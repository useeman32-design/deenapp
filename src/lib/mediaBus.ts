/**
 * pass 90 — the media bus.
 *
 * Owner report (repeated): "videos kept playing even when they are out of view
 * — when I visited notifications page and come back, or shops page, the video
 * will continue playing. Make it like whenever that video is out of view it
 * will stop playing, even on the videos page. On the native app multiple
 * videos are playing simultaneously on the videos page."
 *
 * Every screen solved this on its own, which is how the holes appeared. This
 * module makes the rule global and boring:
 *
 *   1. only ONE surface may hold the speaker at a time (`claimMedia`);
 *   2. holding it requires the screen to be focused, the app to be foreground,
 *      the browser tab to be visible and the host view to be on screen —
 *      lose any of those and the holder is released and everyone pauses.
 *
 * Surfaces that embed something we cannot command (YouTube iframes / WebView)
 * implement "pause" by unmounting the embed, which is the only reliable stop.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

type Holder = string | null;

let current: Holder = null;
const subs = new Set<(k: Holder) => void>();

function emit() {
  subs.forEach((f) => {
    try {
      f(current);
    } catch {
      /* one bad listener must never break playback control */
    }
  });
}

export function mediaHolder(): Holder {
  return current;
}

/** Take the speaker. Whoever held it before is told to stop. */
export function claimMedia(key: string) {
  if (current === key) return;
  current = key;
  emit();
}

/** Give the speaker back (also called automatically when a gate closes). */
export function releaseMedia(key: string) {
  if (current !== key) return;
  current = null;
  emit();
}

/** Nobody may play — used when a screen blurs or the app is backgrounded. */
export function silenceMedia() {
  if (current === null) return;
  current = null;
  emit();
}

/** Subscribe to holder changes; fires immediately with the current holder. */
export function subscribeMedia(fn: (k: Holder) => void): () => void {
  subs.add(fn);
  try {
    fn(current);
  } catch {
    /* ignore */
  }
  return () => {
    subs.delete(fn);
  };
}

/** True while `key` holds the speaker. */
export function useMediaHolds(key: string): boolean {
  const [holds, setHolds] = useState<boolean>(() => current === key);
  useEffect(() => subscribeMedia((k) => setHolds(k === key)), [key]);
  return holds;
}

/**
 * Cheap on-screen test that works on native AND web: expo-video / YouTube
 * embeds expose no reliable "is the user still looking at me" event, so the
 * host view's window position is polled while it is playing (nothing runs
 * while nothing is playing).
 */
export function useOnScreen<T extends { measureInWindow?: (cb: (...a: number[]) => void) => void }>(
  ref: { current: T | null },
  enabled: boolean,
): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const last = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = () => {
      const node = ref.current;
      if (!node || typeof node.measureInWindow !== 'function') return;
      try {
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          if (!alive) return;
          const vh = Dimensions.get('window').height;
          const vw = Dimensions.get('window').width;
          // A card counts as "in view" while a usable part of it is between
          // the top and bottom edges — anything else is out of view.
          const visible =
            h > 4 && w > 4 && y + h > vh * 0.12 && y < vh * 0.88 && x + w > 0 && x < vw;
          if (visible !== last.current) {
            last.current = visible;
            setOnScreen(visible);
          }
        });
      } catch {
        /* detached mid-tick — the unmount cleanup stops the poll */
      }
    };
    const iv = setInterval(tick, 260);
    tick();
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [enabled, ref]);
  return onScreen;
}

export interface MediaGate {
  /** Attach to the wrapper View that holds the media. */
  hostRef: { current: unknown };
  /** True while this surface may make sound. */
  allowed: boolean;
  /** True while this surface holds the speaker (drives the play/pause icon). */
  holding: boolean;
  /** The user pressed play. */
  start: () => void;
  /** The user paused (or the surface stopped). */
  stop: () => void;
}

/**
 * Gate one media surface by `key`: it is allowed to play only while it holds
 * the speaker AND its screen is focused AND the app/browser is foreground AND
 * it is on screen. Any of those failing releases the speaker for everyone.
 */
export function useMediaGate(key: string, opts?: { autoReleaseWhenOffScreen?: boolean }): MediaGate {
  const hostRef = useRef<any>(null);
  const autoRelease = opts?.autoReleaseWhenOffScreen !== false;

  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        setScreenFocused(false);
        // Leaving the screen is the exact case the owner flagged (notifications
        // / shops opened over the feed) — silence everything on the way out.
        silenceMedia();
      };
    }, []),
  );

  const [appActive, setAppActive] = useState<boolean>(() => {
    try {
      return AppState.currentState === 'active';
    } catch {
      return true;
    }
  });
  useEffect(
    () =>
      AppState.addEventListener('change', (st) => {
        setAppActive(st === 'active');
        if (st !== 'active') silenceMedia();
      }).remove,
    [],
  );

  const [docVisible, setDocVisible] = useState(true);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const v = () => setDocVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', v);
    v();
    return () => document.removeEventListener('visibilitychange', v);
  }, []);

  const holding = useMediaHolds(key);
  const onScreen = useOnScreen(hostRef, holding);

  const allowed = screenFocused && appActive && docVisible && holding && onScreen;

  // The gate closing must free the speaker, otherwise an off-screen card would
  // keep it and the next video the user taps would never get it.
  useEffect(() => {
    if (holding && (!screenFocused || !appActive || !docVisible || (autoRelease && !onScreen))) {
      releaseMedia(key);
    }
  }, [holding, screenFocused, appActive, docVisible, onScreen, autoRelease, key]);

  const start = useCallback(() => claimMedia(key), [key]);
  const stop = useCallback(() => releaseMedia(key), [key]);

  return { hostRef, allowed, holding, start, stop };
}
