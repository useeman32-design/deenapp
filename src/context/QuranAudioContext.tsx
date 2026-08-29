import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { QURAN } from '@/data/quran';

/**
 * Global Qur'an audio (pass 16) — plays per-ayah files so we always know the
 * exact ayah being recited (highlighting + the cassette mini-player).
 * Lives at the root: audio keeps playing anywhere in the app.
 */

export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Al-Husary' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit' },
  { id: 'ar.minshawi', name: 'Al-Minshawi' },
  { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shaatree' },
] as const;

const ayahAudio = (reciter: string, globalAyah: number) => `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyah}.mp3`;

/** global ayah number (1..6236) from surah:ayah */
export function globalAyahOf(surah: number, ayah: number) {
  let n = 0;
  for (let i = 0; i < surah - 1 && i < QURAN.length; i++) n += QURAN[i].ayahs;
  return n + ayah;
}

type AudioState = {
  surah: number | null;
  ayah: number;
  /** 0..1 position within the surah (for the seek bar) */
  progress: number;
  seekTo: (fraction: number) => void;
  reciter: string;
  playing: boolean;
  rate: number;
  playSurah: (surah: number, ayah?: number) => void;
  stop: () => void;
  toggle: () => void;
  setReciter: (id: string) => void;
  cycleRate: () => void;
};

const Ctx = createContext<AudioState | null>(null);

export function useQuranAudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useQuranAudio outside provider');
  return v;
}

export function QuranAudioProvider({ children }: { children: React.ReactNode }) {
  const [surah, setSurah] = useState<number | null>(null);
  const [ayah, setAyah] = useState(1);
  const [reciter, setReciterState] = useState<string>('ar.alafasy');
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);

  const uri = surah != null ? ayahAudio(reciter, globalAyahOf(surah, ayah)) : null;
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = false;
  });

  /* expo-video does not reliably swap sources via the hook arg — replace() */
  const lastSrc = useRef<string | null>(uri);
  useEffect(() => {
    if (uri && uri !== lastSrc.current) {
      lastSrc.current = uri;
      try {
        player.replace({ uri });
        player.playbackRate = rate;
        player.play();
      } catch {}
    }
  }, [uri, player, rate]);

  /* play whenever the ayah/reciter changes and we're active */
  useEffect(() => {
    if (surah == null) return;
    player.playbackRate = rate;
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, ayah, reciter]);

  useEffect(() => {
    player.playbackRate = rate;
  }, [rate, player]);

  /* ayah progress → surah fraction */
  useEffect(() => {
    const t = player.addListener('timeUpdate', (state: { currentTime: number; duration?: number }) => {
      if (surah == null) return;
      const meta = QURAN.find((s) => s.number === surah);
      if (!meta) return;
      const dur = state.duration && state.duration > 0 ? state.duration : 1;
      setProgress(Math.min(1, (ayah - 1 + Math.min(1, state.currentTime / dur)) / meta.ayahs));
    });
    return () => t.remove();
  }, [player, surah, ayah]);

  /* advance on the engine's own end-of-item event (reliable) */
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      if (surah == null) return;
      const meta = QURAN.find((s) => s.number === surah);
      if (meta && ayah < meta.ayahs) setAyah((a) => a + 1); // next ayah auto-plays via replace()
      else {
        player.pause();
        setPlaying(false);
        setSurah(null);
      }
    });
    const statusSub = player.addListener('statusChange', () => setPlaying(player.playing));
    return () => {
      sub.remove();
      statusSub.remove();
    };
  }, [player, surah, ayah]);

  const value = useMemo<AudioState>(
    () => ({
      surah,
      ayah,
      reciter,
      playing,
      rate,
      progress,
      seekTo: (fraction: number) => {
        if (surah == null) return;
        const meta = QURAN.find((s) => s.number === surah);
        if (!meta) return;
        const target = Math.min(meta.ayahs, Math.max(1, Math.ceil(fraction * meta.ayahs)));
        setAyah(target);
      },
      playSurah: (s: number, a = 1) => {
        setSurah(s);
        setAyah(a);
        setPlaying(true);
      },
      stop: () => {
        player.pause();
        setPlaying(false);
        setSurah(null);
      },
      toggle: () => {
        if (surah == null) return;
        if (playing) {
          player.pause();
          setPlaying(false);
        } else {
          player.play();
          setPlaying(true);
        }
      },
      setReciter: (id: string) => {
        setReciterState(id);
      },
      cycleRate: () => setRate((r) => (r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 0.75 : 1)),
    }),
    [surah, ayah, reciter, playing, rate, player],
  );

  /* The player must own a mounted media element — on WEB expo-video only
   * creates its <video> when a <VideoView> is attached, so without this
   * hidden view the recitation is completely silent in browsers.
   * (Native would play without it; harmless either way.) */
  return (
    <Ctx.Provider value={value}>
      {children}
      <VideoView
        player={player}
        style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01, pointerEvents: 'none' }}
        contentFit="contain"
        nativeControls={false}
      />
    </Ctx.Provider>
  );
}
