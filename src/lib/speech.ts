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

/** one-shot arabic dictation (recite-to-search). Resolves on first final. */
export function dictateArabic(onInterim?: (text: string) => void, timeoutMs = 12000): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = getRecognition({ continuous: false });
    if (!r) return reject(new Error('UNSUPPORTED'));
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; try { r.stop(); } catch {} resolve(last); } }, timeoutMs);
    let last = '';
    r.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript + ' ';
        else interim += res[0].transcript + ' ';
      }
      if (interim) { last = interim; onInterim?.(interim); }
      if (final.trim()) {
        done = true;
        clearTimeout(timer);
        try { r.stop(); } catch {}
        resolve(final.trim());
      }
    };
    r.onerror = (e: any) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error(e?.error || 'MIC_ERROR'));
    };
    r.onend = () => { if (!done) { done = true; clearTimeout(timer); resolve(last.trim()); } };
    try { r.start(); } catch (err) { reject(err as Error); }
  });
}
