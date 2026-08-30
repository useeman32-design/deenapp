import { QURAN } from '@/data/quran';
import { loadSurah, type SurahContent } from '@/lib/content';

/**
 * Quran corpus search (pass 20) — loads all 114 surahs from OUR dataset
 * once (cached), then searches arabic / english / hausa text.
 */

let corpus: Array<{ meta: (typeof QURAN)[number]; surah: SurahContent }> | null = null;
let loading: Promise<void> | null = null;

export function ensureQuranCorpus(onProgress?: (done: number) => void): Promise<void> {
  if (corpus) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const out: Array<{ meta: (typeof QURAN)[number]; surah: SurahContent }> = [];
    for (let i = 1; i <= 114; i++) {
      try {
        const s = await loadSurah(i);
        out.push({ meta: QURAN[i - 1], surah: s });
      } catch {}
      onProgress?.(i);
    }
    corpus = out;
  })();
  return loading;
}

export type QuranHit = { surah: number; ayah: number; arabic: string; translation: string };

export function searchQuranCorpus(q: string, limit = 40): QuranHit[] {
  if (!corpus) return [];
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hits: QuranHit[] = [];
  for (const { meta, surah } of corpus) {
    for (const v of surah.verses) {
      if (
        (v.english && v.english.toLowerCase().includes(needle)) ||
        (v.hausa && v.hausa.toLowerCase().includes(needle)) ||
        v.arabic.includes(q.trim())
      ) {
        hits.push({ surah: meta.number, ayah: v.ayah, arabic: v.arabic, translation: v.english || v.hausa || '' });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
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

/** fuzzy-find where a recited/typed verse belongs (normalized token match) */
export function findAyahFuzzy(q: string, limit = 3): FuzzyHit[] {
  if (!corpus) return [];
  const qTok = normalizeArabic(q).split(' ').filter((w) => w.length > 1);
  if (qTok.length < 2) return [];
  const qSet = new Set(qTok);
  const out: FuzzyHit[] = [];
  for (const { meta, surah } of corpus) {
    for (const v of surah.verses) {
      const vTok = normalizeArabic(v.arabic).split(' ').filter((w) => w.length > 1);
      if (Math.abs(vTok.length - qTok.length) > 12) continue;
      /* token-set coverage (order-independent) */
      let hit = 0;
      for (const t of qSet) if (vTok.some((w) => wordClose(w, t))) hit++;
      const coverage = hit / qTok.length;
      /* ordered LCS ratio — rewards reciting in sequence */
      let li = 0, seq = 0;
      for (let qi = 0; qi < qTok.length; qi++) {
        let found = -1;
        for (let vi = li; vi < vTok.length; vi++) if (wordClose(vTok[vi], qTok[qi])) { found = vi; break; }
        if (found >= 0) { li = found + 1; seq++; }
      }
      const lcs = seq / qTok.length;
      const score = 0.45 * coverage + 0.55 * lcs;
      if (score > 0.4) out.push({ surah: meta.number, ayah: v.ayah, score, arabic: v.arabic, translation: v.english || v.hausa || '', surahName: meta.english });
      if (out.length > 400) break;
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
