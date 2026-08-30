import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

/**
 * Splash (pass 23 — full redesign): a clean branded animation instead of the
 * video clip — the real DeenLink logo scales in with soft glow rings, the
 * wordmark + slogan fade up, and a thin loader runs while the app boots.
 * Theme-aware, ~2.4s on every cold web load (once per app lifetime native).
 */
let nativeSeen = false;

export function SplashGate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const { isDark } = useTheme();
  const [show, setShow] = useState(false);
  const [gone, setGone] = useState(false);

  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(14)).current;
  const textOp = useRef(new Animated.Value(0)).current;
  const barW = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const start = useRef(Date.now()).current;
  const [readyAt, setReadyAt] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') setShow(true);
    else if (!nativeSeen) {
      nativeSeen = true;
      setShow(true);
    } else setGone(true);
  }, []);

  useEffect(() => {
    if (ready && readyAt == null) setReadyAt(Date.now());
  }, [ready, readyAt]);

  /* entrance choreography */
  useEffect(() => {
    if (!show) return;
    Animated.sequence([
      Animated.timing(logoScale, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.6)), useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(textY, { toValue: 0, duration: 420, easing: Easing.out(Easing.poly(4)), useNativeDriver: false }),
        Animated.timing(textOp, { toValue: 1, duration: 420, useNativeDriver: false }),
      ]),
    ]).start();
    Animated.timing(logoGlow, { toValue: 1, duration: 900, useNativeDriver: false }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring1, { toValue: 1, duration: 1500, easing: Easing.out(Easing.poly(3)), useNativeDriver: false }),
        Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    ).start();
    const t2 = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring2, { toValue: 1, duration: 1500, easing: Easing.out(Easing.poly(3)), useNativeDriver: false }),
          Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ).start();
    }, 520);
    Animated.timing(barW, { toValue: 0.72, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    return () => clearTimeout(t2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  /* leave when ready (min 2.4s, cap 4s) */
  useEffect(() => {
    if (!show || readyAt == null) return;
    const elapsed = readyAt - start;
    const hold = Math.max(2400, Math.min(4000, elapsed));
    const left = hold - (Date.now() - start);
    const t = setTimeout(
      () => {
        Animated.timing(barW, { toValue: 1, duration: 220, useNativeDriver: false }).start();
        Animated.timing(fade, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => setGone(true));
      },
      Math.max(0, left),
    );
    return () => clearTimeout(t);
  }, [show, readyAt, fade, barW]);

  if (!show || gone) return <>{children}</>;

  const W = Dimensions.get('window').width;
  const logoSize = Math.min(W * 0.3, 118);

  return (
    <>
      {children}
      <Animated.View
        pointerEvents={readyAt == null ? 'box-none' : 'none'}
        style={{ position: 'absolute', inset: 0, zIndex: 999, opacity: fade }}
      >
        {/* backdrop */}
        <View style={{ flex: 1, backgroundColor: isDark ? '#06140D' : '#F6FAF7' }} />
        {/* soft brand glow behind the logo */}
        <View
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: '34%',
            width: W * 0.9,
            height: W * 0.9,
            borderRadius: (W * 0.9) / 2,
            backgroundColor: isDark ? 'rgba(31,143,92,0.10)' : 'rgba(29,111,66,0.06)',
          }}
        />

        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          {/* pulse rings */}
          {[ring1, ring2].map((r, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: logoSize,
                height: logoSize,
                borderRadius: logoSize / 2,
                borderWidth: 1.5,
                borderColor: isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)',
                transform: [
                  {
                    scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }),
                  },
                ],
                opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              }}
            />
          ))}

          {/* logo with glow */}
          <Animated.View
            style={{
              transform: [{ scale: logoScale }],
              shadowColor: isDark ? '#4AE38F' : '#1D6F42',
              shadowOpacity: logoGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
              shadowRadius: logoGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }),
              shadowOffset: { width: 0, height: 0 },
              elevation: 12,
            }}
          >
            <Image source={require('../../assets/img/logo-badge.png')} style={{ width: logoSize, height: logoSize * (204 / 200), borderRadius: 14 }} resizeMode="contain" />
          </Animated.View>

          {/* wordmark + slogan */}
          <Animated.View style={{ alignItems: 'center', marginTop: 26, opacity: textOp, transform: [{ translateY: textY }] }}>
            <T v="h1" style={{ fontSize: 30, fontWeight: '800', letterSpacing: 0.5, color: isDark ? '#F2F7F3' : '#14241C' }}>
              DeenLink
            </T>
            <T v="caption" style={{ fontSize: 12, marginTop: 5, letterSpacing: 0.4, color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(20,36,28,0.6)' }}>
              All-in-one islamic app
            </T>
          </Animated.View>

          {/* loader */}
          <Animated.View style={{ marginTop: 34, opacity: textOp }}>
            <View style={{ width: Math.min(W * 0.42, 150), height: 3.5, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(20,36,28,0.10)', overflow: 'hidden' }}>
              <Animated.View style={{ width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: 3.5, borderRadius: 2, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
            </View>
            <T v="caption" style={{ fontSize: 9, color: isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.45)', textAlign: 'center', marginTop: 8, letterSpacing: 0.6 }}>
              BISMILLAH
            </T>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
}
