import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

/**
 * Splash (pass 32): the user's brand opening — Dark.MP4 / Light.MP4 converted
 * to optimized GIFs (480px, 12fps, adaptive palette). The pass-31 <video>
 * approach silently failed to autoplay on several real devices (autoplay
 * policy + expo-video start races); an animated GIF renders via a plain
 * <Image> with ZERO autoplay rules, on web AND native. The brand colour
 * paints instantly behind it while the GIF streams in.
 *
 * Timing: brand colour immediately; the GIF plays ~one loop (4s); the gate
 * leaves when the app is ready AND at least 2.8s passed (cap 5.5s).
 * Once per app lifetime on native; every cold web load.
 */
const darkGif = require('../../assets/img/splash-dark.gif');
const lightGif = require('../../assets/img/splash-light.gif');

let nativeSeen = false;

export function SplashGate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const { isDark } = useTheme();
  const [show, setShow] = useState(false);
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const barW = useRef(new Animated.Value(0)).current;
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

  /* loader bar while booting */
  useEffect(() => {
    if (!show) return;
    Animated.timing(barW, { toValue: 0.72, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [show, barW]);

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
      <Animated.View pointerEvents={readyAt == null ? 'box-none' : 'none'} style={{ position: 'absolute', inset: 0, zIndex: 999, opacity: fade, backgroundColor: isDark ? '#06140D' : '#F6FAF7' }}>
        {/* the brand opening — GIF covers like a video, colour matches the clip */}
        <Image source={isDark ? darkGif : lightGif} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} resizeMode="cover" />

        {/* thin brand loader pinned near the bottom (over the GIF) */}
        <View style={{ position: 'absolute', bottom: '11%', alignSelf: 'center', alignItems: 'center' }}>
          <View style={{ width: Math.min(W * 0.42, 150), height: 3, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(20,36,28,0.16)', overflow: 'hidden' }}>
            <Animated.View style={{ width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: 3, borderRadius: 2, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
          </View>
          <T v="caption" style={{ fontSize: 9, color: isDark ? 'rgba(242,247,243,0.75)' : 'rgba(20,36,28,0.7)', marginTop: 8, letterSpacing: 0.6, fontWeight: '700' }}>
            BISMILLAH
          </T>
        </View>
      </Animated.View>
    </>
  );
}
