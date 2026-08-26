import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { InputField } from '@/components/InputField';
import { CheckIcon, LockIcon, MailIcon, MoonStarIcon, UserIcon } from '@/components/Icons';

const AQEEDAH = ['Sunni', 'Shia', 'Ahmadiyya', 'Other'];

export default function Register() {
  const { theme, isDark } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [aqeedah, setAqeedah] = useState('Sunni');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (password && confirm && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!password) {
      setError('Please enter a password');
      return;
    }
    setBusy(true);
    const res = await register({
      full_name: name.trim(),
      username: username.trim() || name.trim().split(/\s+/)[0].toLowerCase(),
      email: email.trim() || 'demo@deenlink.org',
      password,
      aqeedah,
    });
    if (res.ok) router.replace('/(tabs)');
    else {
      setError(res.message || 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Green header */}
      <View style={{ height: 150, position: 'relative', overflow: 'hidden' }}>
        <LinearGradient
          colors={(isDark
            ? ['rgba(46,204,113,0.95)', 'rgba(39,174,96,0.9)']
            : ['rgba(29,111,66,0.92)', 'rgba(29,111,66,0.85)']) as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 16, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <MoonStarIcon size={18} color="rgba(255,255,255,0.9)" />
        </View>
        <View style={{ position: 'absolute', top: 56, left: 0, right: 0, alignItems: 'center' }}>
          <T v="display" color="onPrimary" style={{ fontSize: 26 }}>
            DeenLink
          </T>
          <T v="body" color="onPrimary" style={{ opacity: 0.9, marginTop: 6, fontSize: 14 }}>
            All-in-one Islamic App
          </T>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.border,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 4,
              marginTop: -40,
            }}
          >
            {/* Tabs */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18, borderBottomWidth: 3, borderBottomColor: 'transparent' }}>
                <Link href="/(auth)/login" asChild>
                  <T v="h3" color="subtext" style={{ fontWeight: '600', fontSize: 16 }}>
                    Login
                  </T>
                </Link>
              </View>
              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18, borderBottomWidth: 3, borderBottomColor: theme.primary }}>
                <T v="h3" color="primary" style={{ fontWeight: '600', fontSize: 16 }}>
                  Register
                </T>
              </View>
            </View>

            <View style={{ padding: 20 }}>
              <T v="h1" style={{ fontSize: 20 }}>
                Create your account
              </T>
              <T v="caption" style={{ marginTop: 4, marginBottom: 20 }}>
                Start your journey with DeenLink
              </T>

              <InputField
                label="Full name"
                value={name}
                onChangeText={setName}
                icon={UserIcon}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
              <InputField
                label="Username"
                value={username}
                onChangeText={setUsername}
                icon={UserIcon}
                placeholder="your_username"
                autoCapitalize="none"
                style={{ marginTop: 14 }}
              />
              <InputField
                label="Email"
                value={email}
                onChangeText={setEmail}
                icon={MailIcon}
                placeholder="you@example.com"
                keyboardType="email-address"
                style={{ marginTop: 14 }}
              />
              <InputField
                label="Password"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError('');
                }}
                icon={LockIcon}
                secure
                placeholder="Create a password"
                style={{ marginTop: 14 }}
              />
              <InputField
                label="Confirm password"
                value={confirm}
                onChangeText={(t) => {
                  setConfirm(t);
                  setError('');
                }}
                icon={LockIcon}
                secure
                placeholder="Confirm your password"
                returnKeyType="done"
                style={{ marginTop: 14 }}
                error={error || undefined}
              />

              {/* Aqeedah selector (web uses a dropdown) */}
              <T v="caption" style={{ fontWeight: '500', marginTop: 16, marginBottom: 8 }}>
                Aqeedah
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {AQEEDAH.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAqeedah(a)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: aqeedah === a ? theme.primary : theme.cardSoft,
                      borderWidth: 1,
                      borderColor: aqeedah === a ? theme.primary : theme.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <T v="caption" color={aqeedah === a ? 'onPrimary' : 'text'} style={{ fontWeight: '600' }}>
                      {a}
                    </T>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={() => setAgree((a) => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 }} hitSlop={6}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    backgroundColor: agree ? theme.primary : 'transparent',
                    borderWidth: 1.5,
                    borderColor: agree ? theme.primary : theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {agree ? <CheckIcon size={11} color="#fff" strokeWidth={3} /> : null}
                </View>
                <T v="caption" style={{ flex: 1, lineHeight: 17 }}>
                  I agree to the{' '}
                  <T v="caption" color="primary" style={{ fontWeight: '700' }}>
                    Terms & Conditions
                  </T>{' '}
                  and{' '}
                  <T v="caption" color="primary" style={{ fontWeight: '700' }}>
                    Privacy Policy
                  </T>
                </T>
              </Pressable>

              <Pressable
                onPress={submit}
                disabled={busy || !agree}
                style={({ pressed }) => ({
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  padding: 15,
                  alignItems: 'center',
                  marginTop: 18,
                  opacity: pressed || !agree ? 0.6 : 1,
                })}
              >
                <T v="button" color="onPrimary" style={{ fontWeight: '700', fontSize: 15 }}>
                  {busy ? 'Creating…' : 'Sign Up'}
                </T>
              </Pressable>

              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
                <T v="caption">Already have an account?</T>
                <Link href="/(auth)/login" asChild>
                  <T v="caption" color="primary" style={{ fontWeight: '700', marginLeft: 5 }}>
                    Log in
                  </T>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
