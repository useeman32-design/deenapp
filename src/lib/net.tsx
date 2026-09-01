import { useEffect, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';

/**
 * Global connectivity UX (pass 28).
 *  · <NetPill/> mounts ONCE in the root layout — a small floating pill.
 *  · Media modules report through netBus: slow(true) while buffering/loading,
 *    slow(false) when flowing. The pill appears after ~1.2s of "slow" and
 *    vanishes the moment things recover.
 *  · Going offline (navigator.onLine) flips it to a red
 *    "Network error — check your internet connection" banner automatically.
 */

type NetState = { slow: number; offline: boolean };
let state: NetState = { slow: 0, offline: false };
const subs = new Set<(s: NetState) => void>();
const emit = () => subs.forEach((f) => f({ ...state }));

/* pass 34f: React Native defines a global `window` WITHOUT DOM event APIs —
 * `typeof window !== 'undefined'` is TRUE on native and window.addEventListener
 * is undefined, which crashed the whole module graph in Expo Go. Check for
 * the web PLATFORM + the actual function instead. */
const webEvents = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function';
if (webEvents) {
  window.addEventListener('online', () => { state = { ...state, offline: false }; emit(); });
  window.addEventListener('offline', () => { state = { ...state, offline: true }; emit(); });
  state = { ...state, offline: !navigator.onLine };
}

export const netBus = {
  /** register a loading/buffering media source (reference-counted) */
  slow(on: boolean) {
    if (typeof window === 'undefined') return;
    const next = Math.max(0, state.slow + (on ? 1 : -1));
    if (next !== state.slow) { state = { ...state, slow: next }; emit(); }
  },
  offline(): boolean {
    /* native has no navigator.onLine (it reads undefined → would always say
     * "offline") — assume online there; the pill is web-only UX for now. */
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
    return !navigator.onLine;
  },
};

/** Tiny helper: wraps a media promise and reports slow-network while pending. */
export async function withNetGuard<T>(p: Promise<T>, thresholdMs = 1600): Promise<T> {
  netBus.slow(true);
  let t: ReturnType<typeof setTimeout> | null = setTimeout(() => null, thresholdMs);
  const done = () => { if (t) { clearTimeout(t); t = null; } netBus.slow(false); };
  try {
    const v = await p;
    done();
    return v;
  } catch (e) {
    done();
    throw e;
  }
}

export function NetPill() {
  const [s, setS] = useState<NetState>(state);
  const [shown, setShown] = useState(false);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    subs.add(setS);
    return () => { subs.delete(setS); };
  }, []);

  /* the slow pill only shows once loading has persisted a moment (no flicker) */
  useEffect(() => {
    if (s.offline) return; /* offline banner handles itself */
    if (s.slow > 0) {
      const t = setTimeout(() => setShown(true), 1200);
      return () => clearTimeout(t);
    }
    setShown(false);
  }, [s.slow, s.offline]);

  useEffect(() => {
    Animated.timing(anim, { toValue: s.offline || shown ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [s.offline, shown, anim]);

  if (!s.offline && !shown) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 999,
        elevation: 999,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
      }}
    >
      <View
        style={{
          marginTop: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderRadius: 13,
          borderWidth: 1,
          backgroundColor: s.offline ? 'rgba(180,52,52,0.94)' : 'rgba(22,32,26,0.92)',
          borderColor: s.offline ? 'rgba(255,160,160,0.5)' : 'rgba(212,175,55,0.45)',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Text style={{ fontSize: 11, color: s.offline ? '#FFD9D9' : '#E8C96A', fontFamily: 'Poppins-Bold' }}>
          {s.offline ? 'Network error — check your internet connection' : 'Slow network… still loading'}
        </Text>
      </View>
    </Animated.View>
  );
}
