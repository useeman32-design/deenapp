import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';

export default function ChangeEmail() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const current = (user?.email as string) ?? '';
  const sq1 = (user?.security_question as string) ?? '';
  const sq2 = (user?.security_question_2 as string) ?? '';
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(next.trim()) && next.trim().toLowerCase() !== current.toLowerCase();

  const send = async () => {
    if (!valid || busy) return;
    setBusy(true); setMsg('');
    const r = await api.requestEmailChange(current, next.trim());
    setBusy(false);
    if (r.ok) { setDone(true); setMsg('We sent a verification link to your current email. Open it to confirm the change.'); }
    else setMsg(r.message ?? 'Could not start the email change — check your connection.');
  };

  const field = { backgroundColor: theme.cardSoft, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 12, fontFamily: 'Poppins-Medium', fontSize: 16, color: theme.text } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Change email" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <T v="meta" style={{ letterSpacing: 0.6, marginBottom: 6 }}>CURRENT EMAIL</T>
        <View style={{ ...field, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <FontAwesome5 name="envelope" size={13} color={theme.subtext} />
          <T v="bodyS" style={{ fontSize: 15, color: theme.subtext, flex: 1 }} numberOfLines={1}>{current || '—'}</T>
        </View>

        <T v="bodyS" style={{ color: theme.subtext, fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
          To change your email, we'll send a verification link to your current address. Confirm it there, then the new email becomes active.
        </T>

        <T v="meta" style={{ letterSpacing: 0.6, marginBottom: 6 }}>NEW EMAIL</T>
        <TextInput value={next} onChangeText={setNext} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholderTextColor={theme.subtext} style={field} />

        <Pressable onPress={send} disabled={!valid || busy} style={({ pressed }) => ({ alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, borderRadius: 13, padding: 14, marginTop: 16, opacity: pressed || !valid || busy ? 0.6 : 1 })}>
          <T v="button" color="onPrimary">{busy ? 'Sending…' : 'Send verification link'}</T>
        </Pressable>

        {msg ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: done ? 'rgba(74,227,143,0.1)' : 'rgba(232,114,107,0.08)', borderWidth: 1, borderColor: done ? 'rgba(74,227,143,0.4)' : 'rgba(232,114,107,0.3)' }}>
            <FontAwesome5 name={done ? 'check-circle' : 'exclamation-circle'} size={13} color={done ? '#4AE38F' : '#E8726B'} />
            <T v="meta" style={{ flex: 1, color: done ? '#4AE38F' : '#E8726B' }}>{msg}</T>
          </View>
        ) : null}

        <View style={{ marginTop: 22, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <FontAwesome5 name="question-circle" size={13} color={theme.primary} />
            <T v="body" style={{ fontWeight: '700', fontSize: 13, color: theme.text }}>Lost access to your email?</T>
          </View>
          {sq1 || sq2 ? (
            <View style={{ gap: 6, marginBottom: 6 }}>
              <T v="meta" style={{ color: theme.subtext, textTransform: 'none', letterSpacing: 0, lineHeight: 16 }}>Your security questions are set. Answer them to recover your account:</T>
              {sq1 ? <T v="bodyS" style={{ fontSize: 12.5, color: theme.text }}>• {sq1}</T> : null}
              {sq2 ? <T v="bodyS" style={{ fontSize: 12.5, color: theme.text }}>• {sq2}</T> : null}
            </View>
          ) : (
            <T v="meta" style={{ color: theme.subtext, lineHeight: 16, textTransform: 'none', letterSpacing: 0 }}>
              You haven't set security questions yet. Add them in Edit Profile so you can recover your account if you lose access to this email.
            </T>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
