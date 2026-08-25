import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { DeenLogo } from '@/components/DeenLogo';
import { GradientButton } from '@/components/GradientButton';
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
    setBusy(true);
    const user = (name.trim() || email.split('@')[0] || 'DeenLink User').trim();
    await register({
      name: user,
      username: user.split(/\s+/)[0].toLowerCase(),
      email: email.trim() || 'demo@deenlink.org',
      password: password || 'demo1234',
      mizhab: 'Sunni',
    });
    router.replace('/(tabs)');
  };

  const field = {
    backgroundColor: isDark ? '#0D1D16' : '#FAF8F2',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingLeft: 44,
    paddingRight: 16,
    paddingVertical: 13,
    color: theme.text,
    fontSize: 14,
  };

  const label = { color: theme.text, fontWeight: '700' as const, fontSize: 12.5, marginTop: 15, marginBottom: 7 };

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={isDark ? patternDark : patternLight}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(5, 13, 9, 0.42)' : 'rgba(246, 243, 235, 0.55)' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <DeenLogo size={64} color={theme.primary} accent={theme.accent} />
            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.heading, marginTop: 8 }}>Create Account</Text>
            <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 4 }}>Start your journey with DeenLink</Text>
          </View>

          <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border }}>
            <Text style={label}>Full Name</Text>
            <View style={{ position: 'relative' }}>
              <View style={{ position: 'absolute', left: 14, top: 13 }}>
                <UserIcon size={17} color={theme.subtext} />
              </View>
              <TextInput value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={theme.subtext} style={field} />
            </View>

            <Text style={label}>Email</Text>
            <View style={{ position: 'relative' }}>
              <View style={{ position: 'absolute', left: 14, top: 13 }}>
                <MailIcon size={17} color={theme.subtext} />
              </View>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={theme.subtext}
                autoCapitalize="none"
                keyboardType="email-address"
                style={field}
              />
            </View>

            <Text style={label}>Password</Text>
            <View style={{ position: 'relative' }}>
              <View style={{ position: 'absolute', left: 14, top: 13 }}>
                <LockIcon size={17} color={theme.subtext} />
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor={theme.subtext}
                secureTextEntry
                style={field}
              />
            </View>

            <Text style={label}>Confirm Password</Text>
            <View style={{ position: 'relative' }}>
              <View style={{ position: 'absolute', left: 14, top: 13 }}>
                <LockIcon size={17} color={theme.subtext} />
              </View>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm your password"
                placeholderTextColor={theme.subtext}
                secureTextEntry
                style={field}
              />
            </View>

            {error ? <Text style={{ color: theme.danger, fontSize: 12, marginTop: 10 }}>{error}</Text> : null}

            <Pressable onPress={() => setAgree((a) => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }} hitSlop={6}>
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
              <Text style={{ color: theme.subtext, fontSize: 11.5, lineHeight: 16 }}>
                I agree to the <Text style={{ color: theme.primary, fontWeight: '700' }}>Terms & Conditions</Text> and{' '}
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Privacy Policy</Text>
              </Text>
            </Pressable>

            <GradientButton label={busy ? 'Creating…' : 'Sign Up'} onPress={submit} disabled={busy || !agree} style={{ marginTop: 16 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
              <Text style={{ color: theme.subtext, fontSize: 12.5 }}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12.5 }}>Log in</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
