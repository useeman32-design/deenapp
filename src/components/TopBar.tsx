import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { BackButton } from '@/components/BackButton';

export function TopBar({
  title,
  subtitle,
  showBack = false,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 14,
        backgroundColor: d.bg,
      }}
    >
      {showBack ? <View style={{ marginRight: 12 }}><BackButton /></View> : null}
      <View style={{ flex: 1 }}>
        <T v="h1" style={{ color: d.text, fontWeight: '800', fontSize: 21 }}>{title}</T>
        {subtitle ? <T v="caption" style={{ marginTop: 2, color: d.faint }}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}
