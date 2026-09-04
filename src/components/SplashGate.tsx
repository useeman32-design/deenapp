import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

/**
 * Splash (pass 34e): the user's REAL DeenLink logo (their latest artwork,
 * webp 720px ~96KB) on a rounded brand card — replaces the pass-34 animated
 * GIFs (the recompression looked poor) and the pass-31/32 video experiments.
 *
 * Timing: brand colour immediately; the logo springs in; the gate leaves
 * when the app is ready AND at least 2.8s passed (cap 5.5s).
 * Once per app lifetime on native; every cold web load.
 */
const logo = require('../../assets/img/logo-export.png');
/* pass 37 — one explicit square size for the splash logo (no aspectRatio math) */
const LOGO = 148;

let nativeSeen = false;

export function SplashGate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const { isDark } = useTheme();
  const [show, setShow] = useState(false);
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const barW = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  /* pass 37 — full splash animation: glow bloom behind the logo, spring-in
   * square logo card, wordmark + tagline fade-up, shimmering loader bar */
  const glow = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(-1)).current;
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

  /* the animation sequence */
  useEffect(() => {
    if (!show) return;
    Animated.timing(barW, { toValue: 0.72, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    /* 1 — glow blooms in first */
    Animated.timing(glow, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    /* 2 — logo springs in over the glow */
    Animated.spring(pop, { toValue: 1, friction: 7, tension: 40, useNativeDriver: false }).start();
    /* 3 — the glow keeps breathing gently (loop) */
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(breathe, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();
    /* 4 — wordmark + tagline fade up */
    Animated.timing(word, { toValue: 1, duration: 620, delay: 340, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    /* 5 — shimmer sweeps across the loader bar */
    Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 1250, easing: Easing.linear, useNativeDriver: false }),
    ).start();
  }, [show, barW, pop, glow, breathe, word, shine]);

  /* leave: ready AND min-watch elapsed (absolute cap so a stuck boot never
   * holds the app hostage) */
  useEffect(() => {
    if (!show || readyAt == null) return;
    const hold = Math.max(2800, Math.min(5500, readyAt - start + 2800));
    const left = hold - (Date.now() - start);
    const t = setTimeout(() => {
      Animated.timing(barW, { toValue: 1, duration: 200, useNativeDriver: false }).start();
      Animated.timing(fade, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => setGone(true));
    }, Math.max(0, left));
    return () => clearTimeout(t);
  }, [show, readyAt, fade, barW]);

  if (!show || gone) return <>{children}</>;

  const W = Dimensions.get('window').width;

  return (
    <>
      {children}
      <Animated.View pointerEvents={readyAt == null ? 'box-none' : 'none'} style={{ position: 'absolute', inset: 0, zIndex: 999, opacity: fade, backgroundColor: isDark ? '#06140D' : '#F6FAF7', alignItems: 'center', justifyContent: 'center' }}>
        {/* pass 37 — animated splash: breathing glow → square logo card → wordmark */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {/* glow halo behind the logo (blooms then breathes) */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: LOGO + 120,
              height: LOGO + 120,
              borderRadius: (LOGO + 120) / 2,
              backgroundColor: isDark ? 'rgba(74,227,143,0.16)' : 'rgba(29,111,66,0.12)',
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              transform: [
                { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) },
              ],
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: LOGO + 46,
              height: LOGO + 46,
              borderRadius: (LOGO + 46) / 2,
              backgroundColor: isDark ? 'rgba(212,175,55,0.14)' : 'rgba(212,175,55,0.10)',
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
              transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.94] }) }],
            }}
          />
          {/* the logo — EXPLICIT square (width = height), spring-in */}
          <Animated.Image
            source={logo}
            style={{
              width: LOGO,
              height: LOGO,
              borderRadius: LOGO * 0.17,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: isDark ? 'rgba(232,201,102,0.4)' : 'rgba(140,109,31,0.35)',
              shadowColor: isDark ? '#4AE38F' : '#1D6F42',
              shadowOpacity: 0.35,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 8 },
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '0deg'] }) },
              ],
            }}
            resizeMode="cover"
          />
          {/* wordmark + tagline fade up */}
          <Animated.View style={{ alignItems: 'center', marginTop: 22, opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <T v="h2" style={{ fontWeight: '900', fontSize: 21, letterSpacing: 0.4, color: isDark ? '#F2F7F3' : '#15251C' }}>
              DeenLink
            </T>
            <T v="caption" style={{ fontSize: 9.5, letterSpacing: 1.6, marginTop: 4, color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(21,37,28,0.6)' }}>
              STRENGTHEN YOUR DEEN, EVERY DAY
            </T>
          </Animated.View>
        </View>

        {/* thin brand loader pinned near the bottom (over the GIF) */}
        <View style={{ position: 'absolute', bottom: '11%', alignSelf: 'center', alignItems: 'center' }}>
          <View style={{ width: Math.min(W * 0.42, 168), height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(20,36,28,0.12)', overflow: 'hidden', justifyContent: 'center' }}>
            <Animated.View style={{ width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: 4, borderRadius: 2, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
            {/* shimmer sweep over the bar */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '38%',
                opacity: 0.5,
                transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-140, 400] }) }],
                backgroundColor: 'rgba(255,255,255,0.55)',
                borderRadius: 2,
              }}
            />
          </View>
          <T v="caption" style={{ fontSize: 9, color: isDark ? 'rgba(242,247,243,0.75)' : 'rgba(20,36,28,0.7)', marginTop: 8, letterSpacing: 0.6, fontWeight: '700' }}>
            BISMILLAH
          </T>
        </View>
      </Animated.View>
    </>
  );
}
