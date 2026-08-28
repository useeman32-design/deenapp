import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { AuthShell, AuthHeading, AuthField, AuthPrimaryButton, AuthGoogleButton, AuthOrDivider, AuthSwitchLine } from '@/components/AuthShell';

const AQEEDAH = ['Sunni', 'Sufi', 'Shia', 'Other'];

/**
 * Register — mirrors the pass-12 login design: brand background, "Create
 * your account", name/email/password, aqeedah chips, emerald Sign Up,
 * Google pill (demo), switch-to-login line.
 */
export default function Register() {
  const { isDark } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [aqeedah, setAqeedah] = useState('Sunni');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setBusy(true);
    const res = await register({
      full_name: name.trim(),
      username: name.trim().split(/\s+/)[0].toLowerCase(),
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

  const googleDemo = async () => {
    if (busy) return;
    setBusy(true);
    const res = await register({
      full_name: name.trim() || 'Demo User',
      username: 'demo',
      email: 'demo@deenlink.org',
      password: 'demo1234',
      aqeedah,
    });
    if (res.ok) router.replace('/(tabs)');
    else {
      setError(res.message || 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <View style={{ paddingHorizontal: 26, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 2 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(2,59,42,0.7)' : 'rgba(255,255,255,0.9)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.1)',
              marginRight: 12,
            }}
          >
            <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#F2F7F3' : '#14241C'} />
          </Pressable>
        </View>

        <AuthHeading title="Create your account" sub="Join the community — it takes less than a minute" />

        <AuthField label="Full name" value={name} onChangeText={setName} placeholder="e.g. Aminu Abubakar" icon="user" autoCap="words" />
        <AuthField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" icon="envelope" keyboard="email-address" />
        <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" icon="lock" secure />

        {/* aqeedah chips */}
        <View style={{ marginBottom: 16 }}>
          <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)', marginBottom: 7 }}>
            AQEEDAH
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AQEEDAH.map((a) => {
              const on = aqeedah === a;
              return (
                <Pressable
                  key={a}
                  onPress={() => { haptic.selection(); setAqeedah(a); }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: on ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)',
                    backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.15)' : 'rgba(29,111,66,0.09)') : isDark ? 'rgba(2,59,42,0.6)' : 'rgba(255,255,255,0.85)',
                    paddingHorizontal: 13,
                    paddingVertical: 7,
                  }}
                >
                  {on ? <FontAwesome5 name="check" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                  <T v="caption" style={{ color: on ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(242,247,243,0.75)' : 'rgba(20,36,28,0.75)', fontWeight: '700', fontSize: 11.5 }}>
                    {a}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <T v="caption" style={{ color: '#FF7B7B', fontWeight: '700', fontSize: 12, marginBottom: 10 }}>
            {error}
          </T>
        ) : null}

        <AuthPrimaryButton label="Sign Up" busy={busy} onPress={submit} />

        <AuthOrDivider />

        <AuthGoogleButton onDemo={googleDemo} />

        <AuthSwitchLine
          text="Already have an account?"
          actionLabel="Sign In"
          onAction={() => router.back()}
        />

        <Pressable onPress={() => Alert.alert('Terms', 'By signing up you agree to our Terms of Service and Privacy Policy.')} style={{ marginTop: 14, alignSelf: 'center' }} hitSlop={6}>
          <T v="caption" style={{ color: isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)', fontSize: 10 }}>
            Terms of Service · Privacy Policy
          </T>
        </Pressable>
      </View>
    </AuthShell>
  );
}
