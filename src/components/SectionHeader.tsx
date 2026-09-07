import { Pressable, View } from 'react-native';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';

export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  style,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  style?: object;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, ...style }}>
      <View style={{ flex: 1 }}>
        <T v="h2">{title}</T>
        {subtitle ? <T v="caption" style={{ marginTop: 2 }}>{subtitle}</T> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={6}>
          <T v="caption" color="primary" style={{ fontWeight: '700' }}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}
