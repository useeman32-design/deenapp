/**
 * pass 42 — Tafsir library (quranapi.pages.dev, free static JSON).
 *  · THREE English tafsirs per ayah: Ibn Kathir (abridged), Maarif ul Quran
 *    (Muhammad Taqi Usmani), Tazkirul Quran (Wahiduddin Khan).
 *  · GET /api/tafsir/{surah}_{ayah}.json → { surahName, surahNo, ayahNo,
 *    tafsirs: [{ author, groupVerse, content(markdown-lite) }] }
 *  · content uses "## " headings — render them as bold section titles.
 *  · Also feeds DeenLink AI: `tafsirContextFor()` pulls the Ibn Kathir
 *    passage for a verse reference so AI answers cite the real tafsir.
 */

const BASE = 'https://quranapi.pages.dev/api/tafsir';

export type TafsirAuthor = 'Ibn Kathir' | 'Maarif Ul Quran' | 'Tazkirul Quran';

export type TafsirPassage = {
  author: TafsirAuthor | string;
  groupVerse: string | null;
  content: string;
};

export type TafsirAyah = {
  surahName: string;
  surahNo: number;
  ayahNo: number;
  tafsirs: TafsirPassage[];
};

export const TAFSIR_BOOKS: Array<{ id: TafsirAuthor; label: string; author: string; blurb: string }> = [
  { id: 'Ibn Kathir', label: 'Ibn Kathir', author: 'Hafiz Ibn Kathir', blurb: 'The classic abridged tafsir — hadith-based and precise.' },
  { id: 'Maarif Ul Quran', label: "Ma'arif al-Qur'an", author: 'Muhammad Taqi Usmani', blurb: 'A modern masterpiece — clear reasoning and context.' },
  { id: 'Tazkirul Quran', label: 'Tazkirul Quran', author: 'Wahiduddin Khan', blurb: 'Concise lessons and reflections for daily life.' },
];

const cache = new Map<string, TafsirAyah>();

export async function fetchTafsir(surah: number, ayah: number): Promise<TafsirAyah> {
  const key = `${surah}:${ayah}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${BASE}/${surah}_${ayah}.json`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`tafsir ${r.status}`);
    const j = (await r.json()) as TafsirAyah;
    if (!j || !Array.isArray(j.tafsirs)) throw new Error('tafsir shape');
    cache.set(key, j);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTafsirFor(surah: number, ayah: number, book: TafsirAuthor | string): Promise<TafsirPassage | null> {
  const j = await fetchTafsir(surah, ayah).catch(() => null);
  if (!j) return null;
  return j.tafsirs.find((t) => t.author === book) ?? j.tafsirs[0] ?? null;
}

/** plain-text tafsir snippet (headings stripped) — for DeenLink AI context */
export async function tafsirContextFor(surah: number, ayah: number, max = 1400): Promise<string | null> {
  const p = await fetchTafsirFor(surah, ayah, 'Ibn Kathir').catch(() => null);
  if (!p) return null;
  return p.content
    .replace(/#{1,4}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** split a passage into { header, text } blocks for rendering */
export function tafsirBlocks(content: string): Array<{ h: string | null; t: string }> {
  const out: Array<{ h: string | null; t: string }> = [];
  let cur: { h: string | null; t: string } = { h: null, t: '' };
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,4}\s+/.test(line)) {
      if (cur.h != null || cur.t.trim()) out.push(cur);
      cur = { h: line.replace(/^#{1,4}\s+/, '').trim(), t: '' };
    } else {
      cur.t += (cur.t ? ' ' : '') + line;
    }
  }
  if (cur.h != null || cur.t.trim()) out.push(cur);
  return out;
}
