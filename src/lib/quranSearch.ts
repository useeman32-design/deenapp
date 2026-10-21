import { QURAN } from '@/data/quran';
import { loadSurah, type SurahContent } from '@/lib/content';
import { rankByScore, scoreBest, type Scored } from '@/lib/searchRank';

/**
 * Quran corpus search (pass 20) — loads all 114 surahs from OUR dataset
 * once (cached), then searches arabic / english / hausa text.
 */

let corpus: Array<{ meta: (typeof QURAN)[number]; surah: SurahContent }> | null = null;
let loading: Promise<void> | null = null;

export function ensureQuranCorpus(onProgress?: (done: number) => void): Promise<void> {
  if (corpus) return Promise.resolve();
  if (loading) return loading;
  /* pass 35 — 8-way parallel load: first ayah search used to stream 114
   * surahs one-by-one (slow enough to look broken on device) */
  loading = (async () => {
    const out: Array<{ meta: (typeof QURAN)[number]; surah: SurahContent }> = [];
    let done = 0;
    const ids = Array.from({ length: 114 }, (_, k) => k + 1);
    for (let i = 0; i < ids.length; i += 8) {
      const chunk = ids.slice(i, i + 8);
      const loaded = await Promise.all(
        chunk.map(async (n) => {
          try {
            return { n, s: await loadSurah(n) as SurahContent | null };
          } catch {
            return { n, s: null };
          }
        }),
      );
      for (const r of loaded) {
        if (r.s) out.push({ meta: QURAN[r.n - 1], surah: r.s });
        done++;
        onProgress?.(done);
      }
    }
    out.sort((a, b) => a.meta.number - b.meta.number);
    corpus = out;
  })();
  return loading;
}

export type QuranHit = { surah: number; ayah: number; arabic: string; translation: string };

export function searchQuranCorpus(q: string, limit = 40): QuranHit[] {
  if (!corpus) return [];
  const needle = q.trim();
  if (!needle) return [];

  /* pass 102 — RANK THE WHOLE CORPUS, THEN CUT.
   *
   * The old version walked the surahs in order and `return`ed the moment it had
   * `limit` exact substring hits, so a common word ("mercy", "patience",
   * "Allah") filled the quota inside al-Baqarah alone and surahs 3-114 were
   * never even looked at. Its token tier then appended rows on a bare `sc >= 2`
   * with no ordering signal — which is exactly the owner's complaint that "the
   * first result is the best, the rest are not even close".
   *
   * Every verse is now scored against Arabic + English + Hausa at once through
   * the shared ranker (exact phrase > full token coverage > ordered tokens >
   * partial coverage), sorted once, and only then trimmed. Similar ayahs in
   * different surahs — and repeated ones inside the same surah — all surface
   * together, ordered by how well they actually match. */
  const scored: Scored<QuranHit>[] = [];

  for (const { meta, surah } of corpus) {
    for (const v of surah.verses) {
      const score = scoreBest([v.arabic, v.english, v.hausa], needle);
      if (score <= 0) continue;
      scored.push({
        score,
        item: {
          surah: meta.number,
          ayah: v.ayah,
          arabic: v.arabic,
          translation: v.english || v.hausa || '',
        },
      });
    }
  }

  /* Tiebreak on surah then ayah, so equal-scoring verses read in mushaf order
   * instead of shuffling between keystrokes. */
  return rankByScore(scored, (a, b) => a.surah - b.surah || a.ayah - b.ayah).slice(0, limit);
}

/* ───────── pass 24: recite-to-find (fuzzy arabic matching) ─────────
 * A spoken verse never matches exactly (diacritics, recorder errors, partial
 * starts). Normalize both sides to bare letters, then score by ordered token
 * overlap — robust when the user recites the middle of a verse. */

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalizeArabic(t: string): string {
  return t
    .replace(DIACRITICS, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') /* alef hamza forms → ا */
    .replace(/\u0649/g, '\u064A') /* ى → ي */
    .replace(/\u0629/g, '\u0647') /* ة → ه */
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/[\u061F\u061B\u060C\u061B.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* edit distance for word-level tolerance (recognition slips) */
function wordClose(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length && edits <= 2) {
    if (a[i] === b[j]) { i++; j++; }
    else { edits++; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  }
  return edits + Math.abs(a.length - i) + Math.abs(b.length - j) <= 2;
}

export type FuzzyHit = { surah: number; ayah: number; score: number; arabic: string; translation: string; surahName: string };

/* pass 27: search-side helpers — forgiving matching + robust scoring.
 * Why some recitations failed before: every surah's ayah 1 embeds the
 * basmallah, so reciting it matched 113 different verses weakly and drowned
 * the real target; short queries also had no character-level signal. */

const BARE_DIA = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06E5\u06E6]/g;
const bareW = (t: string) => normalizeArabic(t).replace(BARE_DIA, '');
const BASM_BARE = 'بسم الله الرحمن الرحيم';

function stripBasm(t: string): string {
  const b = bareW(t).replace(/\s+/g, ' ').trim();
  return b.startsWith(BASM_BARE) ? b.slice(BASM_BARE.length).trim() : b;
}

/** character trigram jaccard — catches tokenization/orthography drift */
function triSim(a: string, b: string): number {
  if (a.length < 3 || b.length < 3) return a === b ? 1 : 0;
  const grams = (x: string) => { const g = new Set<string>(); for (let i = 0; i < x.length - 2; i++) g.add(x.slice(i, i + 3)); return g; };
  const ga = grams(a), gb = grams(b);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  return inter / Math.min(ga.size, gb.size);
}

export function findAyahFuzzy(q: string, limit = 5): FuzzyHit[] {
  if (!corpus) return [];
  const qBare = stripBasm(q);
  const qTok = qBare.split(' ').filter((w) => w.length > 1);
  if (qTok.length < 2 && qBare.length < 6) return [];
  const qSet = new Set(qTok);
  const out: FuzzyHit[] = [];

  for (const { meta, surah } of corpus) {
    for (const v of surah.verses) {
      const vBare = v.ayah === 1 && meta.number !== 1 ? stripBasm(v.arabic) : bareW(v.arabic).replace(/\s+/g, ' ').trim();
      if (Math.abs(vBare.length - qBare.length) > 60) continue;
      const vTok = vBare.split(' ').filter((w) => w.length > 1);

      /* token coverage (order-independent, loose) */
      let hit = 0;
      for (const t of qSet) if (vTok.some((w) => looseWord(w, t))) hit++;
      const coverage = qTok.length ? hit / qTok.length : 0;

      /* ordered token LCS */
      let li = 0, seq = 0;
      for (let qi = 0; qi < qTok.length; qi++) {
        let found = -1;
        for (let vi = li; vi < vTok.length; vi++) if (looseWord(vTok[vi], qTok[qi])) { found = vi; break; }
        if (found >= 0) { li = found + 1; seq++; }
      }
      const lcs = qTok.length ? seq / qTok.length : 0;

      /* character trigram similarity — robust to splits/joins/spelling */
      const tri = triSim(qBare, vBare);

      const score = 0.34 * coverage + 0.33 * lcs + 0.33 * tri;
      if (score > 0.34) out.push({ surah: meta.number, ayah: v.ayah, score, arabic: v.arabic, translation: v.english || v.hausa || '', surahName: meta.english });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** loose word equality used by the search matcher (NOT for strict recite checks) */
function looseWord(a: string, b: string): boolean {
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
