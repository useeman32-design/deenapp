import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import * as api from '@/api/client';
import { AuthShell, AuthHeading, AuthField, AuthPrimaryButton, AuthGoogleButton, AuthOrDivider, AuthSwitchLine } from '@/components/AuthShell';

/**
 * Login — pass-12 redesign (user's mock): full-bleed brand background,
 * "Welcome back!", email + password fields with eye toggle, remember me,
 * emerald Sign In, OR divider, Google pill (demo), switch-to-signup line.
 */
export default function Login() {
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  /* security-question account recovery */
  const d = theme.dash;
  const [recOpen, setRecOpen] = useState(false);
  const [recStep, setRecStep] = useState<'id' | 'answer'>('id');
  const [recId, setRecId] = useState('');
  const [recQ, setRecQ] = useState('');
  const [recAns, setRecAns] = useState('');
  const [recPw, setRecPw] = useState('');
  const [recPw2, setRecPw2] = useState('');
  const [recBusy, setRecBusy] = useState(false);
  const [recErr, setRecErr] = useState('');

  const closeRec = () => { setRecOpen(false); setRecStep('id'); setRecId(''); setRecQ(''); setRecAns(''); setRecPw(''); setRecPw2(''); setRecErr(''); };

  const findQuestion = async () => {
    if (recBusy) return;
    if (!recId.trim()) { setRecErr('Enter your email or username.'); return; }
    setRecBusy(true); setRecErr('');
    const r = await api.getSecurityQuestion(recId.trim());
    setRecBusy(false);
    if (r.ok && r.found && r.question) { setRecQ(r.question); setRecStep('answer'); }
    else if (r.ok) { setRecErr(r.message ?? 'No security question found for that account.'); }
    else { setRecErr(r.message ?? 'Could not reach the server. Check your connection.'); }
  };

  const doRecover = async () => {
    if (recBusy) return;
    if (!recAns.trim()) { setRecErr('Enter your security answer.'); return; }
    if (recPw.length < 8) { setRecErr('Password must be at least 8 characters.'); return; }
    if (recPw !== recPw2) { setRecErr('Passwords do not match.'); return; }
    setRecBusy(true); setRecErr('');
    const r = await api.recoverPassword(recId.trim(), recAns.trim(), recPw, recPw2);
    setRecBusy(false);
    if (r.ok) {
      closeRec();
      haptic.success();
      Alert.alert('Password reset', r.message ?? 'Your password was reset. Please log in.');
    } else {
      setRecErr(r.message ?? 'Could not reset password.');
    }
  };

  const recField = { backgroundColor: d.bgSoft, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 13, paddingVertical: 12, fontFamily: 'Poppins-Medium', fontSize: 16, color: d.text } as const;

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
      <View>
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
          <Pressable onPress={() => { haptic.selection(); setRecOpen(true); }} hitSlop={8}>
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

      {/* security-question account recovery */}
      <Modal visible={recOpen} transparent animationType="slide" onRequestClose={closeRec}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={closeRec} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <T v="h3" style={{ fontWeight: '800', flex: 1, color: d.text }}>{recStep === 'id' ? 'Reset password' : 'Answer your security question'}</T>
              <Pressable onPress={closeRec} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {recStep === 'id' ? (
                <View style={{ gap: 12 }}>
                  <T v="caption" style={{ fontSize: 11.5, color: d.subtext, lineHeight: 17 }}>Enter the email or username on your account. We'll show your security question so you can reset your password.</T>
                  <TextInput value={recId} onChangeText={setRecId} placeholder="Email or username" autoCapitalize="none" autoCorrect={false} placeholderTextColor={d.faint} style={recField} />
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <View style={{ borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.05)', padding: 13 }}>
                    <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.6, color: isDark ? '#E8C96A' : '#8C6D1F', marginBottom: 4 }}>SECURITY QUESTION</T>
                    <T v="bodyS" style={{ fontSize: 13, fontWeight: '700', color: d.text }}>{recQ}</T>
                  </View>
                  <TextInput value={recAns} onChangeText={setRecAns} placeholder="Your answer" autoCapitalize="none" autoCorrect={false} placeholderTextColor={d.faint} style={recField} />
                  <TextInput value={recPw} onChangeText={setRecPw} placeholder="New password" secureTextEntry placeholderTextColor={d.faint} style={recField} />
                  <TextInput value={recPw2} onChangeText={setRecPw2} placeholder="Confirm new password" secureTextEntry placeholderTextColor={d.faint} style={recField} />
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, lineHeight: 14 }}>Password must be 8+ characters with uppercase, lowercase, a number and a special character.</T>
                </View>
              )}
              {recErr ? <T v="caption" style={{ fontSize: 11, color: '#FF7B7B', marginTop: 10 }}>{recErr}</T> : null}
              <Pressable onPress={recStep === 'id' ? findQuestion : doRecover} disabled={recBusy} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', borderRadius: 13, padding: 14, opacity: recBusy ? 0.7 : 1 }}>
                {recBusy ? <ActivityIndicator color="#fff" /> : null}
                <T v="button" style={{ color: '#fff' }}>{recBusy ? 'Please wait…' : recStep === 'id' ? 'Find my question' : 'Reset password'}</T>
              </Pressable>
              {recStep === 'answer' ? (
                <Pressable onPress={() => { setRecStep('id'); setRecErr(''); }} style={{ alignItems: 'center', marginTop: 12 }}>
                  <T v="caption" style={{ fontSize: 11, color: d.faint, fontWeight: '700' }}>Use a different account</T>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AuthShell>
  );
}
