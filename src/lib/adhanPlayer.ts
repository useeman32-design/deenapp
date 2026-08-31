import { Platform } from 'react-native';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { publicBase } from '@/lib/gzio';

/**
 * pass 33 — adhan playback. Three bundled recitations
 * (public/adhan/adhan{1,2,3}.mp3) play when a prayer time arrives while the
 * app is open (the prayer screen schedules it).
 * Web: HTMLAudioElement (autoplay is fine — it only fires after user
 * interaction with the app). Native (pass 34b): expo-video's headless player
 * (audio-only mp3s play fine through it; Expo Go included).
 */
export const ADHAN_VOICES: Array<{ id: 'v1' | 'v2' | 'v3'; label: string; file: string }> = [
  { id: 'v1', label: 'Adhan 1', file: 'adhan/adhan1.mp3' },
  { id: 'v2', label: 'Adhan 2', file: 'adhan/adhan2.mp3' },
  { id: 'v3', label: 'Adhan 3', file: 'adhan/adhan3.mp3' },
];

let el: HTMLAudioElement | null = null;
let nativePlayer: VideoPlayer | null = null;

export function playAdhan(voice: 'v1' | 'v2' | 'v3' = 'v1'): boolean {
  stopAdhan();
  const v = ADHAN_VOICES.find((x) => x.id === voice) ?? ADHAN_VOICES[0];
  try {
    if (Platform.OS !== 'web') {
      const url = `${publicBase()}/${v.file}`;
      nativePlayer = createVideoPlayer(url);
      nativePlayer.loop = true;
      nativePlayer.play();
      return true;
    }
    if (typeof window === 'undefined') return false;
    el = new Audio(`${publicBase()}/${v.file}`);
    el.onerror = () => { el = null; };
    void el.play().catch(() => { el = null; });
    return true;
  } catch {
    stopAdhan();
    return false;
  }
}

export function stopAdhan() {
  if (el) {
    try { el.pause(); el.currentTime = 0; } catch {}
    el = null;
  }
  if (nativePlayer) {
    try { nativePlayer.pause(); nativePlayer.release(); } catch {}
    nativePlayer = null;
  }
}

export function isAdhanPlaying() {
  if (nativePlayer) {
    try { return nativePlayer.playing; } catch { return false; }
  }
  return el != null && !el.paused;
}
