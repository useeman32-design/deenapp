import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { DeenLogo } from '@/components/DeenLogo';
import { GradientButton } from '@/components/GradientButton';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { InputField } from '@/components/InputField';
import { AppleIcon, CheckIcon, LockIcon, MailIcon } from '@/components/Icons';

const patternDark = require('../../../assets/img/pattern-dark.png');
const patternLight = require('../../../assets/img/pattern-light.png');

export default function Login() {
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await login(email.trim() || 'demo@deenlink.org', password || 'demo1234');
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
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <DeenLogo size={70} color={theme.primary} accent={theme.accent} />
            <T v="h1" style={{ marginTop: 4 }}>DeenLink</T>
            <T v="meta" color="accent" uppercase style={{ marginTop: 5 }}>
              Strengthen Your Deen, Every Day
            </T>
          </View>

          <Surface elevated style={{ padding: 20 }}>
            <T v="h1">Welcome back</T>
            <T v="caption" style={{ marginTop: 4 }}>
              Sign in to continue your journey
            </T>

            <InputField
              label="Email or username"
              value={email}
              onChangeText={setEmail}
              icon={MailIcon}
              placeholder="you@example.com"
              keyboardType="email-address"
              style={{ marginTop: 18 }}
            />
            <InputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              icon={LockIcon}
              secure
              placeholder="Enter your password"
              returnKeyType="done"
              style={{ marginTop: 14 }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <Pressable onPress={() => setRemember((r) => !r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }} hitSlop={6}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 6,
                    backgroundColor: remember ? theme.primary : 'transparent',
                    borderWidth: 1.5,
                    borderColor: remember ? theme.primary : theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {remember ? <CheckIcon size={11} color="#fff" strokeWidth={3} /> : null}
                </View>
                <T v="caption">Remember me</T>
              </Pressable>
              <T v="caption" color="primary" style={{ fontWeight: '700' }}>
                Forgot password?
              </T>
            </View>

            <GradientButton label={busy ? 'Signing in…' : 'Sign In'} onPress={submit} disabled={busy} style={{ marginTop: 18 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <T v="meta" style={{ marginHorizontal: 12, letterSpacing: 0.8 }}>
                OR CONTINUE WITH
              </T>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
              {[
                { key: 'google', node: <Text style={{ color: '#4285F4', fontFamily: 'Manrope', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>G</Text>, hint: 'Google' },
                { key: 'apple', node: <AppleIcon size={19} color={isDark ? '#F5FBF7' : '#111111'} />, hint: 'Apple' },
                { key: 'email', node: <MailIcon size={18} color={theme.primary} />, hint: 'Email' },
              ].map((s) => (
                <View key={s.key} style={{ alignItems: 'center', gap: 5 }}>
                  <Pressable
                    style={({ pressed }) => ({
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDark ? theme.cardSoft : '#FAF8F2',
                      borderWidth: 1.2,
                      borderColor: theme.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {s.node}
                  </Pressable>
                  <T v="meta" style={{ letterSpacing: 0.4 }}>{s.hint}</T>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
              <T v="caption">Don’t have an account? </T>
              <Link href="/(auth)/register" asChild>
                <T v="caption" color="primary" style={{ fontWeight: '800' }}>
                  Sign up
                </T>
              </Link>
            </View>
          </Surface>

          <T v="meta" style={{ textAlign: 'center', marginTop: 16, letterSpacing: 0.4, lineHeight: 16 }}>
            Demo mode — if your API is unreachable you’ll be signed in locally
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
