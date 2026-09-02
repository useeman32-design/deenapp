import { Platform } from 'react-native';

/**
 * expo-video on WEB: `replace()` does load()+play() and the play promise can
 * silently abort, while the player's own `playing` flag stays true — so UI
 * spinners never clear. This probe reads the REAL <video> element state from
 * the DOM (the source of truth on web) so loading/playing are always honest.
 */

export type MediaState = 'playing' | 'paused' | 'none';

export function probeMedia(uri: string | null | undefined): MediaState {
  if (Platform.OS !== 'web' || !uri || typeof window === 'undefined') return 'none';
  try {
    const el = Array.from(window.document.querySelectorAll('video')).find((v) => v.getAttribute('src') === uri) as HTMLVideoElement | undefined;
    if (!el) return 'none';
    if (!el.paused && !el.ended) return 'playing';
    return 'paused';
  } catch {
    return 'none';
  }
}

/** true when the element for `uri` exists, is playing, and time is advancing */
export function probeAdvancing(uri: string | null | undefined, minTime = 0.05): boolean {
  if (Platform.OS !== 'web' || !uri || typeof window === 'undefined') return false;
  try {
    const el = Array.from(window.document.querySelectorAll('video')).find((v) => v.getAttribute('src') === uri) as HTMLVideoElement | undefined;
    return !!el && !el.paused && !el.ended && el.currentTime > minTime;
  } catch {
    return false;
  }
}
