import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

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
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      {showBack ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 10 }}>
          <Text style={{ fontSize: 26, color: theme.primary, lineHeight: 30 }}>‹</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: theme.subtext, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
