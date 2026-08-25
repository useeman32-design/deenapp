import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

const SETTINGS = [
  { icon: '📍', label: 'Location', sub: 'Used for prayer times & Qibla' },
  { icon: '🔔', label: 'Notifications', sub: 'Prayer reminders · coming in v1.1' },
  { icon: 'ℹ️', label: 'About DeenLink', sub: 'All-in-one Islamic app · v0.1' },
];

export default function Profile() {
  const { theme, mode, setMode } = useTheme();
  const { user, isDemo, logout } = useAuth();
  const stats = [
    { label: 'Posts', value: '24' },
    { label: 'Following', value: '12' },
    { label: 'Followers', value: '31' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Profile" />
      <View style={{ padding: 16 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Avatar name={user?.name ?? 'User'} color={theme.primary} size={70} />
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginTop: 12 }}>
            {user?.name}
          </Text>
          <Text style={{ color: theme.subtext, marginTop: 3, fontSize: 13 }}>
            @{user?.username}
            {user?.mizhab ? ` · ${user.mizhab}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            {stats.map((s) => (
              <View key={s.label} style={{ alignItems: 'center', minWidth: 80 }}>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>{s.value}</Text>
                <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {isDemo ? (
          <Card style={{ marginTop: 10, backgroundColor: theme.primarySoft, borderColor: 'transparent' }}>
            <Text style={{ color: theme.text, fontSize: 12.5, lineHeight: 19 }}>
              🧪 <Text style={{ fontWeight: '700' }}>Demo mode.</Text> Your PHP API isn’t reachable from this
              build, so you’re signed in locally. Point{' '}
              <Text style={{ fontFamily: 'monospace' }}>EXPO_PUBLIC_API_URL</Text> at your backend and
              everything goes live.
            </Text>
          </Card>
        ) : null}

        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text, marginTop: 22, marginBottom: 10 }}>
          Appearance
        </Text>
        <Card style={{ flexDirection: 'row' }}>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: mode === m ? theme.primary : theme.border,
                backgroundColor: mode === m ? theme.primarySoft : 'transparent',
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: mode === m ? theme.primary : theme.subtext,
                  fontWeight: '700',
                  fontSize: 13,
                  textTransform: 'capitalize',
                }}
              >
                {m === 'system' ? '☀️ Auto' : m === 'light' ? '☀️ Light' : '🌙 Dark'}
              </Text>
            </Pressable>
          ))}
        </Card>

        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text, marginTop: 22, marginBottom: 10 }}>
          Settings
        </Text>
        {SETTINGS.map((r) => (
          <Card key={r.label} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 19 }}>{r.icon}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{r.label}</Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>{r.sub}</Text>
            </View>
          </Card>
        ))}

        <Pressable
          onPress={logout}
          style={{
            backgroundColor: 'rgba(214,69,69,0.08)',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.danger,
            padding: 14,
            alignItems: 'center',
            marginTop: 14,
          }}
        >
          <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 15 }}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}
