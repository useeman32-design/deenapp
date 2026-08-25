import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>{title}</Text>
      {action}
    </View>
  );
}
