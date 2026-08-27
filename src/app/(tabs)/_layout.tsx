import { Redirect, Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Floating glassy bottom navigation (Phase 2 design language):
 * pill-shaped, translucent deep-green surface, thin gold hairline,
 * floats above the bottom edge. Same five tabs as the web frontend:
 * Home · Quran & Hadith · Worship Tools · Learning · Profile
 */
export default function TabsLayout() {
  const { ready, user } = useAuth();
  const { theme } = useTheme();
  const d = theme.dash;
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const tabIcon = (fa: keyof typeof FontAwesome5.glyphMap) => ({ focused }: { focused: boolean }) => (
    <FontAwesome5 name={fa} size={19} color={focused ? d.emerald : d.faint} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 16,
          height: 76,
          paddingTop: 9,
          borderRadius: 28,
          backgroundColor: d.navBg,
          borderWidth: 1,
          borderColor: d.cardBorder,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
          backdropFilter: 'blur(20px)',
        },
        tabBarActiveTintColor: d.emerald,
        tabBarInactiveTintColor: d.faint,
        tabBarLabelStyle: {
          fontFamily: 'Poppins-SemiBold',
          fontSize: 9,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="quran" options={{ title: 'Quran & Hadith', tabBarIcon: tabIcon('quran') }} />
      <Tabs.Screen name="tools" options={{ title: 'Worship Tools', tabBarIcon: tabIcon('mosque') }} />
      <Tabs.Screen name="learning" options={{ title: 'Learning', tabBarIcon: tabIcon('graduation-cap') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
