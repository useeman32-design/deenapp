import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import type { ScrollView } from 'react-native';

/**
 * pass 52 — "teach the navigation" deep links.
 *
 * A Today's Goal no longer opens the destination screen directly. It opens the
 * HUB that contains it (Learning Hub, Worship Tools tab) with `?focus=<key>`,
 * and this hook smoothly scrolls that hub to the matching card and flashes a
 * highlight ring on it. The point is that users learn *where* things live in
 * the app instead of being teleported straight there.
 *
 * Usage:
 *   const { highlight, register, scrollRef } = useGoalFocus();
 *   <ScrollView ref={scrollRef}> … <Card ref={register('tafsir')}
 *     style={ring(highlight === 'tafsir')} /> … </ScrollView>
 */
type Measurable = {
  measure: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) => void;
};
type Scrollable = { scrollTo: (o: { y: number; animated: boolean }) => void };

export function useGoalFocus<S = ScrollView>() {
  const params = useLocalSearchParams<{ focus?: string; t?: string }>();
  const raw = params.focus;
  const focus = typeof raw === 'string' && raw ? raw : undefined;
  /* pass 54 — a nonce so tapping the SAME goal twice re-runs the scroll+highlight.
   * Without it the param is unchanged on the second tap and the effect never fires. */
  const nonce = typeof params.t === 'string' ? params.t : '';

  const scrollRef = useRef<S | null>(null);
  const nodes = useRef<Record<string, Measurable>>({});
  const [highlight, setHighlight] = useState<string | null>(null);

  const register = useCallback(
    (key: string) => (el: Measurable | null) => {
      if (el) nodes.current[key] = el;
      else delete nodes.current[key];
    },
    [],
  );

  useEffect(() => {
    if (!focus) return;
    let alive = true;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    /* Layout must settle before measure() returns real offsets. */
    const t = setTimeout(() => {
      const el = nodes.current[focus];
      const sc = scrollRef.current as unknown as Scrollable | null;
      if (!el || !sc) return;
      try {
        el.measure((_x, _y, _w, _h, _px, py) => {
          if (!alive || !Number.isFinite(py)) return;
          try { sc.scrollTo({ y: Math.max(0, py - 120), animated: true }); } catch { /* noop */ }
          setHighlight(focus);
          clearTimer = setTimeout(() => { if (alive) setHighlight(null); }, 2800);
        });
      } catch { /* measure unsupported — skip the scroll, keep the highlight */ }
    }, 500);

    return () => {
      alive = false;
      clearTimeout(t);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [focus, nonce]);

  return { focus, highlight, register, scrollRef };
}

/** Gold ring used to mark the highlighted card. */
export function focusRing(active: boolean) {
  if (!active) return {};
  return {
    borderColor: 'rgba(212,175,55,0.95)',
    borderWidth: 2,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.85,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  };
}

/** '/tools/tafsir' -> 'tafsir' */
export const focusKeyFromHref = (href?: string): string => (href ? href.split('/').filter(Boolean).pop() ?? href : '');
