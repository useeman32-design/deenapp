import { Platform } from 'react-native';

/**
 * pass 33 — adhan playback. Three bundled recitations
 * (public/adhan/adhan{1,2,3}.mp3) play when a prayer time arrives while the
 * app is open (the prayer screen schedules it). Web uses HTMLAudioElement —
 * no autoplay issues because it only ever fires after user interaction with
 * the app. Native returns a no-op until expo-av is wired.
 */
export const ADHAN_VOICES: Array<{ id: 'v1' | 'v2' | 'v3'; label: string; file: string }> = [
  { id: 'v1', label: 'Adhan 1', file: 'adhan/adhan1.mp3' },
  { id: 'v2', label: 'Adhan 2', file: 'adhan/adhan2.mp3' },
  { id: 'v3', label: 'Adhan 3', file: 'adhan/adhan3.mp3' },
];

let el: HTMLAudioElement | null = null;

const urlOf = (file: string) => {
  const base = typeof window !== 'undefined' ? window.location.pathname.replace(/^(\/deenapp\b).*$/, '$1') : '';
  return `${base}/${file}`;
};

export function playAdhan(voice: 'v1' | 'v2' | 'v3' = 'v1'): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  stopAdhan();
  const v = ADHAN_VOICES.find((x) => x.id === voice) ?? ADHAN_VOICES[0];
  try {
    el = new Audio(urlOf(v.file));
    el.onerror = () => { el = null; };
    void el.play().catch(() => { el = null; });
    return true;
  } catch {
    el = null;
    return false;
  }
}

export function stopAdhan() {
  if (el) {
    try { el.pause(); el.currentTime = 0; } catch {}
    el = null;
  }
}

export function isAdhanPlaying() {
  return el != null && !el.paused;
}
