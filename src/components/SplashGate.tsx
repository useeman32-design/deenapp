import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * Animated splash (pass 18): the DeenLink logo VIDEO (user's clip, background
 * keyed onto the deep-forest #06140D) plays on every cold start.
 *  · app ready fast → holds 2s, then fades
 *  · app ready slow  → waits for ready, capped at 4s (clip length)
 * Once per session on web; once per app lifetime on native.
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

  // client-only mount (SSR-safe)
  const [show, setShow] = useState(false);
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const start = useRef(Date.now()).current;
  const [readyAt, setReadyAt] = useState<number | null>(null);

  const player = useVideoPlayer(require('../../assets/images/splash-anim.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (oncePerSession()) setShow(true);
    else setGone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && readyAt == null) setReadyAt(Date.now());
  }, [ready, readyAt]);

  useEffect(() => {
    if (show) {
      try { player.play(); } catch {}
    }
  }, [show, player]);

  useEffect(() => {
    if (!show || readyAt == null) return;
    const elapsed = readyAt - start;
    const hold = Math.max(2000, Math.min(4000, elapsed));
    const left = hold - (Date.now() - start);
    const t = setTimeout(
      () =>
        Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: Platform.OS !== 'web' }).start(() => {
          player.pause();
          setGone(true);
        }),
      Math.max(0, left),
    );
    return () => clearTimeout(t);
  }, [show, readyAt, fade, player]);

  if (!show || gone) return <>{children}</>;

  const W = Dimensions.get('window').width;
  return (
    <>
      {children}
      <Animated.View
        pointerEvents={readyAt == null ? 'box-none' : 'none'}
        style={{ position: 'absolute', inset: 0, zIndex: 999, backgroundColor: '#06140D', alignItems: 'center', justifyContent: 'center', opacity: fade }}
      >
        <View pointerEvents="none" style={{ width: Math.min(W, 640), aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden' }}>
          <VideoView player={player} contentFit="contain" nativeControls={false} playsInline style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }} />
        </View>
      </Animated.View>
    </>
  );
}
