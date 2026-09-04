import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { shadows } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

/**
 * The DeenLink card.
 * Dark:  subtle emerald gradient with optional soft glow — a premium lift.
 * Light: white / warm card with a soft shadow.
 * Pass padding etc. through `style`; children always sit above the background.
 */
export function Surface({
  children,
  style,
  glow = false,
  soft = false,
  elevated = false,
  solid = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
  soft?: boolean;
  elevated?: boolean;
  solid?: boolean;
}) {
  const { theme, isDark } = useTheme();

  const single = isDark
    ? soft
      ? theme.card
      : theme.card
    : soft
      ? theme.cardSoft
      : theme.card;
  const grad: [string, string, ...string[]] = isDark
    ? soft
      ? [theme.cardSoft, theme.card]
      : [theme.card2, theme.card]
    : [single, single];

  return (
    <View
      style={[
        {
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isDark
            ? glow
              ? 'rgba(212,175,55,0.35)'
              : 'rgba(212,175,55,0.18)'
            : 'rgba(29,111,66,0.16)',
          ...(solid ? { backgroundColor: single } : null),
          ...(elevated ? shadows.dark.float : shadows.light.card),
        },
        style,
      ]}
    >
      {!solid ? (
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}
      {glow && isDark ? (
        <View
          style={{
            position: 'absolute',
            width: 240,
            height: 150,
            borderRadius: 999,
            backgroundColor: theme.glow,
            top: -75,
            right: -70,
          }}
        />
      ) : null}
      <View style={{ position: 'relative', flex: 1 }}>{children}</View>
    </View>
  );
}
