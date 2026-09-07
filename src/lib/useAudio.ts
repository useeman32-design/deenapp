import { useEffect, useRef, useState } from 'react';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { probeAdvancing } from '@/lib/mediaProbe';
import { claimExclusiveAudio, registerAudioStop } from '@/lib/audioBus';

/* expo-video web play() can silently abort after replace() — make sure the
 * actual <video> element carrying this src plays (DOM-level fallback). */
function domEnsurePlay(uri: string | null, tries = 0, wanted: () => boolean = () => true) {
  /* pass 35: stop retrying the moment playback is no longer wanted */
  if (!wanted()) return;
  /* pass 34f: native defines `window` but has no document — bail before touching the DOM */
  if (typeof document === 'undefined' || !uri) return;
  try {
    const doc = window.document;
    const el = Array.from(doc.querySelectorAll('video')).find((v) => v.getAttribute('src') === uri);
    if (el) {
      if (el.paused) void (el as HTMLVideoElement).play().catch(() => {});
      else return;
    }
  } catch {}
  if (tries < 14) window.setTimeout(() => domEnsurePlay(uri, tries + 1, wanted), 450);
}

/**
 * Simple one-source audio hook (dua / 99-names / athkar…): wraps expo-video
 * with the pass-22 requirements — loading state, working progress (polling —
 * web engines don't always emit timeUpdate), fraction seek, pause toggle.
 * Render <GlassPlayerBar> (it mounts the hidden VideoView the web engine needs).
 */
export function useAudio() {
  /* pass 40 — this instance can be stopped by any other player starting */
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frac, setFrac] = useState(0);
  const [duration, setDuration] = useState(0);
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  /* pass 40 — global exclusivity: any other player starting pauses this one */
  const instanceId = useRef(`au${Math.random().toString(36).slice(2, 8)}`).current;
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => registerAudioStop(instanceId, () => stopRef.current()), []);

  useEffect(() => {
    stopRef.current = () => {
      wantPlay.current = false;
      try { player.pause(); } catch {}
      setPlaying(false);
    };
  });

  /* honest loading/playing from the real media element (web) */
  useEffect(() => {
    const iv = setInterval(() => {
      if (!url) {
        setLoading(false);
        return;
      }
      if (probeAdvancing(url)) {
        setLoading(false);
        setPlaying(true);
      } else if (wantPlay.current) {
        setLoading(true);
        setPlaying(false);
      }
    }, 350);
    return () => clearInterval(iv);
  }, [url]);

  useEffect(() => {
    if (!url) return;
    wantPlay.current = true;
    try {
      player.replace({ uri: url });
      player.play();
      setPlaying(true);
      setLoading(true);
    } catch {}
    domEnsurePlay(url, 0, () => wantPlay.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  /* web engines drop play() fired before the source is ready — retry watchdog */
  const wantPlay = useRef(false);
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
    if (!wantPlay.current || !url) return;
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
      domEnsurePlay(url, 0, () => wantPlay.current);
      if (tries > 30) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, [player, url]);

  useEffect(() => {
    const compute = (ct: number, du: number) => {
      if (du > 0) {
        setDuration(du);
        setFrac(Math.min(1, ct / du));
      }
    };
    const t = player.addListener('timeUpdate', (s: { currentTime: number; duration?: number }) => compute(s.currentTime, s.duration ?? 0));
    const iv = setInterval(() => {
      try {
        compute((player as unknown as { currentTime?: number }).currentTime ?? 0, (player as unknown as { duration?: number }).duration ?? 0);
      } catch {}
    }, 400);
    const end = player.addListener('playToEnd', () => {
      wantPlay.current = false;
      setPlaying(false);
      setFrac(1);
    });
    const st = player.addListener('statusChange', () => setPlaying(player.playing));
    return () => {
      t.remove();
      clearInterval(iv);
      end.remove();
      st.remove();
    };
  }, [player]);

  return {
    player: player as VideoPlayer,
    url,
    playing,
    loading,
    frac,
    duration,
    /** start a source (or restart the same one) */
    play: (u: string) => {
      if (u === url && playing) return;
      setUrl(u);
      /* same url paused → just resume */
      if (u === url) {
        try {
          player.play();
          setPlaying(true);
        } catch {}
      }
    },
    pause: () => {
      wantPlay.current = false;
      try {
        player.pause();
      } catch {}
      setPlaying(false);
    },
    toggle: (u: string) => {
      if (u !== url) {
        claimExclusiveAudio(`content:${u.slice(-40)}`);
        setUrl(u);
        return;
      }
      if (!playing) claimExclusiveAudio(`content:${url.slice(-40)}`);
      if (playing) {
        wantPlay.current = false;
        player.pause();
        setPlaying(false);
      } else {
        wantPlay.current = true;
        try {
          player.play();
        } catch {}
        domEnsurePlay(url, 0, () => wantPlay.current);
        setPlaying(true);
      }
    },
    seekFrac: (f: number) => {
      const clamped = Math.max(0, Math.min(1, f));
      setFrac(clamped);
      if (duration > 0) {
        try {
          player.currentTime = clamped * duration;
        } catch {}
      }
    },
    stop: () => {
      wantPlay.current = false;
      try {
        player.pause();
      } catch {}
      setPlaying(false);
      setUrl(null);
      setFrac(0);
      setDuration(0);
    },
  };
}
