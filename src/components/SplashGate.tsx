import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, View } from 'react-native';
import { Image } from 'expo-image';

/**
 * Animated splash (pass 15): the DeenLink logo animation (transparent GIF,
 * black background keyed out) plays over a deep-forest screen on every cold
 * start.
 *  · app ready fast   → splash still holds 2s, then fades
 *  · app ready slow   → splash waits for ready, capped at 4s
 * Once per session on web (sessionStorage); once per app lifetime on native.
 */
let nativeSeen = false;

export function SplashGate({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const oncePerSession = () => {
    try {
      if (Platform.OS === 'web') {
        if (sessionStorage.getItem('dl.splash.seen')) return false;
        sessionStorage.setItem('dl.splash.seen', '1');
        return true;
      }
    } catch {}
    if (nativeSeen) return false;
    nativeSeen = true;
    return true;
  };

  // client-only mount (SSR-safe: nothing rendered during static export hydration)
  const [show, setShow] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (oncePerSession()) setShow(true);
    else setGone(true);
  }, []);
  const fade = useRef(new Animated.Value(1)).current;
  const start = useRef(Date.now()).current;
  const [readyAt, setReadyAt] = useState<number | null>(null);

  useEffect(() => {
    if (ready && readyAt == null) setReadyAt(Date.now());
  }, [ready, readyAt]);

  useEffect(() => {
    if (!show || readyAt == null) return;
    const elapsed = readyAt - start;
    const hold = Math.max(2000, Math.min(4000, elapsed));
    const left = hold - (Date.now() - start);
    const t = setTimeout(
      () =>
        Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: Platform.OS !== 'web' }).start(() =>
          setGone(true),
        ),
      Math.max(0, left),
    );
    return () => clearTimeout(t);
  }, [show, readyAt, fade]);

  if (!show || gone) return <>{children}</>;

  const W = Dimensions.get('window').width;
  return (
    <>
      {children}
      <Animated.View
        pointerEvents={readyAt == null ? 'box-none' : 'none'}
        style={{ position: 'absolute', inset: 0, zIndex: 999, backgroundColor: '#06140D', alignItems: 'center', justifyContent: 'center', opacity: fade }}
      >
        <Image
          source={require('../../assets/images/splash-anim.gif')}
          style={{ width: Math.min(W - 40, 560), aspectRatio: 1024 / 576 }}
          contentFit="contain"
          transition={0}
        />
      </Animated.View>
    </>
  );
}
