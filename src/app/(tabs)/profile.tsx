import { Pressable, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
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
  MedalIcon,
  TargetIcon,
} from '@/components/Icons';

const SECTIONS: { title: string; items: { label: string; icon: typeof GearIcon }[] }[] = [
  {
    title: 'Account',
    items: [
      { label: 'Account settings', icon: GearIcon },
      { label: 'Reminders', icon: BellIcon },
      { label: 'Saved', icon: BookmarkIcon },
      { label: 'Downloads', icon: DownloadIcon },
    ],
  },
  {
    title: 'Privacy & support',
    items: [
      { label: 'Privacy', icon: LockIcon },
      { label: 'Help & support', icon: HelpIcon },
      { label: 'About DeenLink', icon: InfoIcon },
    ],
  },
];

export default function Profile() {
  const { theme, mode, setMode } = useTheme();
  const { user, isDemo, logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Profile" />
      <View style={{ padding: 16 }}>
        {/* Header */}
        <Surface style={{ flexDirection: 'row', alignItems: 'center', padding: 15 }}>
          <Avatar name={user?.name ?? 'U'} color={theme.primary} size={54} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T v="h2">{user?.name ?? 'DeenLink User'}</T>
            <T v="caption" style={{ marginTop: 3 }}>View and edit your profile</T>
          </View>
          <ChevronRightIcon size={17} color={theme.subtext} />
        </Surface>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 10 }}>
          {[
            { icon: <FlameIcon size={16} color={theme.accent} />, tile: theme.accentSoft, value: '12', label: 'Day streak' },
            { icon: <TargetIcon size={16} color={theme.primary} />, tile: theme.primarySoft, value: '63%', label: 'Goals met' },
            { icon: <MedalIcon size={16} color={theme.accent} />, tile: theme.accentSoft, value: '3', label: 'Awards' },
          ].map((s) => (
            <Surface key={s.label} style={{ flex: 1, alignItems: 'center', padding: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: s.tile, alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </View>
              <T v="stat" style={{ marginTop: 7, fontSize: 17 }}>{s.value}</T>
              <T v="caption" style={{ marginTop: 1 }}>{s.label}</T>
            </Surface>
          ))}
        </View>

        {/* Menu sections */}
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={{ marginTop: 18 }}>
            <T v="meta" uppercase style={{ marginBottom: 9, letterSpacing: 1.2 }}>{sec.title}</T>
            <Surface style={{ overflow: 'hidden' }}>
              {sec.items.map((m, i) => {
                const Icon = m.icon;
                return (
                  <View
                    key={m.label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 13,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: theme.border,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={theme.primary} />
                    </View>
                    <T v="bodyS" style={{ flex: 1, marginLeft: 12, fontWeight: '600' }}>{m.label}</T>
                    <ChevronRightIcon size={15} color={theme.subtext} />
                  </View>
                );
              })}
            </Surface>
          </View>
        ))}

        {/* Appearance */}
        <T v="meta" uppercase style={{ marginTop: 18, marginBottom: 9, letterSpacing: 1.2 }}>Appearance</T>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: theme.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 5,
          }}
        >
          {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 9,
                alignItems: 'center',
                backgroundColor: mode === m ? theme.primarySoft : 'transparent',
                borderWidth: 1,
                borderColor: mode === m ? theme.primary : 'transparent',
              }}
            >
              <T v="caption" color={mode === m ? 'primary' : 'subtext'} style={{ textTransform: 'capitalize', fontWeight: '700' }}>
                {m}
              </T>
            </Pressable>
          ))}
        </View>

        {isDemo ? (
          <T v="caption" style={{ marginTop: 16, textAlign: 'center', lineHeight: 17 }}>
            🧪 Demo mode — signed in locally. Point EXPO_PUBLIC_API_URL at your PHP backend to go live.
          </T>
        ) : null}

        <Pressable
          onPress={logout}
          style={({ pressed }) => ({
            borderRadius: 14,
            borderWidth: 1.2,
            borderColor: theme.danger,
            padding: 13,
            alignItems: 'center',
            marginTop: 18,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <T v="button" color="danger">Sign out</T>
        </Pressable>
      </View>
    </View>
  );
}
