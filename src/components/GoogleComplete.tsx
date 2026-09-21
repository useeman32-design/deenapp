import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { Alert } from '@/lib/alert';
import { api, GOOGLE_MSG_KEY } from '@/api/client';
import { storage } from '@/lib/storage';
import { AqeedahPicker } from '@/components/AqeedahPicker';
import { useAqeedahOptions } from '@/components/AqeedahPicker';
import { COUNTRIES } from '@/lib/countries';


/**
 * pass 99 — "Complete your information".
 *
 * Google hands us a name and an email. It does NOT give a date of birth, a
 * gender, a username the owner chose, or any password at all — so a Google
 * account is created minimal (`profile_complete = 0`) and this modal finishes
 * it. The password matters: owner — "even password so that he can login even
 * without google". Nothing else in the app is reachable until it is saved, and
 * Save drops him on the Home page.
 *
 * Shown from three signals, all of them server truth:
 *   · the callback redirect  …?google=complete
 *   · api.authMe().user.profile_complete === false (any cold start, any device)
 *   · the signup screen, immediately after the Google round trip
 */

const GENDERS = ['Male', 'Female'];
const TRIBES = ['Hausa', 'Yoruba', 'Igbo', 'General'];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  return (
    <View style={{ marginBottom: 12 }}>
      <T v="caption" style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: d.faint, marginBottom: 5 }}>
        {label.toUpperCase()}
      </T>
      {children}
      {hint ? (
        <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 4 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function GoogleCompleteModal() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const green = isDark ? '#4AE38F' : '#0E7A46';
  const router = useRouter();
  const { user, ready, adoptSession } = useAuth();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [uState, setUState] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [gender, setGender] = useState<string | null>(null);
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [tribe, setTribe] = useState<string | null>(null);
  const [aqeedah, setAqeedah] = useState('Sunni');
  /* the same server-driven list the registration form uses */
  const { options: aqeedahList } = useAqeedahOptions();
  const [aqeedahOther, setAqeedahOther] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const openedOnce = useRef(false);

  /* ── which signal opened it ── */
  const checkNeedsProfile = useCallback(async () => {
    if (!ready || !user) return;
    if ((user as { profile_complete?: boolean }).profile_complete === false) {
      setOpen(true);
      return;
    }
    const needs = await api.googleNeedsProfile().catch(() => false);
    if (needs) setOpen(true);
  }, [ready, user]);

  useEffect(() => {
    void checkNeedsProfile();
  }, [checkNeedsProfile]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const outcome = q.get('google');
    if (!outcome) return;
    const msg = q.get('google_message') || '';
    /* the outcome stays in the URL until we act on it, then it is removed so a
     * refresh does not replay a stale message */
    window.history.replaceState({}, '', window.location.pathname);
    if (outcome === 'complete') {
      setOpen(true);
      if (msg) void storage.setItem(GOOGLE_MSG_KEY, msg).catch(() => {});
    } else if (msg) {
      Alert.alert(outcome === 'error' ? 'Google sign-up' : 'Google', msg);
    }
    if (outcome === 'login' || outcome === 'linked') {
      void api.authMe().then((u) => {
        if (u) void adoptSession(u);
      });
    }
  }, [adoptSession]);

  /* prefill from the account the server just created */
  useEffect(() => {
    if (!open || openedOnce.current) return;
    openedOnce.current = true;
    const u = user as { full_name?: string; email?: string; username?: string } | null;
    if (u?.full_name) setName(String(u.full_name));
    if (u?.email) setEmail(String(u.email));
    const suggested = String(u?.username ?? '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (suggested.length >= 3) setUsername(suggested.slice(0, 20));
  }, [open, user]);

  /* username availability — same endpoint the normal form uses */
  useEffect(() => {
    if (!open) return;
    const u = username.trim();
    if (u.length < 3) {
      setUState('idle');
      return;
    }
    setUState('checking');
    let alive = true;
    const timer = setTimeout(() => {
      void api
        .checkUsernameAvailable(u)
        .then((r: { available?: boolean }) => {
          if (!alive) return;
          setUState(r?.available ? 'ok' : 'taken');
        })
        .catch(() => alive && setUState('idle'));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [username, open]);

  const dobError = useMemo(() => {
    if (!dob) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Use YYYY-MM-DD';
    const dt = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return 'That date does not exist';
    const today = new Date();
    let age = today.getFullYear() - dt.getFullYear();
    const m = today.getMonth() - dt.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dt.getDate())) age -= 1;
    if (dt > today) return 'Date of birth cannot be in the future';
    if (age < 13) return 'You must be at least 13 years old to register';
    if (age > 120) return 'Please check the year';
    return '';
  }, [dob]);

  const pwOk = useMemo(
    () =>
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password),
    [password],
  );

  const save = async () => {
    if (busy) return;
    if (uState !== 'ok') return setError('Please choose an available username');
    if (!gender) return setError('Please select your gender');
    if (!dob || dobError) return setError(dobError || 'Please enter your date of birth');
    if (country.toLowerCase() === 'nigeria' && !tribe) return setError('Please select your tribe');
    if (!pwOk) return setError('Password needs 8+ characters with an upper, lower, number and symbol');
    if (password !== confirm) return setError('Passwords do not match');
    haptic.medium();
    setBusy(true);
    setError('');
    const res = await api.googleComplete({
      username: username.trim(),
      gender: gender.toLowerCase(),
      date_of_birth: dob,
      country: country || undefined,
      tribe: tribe || undefined,
      aqeedah: aqeedah === 'Other' && aqeedahOther.trim() ? aqeedahOther.trim() : aqeedah,
      password,
    });
    setBusy(false);
    if (!res.ok || !res.user) {
      setError(res.message || 'Could not save your details');
      if (res.errors?.username) setUState('taken');
      return;
    }
    haptic.success();
    await adoptSession(res.user);
    setOpen(false);
    Alert.alert('Welcome to DeenLink', res.message || 'Your account is complete.');
    router.replace('/(tabs)' as never);
  };

  if (!open) return null;

  const input = (extra?: object) => ({
    borderRadius: 12,
    borderWidth: 1,
    borderColor: d.cardBorder,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(20,36,28,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: d.text,
    ...(extra || {}),
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(6,18,12,0.55)', justifyContent: 'flex-end' }}>
        <View
          style={{
            maxHeight: '92%',
            backgroundColor: d.bg,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 16,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(212,175,55,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="google" size={15} color="#D4AF37" />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h2" style={{ fontSize: 17, fontWeight: '900' }}>Complete your information</T>
              <T v="caption" style={{ fontSize: 11, color: d.faint }}>
                {name ? `${name}${email ? ` · ${email}` : ''}` : 'Signed in with Google'}
              </T>
            </View>
          </View>
          <T v="caption" style={{ fontSize: 11, lineHeight: 16, color: d.subtext, marginBottom: 12 }}>
            Google gave us your name and email only. Fill the rest to finish your account — the password lets you
            sign in with or without Google.
          </T>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 18 }}>
            <Field label="Username" hint={uState === 'taken' ? 'That one is taken — try another' : 'This is how others see you (@name)'}>
              <TextInput
                value={username}
                onChangeText={(v) => setUsername(v.replace(/[^A-Za-z0-9._]/g, '').toLowerCase())}
                placeholder="e.g. aminu.abubakar"
                placeholderTextColor={d.faint}
                autoCapitalize="none"
                style={input()}
              />
              {uState === 'checking' ? (
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 3 }}>Checking…</T>
              ) : uState === 'ok' ? (
                <T v="caption" style={{ fontSize: 10, color: green, marginTop: 3 }}>Available</T>
              ) : null}
            </Field>

            <Field label="Gender">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {GENDERS.map((g) => {
                  const on = gender === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => { haptic.selection(); setGender(g); }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        borderRadius: 12,
                        borderWidth: 1,
                        paddingVertical: 10,
                        borderColor: on ? green : d.cardBorder,
                        backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.14)' : 'rgba(14,122,70,0.08)') : 'transparent',
                      }}
                    >
                      <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: on ? green : d.subtext }}>{g}</T>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Date of birth" hint="Used for your age in the app — never shown on your profile.">
              <TextInput
                value={dob}
                onChangeText={(v) => setDob(v.replace(/[^0-9-]/g, '').slice(0, 10))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={d.faint}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                style={input()}
              />
              {dob && dobError ? (
                <T v="caption" style={{ fontSize: 10.5, color: '#FF9B6A', marginTop: 4 }}>{dobError}</T>
              ) : null}
            </Field>

            <Field label="Country">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                {COUNTRIES.slice(0, 24).map((c) => {
                  const nm = typeof c === 'string' ? c : String((c as { name?: string }).name ?? '');
                  const on = country === nm;
                  return (
                    <Pressable
                      key={nm}
                      onPress={() => { haptic.selection(); setCountry(nm); setTribe(null); }}
                      style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.14)' : 'rgba(14,122,70,0.08)') : 'transparent' }}
                    >
                      <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: on ? green : d.subtext }}>{nm}</T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Field>

            {country.toLowerCase() === 'nigeria' ? (
              <Field label="Tribe">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {TRIBES.map((t) => {
                    const on = tribe === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => { haptic.selection(); setTribe(t); }}
                        style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.14)' : 'rgba(14,122,70,0.08)') : 'transparent' }}
                      >
                        <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: on ? green : d.subtext }}>{t}</T>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            <AqeedahPicker
              value={aqeedah}
              other={aqeedahOther}
              setValue={setAqeedah}
              setOther={setAqeedahOther}
              nigeria={country.toLowerCase() === 'nigeria'}
              options={aqeedahList}
            />

            <Field label="Password" hint="8+ characters with an uppercase letter, a lowercase letter, a number and a symbol.">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor={d.faint}
                secureTextEntry
                autoCapitalize="none"
                style={input()}
              />
            </Field>

            <Field label="Confirm password">
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter your password"
                placeholderTextColor={d.faint}
                secureTextEntry
                autoCapitalize="none"
                style={input()}
              />
            </Field>

            {error ? (
              <T v="caption" style={{ fontSize: 12, fontWeight: '800', color: '#FF7B7B', marginBottom: 10 }}>{error}</T>
            ) : null}

            <Pressable
              disabled={busy}
              onPress={save}
              style={({ pressed }) => ({
                borderRadius: 14,
                backgroundColor: green,
                paddingVertical: 15,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                opacity: busy || pressed ? 0.85 : 1,
              })}
            >
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="check" size={13} color="#fff" />}
              <T v="button" style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                {busy ? 'Saving…' : 'Save and continue'}
              </T>
            </Pressable>
            <T v="caption" style={{ fontSize: 10, color: d.faint, textAlign: 'center', marginTop: 9 }}>
              You cannot use DeenLink until this is saved — it takes a few seconds.
            </T>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
