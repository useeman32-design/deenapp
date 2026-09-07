import { Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

export function GradientButton({
  label,
  onPress,
  disabled,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: React.CSSProperties | object;
  small?: boolean;
}) {
  const { theme, isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style as object]}
    >
      <LinearGradient
        colors={isDark ? ['#3FB07A', '#2B8557'] : ['#43A86F', '#2E8557']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: small ? 12 : 14,
          paddingVertical: small ? 11 : 15,
          paddingHorizontal: small ? 14 : 20,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: small ? 13.5 : 15.5 }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
