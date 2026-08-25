import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { TopBar } from '@/components/TopBar';
import {
  BellIcon,
  BookmarkIcon,
  ChevronRightIcon,
  DownloadIcon,
  FlameIcon,
  GearIcon,
  HelpIcon,
  InfoIcon,
  LockIcon,
} from '@/components/Icons';

const MENU = [
  { label: 'Account Settings', icon: GearIcon },
  { label: 'Reminders', icon: BellIcon },
  { label: 'Saved', icon: BookmarkIcon },
  { label: 'Downloads', icon: DownloadIcon },
  { label: 'Privacy', icon: LockIcon },
  { label: 'Help & Support', icon: HelpIcon },
  { label: 'About DeenLink', icon: InfoIcon },
];

export default function Profile() {
  const { theme, mode, setMode } = useTheme();
  const { user, isDemo, logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Profile" />
      <View style={{ padding: 16 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
          }}
        >
          <Avatar name={user?.name ?? 'U'} color={theme.primary} size={54} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: theme.heading, fontSize: 16.5, fontWeight: '800' }}>{user?.name}</Text>
            <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 3 }}>View and edit your profile</Text>
          </View>
          <ChevronRightIcon size={18} color={theme.subtext} />
        </View>

        {/* Streak */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
            marginTop: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.primarySoft, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 }}>
            <FlameIcon size={17} color={theme.accent} />
            <View>
              <Text style={{ color: theme.subtext, fontSize: 10.5, fontWeight: '700' }}>Streak</Text>
              <Text style={{ color: theme.heading, fontSize: 13.5, fontWeight: '800' }}>12 days</Text>
            </View>
          </View>
          <FlameIcon size={26} color={theme.accent} />
        </View>

        {/* Menu */}
        {MENU.map((m) => {
          const Icon = m.icon;
          return (
            <View
              key={m.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                paddingVertical: 13,
                paddingHorizontal: 14,
                marginTop: 8,
              }}
            >
              <Icon size={19} color={theme.primary} />
              <Text style={{ flex: 1, color: theme.text, fontWeight: '700', fontSize: 13.5, marginLeft: 12 }}>
                {m.label}
              </Text>
              <ChevronRightIcon size={16} color={theme.subtext} />
            </View>
          );
        })}

        {/* Appearance */}
        <Text style={{ color: theme.heading, fontSize: 13.5, fontWeight: '800', marginTop: 20, marginBottom: 10 }}>
          Appearance
        </Text>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: theme.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 6,
          }}
        >
          {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: mode === m ? theme.primarySoft : 'transparent',
                borderWidth: 1,
                borderColor: mode === m ? theme.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  color: mode === m ? theme.primary : theme.subtext,
                  fontWeight: '700',
                  fontSize: 12.5,
                  textTransform: 'capitalize',
                }}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        {isDemo ? (
          <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 16, textAlign: 'center', lineHeight: 16 }}>
            🧪 Demo mode — signed in locally. Point EXPO_PUBLIC_API_URL at your PHP backend to go live.
          </Text>
        ) : null}

        <Pressable
          onPress={logout}
          style={{
            backgroundColor: 'rgba(214,69,69,0.08)',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.danger,
            padding: 14,
            alignItems: 'center',
            marginTop: 18,
          }}
        >
          <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 14.5 }}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}
