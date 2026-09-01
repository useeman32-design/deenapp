import { Platform } from 'react-native';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';

/**
 * pass 39 — Ruqyah AUDIO (islamicapi.com static MP3s, per their docs):
 *   per-surah recitations …  https://islamicapi.com/audio/ruqyah/{surah}.mp3
 *   Ayatul Kursi …………………  https://islamicapi.com/audio/ruqyah/Ayatul Kursi.mp3
 *   full programs ……………  total_{brief|med|long}_ruqyah.mp3
 * Not part of the JSON API — served as static files. Web: HTMLAudioElement;
 * native: expo-video headless player (same pattern as the adhan player).
 */

const BASE = 'https://islamicapi.com/audio/ruqyah';

/* surahs the API ships audio for */
const SURAH_AUDIO: Record<string, number> = {
  'al-fatiha': 1,
  'al-fatihah': 1,
  'fatiha': 1,
  'al-baqarah': 2,
  'baqarah': 2,
  "al-a'raf": 7,
  'al-araf': 7,
  "a'raf": 7,
  'ta-ha': 20,
  'taha': 20,
  'ta ha': 20,
  'al-kafirun': 109,
  'kafirun': 109,
  'al-ikhlas': 112,
  'ikhlas': 112,
  'al-falaq': 113,
  'falaq': 113,
  'an-nas': 114,
  'nas': 114,
};

export type RuqyahAudio = { url: string; label: string };

export function audioForEntry(title: string): RuqyahAudio | null {
  const t = title.toLowerCase().trim();
  if (/ayat\s*ul\s*kursi|ayatul\s*kursi|kursi/.test(t)) {
    return { url: `${BASE}/Ayatul Kursi.mp3`, label: 'Ayatul Kursi recitation' };
  }
  for (const [name, n] of Object.entries(SURAH_AUDIO)) {
    if (t.startsWith(name) || t.includes(` ${name}`)) {
      return { url: `${BASE}/${n}.mp3`, label: `Surah recitation (${title.split(/ \d/)[0].trim()})` };
    }
  }
  return null;
}

export function audioForProgram(programId: string): RuqyahAudio | null {
  if (programId === 'brief-ruqya') return { url: `${BASE}/total_brief_ruqyah.mp3`, label: 'Complete Brief Ruqyah' };
  if (programId === 'a-medium-ruqya') return { url: `${BASE}/total_med_ruqyah.mp3`, label: 'Complete Medium Ruqyah' };
  if (programId === 'a-long-ruqya') return { url: `${BASE}/total_long_ruqyah.mp3`, label: 'Complete Long Ruqyah' };
  return null;
}

/* ── one thing plays at a time ── */
let el: HTMLAudioElement | null = null;
let nativePlayer: VideoPlayer | null = null;
let currentKey: string | null = null;
type Listen = (key: string | null) => void;
const listeners = new Set<Listen>();
export const onRuqyahAudio = (fn: Listen) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
const emit = () => { listeners.forEach((l) => { try { l(currentKey); } catch {} }); };

export function playRuqyahAudio(key: string, url: string): boolean {
  stopRuqyahAudio();
  try {
    if (Platform.OS !== 'web') {
      nativePlayer = createVideoPlayer(url);
      nativePlayer.loop = false;
      nativePlayer.play();
      currentKey = key;
      emit();
      return true;
    }
    if (typeof window === 'undefined') return false;
    el = new Audio(url);
    el.onerror = () => { el = null; currentKey = null; emit(); };
    el.onended = () => { el = null; currentKey = null; emit(); };
    void el.play().then(() => { currentKey = key; emit(); }).catch(() => { el = null; currentKey = null; emit(); });
    return true;
  } catch {
    stopRuqyahAudio();
    return false;
  }
}

export function stopRuqyahAudio() {
  if (el) {
    try { el.pause(); } catch {}
    el = null;
  }
  if (nativePlayer) {
    try { nativePlayer.pause(); nativePlayer.release(); } catch {}
    nativePlayer = null;
  }
  currentKey = null;
  emit();
}

export function playingKey(): string | null {
  if (nativePlayer) return currentKey;
  return el != null && !el.paused ? currentKey : null;
}
