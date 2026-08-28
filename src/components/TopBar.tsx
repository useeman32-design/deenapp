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
      {showBack ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <T v="h2" style={{ color: d.emerald, fontSize: 18, lineHeight: 24 }}>‹</T>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <T v="h1" style={{ color: d.text, fontWeight: '800', fontSize: 21 }}>{title}</T>
        {subtitle ? <T v="caption" style={{ marginTop: 2, color: d.faint }}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}
