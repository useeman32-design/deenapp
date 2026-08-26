import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { InputField } from '@/components/InputField';
import { CheckIcon, LockIcon, MailIcon, MoonStarIcon } from '@/components/Icons';

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
    await login(email.trim() || 'demo@deenlink.org', password || 'demo1234', remember);
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Green header (web auth pages use the same hero family) */}
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
          {/* Auth card (web .auth-content) */}
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
              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18, borderBottomWidth: 3, borderBottomColor: theme.primary }}>
                <T v="h3" color="primary" style={{ fontWeight: '600', fontSize: 16 }}>
                  Login
                </T>
              </View>
              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18, borderBottomWidth: 3, borderBottomColor: 'transparent' }}>
                <Link href="/(auth)/register" asChild>
                  <T v="h3" color="subtext" style={{ fontWeight: '600', fontSize: 16 }}>
                    Register
                  </T>
                </Link>
              </View>
            </View>

            <View style={{ padding: 20 }}>
              <T v="h1" style={{ fontSize: 20 }}>
                Welcome to DeenLink
              </T>
              <T v="caption" style={{ marginTop: 4, marginBottom: 20 }}>
                Join our community to access your profile and all features
              </T>

              <InputField
                label="Email or username"
                value={email}
                onChangeText={setEmail}
                icon={MailIcon}
                placeholder="you@example.com"
                keyboardType="email-address"
              />
              <InputField
                label="Password"
                value={password}
                onChangeText={setPassword}
                icon={LockIcon}
                secure
                placeholder="Enter your password"
                returnKeyType="done"
                style={{ marginTop: 16 }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <Pressable onPress={() => setRemember((r) => !r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} hitSlop={8}>
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
                  <T v="caption">Remember me</T>
                </Pressable>
                <T v="caption" color="primary" style={{ fontWeight: '600' }}>
                  Forgot password?
                </T>
              </View>

              <Pressable
                onPress={submit}
                style={({ pressed }) => ({
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  padding: 15,
                  alignItems: 'center',
                  marginTop: 20,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <T v="button" color="onPrimary" style={{ fontWeight: '700', fontSize: 15 }}>
                  {busy ? 'Signing in…' : 'Sign In'}
                </T>
              </Pressable>

              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
                <T v="caption">Don’t have an account?</T>
                <Link href="/(auth)/register" asChild>
                  <T v="caption" color="primary" style={{ fontWeight: '700', marginLeft: 5 }}>
                    Sign up
                  </T>
                </Link>
              </View>
            </View>
          </View>

          <T v="caption" style={{ textAlign: 'center', marginTop: 16 }}>
            Demo mode — if the API is unreachable you’ll be signed in locally
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
