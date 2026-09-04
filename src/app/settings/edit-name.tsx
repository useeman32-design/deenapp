import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';

export default function EditName() {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState((user?.full_name as string) ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const names = name.trim().split(/\s+/).filter(Boolean);
  const valid = names.length >= 2;

  const save = async () => {
    setErr('');
    if (!valid) { setErr('Please enter at least two names (a single name isn’t allowed).'); return; }
    if (busy) return;
    setBusy(true);
    const res = await api.updateProfile({ full_name: name.trim() });
    setBusy(false);
    if (res.ok) {
      haptic.success();
      updateUser({ full_name: name.trim() });
      router.back();
    } else {
      // The server enforces the "twice within 14 days" limit and returns the message.
      setErr(res.message ?? 'Could not save — check your connection.');
    }
  };

  const field = { backgroundColor: theme.cardSoft, borderRadius: 12, borderWidth: 1, borderColor: err ? '#E8726B' : theme.border, paddingHorizontal: 13, paddingVertical: 12, fontFamily: 'Poppins-Medium', fontSize: 16, color: theme.text } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Edit name" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <T v="meta" style={{ letterSpacing: 0.6, marginBottom: 6 }}>FULL NAME</T>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="First and last name"
          placeholderTextColor={theme.subtext}
          style={field}
        />
        <T v="bodyS" style={{ color: theme.subtext, fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
          Help people discover your profile by using the name that you're known by: either your full name, nickname or business name. You can only change your name twice within 14 days.
        </T>
        {name.trim() && !valid ? (
          <T v="meta" style={{ color: '#E8726B', marginTop: 6 }}>Your name needs at least two words.</T>
        ) : null}
        {err ? <T v="meta" style={{ color: '#E8726B', marginTop: 8 }}>{err}</T> : null}

        <Pressable
          onPress={save}
          disabled={busy || !valid}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 13, padding: 14, marginTop: 20, opacity: pressed || busy || !valid ? 0.6 : 1 })}
        >
          <T v="button" color="onPrimary">{busy ? 'Saving…' : 'Save name'}</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
