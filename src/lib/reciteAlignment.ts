export type WordState = 'hidden' | 'ok' | 'wrong';

/** Session-generation guard used to reject late Web Speech events after Stop
 * or Reset. A new run always invalidates callbacks from every old run. */
export function isReciteRunCurrent(activeRun: number, callbackRun: number): boolean {
  return activeRun === callbackRun;
}

/* ------------------------------------------------------------------ *
 * pass 104 — hamzat wasl must count as a mistake.
 *
 * The Qur'an text carries hamzat wasl as U+0671 (ٱ) and hamzat qat' as
 * U+0623/U+0625/U+0622 (أ إ آ). Nothing in this file normalised them, so
 * every wasl word relied on strictEq's single-substitution budget to match at
 * all — the tolerance that exists for recognition noise was silently doing the
 * job of a spelling rule, and any word with one extra slip on top failed.
 *
 * The distinction the owner asked to enforce is audible and real: hamzat wasl
 * is elided (no glottal stop) while hamzat qat' IS a glottal stop. Reciting
 * "ٱقْرَأْ" with a hamzat qat' is a genuine tajweed error.
 *
 * BUT it only works in one direction. A speech engine transcribes both to a
 * bare alif, so treating ٱ-vs-ا as an error would mark EVERY correct recitation
 * of EVERY wasl word as wrong and destroy the feature. The rule therefore is:
 *   expected wasl + spoken hamzat qat'  -> WRONG   (glottal stop inserted)
 *   expected wasl + spoken bare alif    -> ok      (engine cannot tell; this is
 *                                                   what a correct recitation
 *                                                   actually transcribes to)
 * That catches the error whenever the engine preserves it and never produces a
 * false positive.
 * ------------------------------------------------------------------ */
export const ALIF_WASL = '\u0671';
const ALIF_QAT = '\u0623\u0625\u0622';
const ALIF_QAT_SET = new Set(['\u0623', '\u0625', '\u0622']);
const ALIF_FAMILY_RE = new RegExp('[' + ALIF_WASL + ALIF_QAT + ']', 'g');
const ALIF_BARE = '\u0627';

/** Fold the alif family onto the bare alif so recognition noise is not penalised. */
export function foldAlif(t: string): string {
  return t.replace(ALIF_FAMILY_RE, ALIF_BARE);
}

/**
 * True when the expected word carries hamzat wasl at a position where the
 * reciter produced a hamzat qat' instead.
 *
 * The check MUST be positional. A word can legitimately contain both: "ٱقْرَأْ"
 * opens with hamzat wasl and ends with a real hamzat qat'. An "is there any
 * qat' anywhere in the spoken word" test therefore flags a perfect recitation
 * of that very word as wrong — which was the first thing the regression run
 * caught here.
 *
 * foldAlif() is a 1:1 character substitution, so equal folded strings always
 * have equal length and the two words can be compared index by index.
 */
export function waslViolated(expected: string, spoken: string): boolean {
  const E = keepMarks(expected);
  const S = keepMarks(spoken);
  if (!E || !S) return false;
  if (!E.includes(ALIF_WASL)) return false;   /* nothing to enforce here */
  if (foldAlif(E) !== foldAlif(S)) return false;  /* not the same word */
  const e = [...E];
  const s = [...S];
  if (e.length !== s.length) return false;
  for (let i = 0; i < e.length; i++) {
    if (e[i] === ALIF_WASL && ALIF_QAT_SET.has(s[i])) return true;
  }
  return false;
}

/** Strict equality: exact, or one substitution of equal length. */
export function strictEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  /* pass 104 — fold the alif family first, so a wasl/qat' spelling difference
   * no longer consumes the single-substitution budget that exists for genuine
   * recognition noise. waslViolated() then re-imposes the tajweed rule. */
  const fa = foldAlif(a);
  const fb = foldAlif(b);
  if (fa === fb) return true;
  if (fa.length !== fb.length) return false;
  let sub = 0;
  for (let i = 0; i < fa.length; i++) if (fa[i] !== fb[i]) sub++;
  return sub <= 1;
}

/** Small recognition-tolerance budget used only for the opening word. */
export function looseEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  /* pass 104 — same folding as strictEq, for the same reason. */
  a = foldAlif(a);
  b = foldAlif(b);
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

const MARK = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;
const PUNCT = /[\u061F\u061B\u060C.,;:!?\u0640\u06E5\u06E6]/g;
export function keepMarks(t: string): string {
  return t.replace(PUNCT, ' ').replace(/\s+/g, ' ').trim();
}
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
/**
 * True when the reciter's short vowels (harakat) disagree with the text.
 *
 * PASS 105 — this is what the owner means by "wasl": the whole harakat system
 * (fatha, kasra, damma, and the tanwin forms fathatan/kasratan/dammatan), not
 * hamzat wasl alone. The reported failure was saying "rasuula" where the text
 * has "rasuulu" — and this function returned FALSE for exactly that case.
 *
 * Three defects, all fixed:
 *
 *  1. `if (i === E.length - 1) continue;` skipped the FINAL letter. The final
 *     vowel is the case ending — precisely where fatha/damma/kasra errors live
 *     in Arabic grammar — so the one position that matters most was never
 *     checked. Reproduced: rasuulu vs rasuula returned false.
 *
 *  2. `marked >= 2` required TWO marked positions before any error counted, so
 *     a single wrong vowel on a short word was forgiven. One wrong harakah is
 *     one wrong harakah.
 *
 *  3. Marks were compared as raw strings, so a corpus that writes
 *     shadda-then-fatha and an engine that returns fatha-then-shadda read as a
 *     conflict even though the recitation is identical. Now compared as sorted
 *     sets.
 *
 * `if (!sm) continue` is deliberately KEPT. Mainstream Arabic speech engines
 * emit unvocalised text, so there is usually no spoken mark to compare against
 * — and inventing an error the engine never reported would be worse than
 * reporting none. See reciteEngine's marksDetected flag for how that limitation
 * is surfaced to the reader instead of being hidden.
 */
export function marksConflict(expected: string, spoken: string): boolean {
  if (!expected || !spoken) return false;
  const E = markPairs(keepMarks(expected));
  const S = markPairs(keepMarks(spoken));
  if (E.length !== S.length) return false;
  let marked = 0;
  let bad = 0;
  for (let i = 0; i < E.length; i++) {
    const em = E[i][1];
    const sm = S[i][1];
    /* BOTH sides must actually state a vowel before a disagreement means
     * anything. If the engine emitted no harakat, we cannot judge what was
     * said. If the source text carries no harakat (hadith and athkar bodies
     * are often unvocalised, unlike the Quran), we cannot judge what was
     * right — and treating every spoken vowel as wrong would flag a perfect
     * recitation. Caught by test: marksConflict(unvocalised, vocalised). */
    if (!em || !sm) continue;
    if (E[i][0] !== S[i][0]) continue;
    marked++;
    /* order-insensitive: shadda+fatha and fatha+shadda are the same recitation */
    const a = [...em].sort().join('');
    const b = [...sm].sort().join('');
    if (a !== b) bad++;
  }
  return marked >= 1 && bad >= 1;
}

/**
 * Did this spoken text carry ANY harakat at all?
 *
 * If a recognition engine never emits short vowels, vowel-level checking is
 * impossible on that device no matter how correct this comparison is — the
 * information is destroyed before it reaches us. Callers use this to tell the
 * reader the truth rather than silently marking every vowel correct.
 */
export function spokenHasMarks(spoken: string): boolean {
  return MARK.test(keepMarks(spoken));
}

export type AlignResult = { states: WordState[]; reached: number };

/** Strict alignment of expected words against everything spoken. */
export function align(E: string[], S: string[], EM?: string[], SM?: string[]): AlignResult {
  const n = E.length;
  const states: WordState[] = new Array(n).fill('hidden');
  const used = new Array(S.length).fill(false);
  const pairs: Array<[number, number]> = [];
  let ei = 0;

  for (let si = 0; si < S.length && ei < n; si++) {
    const tok = S[si];
    if (!tok) continue;
    /* Recognition engines commonly clip the first 100–250ms or return a
     * one-letter Arabic variant on the opening token. Give only the opening
     * word a small fuzzy grace; later words remain strict. */
    if (ei === 0 && si === 0 && looseEq(E[ei], tok)) {
      states[ei] = 'ok'; used[si] = true; pairs.push([ei, si]); ei++; continue;
    }
    if (strictEq(E[ei], tok)) { states[ei] = 'ok'; used[si] = true; pairs.push([ei, si]); ei++; continue; }
    let joinHit = 0;
    for (let k = 2; k <= 4 && ei + k <= n; k++) {
      if (strictEq(E.slice(ei, ei + k).join(''), tok)) { joinHit = k; break; }
    }
    if (joinHit) { for (let q = 0; q < joinHit; q++) states[ei + q] = 'ok'; ei += joinHit; used[si] = true; continue; }
    if (ei + 1 < n && strictEq(E[ei + 1], tok)) { states[ei] = 'wrong'; states[ei + 1] = 'ok'; pairs.push([ei + 1, si]); ei += 2; used[si] = true; continue; }
  }

  let front = 0;
  while (front < n && states[front] !== 'hidden') front++;
  if (front < n) {
    for (let si = 0; si < S.length - 1; si++) {
      if (!used[si] && !used[si + 1] && strictEq(E[front], (S[si] ?? '') + (S[si + 1] ?? ''))) {
        states[front] = 'ok'; used[si] = true; used[si + 1] = true; break;
      }
    }
  }

  /* pass 104 — a word can match on letters and still be a tajweed error.
   * Hamzat wasl spoken as hamzat qat' is downgraded here, exactly like the
   * diacritic check below. Spoken forms are needed for this, so it runs on the
   * matched pairs regardless of whether marked variants were supplied. */
  for (const [pei, psi] of pairs) {
    if (states[pei] === 'ok' && waslViolated(E[pei] ?? '', S[psi] ?? '')) states[pei] = 'wrong';
  }

  if (EM && SM) {
    for (const [pei, psi] of pairs) {
      if (states[pei] === 'ok' && marksConflict(EM[pei] ?? '', SM[psi] ?? '')) states[pei] = 'wrong';
    }
  }

  for (let i = 0; i < n; i++) {
    if (states[i] !== 'wrong') continue;
    for (let si = 0; si < S.length; si++) {
      /* pass 104 — a later token can rescue a word that was skipped, but it
       * must not rescue a tajweed error: strictEq folds the alif family, so
       * without this guard a wasl word spoken with hamzat qat' would be
       * promoted straight back to 'ok' and the rule would silently do nothing. */
      if (!used[si] && strictEq(E[i], S[si] ?? '') && !waslViolated(E[i] ?? '', S[si] ?? '')) {
        states[i] = 'ok'; used[si] = true; pairs.push([i, si]); break;
      }
    }
  }

  let reached = 0;
  for (let i = n - 1; i >= 0; i--) if (states[i] !== 'hidden') { reached = i + 1; break; }
  return { states, reached };
}

/** Merge final speech segments without swallowing legitimate repeated words. */
export function mergeFinal(cur: string, t: string): string {
  const c = cur.trim();
  const x = t.trim();
  if (!x) return c;
  if (!c) return x;
  if (c === x) return c;
  const cw = c.split(/\s+/);
  const xw = x.split(/\s+/);
  if (xw.length > 1 && x.startsWith(`${c} `)) return x;
  if (cw.length > 1 && c.startsWith(`${x} `)) return c;
  if (xw.length > 1 && c.endsWith(` ${x}`)) return c;
  if (cw.length > 1 && x.endsWith(` ${c}`)) return x;
  const max = Math.min(cw.length, xw.length);
  for (let k = max; k >= 2; k--) {
    if (cw.slice(cw.length - k).join(' ') === xw.slice(0, k).join(' ')) {
      return `${c} ${xw.slice(k).join(' ')}`.trim();
    }
  }
  return `${c} ${x}`;
}
