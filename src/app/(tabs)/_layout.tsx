import type { ComponentType } from 'react';
import { View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { BookIcon, HomeIcon, MosqueIcon, UserIcon, UsersIcon, type IconProps } from '@/components/Icons';

export default function TabsLayout() {
  const { ready, user } = useAuth();
  const { theme, isDark } = useTheme();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const tabIcon = (Icon: ComponentType<IconProps>) => ({ focused }: { focused: boolean }) => (
    <View
      style={{
        width: 46,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? theme.primarySoft : 'transparent',
      }}
    >
      <Icon size={21} color={focused ? theme.primary : theme.subtext} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: isDark ? 1 : 0,
          borderTopColor: theme.border,
          height: 62,
          paddingTop: 4,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtext,
        tabBarLabelStyle: { fontFamily: 'Manrope', fontSize: 10, fontWeight: '700', marginTop: -2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon(HomeIcon) }} />
      <Tabs.Screen name="quran" options={{ title: 'Quran', tabBarIcon: tabIcon(BookIcon) }} />
      <Tabs.Screen
        name="qibla"
        options={{
          title: 'Qibla',
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -22,
                borderWidth: 4,
                borderColor: theme.card,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 10,
              }}
            >
              <MosqueIcon size={26} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: tabIcon(UsersIcon) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(UserIcon) }} />
    </Tabs>
  );
}
