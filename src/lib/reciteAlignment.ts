export type WordState = 'hidden' | 'ok' | 'wrong';

/** Session-generation guard used to reject late Web Speech events after Stop
 * or Reset. A new run always invalidates callbacks from every old run. */
export function isReciteRunCurrent(activeRun: number, callbackRun: number): boolean {
  return activeRun === callbackRun;
}

/** Strict equality: exact, or one substitution of equal length. */
export function strictEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length !== b.length) return false;
  let sub = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) sub++;
  return sub <= 1;
}

/** Small recognition-tolerance budget used only for the opening word. */
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
function marksConflict(expected: string, spoken: string): boolean {
  if (!expected || !spoken) return false;
  const E = markPairs(keepMarks(expected));
  const S = markPairs(keepMarks(spoken));
  if (E.length !== S.length) return false;
  let marked = 0;
  let bad = 0;
  for (let i = 0; i < E.length; i++) {
    if (i === E.length - 1) continue;
    const sm = S[i][1];
    if (!sm) continue;
    marked++;
    if (E[i][0] !== S[i][0]) continue;
    if (E[i][1] !== sm) bad++;
  }
  return marked >= 2 && bad >= 1;
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

  if (EM && SM) {
    for (const [pei, psi] of pairs) {
      if (states[pei] === 'ok' && marksConflict(EM[pei] ?? '', SM[psi] ?? '')) states[pei] = 'wrong';
    }
  }

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
