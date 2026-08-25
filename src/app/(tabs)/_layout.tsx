import { Redirect, Tabs } from 'expo-router';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { BookIcon, HomeIcon, MosqueIcon, UserIcon, UsersIcon, type IconProps } from '@/components/Icons';

export default function TabsLayout() {
  const { ready, user } = useAuth();
  const { theme } = useTheme();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const tabIcon = (Icon: ComponentType<IconProps>) => ({ focused }: { focused: boolean }) => (
    <Icon size={23} color={focused ? theme.primary : theme.subtext} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border, height: 64, paddingTop: 6 },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtext,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
                shadowOpacity: 0.25,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              <MosqueIcon size={27} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: tabIcon(UsersIcon) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(UserIcon) }} />
    </Tabs>
  );
}
