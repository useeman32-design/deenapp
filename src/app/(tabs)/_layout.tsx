import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function TabsLayout() {
  const { ready, user } = useAuth();
  const { theme } = useTheme();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const icon = (emoji: string) => ({ size }: { size: number }) => (
    <Text style={{ fontSize: size - 3 }}>{emoji}</Text>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtext,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="quran" options={{ title: 'Quran', tabBarIcon: icon('📖') }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools', tabBarIcon: icon('🧭') }} />
      <Tabs.Screen name="videos" options={{ title: 'Videos', tabBarIcon: icon('🎬') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
