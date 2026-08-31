/**
 * Speech recognition wrapper (pass 24) — Web Speech API.
 * iOS Safari 14.5+ and Chrome support webkitSpeechRecognition; Android Chrome
 * too. Native apps would need a native module — we expose isSupported so UI
 * can fall back to typed input / tap-to-reveal practice.
 */

export type RecResult = { final: string; interim: string };

type AnyRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function getRecognition(opts?: { lang?: string; continuous?: boolean }): AnyRec | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: AnyRec = new Ctor();
  r.lang = opts?.lang ?? 'ar-SA';
  r.continuous = opts?.continuous ?? true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}

/** arabic dictation (pass 32 rewrite) — built for VOICE SEARCH.
 * The pass-24 one-shot resolved '' the instant iOS ended its first session
 * (iOS ignores `continuous`), so voice search "showed no results". Now:
 *  · continuous + auto-restart on EVERY onend (≤14 tries, growing gap)
 *  · finals/interims merged with tail-overlap (re-deliveries deduped, partial
 *    iOS interims merged — never overwritten)
 *  · a final transcript finishes after a 900ms "still talking?" extension wait
 *  · MIC_NOT_ALLOWED rejects (caller shows the permission hint)
 */
export function dictateArabic(onInterim?: (text: string) => void, timeoutMs = 12000): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = getRecognition({ continuous: true });
    if (!r) return reject(new Error('UNSUPPORTED'));
    let done = false;
    let finals = '';
    let interim = '';
    let endTimer: ReturnType<typeof setTimeout> | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;
    const finish = (val: string) => {
      if (done) return;
      done = true;
      if (endTimer) clearTimeout(endTimer);
      if (restartTimer) clearTimeout(restartTimer);
      try { r.abort(); } catch {}
      resolve(val.trim());
    };
    const timer = setTimeout(() => finish(finals || interim), timeoutMs);

    const mergeTail = (cur: string, t: string): string => {
      const c = cur.trim();
      const x = t.trim();
      if (!x) return c;
      if (!c) return x;
      if (c.endsWith(x)) return c;
      const words = c.split(/\s+/);
      const tw = x.split(/\s+/);
      let overlap = 0;
      for (let k = Math.min(words.length, tw.length); k > 0; k--) {
        if (words.slice(words.length - k).join(' ') === tw.slice(0, k).join(' ')) { overlap = k; break; }
      }
      return overlap ? (c + ' ' + tw.slice(overlap).join(' ')).trim() : c + ' ' + x;
    };

    r.onresult = (e: any) => {
      if (done) return;
      let interSeg = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt: string = res[0]?.transcript ?? '';
        if (res.isFinal) {
          finals = finals.endsWith(txt.trim()) && txt.trim().length > 2 ? finals : mergeTail(finals, txt);
          interim = '';
        } else interSeg += txt + ' ';
      }
      if (interSeg.trim()) interim = mergeTail(interim, interSeg);
      const live = (finals + ' ' + interim).trim();
      if (live) onInterim?.(live);
      /* a FINAL means the utterance settled — wait a beat for a continuation,
       * then hand the query over */
      if (finals.trim()) {
        if (endTimer) clearTimeout(endTimer);
        endTimer = setTimeout(() => finish(finals), 900);
      }
    };
    r.onerror = (e: any) => {
      const code = e?.error ?? 'error';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        if (!done) { done = true; clearTimeout(timer); try { r.abort(); } catch {} reject(new Error('MIC_NOT_ALLOWED')); }
        return;
      }
      /* transient (no-speech/network/aborted) — the restart loop rides on */
    };
    r.onend = () => {
      if (done) return;
      if (restartTimer) clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        if (done || tries >= 14) { finish(finals || interim); return; }
        tries += 1;
        try { r.start(); } catch { /* already started or dead — onend will re-fire */ }
      }, Math.min(500, 120 + tries * 40));
    };
    try { r.start(); } catch (err) { clearTimeout(timer); reject(err as Error); }
  });
}
