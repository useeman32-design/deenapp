import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const MIZHAHS = ['Sunni', 'Shii', 'Prefer not to say'];

export default function Register() {
  const { theme } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mizhab, setMizhab] = useState(MIZHAHS[0]);
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
    marginTop: 10,
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await register({
      name: name || 'DeenLink User',
      username: username || (email || 'demo').split('@')[0],
      email: email || 'demo@deenlink.org',
      password: password || 'demo1234',
      mizhab,
    });
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: 24, paddingTop: 40 }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={{ color: theme.primary, fontSize: 24, fontWeight: '700' }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text, marginTop: 8 }}>
            Create account
          </Text>
          <Text style={{ color: theme.subtext, marginTop: 4, marginBottom: 10 }}>
            Join the DeenLink community
          </Text>

          <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={theme.subtext} style={inputStyle} />
          <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={theme.subtext} autoCapitalize="none" style={inputStyle} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={theme.subtext} autoCapitalize="none" keyboardType="email-address" style={inputStyle} />
          <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={theme.subtext} secureTextEntry style={inputStyle} />

          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13.5, marginTop: 16, marginBottom: 8 }}>
            Madhab / affiliation
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MIZHAHS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMizhab(m)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: mizhab === m ? theme.primary : theme.card,
                  borderWidth: 1,
                  borderColor: mizhab === m ? theme.primary : theme.border,
                }}
              >
                <Text style={{ color: mizhab === m ? '#fff' : theme.subtext, fontWeight: '600', fontSize: 12.5 }}>
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={submit}
            disabled={busy}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 14,
              padding: 15,
              alignItems: 'center',
              marginTop: 24,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15.5 }}>
              {busy ? 'Creating…' : 'Create account'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
