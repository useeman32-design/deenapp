import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';

/**
 * pass 40 — ONE back button for the whole app (the old ones were mixed ‹
 * text glyphs of different sizes). 38×38 glass circle + chevron, haptic tap.
 * `onDark` for the PageHero photo headers, plain themed elsewhere.
 */
export function BackButton({ onDark = false, label = 'back' }: { onDark?: boolean; label?: string }) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => { haptic.light(); if (router.canGoBack()) router.back(); else router.replace('/(tabs)' as never); }}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: onDark ? 'rgba(255,255,255,0.13)' : theme.card,
        borderWidth: 1,
        borderColor: onDark ? 'rgba(255,255,255,0.25)' : theme.border,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: onDark ? 0.25 : 0,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <FontAwesome5 name="chevron-left" size={14} color={onDark ? '#FFFFFF' : isDark ? '#4AE38F' : '#1D6F42'} />
    </Pressable>
  );
}
