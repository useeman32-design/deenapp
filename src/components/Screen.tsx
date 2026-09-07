import { ScrollView, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function Screen({
  children,
  style,
  scroll = true,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
  padded?: boolean;
}) {
  const { theme } = useTheme();
  const padding = padded ? 16 : 0;
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding, paddingBottom: 48 }}>{children}</View>
      )}
    </View>
  );
}
