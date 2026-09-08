import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { exitGuest, setLoginModalHandler } from '@/lib/guest';
import { haptic } from '@/lib/haptics';

/* pass 83-6 — the "Login required" dialog for guest actions on ANY screen.
 * RN's Alert.alert is a silent no-op on web (that is why the pass-80 alert
 * never appeared in the PWA), so guests get this styled modal instead —
 * same card design as the LoginRequired screen. Mounted once in _layout. */
export function LoginModalHost() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    setLoginModalHandler((m) => setMsg(m ?? 'Sign in or create a free account to use this feature.'));
    return () => setLoginModalHandler(null);
  }, []);
  return (
    <Modal visible={!!msg} transparent animationType="fade" onRequestClose={() => setMsg(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ width: '100%', maxWidth: 340, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 22, alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(184,134,11,0.1)' }}>
            <FontAwesome5 name="lock" size={16} color={isDark ? '#D4AF37' : '#B8860B'} />
          </View>
          <T v="body" style={{ fontSize: 15, fontWeight: '900', color: d.text }}>Login required</T>
          <T v="caption" style={{ fontSize: 12, color: d.subtext, textAlign: 'center', lineHeight: 17 }}>{msg}</T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, width: '100%' }}>
            <Pressable
              onPress={() => { haptic.selection(); setMsg(null); }}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, opacity: pressed ? 0.8 : 1 })}
            >
              <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.subtext }}>Cancel</T>
            </Pressable>
            <Pressable
              onPress={() => { haptic.selection(); setMsg(null); void exitGuest().then(() => router.push('/(auth)/login')); }}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? '#D4AF37' : '#B8860B', opacity: pressed ? 0.85 : 1 })}
            >
              <T v="bodyS" style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#14241C' : '#fff' }}>Log in</T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
