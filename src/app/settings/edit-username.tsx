import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';

export default function EditUsername() {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const current = (user?.username as string) ?? '';
  const [username, setUsername] = useState(current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [avail, setAvail] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');

  const onChange = (t: string) => setUsername(t.toLowerCase().replace(/\s+/g, ''));
  const clean = username.trim();
  const validLen = clean.length >= 4;
  const changed = clean !== current;

  useEffect(() => {
    if (!changed || !validLen) { setAvail('idle'); return; }
    setAvail('checking');
    const t = setTimeout(() => {
      api.checkUsernameAvailable(clean).then((r) => setAvail(r.available ? 'ok' : 'taken'));
    }, 450);
    return () => clearTimeout(t);
  }, [clean, changed, validLen]);

  const save = async () => {
    setErr('');
    if (!validLen) { setErr('Username must be at least 4 characters.'); return; }
    if (avail === 'taken') { setErr('That username is already taken.'); return; }
    if (busy || !changed) return;
    setBusy(true);
    const res = await api.updateProfile({ username: clean });
    setBusy(false);
    if (res.ok) {
      haptic.success();
      updateUser({ username: clean });
      router.back();
    } else {
      // The server enforces the "twice within 14 days" limit and returns the message.
      setErr(res.message ?? 'Could not save — check your connection.');
    }
  };

  const field = { backgroundColor: theme.cardSoft, borderRadius: 12, borderWidth: 1, borderColor: err || avail === 'taken' ? '#E8726B' : theme.border, paddingHorizontal: 13, paddingVertical: 12, fontFamily: 'Poppins-Medium', fontSize: 16, color: theme.text } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Edit username" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <T v="meta" style={{ letterSpacing: 0.6, marginBottom: 6 }}>USERNAME</T>
        <TextInput
          value={username}
          onChangeText={onChange}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={theme.subtext}
          style={field}
        />
        <T v="bodyS" style={{ color: theme.subtext, fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
          Your username is how friends find and tag you on DeenLink. Use lowercase letters — at least 4 characters. You can only change it twice within 14 days.
        </T>
        {clean && !validLen ? <T v="meta" style={{ color: '#E8726B', marginTop: 6 }}>At least 4 characters.</T> : null}
        {changed && validLen && avail === 'checking' ? <T v="meta" style={{ color: theme.subtext, marginTop: 6 }}>Checking availability…</T> : null}
        {changed && validLen && avail === 'ok' ? <T v="meta" style={{ color: theme.primary, marginTop: 6 }}>✓ Available</T> : null}
        {changed && validLen && avail === 'taken' ? <T v="meta" style={{ color: '#E8726B', marginTop: 6 }}>Already taken.</T> : null}
        {err ? <T v="meta" style={{ color: '#E8726B', marginTop: 8 }}>{err}</T> : null}

        <Pressable
          onPress={save}
          disabled={busy || !changed || !validLen || avail === 'taken'}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 13, padding: 14, marginTop: 20, opacity: pressed || busy || !changed || !validLen ? 0.6 : 1 })}
        >
          <T v="button" color="onPrimary">{busy ? 'Saving…' : 'Save username'}</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
