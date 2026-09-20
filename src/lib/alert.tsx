import { useEffect, useState } from 'react';
import {
  Alert as RNAlert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';

/**
 * pass 97 — the single reason a whole class of taps "did nothing".
 *
 * `Alert.alert` is a NO-OP on react-native-web: no dialog, no error, no
 * console entry. This app's web build (app.deenlink.org) IS the PWA the owner
 * uses, so every confirm/report/choice that lived inside an Alert was dead on
 * arrival there:
 *
 *   · reporting a comment (reason picker) and reporting a message request,
 *   · "Report this account?" and its reason list,
 *   · deleting a comment/reply/chat message,
 *   · accepting a message request, blocking an account,
 *   · every failure toast ("Could not delete", "Could not unblock"…).
 *
 * This module keeps the exact `Alert.alert(title, message, buttons)` API — so
 * every existing call site keeps working and native keeps the OS dialog — and
 * renders a styled in-app sheet on web, where the OS dialog does not exist.
 * Buttons keep their `style: 'cancel' | 'destructive' | 'default'` meaning and
 * their `onPress` fires after the sheet closes.
 */

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type QueueItem = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

let push: ((item: Omit<QueueItem, 'id'>) => void) | null = null;
let nextId = 1;

/** The in-app host registers itself here (mounted once in the root layout). */
export function setAlertHost(fn: ((item: Omit<QueueItem, 'id'>) => void) | null): void {
  push = fn;
}

/** True when the styled sheet is available (web). */
export const usesInAppAlerts = Platform.OS === 'web';

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    /* native: the OS dialog is the right UI and already handles the cap of
     * three buttons, the cancel slot and the keyboard dismissal */
    if (Platform.OS !== 'web') {
      RNAlert.alert(title, message, buttons as never);
      return;
    }
    const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
    if (!push) {
      /* host not mounted yet (very early boot) — never swallow the tap */
      RNAlert.alert(title, message, list as never);
      return;
    }
    push({ title, message, buttons: list });
  },
};

/** Mounted once in the root layout. Renders the queued sheet. */
export function AlertHost(): React.ReactElement | null {
  const { isDark } = useTheme();
  const [item, setItem] = useState<QueueItem | null>(null);

  useEffect(() => {
    setAlertHost((q) => setItem({ ...q, id: nextId++ }));
    return () => setAlertHost(null);
  }, []);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const cancel = item.buttons.find((b) => b.style === 'cancel');
        setItem(null);
        cancel?.onPress?.();
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    };
  }, [item]);

  if (!item) return null;

  const card = isDark ? '#12211A' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.12)';
  const text = isDark ? '#F2F7F3' : '#14241C';
  const sub = isDark ? 'rgba(242,247,243,0.72)' : 'rgba(20,36,28,0.66)';
  const many = item.buttons.length > 3;

  const close = (b?: AlertButton) => {
    setItem(null);
    b?.onPress?.();
  };

  const toneOf = (b: AlertButton) =>
    b.style === 'destructive'
      ? '#E05252'
      : b.style === 'cancel'
        ? sub
        : isDark
          ? '#4AE38F'
          : '#1D6F42';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(item.buttons.find((b) => b.style === 'cancel'))}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', alignItems: 'center', justifyContent: 'center', padding: 26 }}
        onPress={() => close(item.buttons.find((b) => b.style === 'cancel'))}
      >
        <Pressable
          onPress={() => {
            /* swallow — taps inside the card must not close it */
          }}
          style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '80%',
            borderRadius: 18,
            backgroundColor: card,
            borderWidth: 1,
            borderColor: border,
            overflow: 'hidden',
          }}
        >
          <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 }}>
            <T v="h3" style={{ fontSize: 15.5, fontWeight: '800', color: text }}>
              {item.title}
            </T>
            {item.message ? (
              <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 19, color: sub, marginTop: 7 }}>
                {item.message}
              </T>
            ) : null}
          </View>

          {/* a reason list can be long (report = 5) — scroll it, never clip it */}
          <ScrollView style={{ maxHeight: many ? 320 : undefined }} showsVerticalScrollIndicator={many}>
            {item.buttons.map((b, i) => (
              <Pressable
                key={`${b.text ?? 'ok'}-${i}`}
                onPress={() => {
                  haptic.selection();
                  close(b);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 18,
                  paddingVertical: many ? 13 : 15,
                  borderTopWidth: 1,
                  borderTopColor: border,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                {b.style === 'destructive' ? (
                  <FontAwesome5 name="trash-alt" size={12} color={toneOf(b)} />
                ) : null}
                <T
                  v="bodyS"
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: b.style === 'cancel' ? '600' : '800',
                    color: toneOf(b),
                  }}
                >
                  {b.text ?? 'OK'}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
