import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { AuthShell, AuthHeading, AuthField, AuthPrimaryButton, AuthGoogleButton, AuthOrDivider, AuthSwitchLine } from '@/components/AuthShell';

/**
 * Login — pass-12 redesign (user's mock): full-bleed brand background,
 * "Welcome back!", email + password fields with eye toggle, remember me,
 * emerald Sign In, OR divider, Google pill (demo), switch-to-signup line.
 */
export default function Login() {
  const { isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await login(email.trim() || 'demo@deenlink.org', password || 'demo1234', remember);
    router.replace('/(tabs)');
  };

  const googleDemo = async () => {
    if (busy) return;
    setBusy(true);
    await login('demo@deenlink.org', 'demo1234', true);
    router.replace('/(tabs)');
  };

  return (
    <AuthShell>
      <View style={{ paddingHorizontal: 26 }}>
        <AuthHeading title="Welcome back!" sub="Sign in to continue your journey" />

        <AuthField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" icon="envelope" keyboard="email-address" />
        <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" icon="lock" secure />

        {/* remember · forgot */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 18 }}>
          <Pressable onPress={() => { haptic.selection(); setRemember((r) => !r); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} hitSlop={8}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                backgroundColor: remember ? (isDark ? '#1F8F5C' : '#1D6F42') : 'transparent',
                borderWidth: 1.5,
                borderColor: remember ? (isDark ? '#1F8F5C' : '#1D6F42') : isDark ? 'rgba(255,255,255,0.25)' : 'rgba(20,36,28,0.25)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {remember ? <T v="caption" style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>✓</T> : null}
            </View>
            <T v="caption" style={{ color: isDark ? 'rgba(242,247,243,0.7)' : 'rgba(20,36,28,0.7)', fontSize: 12 }}>
              Remember me
            </T>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Reset password', 'A password reset link will be emailed to you.')} hitSlop={8}>
            <T v="caption" style={{ color: isDark ? '#D4AF37' : '#B8860B', fontWeight: '700', fontSize: 12 }}>
              Forgot password?
            </T>
          </Pressable>
        </View>

        <AuthPrimaryButton label="Sign In" busy={busy} onPress={submit} />

        <AuthOrDivider />

        <AuthGoogleButton onDemo={googleDemo} />

        <AuthSwitchLine
          text="Don’t have an account?"
          actionLabel="Sign Up"
          onAction={() => router.push('/(auth)/register')}
        />
      </View>
    </AuthShell>
  );
}
