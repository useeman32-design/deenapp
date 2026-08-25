import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { DeenLogo } from '@/components/DeenLogo';
import { GradientButton } from '@/components/GradientButton';
import { CheckIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '@/components/Icons';

const patternDark = require('../../../assets/img/pattern-dark.png');
const patternLight = require('../../../assets/img/pattern-light.png');

export default function Login() {
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await login(email.trim() || 'demo@deenlink.org', password || 'demo1234');
    router.replace('/(tabs)');
  };

  const field = {
    backgroundColor: isDark ? '#0D1D16' : '#FAF8F2',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingLeft: 44,
    paddingRight: 44,
    paddingVertical: 13,
    color: theme.text,
    fontSize: 14,
  };

  const label = { color: theme.text, fontWeight: '700' as const, fontSize: 12.5, marginTop: 16, marginBottom: 7 };

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
            <DeenLogo size={74} color={theme.primary} accent={theme.accent} />
            <Text style={{ fontSize: 27, fontWeight: '800', color: theme.heading, marginTop: 6 }}>DeenLink</Text>
            <Text
              style={{
                color: theme.accent,
                fontSize: 10.5,
                fontWeight: '700',
                letterSpacing: 1.4,
                marginTop: 4,
                textTransform: 'uppercase',
              }}
            >
              Strengthen Your Deen, Every Day
            </Text>
          </View>

          <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.heading }}>
              Welcome <Text style={{ color: theme.accent }}>back!</Text>
            </Text>
            <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 4 }}>Sign in to continue your journey</Text>

            <Text style={label}>Email or Username</Text>
            <View style={{ position: 'relative' }}>
              <View style={{ position: 'absolute', left: 14, top: 13 }}>
                <MailIcon size={17} color={theme.subtext} />
              </View>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email or username"
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
                placeholder="Enter your password"
                placeholderTextColor={theme.subtext}
                secureTextEntry={!showPass}
                style={field}
              />
              <Pressable onPress={() => setShowPass((s) => !s)} style={{ position: 'absolute', right: 14, top: 13 }} hitSlop={8}>
                {showPass ? <EyeOffIcon size={17} color={theme.subtext} /> : <EyeIcon size={17} color={theme.subtext} />}
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <Pressable onPress={() => setRemember((r) => !r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }} hitSlop={6}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    backgroundColor: remember ? theme.primary : 'transparent',
                    borderWidth: 1.5,
                    borderColor: remember ? theme.primary : theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {remember ? <CheckIcon size={11} color="#fff" strokeWidth={3} /> : null}
                </View>
                <Text style={{ color: theme.subtext, fontSize: 12 }}>Remember me</Text>
              </Pressable>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>Forgot Password?</Text>
            </View>

            <GradientButton label={busy ? 'Signing in…' : 'Sign In'} onPress={submit} disabled={busy} style={{ marginTop: 16 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <Text style={{ color: theme.subtext, fontSize: 11.5, marginHorizontal: 12 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </View>

            <Pressable style={{ backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Text style={{ color: '#4285F4', fontWeight: '900', fontSize: 16 }}>G</Text>
              <Text style={{ color: '#1B2E25', fontWeight: '700', fontSize: 13.5 }}>Sign in with Google</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
              <Text style={{ color: theme.subtext, fontSize: 12.5 }}>Don’t have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12.5 }}>Sign Up</Text>
              </Link>
            </View>
          </View>

          <Text style={{ color: theme.subtext, fontSize: 10.5, textAlign: 'center', marginTop: 14, lineHeight: 15 }}>
            🧪 Demo mode — if your API is unreachable you’ll be signed in locally.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
