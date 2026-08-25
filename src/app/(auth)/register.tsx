import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { DeenLogo } from '@/components/DeenLogo';
import { GradientButton } from '@/components/GradientButton';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { InputField } from '@/components/InputField';
import { CheckIcon, LockIcon, MailIcon, UserIcon } from '@/components/Icons';

const patternDark = require('../../../assets/img/pattern-dark.png');
const patternLight = require('../../../assets/img/pattern-light.png');

export default function Register() {
  const { theme, isDark } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (password && confirm && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!password) {
      setError('Please enter a password');
      return;
    }
    setBusy(true);
    const user = (name.trim() || email.split('@')[0] || 'DeenLink User').trim();
    await register({
      name: user,
      username: user.split(/\s+/)[0].toLowerCase(),
      email: email.trim() || 'demo@deenlink.org',
      password,
      mizhab: 'Sunni',
    });
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Image
        source={isDark ? patternDark : patternLight}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(5, 13, 9, 0.5)' : 'rgba(247, 245, 239, 0.62)' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <DeenLogo size={58} color={theme.primary} accent={theme.accent} />
            <T v="h1" style={{ marginTop: 8 }}>Create account</T>
            <T v="caption" style={{ marginTop: 4 }}>Start your journey with DeenLink</T>
          </View>

          <Surface elevated style={{ padding: 20 }}>
            <InputField
              label="Full name"
              value={name}
              onChangeText={setName}
              icon={UserIcon}
              placeholder="Enter your name"
              autoCapitalize="words"
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

            <Pressable onPress={() => setAgree((a) => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 }} hitSlop={6}>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
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
                <T v="caption" color="primary" style={{ fontWeight: '800' }}>
                  Terms & Conditions
                </T>{' '}
                and{' '}
                <T v="caption" color="primary" style={{ fontWeight: '800' }}>
                  Privacy Policy
                </T>
              </T>
            </Pressable>

            <GradientButton label={busy ? 'Creating…' : 'Sign Up'} onPress={submit} disabled={busy || !agree} style={{ marginTop: 18 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
              <T v="caption">Already have an account? </T>
              <Link href="/(auth)/login" asChild>
                <T v="caption" color="primary" style={{ fontWeight: '800' }}>
                  Log in
                </T>
              </Link>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
