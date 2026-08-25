import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

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
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 14,
        backgroundColor: theme.background,
      }}
    >
      {showBack ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
          <T v="h2" color="primary" style={{ fontSize: 18 }}>‹</T>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <T v="h1">{title}</T>
        {subtitle ? <T v="caption" style={{ marginTop: 2 }}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}
