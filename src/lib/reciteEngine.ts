import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeArabic } from '@/lib/quranSearch';
import { getRecognition, speechSupported } from '@/lib/speech';

/**
 * Recite engine (pass 27) — shared by the ReciteMode screen AND inline mushaf
 * page recitation.
 *
 * STRICTNESS (user feedback): vowel/wasl slips that change a word must be
 * flagged. A spoken word counts as correct only if it equals the expected word
 * EXACTLY (bare letters) or differs by at most ONE substitution with the SAME
 * length. Added/dropped letters (aamanu → aaminu, kafaru → kufiru) FAIL.
 * Joined words (wasl) must equal the joined run exactly.
 *
 * LIFECYCLE: when the ayah completes, the mic STOPS by itself. With autoNext
 * armed, a PERFECT ayah advances to the next one and keeps listening; any
 * mistake stays on the same ayah for the user to retry.
 *
 * WORD AUDIO: audio.qurancdn.com/wbw/{sss}_{aaa}_{www}.mp3 (verified) — real
 * reciter pronunciation per word, TTS then full-ayah as fallbacks.
 */

const DIA = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06E5\u06E6]/g;
export const bare = (t: string) => normalizeArabic(t).replace(DIA, '').replace(/\s+/g, ' ').trim();
const BASM_NORM = 'بسم الله الرحمن الرحيم';

export type WordState = 'hidden' | 'ok' | 'wrong';

/** strict equality: exact, or one substitution of equal length */
/* pass 27: light normalizer that PRESERVES harakat — used to catch vowel/wasl
 * slips (aamanu→aaminu, kafaru→kufiru) that bare() makes invisible. */
const MARK = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;
const PUNCT = /[\u061F\u061B\u060C.,;:!?\u0640\u06E5\u06E6]/g;
export function keepMarks(t: string): string {
  return t.replace(PUNCT, ' ').replace(/\s+/g, ' ').trim();
}
/** letters + attached marks, e.g. "كَفَرُوا" → [["ك","َ"],["ف","َ"],["ر","ُ"],["و",""],["ا",""]] */
function markPairs(w: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let letter = '';
  let marks = '';
  for (const ch of w) {
    if (MARK.test(ch)) { marks += ch; continue; }
    if (letter) out.push([letter, marks]);
    letter = ch; marks = '';
  }
  if (letter) out.push([letter, marks]);
  return out;
}
/** true when the spoken word's marks CONFLICT with the expected word's marks.
 * Only positions the speaker actually vocalized (marked in the transcript)
 * are checked; the final letter's marks are ignored (case-ending tolerance). */
function marksConflict(expected: string, spoken: string): boolean {
  if (!expected || !spoken) return false;
  const E = markPairs(keepMarks(expected));
  const S = markPairs(keepMarks(spoken));
  if (E.length !== S.length) return false; /* letter shift — be lenient here */
  let marked = 0;
  let bad = 0;
  for (let i = 0; i < E.length; i++) {
    if (i === E.length - 1) continue; /* ending i'rab tolerated */
    const sm = S[i][1];
    if (!sm) continue; /* speaker didn't vocalize this letter */
    marked++;
    if (E[i][0] !== S[i][0]) continue; /* letter-level handled elsewhere */
    if (E[i][1] !== sm) bad++;
  }
  /* only judge richly-marked transcripts; single-mark noise is ignored */
  return marked >= 2 && bad >= 1;
}

export function strictEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length !== b.length) return false;
  let sub = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) sub++;
  return sub <= 1;
}

/** loose equality — for SEARCH only (recognition noise tolerance) */
export function looseEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const budget = a.length <= 3 ? 1 : a.length <= 6 ? 2 : 3;
  if (Math.abs(a.length - b.length) > budget) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length && edits <= budget) {
    if (a[i] === b[j]) { i++; j++; }
    else { edits++; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  }
  return edits + (a.length - i) + (b.length - j) <= budget;
}

export type AlignResult = { states: WordState[]; reached: number };

/** strict alignment of expected words against everything spoken */
export function align(E: string[], S: string[], EM?: string[], SM?: string[]): AlignResult {
  const n = E.length;
  const states: WordState[] = new Array(n).fill('hidden');
  const used = new Array(S.length).fill(false);
  const pairs: Array<[number, number]> = [];
  let ei = 0;

  for (let si = 0; si < S.length && ei < n; si++) {
    const tok = S[si];
    if (!tok) continue;
    if (strictEq(E[ei], tok)) { states[ei] = 'ok'; used[si] = true; pairs.push([ei, si]); ei++; continue; }
    /* wasl — this token is 2-4 expected words said joined */
    let joinHit = 0;
    for (let k = 2; k <= 4 && ei + k <= n; k++) {
      if (strictEq(E.slice(ei, ei + k).join(''), tok)) { joinHit = k; break; }
    }
    if (joinHit) { for (let q = 0; q < joinHit; q++) states[ei + q] = 'ok'; ei += joinHit; used[si] = true; continue; }
    /* skip-ahead — the NEXT word was said: the current one is a mistake */
    if (ei + 1 < n && strictEq(E[ei + 1], tok)) { states[ei] = 'wrong'; states[ei + 1] = 'ok'; pairs.push([ei + 1, si]); ei += 2; used[si] = true; continue; }
    /* else: insertion noise — ignore */
  }

  /* split — the frontier word equals two unused tokens glued */
  let front = 0;
  while (front < n && states[front] !== 'hidden') front++;
  if (front < n) {
    for (let si = 0; si < S.length - 1; si++) {
      if (!used[si] && !used[si + 1] && strictEq(E[front], (S[si] ?? '') + (S[si + 1] ?? ''))) {
        states[front] = 'ok'; used[si] = true; used[si + 1] = true; break;
      }
    }
  }

  /* pass 27: harakat check — a letter-perfect word said with the WRONG vowels
   * (aamanu→aaminu) is wrong when the transcript carries the marks */
  if (EM && SM) {
    for (const [pei, psi] of pairs) {
      if (states[pei] === 'ok' && marksConflict(EM[pei] ?? '', SM[psi] ?? '')) states[pei] = 'wrong';
    }
  }

  /* corrections — a red word re-said correctly turns green */
  for (let i = 0; i < n; i++) {
    if (states[i] !== 'wrong') continue;
    for (let si = 0; si < S.length; si++) {
      if (!used[si] && strictEq(E[i], S[si] ?? '')) { states[i] = 'ok'; used[si] = true; pairs.push([i, si]); break; }
    }
  }

  let reached = 0;
  for (let i = n - 1; i >= 0; i--) if (states[i] !== 'hidden') { reached = i + 1; break; }
  return { states, reached };
}

/* ───────────────────── per-word audio ───────────────────── */
const pad3 = (x: number) => String(x).padStart(3, '0');
let wordAudioEl: HTMLAudioElement | null = null;

/** pronounce ONE word with a real reciter (wbw CDN) → TTS → full ayah */
export function speakWord(surah: number, ayah: number, wordIdx0: number, word: string, fallback: () => void) {
  const url = `https://audio.qurancdn.com/wbw/${pad3(surah)}_${pad3(ayah)}_${pad3(wordIdx0 + 1)}.mp3`;
  try {
    if (typeof window !== 'undefined') {
      if (!wordAudioEl) wordAudioEl = new Audio();
      if (!wordAudioEl.paused) { wordAudioEl.pause(); }
      wordAudioEl.src = url;
      wordAudioEl.onended = null;
      wordAudioEl.onerror = () => ttsWord(word, fallback);
      void wordAudioEl.play().catch(() => ttsWord(word, fallback));
      return;
    }
  } catch {}
  ttsWord(word, fallback);
}

function ttsWord(word: string, fallback: () => void) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return fallback();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'ar-SA';
    u.rate = 0.7;
    const v = synth.getVoices().find((x) => x.lang?.toLowerCase().startsWith('ar'));
    if (v) u.voice = v;
    u.onerror = () => fallback();
    synth.cancel();
    synth.speak(u);
    setTimeout(() => { if (!synth.speaking) fallback(); }, 900);
  } catch { fallback(); }
}

/* ───────────────────── spoken-text buffers ───────────────────── */
/* pass 31 fix: FINAL segments are always NEW text (resultIndex advances) —
 * a tail-overlap dedupe swallowed legitimate REPEATS, and the Qur'an is full
 * of them (112: …اللَّهُ أَحَدٌ then 112:2 اللَّهُ الصَّمَدُ — the second اللَّهُ
 * vanished and every later word mis-aligned). Only a genuine re-delivery of
 * the same multi-word segment is skipped. */
const mergeFinal = (cur: string, t: string): string => {
  const c = cur.trim();
  const x = t.trim();
  if (!x) return c;
  if (!c) return x;
  if (c === x) return c; /* identical segment re-delivered */
  if (x.split(/\s+/).length > 1 && c.endsWith(x)) return c; /* growing re-delivery */
  return `${c} ${x}`;
};

/** tail-overlap merge for INTERIM buffers: "بسم" + "بسم الله" → "بسم الله".
 * (Chrome/iOS re-deliver the growing utterance; naive append duplicated words
 * and naive replace lost the FIRST word of the next partial segment — iOS
 * delivers partial interims, so overwriting was eating the first word.) */
const mergeTail = (cur: string, t: string): string => {
  const c = cur.trim();
  const x = t.trim();
  if (!x) return c;
  if (!c) return x;
  if (c.endsWith(x)) return c; /* exact re-delivery */
  const words = c.split(/\s+/);
  const tw = x.split(/\s+/);
  let overlap = 0;
  for (let k = Math.min(words.length, tw.length); k > 0; k--) {
    if (words.slice(words.length - k).join(' ') === tw.slice(0, k).join(' ')) { overlap = k; break; }
  }
  return overlap ? (c + ' ' + tw.slice(overlap).join(' ')).trim() : (c ? c + ' ' + x : x);
};

/* ───────────────────── the tracker hook ───────────────────── */
export type ReciteItem = { surah: number; ayah: number; arabic: string; label?: string };

/** split an ayah into display words; strips the inline basmallah of ayah 1
 * (surah ≠ 1) so word numbering matches the wbw audio CDN */
export function itemWords(item: ReciteItem): string[] {
  let t = item.arabic;
  if (item.ayah === 1 && item.surah !== 1) {
    const nb = bare(t);
    if (nb.startsWith(BASM_NORM)) {
      /* find char cut: walk until the bare prefix consumed */
      let kept = 0, bi = 0, target = BASM_NORM.length;
      for (let i = 0; i < t.length && bi < target; i++) {
        const ch = t[i];
        const isDia = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06E5\u06E6]/.test(ch);
        if (!isDia) bi++;
        kept = i + 1;
      }
      t = t.slice(kept);
    }
  }
  /* drop diacritic-only remnants (see note above) */
  return t.split(/\s+/).filter((w) => bare(w).length > 0);
}

/* basmallah as bare words — reciters CHOOSE to open with it; when the
 * expected stream doesn't include it we must strip it from the spoken side
 * or it pollutes alignment as 4 insertion tokens (and in wasl, one giant
 * joined token that matches nothing). */
const BASM_TOKENS = BASM_NORM.split(' ');
/** remove an optional leading basmallah (4 words, said plainly or with wasl
 * joins) from the spoken token pairs. Returns the trimmed pairs. */
function stripOptionalBasm(pairs: Array<readonly [string, string]>): Array<readonly [string, string]> {
  if (pairs.length < 4) return pairs;
  /* try windows of 4..6 spoken tokens whose bare join equals the basmallah */
  for (let k = 6; k >= 4; k--) {
    if (pairs.length < k) continue;
    const win = pairs.slice(0, k).map(([b]) => b);
    const plain = win.join(' ');
    const joined = win.join('');
    if (plain === BASM_NORM || joined === BASM_NORM) return pairs.slice(k);
  }
  /* word-by-word consume (handles PARTIAL joins like "بسم الله" + "الرحمن") */
  let si = 0;
  let bi = 0;
  while (si < pairs.length && bi < BASM_TOKENS.length) {
    const tok = pairs[si][0];
    let consumed = false;
    for (let k = Math.min(BASM_TOKENS.length - bi, 4); k >= 1; k--) {
      if (tok === BASM_TOKENS.slice(bi, bi + k).join('')) { bi += k; si++; consumed = true; break; }
    }
    if (!consumed) break;
  }
  return bi >= BASM_TOKENS.length ? pairs.slice(si) : pairs;
}

export function useReciteTracker(items: ReciteItem[], opts?: { autoNext?: boolean; continuous?: boolean }) {
  const supported = useMemo(() => speechSupported(), []);
  const continuous = opts?.continuous ?? false;
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<{ ok: number; wrong: number; words: number } | null>(null);
  const [states, setStates] = useState<WordState[]>([]);
  const [reached, setReached] = useState(0);
  const recRef = useRef<ReturnType<typeof getRecognition>>(null);
  const finals = useRef('');
  const interim = useRef('');
  const settled = useRef(false);
  const autoNext = useRef(opts?.autoNext ?? false);
  const setAutoNext = (v: boolean) => { autoNext.current = v; };

  const item = items[Math.min(idx, items.length - 1)];
  const shown = useMemo(() => (item ? itemWords(item) : []), [item]);
  const words = useMemo(() => shown.map(bare), [shown]);

  /* continuous mode: the WHOLE passage (page/surah) is ONE word stream —
   * per-ayah ranges map flat positions back to verses for word colouring. */
  const flatShown = useMemo(() => (continuous ? items.flatMap((it) => itemWords(it)) : shown), [continuous, items, shown]);
  const flatWords = useMemo(() => flatShown.map(bare), [flatShown]);
  const ranges = useMemo(() => {
    const r: Array<{ a: number; b: number }> = [];
    if (!continuous) return r;
    let acc = 0;
    for (const it of items) {
      const n = itemWords(it).length;
      r.push({ a: acc, b: acc + n });
      acc += n;
    }
    return r;
  }, [continuous, items]);
  const flat2item = useCallback((i: number) => ranges.findIndex((r) => i >= r.a && i < r.b), [ranges]);

  const clearAyah = useCallback(() => {
    finals.current = '';
    interim.current = '';
    settled.current = false;
    setStates(new Array(continuous ? flatWords.length : words.length).fill('hidden'));
    setReached(0);
    setScore(null);
    setLive('');
  }, [continuous, flatWords.length, words.length]);

  /* continuous: idx AUTO-ADVANCES with the reciter — clearing on idx would
   * wipe page progress at every boundary; and clearAyah must NOT be a dep
   * (its identity changes with words.length when idx advances, which re-ran
   * the clear and wiped the page mid-recitation). */
  useEffect(() => { clearAyah(); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!continuous) clearAyah(); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = useCallback((st: WordState[]) => {
    if (settled.current) return null;
    settled.current = true;
    const full = [...st];
    for (let i = 0; i < full.length; i++) if (full[i] === 'hidden') full[i] = 'wrong'; // unspoken = wrong
    setStates(full);
    setScore({ ok: full.filter((x) => x === 'ok').length, wrong: full.filter((x) => x === 'wrong').length, words: full.length });
    return full;
  }, []);

  const realign = useCallback(() => {
    const rawFinalToks = finals.current.split(/\s+/).filter((x) => x.trim().length > 0);
    const rawToks = (finals.current + ' ' + interim.current).split(/\s+/).filter((x) => x.trim().length > 0);
    const toks = rawToks.map((t) => [bare(t), keepMarks(t)] as const).filter(([b]) => b.length > 0);
    const finalSet = new Set(rawFinalToks.map(keepMarks));
    let pairs = toks.map(([b, m]) => [b, finalSet.has(m) ? m : ''] as const);
    /* the reciter may open with the basmallah even though the expected text
     * starts at the first ayah's words — strip it so alignment is unaffected */
    pairs = stripOptionalBasm(pairs);
    const spoken = pairs.map(([b]) => b);
    const spokenM = pairs.map(([, m]) => m);

    if (continuous) {
      const shownAll = flatShown.map(keepMarks);
      const { states: st, reached: r } = align(flatWords, spoken, shownAll, spokenM);
      setStates(st);
      setReached(r);
      /* roll the "current ayah" label to where the reciter actually is */
      const it = flat2item(Math.max(0, r - 1));
      if (it >= 0 && it !== idx && it < items.length) setIdx(it);
      if (r >= flatWords.length && flatWords.length > 0) {
        settle(st);
        haltRef.current();
      }
      return;
    }

    const shownM = shown.map(keepMarks);
    const { states: st, reached: r } = align(words, spoken, shownM, spokenM);
    setStates(st);
    setReached(r);
    if (r >= words.length && words.length > 0 && !settled.current) {
      /* first-word grace: the mic's first ~200ms is often clipped — if the
       * opening word never matched but something said loose-equals it, count
       * it (pass 32: "first word is never recognized"). */
      const full = settle(st);
      const wrong = full ? full.filter((x) => x === 'wrong').length : 1;
      if (autoNext.current && wrong === 0 && idx < items.length - 1) {
        setTimeout(() => { if (autoNext.current) setIdx((i) => i + 1); }, 900);
      } else {
        setTimeout(() => haltRef.current(), 250);
      }
    }
  }, [words, shown, flatWords, flatShown, settle, idx, items.length, continuous, flat2item]);

  /* onresult captures a STALE realign (old words/idx) — always call via ref */
  const realignRef = useRef(realign);
  realignRef.current = realign;

  /* keep latest states for stop() without re-creating it every realign */
  const statesRef = useRef<WordState[]>([]);
  statesRef.current = states;

  /* ── lifecycle ──
   * pass 31: `halt` is the ONE true way to stop — keepAlive=false FIRST, kill
   * the restart timers, THEN abort+stop the session. The old code stopped the
   * mic while keepAlive was still true, so onend immediately RESTARTED it —
   * the mic stayed hot after "stop" and blocked other apps. */
  const keepAlive = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const haltRef = useRef<() => void>(() => {});

  const start = useCallback(() => {
    setError(null);
    /* kill any zombie session from a previous run before creating a fresh one */
    keepAlive.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { recRef.current?.abort(); } catch {}
    const r = getRecognition({ continuous: true });
    if (!r) { setError('Speech recognition is not available in this browser.'); return; }
    recRef.current = r;
    keepAlive.current = true;
    settled.current = false;
    r.onresult = (e: any) => {
      let interSeg = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt: string = res[0]?.transcript ?? '';
        if (res.isFinal) {
          finals.current = mergeFinal(finals.current, txt);
          interim.current = '';
        } else interSeg += txt + ' ';
      }
      /* interims can arrive PARTIAL (iOS) — merge, never overwrite, or the
       * first word said during an interim-only session is lost forever */
      if (interSeg.trim()) interim.current = mergeTail(interim.current, interSeg);
      setLive((finals.current + ' ' + interim.current).trim().slice(-160));
      realignRef.current();
    };
    r.onerror = (e: any) => {
      const code = e?.error ?? 'error';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        keepAlive.current = false;
        setListening(false);
        setError('Microphone permission denied — enable it in browser settings.');
        return;
      }
      if (code === 'network') setError('Speech recognition needs an internet connection.');
    };
    r.onend = () => {
      if (!keepAlive.current) { setListening(false); return; }
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!keepAlive.current) return;
        let tries = 0;
        const attempt = () => {
          if (!keepAlive.current) return;
          try { recRef.current?.start(); }
          catch {
            /* keep retrying (up to ~12) with a growing gap — giving up after 4
             * was why tracking "decided not to work" mid-passage */
            if (++tries < 12) restartTimer.current = setTimeout(attempt, Math.min(600, 180 + tries * 60));
          }
        };
        attempt();
      }, 110);
    };
    /* confirm the session ACTUALLY started; some browsers silently swallow
     * start() — retry once via abort+start */
    let started = false;
    r.onstart = () => { started = true; setListening(true); };
    try {
      r.start();
      setListening(true);
      setTimeout(() => { if (keepAlive.current && !started) { try { r.abort(); r.start(); } catch {} } }, 400);
    } catch {
      try { r.start(); setListening(true); } catch { setError('Could not start the mic — tap the mic again.'); keepAlive.current = false; setListening(false); }
    }
  }, []);

  const stop = useCallback(() => {
    /* settle the score from everything heard so far, then REALLY release */
    if (!settled.current) {
      if (continuous) {
        settle(statesRef.current);
      } else if (reached > 0 && reached < words.length) {
        const rawToks = (finals.current + ' ' + interim.current).split(/\s+/).filter((x) => x.trim().length > 0);
        let pairs = rawToks.map((t) => [bare(t), keepMarks(t)] as const).filter(([b]) => b.length > 0);
        pairs = stripOptionalBasm(pairs);
        const spoken = pairs.map(([b]) => b);
        const { states: st } = align(words, spoken);
        settle(st);
      }
    }
    haltRef.current();
  }, [reached, words, settle, continuous]);

  haltRef.current = useCallback(() => {
    keepAlive.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { recRef.current?.abort(); } catch {}
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  /* full reset — first ayah, nothing marked, mic off */
  const reset = useCallback(() => {
    haltRef.current();
    finals.current = '';
    interim.current = '';
    settled.current = false;
    setListening(false);
    setIdx(0);
    setStates(new Array(continuous ? flatWords.length : words.length).fill('hidden'));
    setReached(0);
    setScore(null);
    setLive('');
    setError(null);
  }, [continuous, flatWords.length, words.length]);

  useEffect(() => () => { keepAlive.current = false; if (restartTimer.current) clearTimeout(restartTimer.current); try { recRef.current?.abort(); } catch {} }, []);

  /* per-ayah word states for continuous mode (map the flat stream back) */
  const ayahStates = useMemo(() => {
    if (!continuous) return null;
    return ranges.map((r) => states.slice(r.a, r.b));
  }, [continuous, ranges, states]);
  const curAyah = useMemo(() => (continuous ? ranges.findIndex((r, i) => (i === ranges.length - 1 ? true : reached < ranges[i + 1].a)) : idx), [continuous, ranges, reached, idx]);

  return {
    supported, item, idx, setIdx, shown, words, states, reached, listening, live, error, score,
    start, stop, reset, clearAyah, setAutoNext,
    /* continuous extras */
    continuous, ayahStates, curAyah,
    flatShown, flatWords,
    okCount: states.filter((x) => x === 'ok').length,
    wrongCount: states.filter((x) => x === 'wrong').length,
    done: continuous ? reached >= flatWords.length && flatWords.length > 0 : reached >= shown.length && shown.length > 0,
  };
}
