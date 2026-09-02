import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Pressable, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { isLive, sendOtp, verifyOtp } from '@/api/client';

/**
 * pass 44 — 6-digit email OTP.
 *  · success: the entered boxes float up & fade → a ring forms and spins →
 *    a padlock appears → it UNLOCKS (lock → lock-open) → a green check springs in.
 *    One progress timeline (0→1) drives every phase so it stays smooth.
 *  · wrong:   the row shakes, a red hint appears, focus returns to box 1.
 * In demo (no live API) the accepted code is 123456 so the flow is testable.
 */
export function OtpVerify({ email, onVerified, onCancel }: { email: string; onVerified: () => void; onCancel: () => void }) {
  const { theme } = useTheme();
  const d = theme.dash;
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'wrong' | 'success'>('idle');
  const [hint, setHint] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const refs = useRef<Array<TextInput | null>>([]);
  const live = isLive();

  const lift = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current; // 0→1 success timeline
  const lockTilt = useRef(new Animated.Value(0)).current; // little wiggle on unlock

  const send = () => {
    setCooldown(30);
    if (!live) { setHint('Demo mode — use code 123456'); return; }
    sendOtp(email).then((r) => { if (!r.ok && !r.networkError) setHint(r.message ?? 'Could not send the code'); });
  };

  useEffect(() => {
    send(); // eslint-disable-line
    const iv = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);

  const setDigit = (i: number, v: string) => {
    const c = v.replace(/\D/g, '').slice(-1);
    setDigits((p) => { const n = [...p]; n[i] = c; return n; });
    if (c && i < 5) refs.current[i + 1]?.focus();
  };

  const doWrong = () => {
    haptic.medium();
    setStatus('wrong');
    setHint('Incorrect code — check and try again');
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
    setDigits(['', '', '', '', '', '']);
    refs.current[0]?.focus();
  };

  const succeed = () => {
    haptic.success();
    setStatus('success');
    setHint('');
    setUnlocked(false);
    progress.setValue(0);
    lift.setValue(0);
    /* one timeline drives float → ring → spin → lock → check (JS-driven: it
       also interpolates a colour, which the native driver can't do) */
    Animated.timing(progress, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();
    Animated.spring(lift, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }).start();
    /* the padlock unlocks ~62% through, with a small wiggle */
    setTimeout(() => {
      setUnlocked(true);
      haptic.selection();
      Animated.sequence([
        Animated.timing(lockTilt, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(lockTilt, { toValue: -1, duration: 110, useNativeDriver: true }),
        Animated.timing(lockTilt, { toValue: 0, duration: 110, useNativeDriver: true }),
      ]).start();
    }, 1480);
    setTimeout(() => haptic.success(), 2080);
    setTimeout(onVerified, 2950);
  };

  const verify = () => {
    const code = digits.join('');
    if (code.length !== 6) { setHint('Enter all 6 digits'); return; }
    Keyboard.dismiss();
    setStatus('verifying');
    if (!live) { if (code === '123456') succeed(); else doWrong(); return; }
    verifyOtp(email, code).then((r) => { if (r.verified) succeed(); else doWrong(); });
  };

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const liftY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const gold = d.gold;
  const green = '#2FA866';

  /* ── success timeline interpolations ── */
  const boxesY = progress.interpolate({ inputRange: [0, 0.22], outputRange: [0, -48], extrapolate: 'clamp' });
  const boxesOpacity = progress.interpolate({ inputRange: [0, 0.18], outputRange: [1, 0], extrapolate: 'clamp' });
  const ringScale = progress.interpolate({ inputRange: [0.16, 0.42], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const ringOpacity = progress.interpolate({ inputRange: [0.16, 0.3], outputRange: [0, 1], extrapolate: 'clamp' });
  const ringRotate = progress.interpolate({ inputRange: [0.16, 0.62], outputRange: ['0deg', '360deg'], extrapolate: 'clamp' });
  const ringColor = progress.interpolate({ inputRange: [0.7, 0.9], outputRange: [gold, green], extrapolate: 'clamp' });
  const lockScale = progress.interpolate({ inputRange: [0.42, 0.56], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const lockOpacity = progress.interpolate({ inputRange: [0.42, 0.5, 0.74, 0.84], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const lockTiltDeg = lockTilt.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });
  const checkScale = progress.interpolate({ inputRange: [0.84, 1], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const checkOpacity = progress.interpolate({ inputRange: [0.84, 0.92], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(4,10,7,0.86)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <Animated.View style={{ width: '100%', maxWidth: 400, borderRadius: 24, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 22, transform: [{ translateY: liftY }] }}>
        {status === 'success' ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            {/* phase 1 — the entered boxes float up and fade out */}
            <Animated.View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', height: 52, opacity: boxesOpacity, transform: [{ translateY: boxesY }] }}>
              {digits.map((v, i) => (
                <View key={i} style={{ width: 44, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: d.bg, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.6)' }}>
                  <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>{v}</T>
                </View>
              ))}
            </Animated.View>

            {/* phases 2–5 — ring forms + spins → padlock → unlocks → check */}
            <View style={{ width: 124, height: 124, alignItems: 'center', justifyContent: 'center', marginTop: -6 }}>
              <Animated.View style={{ position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 5, borderColor: ringColor, backgroundColor: 'rgba(47,168,102,0.06)', opacity: ringOpacity, transform: [{ scale: ringScale }, { rotate: ringRotate }] }} />
              <Animated.View style={{ position: 'absolute', opacity: lockOpacity, transform: [{ scale: lockScale }, { rotate: lockTiltDeg }] }}>
                <FontAwesome5 name={unlocked ? 'lock-open' : 'lock'} size={40} color={unlocked ? green : gold} solid />
              </Animated.View>
              <Animated.View style={{ opacity: checkOpacity, transform: [{ scale: checkScale }] }}>
                <FontAwesome5 name="check" size={46} color={green} solid />
              </Animated.View>
            </View>

            <T v="bodyS" style={{ color: green, fontWeight: '800', marginTop: 6 }}>{unlocked ? 'Email verified 🎉' : 'Verifying…'}</T>
            <T v="caption" style={{ color: d.subtext, fontSize: 12, marginTop: 2 }}>Taking you in…</T>
          </View>
        ) : (
          <>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20, textAlign: 'center' }}>Verify your email</T>
            <T v="caption" style={{ color: d.subtext, fontSize: 12, textAlign: 'center', marginTop: 4 }}>We sent a 6-digit code to {email}</T>
            <Animated.View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 22, transform: [{ translateX: shakeX }] }}>
              {digits.map((v, i) => (
                <TextInput
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  value={v}
                  onChangeText={(t) => setDigit(i, t)}
                  onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  style={{
                    width: 44, height: 52, textAlign: 'center', textAlignVertical: 'center',
                    fontSize: 20, fontWeight: '800', color: status === 'wrong' ? '#E05B5B' : d.text,
                    backgroundColor: d.bg, borderRadius: 12, borderWidth: 1.5,
                    borderColor: status === 'wrong' ? 'rgba(224,91,91,0.6)' : v ? 'rgba(212,175,55,0.6)' : d.cardBorder,
                  }}
                />
              ))}
            </Animated.View>
            {hint !== '' ? <T v="caption" style={{ color: status === 'wrong' ? '#E05B5B' : d.subtext, fontSize: 11.5, textAlign: 'center', marginBottom: 10 }}>{hint}</T> : null}
            <Pressable onPress={verify} disabled={status === 'verifying'} style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#1F8F5C', opacity: pressed || status === 'verifying' ? 0.8 : 1 })}>
              <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{status === 'verifying' ? 'Verifying…' : 'Verify'}</T>
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <Pressable onPress={send} disabled={cooldown > 0} style={{ opacity: cooldown > 0 ? 0.5 : 1 }}>
                <T v="caption" style={{ color: d.gold, fontSize: 12, fontWeight: '700' }}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</T>
              </Pressable>
              <T v="caption" style={{ color: d.faint, fontSize: 12 }}>·</T>
              <Pressable onPress={onCancel}><T v="caption" style={{ color: d.subtext, fontSize: 12 }}>Cancel</T></Pressable>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}
