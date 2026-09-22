import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * pass 97 — "it is not checking for new posts".
 *
 * Every feed in the app loaded ONCE (on mount) and then never asked the server
 * again. The consequence the owner hit: a video posted from the Videos page did
 * not appear in Community or on his Profile until he killed the PWA and came
 * back (Community hydrates from its per-account cache, so a plain reload could
 * even re-show the old list). There was no app-wide notion of "content
 * changed" — only per-post delete events.
 *
 * This module gives every feed two triggers:
 *   · a CONTENT EVENT — any successful post/video/upload emits, and every
 *     mounted feed refetches at once (no screen hop, no restart);
 *   · a FOCUS + FOREGROUND sweep — returning to a tab, or bringing the app
 *     back to the front (PWA tab switch included), refetches the top page, plus
 *     a light interval while the screen is focused so a post made on another
 *     device shows up without any interaction.
 */

export type FeedKind = 'post' | 'video' | 'group' | 'message' | 'notification';

const listeners = new Map<FeedKind, Set<(at: number) => void>>();

export function emitContentChanged(kind: FeedKind = 'post'): void {
  const at = Date.now();
  listeners.get(kind)?.forEach((fn) => {
    try {
      fn(at);
    } catch {
      /* a broken listener must never break the emitter */
    }
  });
  /* a new post is also new content for every generic feed surface */
  if (kind !== 'post') {
    listeners.get('post')?.forEach((fn) => {
      try {
        fn(at);
      } catch {
        /* ignore */
      }
    });
  }
}

export function onContentChanged(kind: FeedKind, fn: (at: number) => void): () => void {
  let set = listeners.get(kind);
  if (!set) {
    set = new Set();
    listeners.set(kind, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
  };
}

/**
 * Refresh `refetch` when:
 *   · the screen gains focus,
 *   · this app comes back to the foreground (PWA tab switch / phone unlock),
 *   · the server tells us something changed (`kind`),
 *   · every `intervalMs` while focused (0 disables).
 *
 * `refetch` does NOT need to be stable: it is kept in a ref, so a caller may
 * pass an inline arrow without breaking anything (see pass 100 below).
 */
export function useContentRefresh(
  kind: FeedKind,
  refetch: () => void | Promise<void>,
  options: { intervalMs?: number } = {},
): void {
  const { intervalMs = 45000 } = options;
  const busy = useRef(false);
  /* pass 100 — owner: "the videos page is crashing, taking time to boot and the
   * video takes time to play". The videos screen passed an INLINE arrow as
   * `refetch`, so `run` (useCallback [refetch]) — and therefore the useFocusEffect
   * callback above it — got a new identity on EVERY render. React Navigation
   * re-invokes useFocusEffect whenever its callback identity changes, so each
   * render called run() → setState (setLiveTick/setStoreTick) → render → … an
   * unbounded refetch storm: measured 1,625 `videos/list.php` + 1,625
   * `feed/get_posts.php` calls in 20 seconds on the rig, which starved the media
   * request and killed the reel ("no supported source was found").
   * The ref keeps `run` (and every subscription below) stable no matter how the
   * caller writes its refetch. */
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const run = useCallback(() => {
    if (busy.current) return; /* never stack overlapping refetches */
    busy.current = true;
    try {
      const r = refetchRef.current();
      if (r && typeof (r as Promise<void>).then === 'function') {
        void (r as Promise<void>).finally(() => {
          busy.current = false;
        });
      } else {
        busy.current = false;
      }
    } catch {
      busy.current = false;
    }
  }, []);

  /* focus + interval */
  useFocusEffect(
    useCallback(() => {
      run();
      if (intervalMs <= 0) return undefined;
      const iv = setInterval(run, intervalMs);
      return () => clearInterval(iv);
    }, [run, intervalMs]),
  );

  /* content events */
  useEffect(() => {
    const off = onContentChanged(kind, () => run());
    return off;
  }, [kind, run]);

  /* app foreground (web: document visibility, native: AppState) */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    let onVis: (() => void) | null = null;
    if (typeof document !== 'undefined') {
      onVis = () => {
        if (document.visibilityState === 'visible') run();
      };
      document.addEventListener('visibilitychange', onVis);
    }
    return () => {
      sub.remove();
      if (onVis && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [run]);
}

/**
 * Merge a freshly fetched first page ON TOP of what is already on screen:
 * new rows appear immediately, rows the user is interacting with are not
 * dropped, and nothing is duplicated. Server order wins for the top block.
 */
export function mergeNewest<T extends { id: number | string }>(fresh: T[], current: T[], keep = 40): T[] {
  if (!fresh.length) return current;
  const seen = new Set(fresh.map((x) => x.id));
  const older = current.filter((x) => !seen.has(x.id));
  return [...fresh, ...older].slice(0, Math.max(keep, fresh.length));
}
