/* pass 83-39 — server-first Learning-Hub decks (admin-managed in the panel):
 * Short Lessons + Riddles + Tafsir editions + Fatwa overlay.
 * Every hook falls back to the bundled data, and failures fail OPEN. */
import { useEffect, useState } from 'react';
import { publicGet } from '@/api/client';

export type LessonTopic = { id: string; title: string; icon: string; tint: string; minutes: number; points: Array<{ h: string; b: string }> };
export type Riddle = { q: string; a: string; hint?: string };

let lessonsCache: LessonTopic[] | null = null;
let riddlesCache: Riddle[] | null = null;
let tafsirsCache: string[] | null = null;

async function getJSON<T>(path: string): Promise<T[] | null> {
  try {
    const r = await publicGet<{ status?: string; items?: T[] }>(path);
    if (r.ok && Array.isArray(r.data.items)) return r.data.items;
  } catch {}
  return null;
}

/* ── Short Lessons ── */
export function useLessonTopics(fallback: LessonTopic[]): LessonTopic[] {
  const [list, setList] = useState<LessonTopic[]>(lessonsCache ?? fallback);
  useEffect(() => {
    let alive = true;
    getJSON<LessonTopic>('/api/content/lessons.php').then((rows) => {
      if (!alive || !rows || !rows.length) return;
      const norm = rows.map((r, i) => ({
        id: String(r.id ?? i), title: r.title, icon: r.icon || 'book-open',
        tint: r.tint || '#2F6D33', minutes: Number(r.minutes ?? 5),
        points: Array.isArray(r.points) ? r.points : [],
      }));
      lessonsCache = norm;
      setList(norm);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return list;
}

/* ── Riddles ── */
export function useRiddles(fallback: Riddle[]): Riddle[] {
  const [list, setList] = useState<Riddle[]>(riddlesCache ?? fallback);
  useEffect(() => {
    let alive = true;
    getJSON<Riddle>('/api/content/riddles.php').then((rows) => {
      if (!alive || !rows || !rows.length) return;
      riddlesCache = rows;
      setList(rows);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return list;
}

/* ── Tafsir editions (enabled + order) — returns null while unknown ── */
export function useTafsirEditions(): Array<{ id: string; label: string; author: string; blurb: string }> | null {
  const [ed, setEd] = useState<Array<{ id: string; label: string; author: string; blurb: string }> | null>(tafsirsCache ? tafsirsCache.map((id) => ({ id, label: id, author: '', blurb: '' })) : null);
  useEffect(() => {
    let alive = true;
    getJSON<{ bkey: string; label: string; author: string; blurb: string }>('/api/content/tafsirs.php').then((rows) => {
      if (!alive || !rows || !rows.length) return;
      const norm = rows.map((r) => ({ id: String(r.bkey), label: String(r.label ?? r.bkey), author: String(r.author ?? ''), blurb: String(r.blurb ?? '') }));
      tafsirsCache = norm.map((x) => x.id);
      setEd(norm);
    });
    return () => { alive = false; };
  }, []);
  return ed;
}

/* ── Fatwa overlay: admin rulings that prepend the static archive ── */
export type FatwaExtra = { t: string; a: string; src?: string };
let fatwaExtraCache: FatwaExtra[] | null = null;
export function fatwaExtras(): Promise<FatwaExtra[]> {
  if (fatwaExtraCache) return Promise.resolve(fatwaExtraCache);
  return getJSON<{ title: string; body: string; source_label: string }>('/api/content/fatwa.php').then((rows) => {
    const out = (rows ?? []).map((r) => ({ t: r.title, a: r.body, src: r.source_label }));
    fatwaExtraCache = out;
    return out;
  });
}
