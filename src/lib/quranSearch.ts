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
