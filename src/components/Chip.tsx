import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';

export function Chip({
  label,
  active = false,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: active ? (isDark ? 'rgba(46,204,113,0.18)' : 'rgba(29,111,66,0.1)') : d.card,
          borderWidth: 1,
          borderColor: active ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <T v="caption" style={{ fontWeight: '700', color: active ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext }}>{label}</T>
    </Pressable>
  );
}
