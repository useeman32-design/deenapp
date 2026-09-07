import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { exitGuest, registerGuestPrompt } from '@/lib/guest';

/* pass 82 — the "Require login" dialog guests get when tapping a locked
 * action or module. Mounted once at the app root (web + native). */
export function GuestLoginModal() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    registerGuestPrompt((m) => setMsg(m ?? 'Sign in or create a free account to use this feature.'));
    return () => registerGuestPrompt(null);
  }, []);

  return (
    <Modal visible={msg !== null} transparent animationType="fade" onRequestClose={() => setMsg(null)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setMsg(null)}>
        <Pressable style={{ width: 300, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 20, gap: 12 }} onPress={() => undefined}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="lock" size={16} color={isDark ? '#4AE38F' : '#0E7A46'} />
          </View>
          <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text }}>Login required</T>
          <T v="bodyS" style={{ fontSize: 12.5, color: d.subtext, lineHeight: 18 }}>{msg}</T>
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 4 }}>
            <Pressable onPress={() => setMsg(null)} accessibilityLabel="cancel login prompt"
              style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', paddingVertical: 11 }}>
              <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.subtext }}>Cancel</T>
            </Pressable>
            <Pressable
              accessibilityLabel="go to login"
              onPress={() => {
                haptic.light();
                setMsg(null);
                void exitGuest().then(() => router.push('/(auth)/login'));
              }}
              style={{ flex: 1, borderRadius: 12, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', alignItems: 'center', paddingVertical: 11 }}
            >
              <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: '#fff' }}>Log in</T>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
