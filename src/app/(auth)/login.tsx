import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function Login() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: theme.text,
    fontSize: 15,
    marginTop: 12,
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await login(email || 'demo@deenlink.org', password || 'demo1234');
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <View
              style={{
                width: 74,
                height: 74,
                borderRadius: 20,
                backgroundColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Text style={{ fontSize: 38 }}>🕌</Text>
            </View>
            <Text style={{ fontSize: 30, fontWeight: '800', color: theme.text }}>DeenLink</Text>
            <Text style={{ color: theme.subtext, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
              Your deen, in one place.
              {'\n'}Prayer times · Qur’an · Community
            </Text>
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={theme.subtext}
            autoCapitalize="none"
            keyboardType="email-address"
            style={inputStyle}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.subtext}
            secureTextEntry
            style={inputStyle}
          />
          <Pressable
            onPress={submit}
            disabled={busy}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 14,
              padding: 15,
              alignItems: 'center',
              marginTop: 18,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15.5 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
            <Text style={{ color: theme.subtext, fontSize: 13.5 }}>New to DeenLink? </Text>
            <Link href="/(auth)/register" asChild>
              <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13.5 }}>
                Create an account
              </Text>
            </Link>
          </View>

          <Text style={{ color: theme.subtext, fontSize: 11.5, textAlign: 'center', marginTop: 26, lineHeight: 17 }}>
            🧪 Demo mode: if your API isn’t reachable, you’ll be signed in locally so you can explore the app.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
