import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useVideoPlayer } from 'expo-video';
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

  const uri = surah != null ? ayahAudio(reciter, globalAyahOf(surah, ayah)) : 'about:blank';
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
  });

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

  /* track time → advance to the next ayah on finish */
  const advancing = useRef(false);
  useEffect(() => {
    const sub = player.addListener('timeUpdate', (state: { currentTime: number; duration?: number }) => {
      const dur = state.duration ?? 0;
      if (surah == null) return;
      if (dur > 0 && state.currentTime >= dur - 0.12 && !advancing.current) {
        advancing.current = true;
        const meta = QURAN.find((s) => s.number === surah);
        if (meta && ayah < meta.ayahs) {
          setAyah((a) => a + 1); // next ayah (auto-plays via effect)
        } else {
          player.pause();
          setPlaying(false);
          setSurah(null);
        }
        setTimeout(() => (advancing.current = false), 400);
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

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
