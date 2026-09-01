import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { netBus } from '@/lib/net';
import { useVideoPlayer, VideoView } from 'expo-video';
import { QURAN } from '@/data/quran';
import { probeAdvancing } from '@/lib/mediaProbe';

/**
 * Global Qur'an audio — plays per-ayah files so we always know the exact ayah
 * being recited (highlighting + the cassette mini-player).
 * Lives at the root: audio keeps playing anywhere in the app.
 *
 * pass 22:
 *  · DOUBLE-BUFFER — the next ayah is preloaded into a second engine while
 *    the current one plays, so ayah transitions are seamless (no gap/loading).
 *  · `loading` — true while the engine buffers, so play buttons can spin.
 *  · progress polling every 400ms (web engines don't always emit timeUpdate —
 *    the seek bar used to look frozen).
 */

/* pass 34: new reciters — Sudais, Shuraim, Muhammad Ayyub & Maher Al
 * Muaiqly live on everyayah (folder + zero-padded SSSAAA.mp3); the rest on
 * cdn.islamic.network (global-ayah mp3s). `src` picks the URL builder. */
export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Alafasy', photo: require('../../assets/img/reciters/alafasy.jpg') },
  { id: 'ar.husary', name: 'Mahmoud Al-Husary', photo: require('../../assets/img/reciters/husary.jpg') },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit', photo: require('../../assets/img/reciters/abdulbasit.jpg') },
  { id: 'ar.minshawi', name: 'Al-Minshawi', photo: require('../../assets/img/reciters/minshawi.jpg') },
  { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shaatree', photo: require('../../assets/img/reciters/shaatree.jpg') },
  { id: 'ar.abdurrahmaansudais', name: 'Abdurrahman As-Sudais', photo: require('../../assets/img/reciters/sudais.jpg'), src: 'everyayah', folder: 'Abdurrahmaan_As-Sudais_192kbps' },
  { id: 'ar.saudalshuraim', name: 'Saud Ash-Shuraim', photo: require('../../assets/img/reciters/shuraim.jpg'), src: 'everyayah', folder: 'Saood_ash-Shuraym_128kbps' },
  { id: 'ar.muhammadayyub', name: 'Muhammad Ayyub', photo: require('../../assets/img/reciters/ayyub.jpg'), src: 'everyayah', folder: 'Muhammad_Ayyoub_128kbps' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', photo: require('../../assets/img/reciters/maher.jpg') },
] as const;

export type LoopCfg = { surah: number; from: number; to: number; perAyah: number; cycles: number };

const RECITER_CFG = (id: string) => RECITERS.find((r) => r.id === id);
const ayahAudio = (reciter: string, globalAyah: number, surah?: number, ayah?: number) => {
  const cfg = RECITER_CFG(reciter) as { src?: string; folder?: string } | undefined;
  if (cfg?.src === 'everyayah' && cfg.folder && surah != null && ayah != null) {
    const s3 = String(surah).padStart(3, '0');
    const a3 = String(ayah).padStart(3, '0');
    return `https://everyayah.com/data/${cfg.folder}/${s3}${a3}.mp3`;
  }
  return `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyah}.mp3`;
};

/* expo-video web: replace() does load()+play() and the play promise silently
 * aborts (its internal `playing` flag stays true, so retries no-op). Ensure
 * the actual <video> element with this src is playing — DOM-level fallback. */
function domEnsurePlay(uri: string | null, tries = 0) {
  /* pass 34f: native defines `window` but has no document — bail before touching the DOM */
  if (typeof document === 'undefined' || !uri) return;
  try {
    const doc = window.document;
    const el = [...doc.querySelectorAll('video')].find((v) => v.getAttribute('src') === uri);
    if (el) {
      if (el.paused) void (el as HTMLVideoElement).play().catch(() => {});
      else return; /* playing */
    }
  } catch {}
  if (tries < 14) window.setTimeout(() => domEnsurePlay(uri, tries + 1), 450);
}

/** global ayah number (1..6236) from surah:ayah */
export function globalAyahOf(surah: number, ayah: number) {
  let n = 0;
  for (let i = 0; i < surah - 1 && i < QURAN.length; i++) n += QURAN[i].ayahs;
  return n + ayah;
}

/** {surah, ayah} from a global ayah number (1..6236) — for mushaf highlight */
export function surahOfGlobal(global: number): { surah: number; ayah: number } {
  let n = 0;
  for (const s of QURAN) {
    if (global <= n + s.ayahs) return { surah: s.number, ayah: global - n };
    n += s.ayahs;
  }
  return { surah: 114, ayah: 6 };
}

type AudioState = {
  surah: number | null;
  ayah: number;
  /** 0..1 position within the surah (for the seek bar) */
  progress: number;
  /** true while the current ayah is buffering — play buttons show a loader */
  loading: boolean;
  seekTo: (fraction: number) => void;
  reciter: string;
  playing: boolean;
  rate: number;
  /** set for ~5s when a surah ends and the next one is about to play */
  announcement: { surah: number; at: number } | null;
  /** play ONE ayah (stops after it) — the per-ayah play button */
  playAyah: (surah: number, ayah: number) => void;
  playSurah: (surah: number, ayah?: number) => void;
  /** pass-24 memorization loop: repeat one ayah or a range (perAyah/cycles 0 = ∞) */
  loop: LoopCfg | null;
  setLoop: (c: LoopCfg | null) => void;
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
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);
  /** single-ayah mode: play one ayah then stop (ayah action row) */
  const single = useRef(false);
  /* pass-24 loop state (ref mirrors for the playToEnd handler) */
  const [loop, setLoopState] = useState<LoopCfg | null>(null);
  const loopRef = useRef<LoopCfg | null>(null);
  const ayahPlays = useRef(1);
  const cycleCount = useRef(1);
  /** when the surah ends we announce the next one for 5s, then continue */
  const [announcement, setAnnouncement] = useState<{ surah: number; at: number } | null>(null);

  /* ── double buffer: two engines, we alternate so the next ayah is warm ── */
  const engineA = useVideoPlayer(null, (p) => { p.loop = false; });
  const engineB = useVideoPlayer(null, (p) => { p.loop = false; });
  const engines = [engineA, engineB];
  const [active, setActive] = useState(0);
  const player = engines[active];
  const standby = engines[1 - active];
  const standbySrc = useRef<string | null>(null);
  const activeSrc = useRef<string | null>(null);
  /* playback intent — survives source swaps; (re)fires on readyToPlay */
  const wantPlay = useRef(false);

  const uri = surah != null ? ayahAudio(reciter, globalAyahOf(surah, ayah), surah, ayah) : null;

  /* what plays after the current ayah (null = stop) */
  const nextOf = (s: number, a: number): { surah: number; ayah: number } | null => {
    const meta = QURAN.find((x) => x.number === s);
    if (!meta) return null;
    if (a < meta.ayahs) return { surah: s, ayah: a + 1 };
    if (single.current) return null;
    if (s < 114) return { surah: s + 1, ayah: 1 };
    return null;
  };

  /* load current source into the active engine when it changes */
  useEffect(() => {
    if (!uri) return;
    if (uri !== activeSrc.current) {
      activeSrc.current = uri;
      try {
        player.replace({ uri });
        player.playbackRate = rate;
        player.play();
      } catch {}
      domEnsurePlay(uri);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, player]);

  /* web engines drop play() fired before the source is ready — a small
   * watchdog keeps retrying while playback is WANTED until it actually sticks */
  useEffect(() => {
    const st = player.addListener('statusChange', () => {
      if (wantPlay.current && !player.playing) {
        try {
          player.play();
        } catch {}
      }
    });
    return () => st.remove();
  }, [player]);
  useEffect(() => {
    if (!wantPlay.current || surah == null) return;
    let tries = 0;
    const iv = setInterval(() => {
      if (!wantPlay.current) {
        clearInterval(iv);
        return;
      }
      tries += 1;
      if (!player.playing) {
        try {
          player.play();
        } catch {}
      }
      domEnsurePlay(activeSrc.current);
      if (tries > 30) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, [player, surah, uri]);

  /* preload the NEXT ayah into the standby engine (seamless swap) */
  useEffect(() => {
    if (surah == null) return;
    const nx = nextOf(surah, ayah);
    if (!nx) {
      standbySrc.current = null;
      return;
    }
    const nextUri = ayahAudio(reciter, globalAyahOf(nx.surah, nx.ayah), nx.surah, nx.ayah);
    if (nextUri !== standbySrc.current) {
      standbySrc.current = nextUri;
      try {
        standby.replace({ uri: nextUri });
        standby.playbackRate = rate;
        standby.pause();
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, ayah, reciter, standby]);

  useEffect(() => {
    player.playbackRate = rate;
    standby.playbackRate = rate;
  }, [rate, player, standby]);

  /* progress: listener + 400ms polling (web engines don't always emit) */
  useEffect(() => {
    const compute = (currentTime: number, duration?: number) => {
      if (surah == null) return;
      const meta = QURAN.find((s) => s.number === surah);
      if (!meta) return;
      const dur = duration && duration > 0 ? duration : 0;
      const within = dur > 0 ? Math.min(1, currentTime / dur) : 0;
      setProgress(Math.min(1, (ayah - 1 + within) / meta.ayahs));
    };
    const t = player.addListener('timeUpdate', (state: { currentTime: number; duration?: number }) => compute(state.currentTime, state.duration));
    const iv = setInterval(() => {
      try {
        compute((player as unknown as { currentTime?: number }).currentTime ?? 0, (player as unknown as { duration?: number }).duration);
      } catch {}
    }, 400);
    return () => {
      t.remove();
      clearInterval(iv);
    };
  }, [player, surah, ayah]);

  /* loading + playing — read the REAL media element (web truth) so the
   * spinner clears the moment audio actually starts, and shows again while
   * the next ayah buffers (slow networks). pass 28: also feeds the global
   * net pill so users see slow-network / offline state app-wide. */
  useEffect(() => {
    let netOn = false;
    const iv = setInterval(() => {
      const src = activeSrc.current;
      if (surah == null || !src) {
        setLoading(false);
        if (netOn) { netBus.slow(false); netOn = false; }
        return;
      }
      if (probeAdvancing(src)) {
        setLoading(false);
        setPlaying(true);
        if (netOn) { netBus.slow(false); netOn = false; }
      } else if (wantPlay.current) {
        setLoading(true);
        setPlaying(false);
        if (!netOn) { netBus.slow(true); netOn = true; }
      }
    }, 350);
    return () => { clearInterval(iv); if (netOn) netBus.slow(false); };
  }, [surah]);

  /* advance on end-of-item — flip to the preloaded standby engine */
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      if (surah == null) return;
      const meta = QURAN.find((s) => s.number === surah);
      const atEnd = meta && ayah >= meta.ayahs;
      /* pass 28: a SINGLE-ayah listen stops at the end of ITS ayah —
       * mid-surah too (it used to roll seamlessly into the next verse) */
      if (single.current) {
        single.current = false;
        wantPlay.current = false;
        player.pause();
        standby.pause();
        setPlaying(false);
        setSurah(null);
        activeSrc.current = null;
        return;
      }
      if (atEnd && single.current) {
        single.current = false;
        wantPlay.current = false;
        player.pause();
        setPlaying(false);
        setSurah(null);
        activeSrc.current = null;
        return;
      }
      if (atEnd && surah >= 114) {
        wantPlay.current = false;
        player.pause();
        setPlaying(false);
        setSurah(null);
        activeSrc.current = null;
        return;
      }
      if (atEnd) {
        /* end of surah → announce the next one for 5s, then continue */
        const next = surah + 1;
        setAnnouncement({ surah: next, at: Date.now() });
        setTimeout(() => {
          setAnnouncement(null);
          setSurah(next);
          setAyah(1);
          setPlaying(true);
        }, 5000);
        return;
      }
      /* pass-24: memorization loop — repeat this ayah / walk the range */
      const L = loopRef.current;
      if (L && L.surah === surah && !single.current) {
        const wantMore = L.perAyah === 0 || ayahPlays.current < L.perAyah;
        if (wantMore) {
          ayahPlays.current++;
          try { player.replay(); } catch {}
          domEnsurePlay(uri, 0);
          return;
        }
        ayahPlays.current = 1;
        if (ayah >= L.to) {
          const moreCycles = L.cycles === 0 || cycleCount.current < L.cycles;
          if (moreCycles) {
            cycleCount.current++;
            setAyah(L.from);
            setPlaying(true);
            return; /* uri changes -> the load effect reloads + plays */
          }
          loopRef.current = null;
          setLoopState(null); /* finished the whole loop -> continue normally */
        }
      }
      /* mid-surah: seamless swap into the standby engine (already loaded) */
      activeSrc.current = standbySrc.current;
      standbySrc.current = null;
      setActive((i) => 1 - i);
      setAyah((a) => a + 1);
      try {
        standby.playbackRate = rate;
        standby.play();
      } catch {}
    });
    const statusSub = player.addListener('statusChange', () => setPlaying(player.playing));
    return () => {
      sub.remove();
      statusSub.remove();
    };
  }, [player, standby, surah, ayah, rate]);

  const value = useMemo<AudioState>(
    () => ({
      surah,
      ayah,
      reciter,
      playing,
      loading,
      rate,
      progress,
      announcement,
      seekTo: (fraction: number) => {
        if (surah == null) return;
        const meta = QURAN.find((s) => s.number === surah);
        if (!meta) return;
        const target = Math.min(meta.ayahs, Math.max(1, Math.ceil(fraction * meta.ayahs)));
        setAyah(target);
      },
      loop,
      setLoop: (c) => {
        loopRef.current = c;
        ayahPlays.current = 1;
        cycleCount.current = 1;
        setLoopState(c);
      },
      playSurah: (s: number, a = 1) => {
        if (loopRef.current && loopRef.current.surah !== s) {
          loopRef.current = null;
          setLoopState(null);
        }
        ayahPlays.current = 1;
        cycleCount.current = 1;
        single.current = false;
        wantPlay.current = true;
        setAnnouncement(null);
        setSurah(s);
        setAyah(a);
        setPlaying(true);
      },
      playAyah: (s: number, a: number) => {
        single.current = true;
        wantPlay.current = true;
        setAnnouncement(null);
        setSurah(s);
        setAyah(a);
        setPlaying(true);
      },
      stop: () => {
        single.current = false;
        wantPlay.current = false;
        setAnnouncement(null);
        player.pause();
        standby.pause();
        setPlaying(false);
        setSurah(null);
        activeSrc.current = null;
      },
      toggle: () => {
        if (surah == null) return;
        if (playing) {
          wantPlay.current = false;
          player.pause();
          setPlaying(false);
        } else {
          wantPlay.current = true;
          try {
            player.play();
          } catch {}
          domEnsurePlay(activeSrc.current);
          setPlaying(true);
        }
      },
      setReciter: (id: string) => {
        setReciterState(id);
      },
      cycleRate: () => setRate((r) => (r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 0.75 : 1)),
    }),
    [surah, ayah, reciter, playing, loading, rate, player, standby, announcement, progress],
  );

  /* Both engines need a mounted media element — on WEB expo-video only creates
   * its <video> when a <VideoView> is attached (otherwise silence). */
  return (
    <Ctx.Provider value={value}>
      {children}
      <VideoView player={engineA} style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01, pointerEvents: 'none' }} contentFit="contain" nativeControls={false} />
      <VideoView player={engineB} style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01, pointerEvents: 'none' }} contentFit="contain" nativeControls={false} />
    </Ctx.Provider>
  );
}
