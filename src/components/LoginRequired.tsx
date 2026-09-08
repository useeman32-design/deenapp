import { Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { exitGuest } from '@/lib/guest';
import { haptic } from '@/lib/haptics';

/* pass 80 — the small "require login" popup shown instead of any
 * non-tools module while browsing as a guest. */
export function LoginRequired({ module: mod }: { module: string }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 100 }}>
      <View style={{ width: '100%', maxWidth: 340, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 22, alignItems: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(184,134,11,0.1)' }}>
          <FontAwesome5 name="lock" size={16} color={isDark ? '#D4AF37' : '#B8860B'} />
        </View>
        <T v="body" style={{ fontSize: 15, fontWeight: '900', color: d.text }}>Login required</T>
        <T v="caption" style={{ fontSize: 12, color: d.subtext, textAlign: 'center', lineHeight: 17 }}>
          {mod} needs an account. Sign in or create a free account to continue — worship tools, the Qur'an and Hadith stay free, no login needed.
        </T>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, width: '100%' }}>
          <Pressable
            onPress={() => { haptic.selection(); router.replace('/(tabs)'); }}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, opacity: pressed ? 0.8 : 1 })}
          >
            <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.subtext }}>Cancel</T>
          </Pressable>
          <Pressable
            onPress={() => { haptic.selection(); void exitGuest().then(() => router.push('/(auth)/login')); }}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? '#D4AF37' : '#B8860B', opacity: pressed ? 0.85 : 1 })}
          >
            <T v="bodyS" style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#14241C' : '#fff' }}>Log in</T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
