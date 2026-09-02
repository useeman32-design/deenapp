import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Pressable, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { isLive, sendOtp, verifyOtp } from '@/api/client';

/**
 * pass 44 — 6-digit email OTP.
 *  · success: the six entered boxes fly OUT of the row and arrange themselves
 *    into a RING (circle), fade into a solid ring, a padlock appears INSIDE,
 *    UNLOCKS (lock → lock-open) and the ring turns green, then a check springs in.
 *    One progress timeline (0→1) drives every phase so it stays smooth.
 *  · wrong:   the row shakes, a red hint appears, focus returns to box 1.
 * In demo (no live API) the accepted code is 123456 so the flow is testable.
 */
const R = 58; // ring radius the boxes fly to

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

  const shake = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current; // 0→1 success timeline
  const lockTilt = useRef(new Animated.Value(0)).current; // wiggle on unlock

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
    /* JS-driven: this timeline also interpolates a colour, which the native
       driver can't do. ~2.6s: boxes→ring (0–.45), padlock (.55–.7),
       unlock (~.74), check (.88–1). */
    Animated.timing(progress, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();
    setTimeout(() => {
      setUnlocked(true);
      haptic.selection();
      Animated.sequence([
        Animated.timing(lockTilt, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(lockTilt, { toValue: -1, duration: 110, useNativeDriver: true }),
        Animated.timing(lockTilt, { toValue: 0, duration: 110, useNativeDriver: true }),
      ]).start();
    }, 1900);
    setTimeout(() => haptic.success(), 2350);
    setTimeout(onVerified, 3200);
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
  const gold = d.gold;
  const green = '#2FA866';

  /* ── shared success-timeline interpolations ── */
  const ringOpacity = progress.interpolate({ inputRange: [0.5, 0.64], outputRange: [0, 1], extrapolate: 'clamp' });
  const ringScale = progress.interpolate({ inputRange: [0.5, 0.64], outputRange: [0.82, 1], extrapolate: 'clamp' });
  const ringColor = progress.interpolate({ inputRange: [0.78, 0.92], outputRange: [gold, green], extrapolate: 'clamp' });
  const lockScale = progress.interpolate({ inputRange: [0.56, 0.7], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const lockOpacity = progress.interpolate({ inputRange: [0.56, 0.64, 0.86, 0.94], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const lockTiltDeg = lockTilt.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });
  const checkScale = progress.interpolate({ inputRange: [0.9, 1], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const checkOpacity = progress.interpolate({ inputRange: [0.9, 0.97], outputRange: [0, 1], extrapolate: 'clamp' });

  /* per-box flight from the row into the ring */
  const boxAnim = (i: number) => {
    const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const endX = R * Math.cos(ang);
    const endY = R * Math.sin(ang);
    const startX = (i - 2.5) * 48;
    return {
      translateX: progress.interpolate({ inputRange: [0, 0.45], outputRange: [startX, endX], extrapolate: 'clamp' }),
      translateY: progress.interpolate({ inputRange: [0, 0.45], outputRange: [0, endY], extrapolate: 'clamp' }),
      scale: progress.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0.58], extrapolate: 'clamp' }),
      rotate: progress.interpolate({ inputRange: [0, 0.45], outputRange: ['0deg', `${i % 2 ? 20 : -20}deg`], extrapolate: 'clamp' }),
      opacity: progress.interpolate({ inputRange: [0.46, 0.62], outputRange: [1, 0], extrapolate: 'clamp' }),
    };
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(4,10,7,0.86)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <View style={{ width: '100%', maxWidth: 400, borderRadius: 24, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 22 }}>
        {status === 'success' ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            {/* the six boxes fly from the row into a ring, then the padlock unlocks inside */}
            <View style={{ width: 220, height: 200, alignItems: 'center', justifyContent: 'center' }}>
              {/* solid ring the boxes resolve into */}
              <Animated.View style={{ position: 'absolute', width: R * 2 + 14, height: R * 2 + 14, borderRadius: R + 7, borderWidth: 5, borderColor: ringColor, backgroundColor: 'rgba(47,168,102,0.05)', opacity: ringOpacity, transform: [{ scale: ringScale }] }} />
              {/* the boxes themselves */}
              {digits.map((v, i) => {
                const a = boxAnim(i);
                return (
                  <Animated.View
                    key={i}
                    style={{
                      position: 'absolute', width: 44, height: 52, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: d.bg, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.6)',
                      opacity: a.opacity,
                      transform: [{ translateX: a.translateX }, { translateY: a.translateY }, { scale: a.scale }, { rotate: a.rotate }],
                    }}
                  >
                    <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>{v}</T>
                  </Animated.View>
                );
              })}
              {/* padlock appears inside the ring, then unlocks */}
              <Animated.View style={{ position: 'absolute', opacity: lockOpacity, transform: [{ scale: lockScale }, { rotate: lockTiltDeg }] }}>
                <FontAwesome5 name={unlocked ? 'lock-open' : 'lock'} size={42} color={unlocked ? green : gold} solid />
              </Animated.View>
              {/* final checkmark */}
              <Animated.View style={{ position: 'absolute', opacity: checkOpacity, transform: [{ scale: checkScale }] }}>
                <FontAwesome5 name="check" size={50} color={green} solid />
              </Animated.View>
            </View>

            <T v="bodyS" style={{ color: green, fontWeight: '800', marginTop: 4 }}>{unlocked ? 'Email verified 🎉' : 'Verifying…'}</T>
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
      </View>
    </View>
  );
}
