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
  return t.split(/\s+/).filter(Boolean);
}

export function useReciteTracker(items: ReciteItem[], opts?: { autoNext?: boolean }) {
  const supported = useMemo(() => speechSupported(), []);
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

  const clearAyah = useCallback(() => {
    finals.current = '';
    interim.current = '';
    settled.current = false;
    setStates(new Array(words.length).fill('hidden'));
    setReached(0);
    setScore(null);
    setLive('');
  }, [words.length]);

  useEffect(() => { clearAyah(); }, [idx, clearAyah]);

  const settle = useCallback((st: WordState[]) => {
    if (settled.current) return;
    settled.current = true;
    const full = [...st];
    for (let i = 0; i < full.length; i++) if (full[i] === 'hidden') full[i] = 'wrong'; // unspoken = wrong
    setStates(full);
    setScore({ ok: full.filter((x) => x === 'ok').length, wrong: full.filter((x) => x === 'wrong').length, words: full.length });
    return full;
  }, []);

  const realign = useCallback(() => {
    const rawToks = (finals.current + ' ' + interim.current).split(/\s+/).filter((x) => x.trim().length > 0);
    /* bare + marked stay LOCKSTEP: filter both or neither */
    const toks = rawToks.map((t) => [bare(t), keepMarks(t)] as const).filter(([b]) => b.length > 0);
    const spoken = toks.map(([b]) => b);
    const spokenM = toks.map(([, m]) => m);
    const shownM = shown.map(keepMarks);
    const { states: st, reached: r } = align(words, spoken, shownM, spokenM);
    setStates(st);
    setReached(r);
    if (r >= words.length && words.length > 0 && !settled.current) {
      const full = settle(st);
      /* stop the mic when the ayah is done — or roll on if autoNext + perfect */
      const wrong = full ? full.filter((x) => x === 'wrong').length : 1;
      if (autoNext.current && wrong === 0 && idx < items.length - 1) {
        setTimeout(() => { if (autoNext.current) { setIdx((i) => i + 1); } }, 900);
      } else {
        setTimeout(() => { try { recRef.current?.stop(); } catch {} setListening(false); }, 250);
      }
    }
  }, [words, shown, settle, idx, items.length]);

  /* pass 27: onresult captured a STALE realign (old words/idx) — always call
   * through a ref so autoNext-advanced ayahs align against their own words */
  const realignRef = useRef(realign);
  realignRef.current = realign;

  const keepAlive = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    setError(null);
    const r = getRecognition({ continuous: true });
    if (!r) { setError('Speech recognition is not available in this browser.'); return; }
    recRef.current = r;
    keepAlive.current = true;
    r.onresult = (e: any) => {
      let inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt: string = res[0]?.transcript ?? '';
        if (res.isFinal) finals.current = (finals.current + ' ' + txt).trim();
        else inter += txt + ' ';
      }
      interim.current = inter.trim();
      setLive((finals.current + ' ' + interim.current).trim().slice(-140));
      realignRef.current();
    };
    r.onerror = (e: any) => {
      const code = e?.error ?? 'error';
      if (code === 'not-allowed') {
        keepAlive.current = false;
        setListening(false);
        setError('Microphone permission denied — enable it in browser settings.');
        return;
      }
      /* no-speech / aborted / network — transient: the restart loop rides on */
      if (code === 'network') setError('Speech recognition needs an internet connection.');
    };
    /* pass 28: iOS Safari ignores `continuous` and ENDS the session after each
     * utterance/pause — if we don't restart, tracking silently dies while the
     * user keeps reciting. Restart while the user wants to listen. */
    r.onend = () => {
      if (!keepAlive.current) { setListening(false); return; }
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!keepAlive.current) return;
        try { recRef.current?.start(); } catch {
          /* already started — ignore InvalidStateError */
        }
      }, 260);
    };
    try { r.start(); setListening(true); } catch { setError('Could not start the mic.'); }
  }, [realign]);

  /* pass 28: full reset — first ayah, nothing marked, mic off */
  const reset = useCallback(() => {
    keepAlive.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { recRef.current?.stop(); } catch {}
    finals.current = '';
    interim.current = '';
    settled.current = false;
    setListening(false);
    setIdx(0);
    setStates(new Array(words.length).fill('hidden'));
    setReached(0);
    setScore(null);
    setLive('');
    setError(null);
  }, [words.length]);

  const stop = useCallback(() => {
    keepAlive.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    /* stopping mid-ayah settles the score: unspoken words count as wrong */
    if (!settled.current && reached > 0 && reached < words.length) {
      const spoken = (finals.current + ' ' + interim.current).split(/\s+/).map(bare).filter((x) => x.length > 0);
      const { states: st } = align(words, spoken);
      settle(st);
    }
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }, [reached, words, settle]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  return {
    supported, item, idx, setIdx, shown, words, states, reached, listening, live, error, score,
    start, stop, reset, clearAyah, setAutoNext,
    okCount: states.filter((s) => s === 'ok').length,
    wrongCount: states.filter((s) => s === 'wrong').length,
    done: reached >= shown.length && shown.length > 0,
  };
}
