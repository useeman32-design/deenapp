import { ActivityIndicator, View } from 'react-native';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
      <ActivityIndicator size="large" color={theme.primary} />
      <T v="caption">{label}</T>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme.primary }} />
      </View>
      <T v="h3" style={{ marginTop: 14 }}>{title}</T>
      {hint ? <T v="caption" style={{ marginTop: 5, textAlign: 'center', lineHeight: 17 }}>{hint}</T> : null}
    </View>
  );
}
