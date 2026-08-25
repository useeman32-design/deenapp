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
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: active ? theme.primary : theme.card,
          borderWidth: 1,
          borderColor: active ? theme.primary : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <T v="caption" color={active ? 'onPrimary' : 'subtext'} style={{ fontWeight: '700' }}>{label}</T>
    </Pressable>
  );
}
