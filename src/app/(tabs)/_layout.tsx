import type { ComponentType } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  BookIcon,
  GraduationCapIcon,
  HomeIcon,
  MosqueIcon,
  UserIcon,
  type IconProps,
} from '@/components/Icons';

/**
 * Approved DeenLink bottom navigation (same five tabs as the web frontend):
 * Home · Quran & Hadith · Worship Tools · Learning · Profile
 */
export default function TabsLayout() {
  const { ready, user } = useAuth();
  const { theme } = useTheme();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const tabIcon = (Icon: ComponentType<IconProps>) => ({ focused }: { focused: boolean }) => (
    <Icon size={21} color={focused ? theme.primary : theme.subtext} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 62,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtext,
        tabBarLabelStyle: { fontFamily: 'Poppins-SemiBold', fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon(HomeIcon) }} />
      <Tabs.Screen name="quran" options={{ title: 'Quran & Hadith', tabBarIcon: tabIcon(BookIcon) }} />
      <Tabs.Screen name="tools" options={{ title: 'Worship Tools', tabBarIcon: tabIcon(MosqueIcon) }} />
      <Tabs.Screen name="learning" options={{ title: 'Learning', tabBarIcon: tabIcon(GraduationCapIcon) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(UserIcon) }} />
    </Tabs>
  );
}
