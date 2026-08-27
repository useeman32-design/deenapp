import { Redirect, Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const tabIcon = (fa: keyof typeof FontAwesome5.glyphMap) => ({ focused }: { focused: boolean }) => (
    <FontAwesome5 name={fa} size={19} color={focused ? d.emerald : d.faint} />
  );

  // Two-line, centered label (e.g. "Quran &" / "Hadith") so long names never truncate.
  const tabLabel = (first: string, second: string) => ({ focused }: { focused: boolean }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
      <Text2 line={first} focused={focused} color={d.emerald} faint={d.faint} />
      {second ? <Text2 line={second} focused={focused} color={d.emerald} faint={d.faint} /> : null}
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 16 + insets.bottom,
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
          includeFontPadding: false,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home'), tabBarLabel: tabLabel('Home', '') }} />
      <Tabs.Screen name="quran" options={{ title: 'Quran & Hadith', tabBarIcon: tabIcon('quran'), tabBarLabel: tabLabel('Quran &', 'Hadith') }} />
      <Tabs.Screen name="tools" options={{ title: 'Worship Tools', tabBarIcon: tabIcon('mosque'), tabBarLabel: tabLabel('Worship', 'Tools') }} />
      <Tabs.Screen name="learning" options={{ title: 'Learning', tabBarIcon: tabIcon('graduation-cap'), tabBarLabel: tabLabel('Learning', '') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('user'), tabBarLabel: tabLabel('Profile', '') }} />
    </Tabs>
  );
}

function Text2({ line, focused, color, faint }: { line: string; focused: boolean; color: string; faint: string }) {
  return (
    <Text
      style={{
        fontFamily: 'Poppins-SemiBold',
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.2,
        includeFontPadding: false,
        color: focused ? color : faint,
      }}
    >
      {line}
    </Text>
  );
}
