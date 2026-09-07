import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  busy?: boolean;
  icon?: keyof typeof FontAwesome5.glyphMap;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * In-app confirmation sheet (works on web + native — unlike Alert.alert, which
 * doesn't render on the web build). Used for logout, delete, etc.
 */
export function ConfirmDialog({
  visible, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', busy = false, icon, onCancel, onConfirm,
}: Props) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const accent = tone === 'danger' ? '#E8726B' : (isDark ? '#4AE38F' : '#1D6F42');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ width: '100%', maxWidth: 360, borderRadius: 22, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? '#0C1712' : '#FFFFFF', padding: 22 }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: `${accent}1A`, borderWidth: 1, borderColor: `${accent}55`, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <FontAwesome5 name={icon ?? (tone === 'danger' ? 'exclamation-triangle' : 'question-circle')} size={20} color={accent} />
          </View>
          <Text style={{ color: d.text, fontFamily: 'Poppins-SemiBold', fontSize: 18, fontWeight: '800', lineHeight: 24 }}>{title}</Text>
          {message ? <T v="bodyS" style={{ color: d.subtext, fontSize: 13, lineHeight: 20, marginTop: 8 }}>{message}</T> : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <Pressable
              onPress={() => { haptic.light(); onCancel(); }}
              disabled={busy}
              style={{ flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.card, paddingVertical: 13, alignItems: 'center' }}
            >
              <Text style={{ color: d.subtext, fontFamily: 'Poppins-SemiBold', fontSize: 14, fontWeight: '700' }}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => { haptic.light(); onConfirm(); }}
              disabled={busy}
              style={{ flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: `${accent}66`, backgroundColor: `${accent}1F`, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {busy ? <ActivityIndicator size="small" color={accent} /> : null}
              <Text style={{ color: accent, fontFamily: 'Poppins-SemiBold', fontSize: 14, fontWeight: '800' }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
