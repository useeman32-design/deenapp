import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Pressable, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { FORCE_DEMO, sendOtp, verifyOtp, checkEmailVerified } from '@/api/client';

/**
 * pass 44 — 6-digit email OTP, cinematic verify sequence:
 *  · the six entered boxes fly out of the row and arrange into a RING,
 *  · the ring of boxes ROTATES (spins) as it transforms into a solid circle,
 *  · a padlock appears INSIDE and UNLOCKS (lock → lock-open),
 *  · a green checkmark springs in, then "Welcome to DeenLink" fades in,
 *  · and the whole card slowly FADES OUT, revealing the home screen.
 *  · wrong: the row shakes, red hint, focus returns to box 1.
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
  const live = !FORCE_DEMO;

  const shake = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current; // 0→1 success timeline (3s)
  const spin = useRef(new Animated.Value(0)).current;     // ring-of-boxes rotation
  const lockTilt = useRef(new Animated.Value(0)).current; // wiggle on unlock
  const fade = useRef(new Animated.Value(1)).current;     // final slow fade-out
  const doneRef = useRef(false); // guards the success celebration so it plays once

  const send = () => {
    setCooldown(30);
    if (!live) { setHint('Demo mode — use code 123456'); return; }
    sendOtp(email).then((r) => { if (!r.ok && !r.networkError) setHint(r.message ?? 'Could not send the code'); });
  };

  useEffect(() => {
    // register.php already emailed the 6-digit code, so don't auto-send a second
    // one here — that would overwrite the code hash and send a duplicate email.
    // The "Resend code" button below still calls send() for a manual resend.
    if (live) setHint('Enter the 6-digit code we emailed you — or tap “Verify my email” in the email.');
    else setHint('Demo mode — use code 123456');
    setCooldown(30);
    const iv = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Poll for email-LINK verification: if the user taps the link in the email
   * instead of typing the code, this detects it and completes automatically. */
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => {
      checkEmailVerified(email).then((v) => { if (v) { clearInterval(iv); succeed(); } }).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, email]);

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
    if (doneRef.current) return; // play the celebration once
    doneRef.current = true;
    haptic.success();
    setStatus('success');
    setHint('');
    setUnlocked(false);
    progress.setValue(0);
    spin.setValue(0);
    fade.setValue(1);
    /* One 3s timeline drives float→ring; a separate 1.4s spin rotates the ring
       of boxes; then unlock, check, welcome, and finally a slow fade-out. */
    Animated.timing(progress, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();
    Animated.timing(spin, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), delay: 950, useNativeDriver: true }).start();
    setTimeout(() => {
      setUnlocked(true);
      haptic.selection();
      Animated.sequence([
        Animated.timing(lockTilt, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(lockTilt, { toValue: -1, duration: 110, useNativeDriver: true }),
        Animated.timing(lockTilt, { toValue: 0, duration: 110, useNativeDriver: true }),
      ]).start();
    }, 2100);
    setTimeout(() => haptic.success(), 2700);
    setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 700, easing: Easing.ease, useNativeDriver: true }).start(), 5200);
    setTimeout(onVerified, 6000);
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

  /* ── success timeline interpolations (fractions of the 3s timeline) ── */
  const ringOpacity = progress.interpolate({ inputRange: [0.52, 0.66], outputRange: [0, 1], extrapolate: 'clamp' });
  const ringScale = progress.interpolate({ inputRange: [0.52, 0.66], outputRange: [0.82, 1], extrapolate: 'clamp' });
  const ringColor = progress.interpolate({ inputRange: [0.8, 0.94], outputRange: [gold, green], extrapolate: 'clamp' });
  const lockScale = progress.interpolate({ inputRange: [0.58, 0.7], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const lockOpacity = progress.interpolate({ inputRange: [0.58, 0.66, 0.86, 0.94], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const lockTiltDeg = lockTilt.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });
  const checkScale = progress.interpolate({ inputRange: [0.88, 1], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const checkOpacity = progress.interpolate({ inputRange: [0.88, 0.96], outputRange: [0, 1], extrapolate: 'clamp' });
  const welcomeOpacity = progress.interpolate({ inputRange: [0.94, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  /* per-box flight from the row into the ring */
  const boxAnim = (i: number) => {
    const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const endX = R * Math.cos(ang);
    const endY = R * Math.sin(ang);
    const startX = (i - 2.5) * 48;
    return {
      translateX: progress.interpolate({ inputRange: [0, 0.42], outputRange: [startX, endX], extrapolate: 'clamp' }),
      translateY: progress.interpolate({ inputRange: [0, 0.42], outputRange: [0, endY], extrapolate: 'clamp' }),
      scale: progress.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0.55], extrapolate: 'clamp' }),
      rotate: progress.interpolate({ inputRange: [0, 0.5], outputRange: ['0deg', `${i % 2 ? 20 : -20}deg`], extrapolate: 'clamp' }),
      opacity: progress.interpolate({ inputRange: [0.5, 0.68], outputRange: [1, 0], extrapolate: 'clamp' }),
    };
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'rgba(4,10,7,0.86)', alignItems: 'center', justifyContent: 'center', padding: 22, opacity: fade }}>
      <View style={{ width: '100%', maxWidth: 400, borderRadius: 24, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 22 }}>
        {status === 'success' ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 220, height: 200, alignItems: 'center', justifyContent: 'center' }}>
              {/* solid ring the boxes resolve into */}
              <Animated.View style={{ position: 'absolute', width: R * 2 + 14, height: R * 2 + 14, borderRadius: R + 7, borderWidth: 5, borderColor: ringColor, backgroundColor: 'rgba(47,168,102,0.05)', opacity: ringOpacity, transform: [{ scale: ringScale }] }} />
              {/* the boxes themselves — the whole ring of boxes spins as it forms */}
              <Animated.View style={{ position: 'absolute', width: '100%', height: '100%', transform: [{ rotate: spinDeg }] }}>
                {digits.map((v, i) => {
                  const a = boxAnim(i);
                  return (
                    <Animated.View
                      key={i}
                      style={{
                        position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -26,
                        width: 44, height: 52, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: d.bg, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.6)',
                        opacity: a.opacity,
                        transform: [{ translateX: a.translateX }, { translateY: a.translateY }, { scale: a.scale }, { rotate: a.rotate }],
                      }}
                    >
                      <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>{v}</T>
                    </Animated.View>
                  );
                })}
              </Animated.View>
              {/* padlock appears inside the ring, then unlocks */}
              <Animated.View style={{ position: 'absolute', opacity: lockOpacity, transform: [{ scale: lockScale }, { rotate: lockTiltDeg }] }}>
                <FontAwesome5 name={unlocked ? 'lock-open' : 'lock'} size={42} color={unlocked ? green : gold} solid />
              </Animated.View>
              {/* final checkmark */}
              <Animated.View style={{ position: 'absolute', opacity: checkOpacity, transform: [{ scale: checkScale }] }}>
                <FontAwesome5 name="check" size={50} color={green} solid />
              </Animated.View>
            </View>

            {/* welcome appears after the check, before the fade-out */}
            <Animated.View style={{ opacity: welcomeOpacity, alignItems: 'center', marginTop: 4 }}>
              <T v="display" style={{ color: d.text, fontWeight: '800', fontSize: 20, textAlign: 'center' }}>Welcome to DeenLink 🌙</T>
              <T v="caption" style={{ color: d.subtext, fontSize: 12, marginTop: 2 }}>Taking you home…</T>
            </Animated.View>
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
    </Animated.View>
  );
}
