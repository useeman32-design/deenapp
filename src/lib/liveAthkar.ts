import { useEffect, useMemo, useState } from 'react';
import { ATHKAR, type Athar } from '@/data/athkar';
import { athkarDuas, type AdminAthkar } from '@/api/client';
import type { ContentDua } from '@/lib/content';
import { sectionForAdminDua, type SectionedDua } from '@/lib/duaSections';

/** Slice 5 — merge admin-managed athkar over the bundled set (offline fallback). */

const GROUPS = ['Morning', 'Evening', 'After Prayer', 'General'] as const;
function mapGroup(g: string): (typeof GROUPS)[number] {
  const s = g.toLowerCase();
  if (s.includes('morn')) return 'Morning';
  if (s.includes('even')) return 'Evening';
  if (s.includes('pray') || s.includes('salah') || s.includes('salat')) return 'After Prayer';
  return 'General';
}

let extra: Athar[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;

export function loadAdminAthkar(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const d = await athkarDuas();
      if (d) {
        extra = d.athkar.map((a: AdminAthkar, i: number) => ({
          id: `adm-a${i}`,
          group: mapGroup(a.group),
          name: a.name,
          arabic: a.arabic ?? '',
          transliteration: a.transliteration ?? '',
          count: a.count || 0,
          note: a.note || undefined,
        }));
      }
    } catch {
      extra = [];
    }
    loaded = true;
  })();
  return inflight;
}

/**
 * pass 95 — this used to be `[...ATHKAR, ...extra]`, which appended the
 * admin-managed rows AFTER the bundled ones. The admin rows are seeded from the
 * same list, so every dhikr appeared TWICE — and, before pass 95, one of the two
 * copies was the truncated half text the owner reported ("some supplications
 * are still half (salawat etc.)").
 *
 * Rule for a name that exists in both lists:
 *   · if the admin text is a strict prefix of the bundled text, it is our own
 *     truncated seed copy, not an edit — keep the complete bundled Arabic and
 *     take the admin row's count/note;
 *   · otherwise the database wins (owner's rule: DB is the source of truth for
 *     content he manages).
 * Genuinely new admin rows are appended as before.
 */
function mergeAthkar(bundled: Athar[], admin: Athar[]): Athar[] {
  if (!admin.length) return bundled;
  const key = (a: Athar) => a.name.trim().toLowerCase();
  const mine = new Map(admin.map((a) => [key(a), a]));
  const out: Athar[] = bundled.map((b) => {
    const a = mine.get(key(b));
    if (!a) return b;
    mine.delete(key(b));
    const truncated = a.arabic.trim() !== '' && b.arabic.startsWith(a.arabic.trim());
    if (truncated) {
      return { ...b, count: a.count || b.count, note: a.note ?? b.note, group: a.group };
    }
    return { ...a, id: b.id };
  });
  return [...out, ...mine.values()];
}

export function allAthkar(): Athar[] {
  return extra.length ? mergeAthkar(ATHKAR, extra) : ATHKAR;
}

export function useAllAthkar(): Athar[] {
  const [list, setList] = useState<Athar[]>(ATHKAR);
  useEffect(() => {
    let on = true;
    loadAdminAthkar().then(() => {
      if (on) setList(allAthkar());
    });
    return () => {
      on = false;
    };
  }, []);
  return list;
}

/* ------------------------------------------------------------------------ *
 * PASS 103 — admin duas on the Duas screen.
 *
 * This used to hand the API's `duas` rows straight to the screen, which
 * rendered them as loose cards in a "From DeenLink" block ABOVE the section
 * grid — duas sitting outside every section, which is what made the page look
 * spoiled. Two things made it worse:
 *
 *   · every seeded `kind='dua'` row had an EMPTY title and empty translation,
 *     so each card rendered with no heading at all: bare Arabic plus
 *     transliteration, stacked 14 deep;
 *   · seven of the fourteen repeat a dua the bundled Hisn al-Muslim pack
 *     already carries, so the page showed the same text twice — once unnamed
 *     and outside its section, once properly filed inside it.
 *
 * The other seven are genuine additions the pack does not have (Amsayna, the
 * dua for one's parents, "increase me in knowledge", riding a vehicle, entering
 * the mosque, Bismillah before eating, Ya Muqallib al-qulub), so they are worth
 * showing — filed into a section like everything else.
 *
 * The athkar half of this table already had the right rule (see mergeAthkar
 * above: dedupe by name, DB wins on a real edit). Duas now get the equivalent:
 *
 *   · a row the API marks with `bundled_dua_id` repeats the bundled pack and is
 *     dropped. That flag is explicit rather than a similarity heuristic because
 *     fuzzy-matching Arabic duas is not safe here — 40 pairs INSIDE the bundled
 *     pack already exceed a Jaccard of 0.5 (IDs 27 and 28 share parts
 *     verbatim), so any threshold low enough to catch a variant duplicate also
 *     swallows genuine content;
 *   · a row with no title cannot be presented as a dua, so it is dropped. An
 *     unnamed card is never better than no card, and this is what the page was
 *     actually full of;
 *   · as a safety net for rows added against an older API that has no
 *     `bundled_dua_id` column, an exact title match or a normalised-Arabic
 *     prefix match against the pack also drops the row. Prefix rather than
 *     whole-text, so an admin who COMPLETES a truncated text still matches and
 *     his edit never creates a second copy;
 *   · whatever survives becomes a `ContentDua` carrying the owner's own Group
 *     choice, so the screen files it into a real section. Nothing floats
 *     outside the sections any more.
 *
 * The owner's rule still holds — the DB is the source of truth for content he
 * manages. This only stops his content being shown twice, and unnamed.
 * ------------------------------------------------------------------------ */

/** Strip harakat, tatweel and punctuation; fold the alif/ya/ta-marbuta forms. */
function normAr(s: string): string {
  return (s || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06E5\u06E6]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/[^\u0621-\u064A\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const titleKey = (s: string) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Two phrases count as the same dua when one is a prefix of the other. Floored
 * so a two-word phrase can never swallow a whole chapter.
 */
const PREFIX_MIN = 16;
function sameDua(a: string, b: string): boolean {
  const n = Math.min(a.length, b.length);
  return n >= PREFIX_MIN && a.slice(0, n) === b.slice(0, n);
}

/**
 * Convert admin rows into bundle-shaped duas, dropping anything the bundled
 * pack already carries. IDs start at 100000 so they can never collide with a
 * Hisn al-Muslim dua number (1..132) or a part ID (1..267).
 */
export function adminDuasAsContent(
  rows: AdminAthkar[],
  bundled: ContentDua[],
): SectionedDua[] {
  if (!rows?.length) return [];

  const knownTitles = new Set<string>();
  const knownArabic: string[] = [];
  for (const c of bundled) {
    const t = titleKey(c.TITLE);
    if (t) knownTitles.add(t);
    for (const p of c.TEXT ?? []) {
      const k = normAr(p.ARABIC_TEXT);
      if (k) knownArabic.push(k);
    }
  }

  const out: SectionedDua[] = [];
  let n = 0;
  for (const r of rows) {
    /* the API says this row repeats a bundled dua */
    if (r.bundled_dua_id != null && Number(r.bundled_dua_id) > 0) continue;

    const title = (r.name || '').trim();
    if (!title) continue; /* unnamed: nothing to show, and no way to file it */
    if (knownTitles.has(titleKey(title))) continue;

    /* safety net for an API old enough to have no bundled_dua_id column */
    const ar = normAr(r.arabic);
    if (ar.length >= PREFIX_MIN && knownArabic.some((k) => sameDua(ar, k))) continue;

    n += 1;
    out.push({
      ID: 100000 + n,
      TITLE: title,
      section: sectionForAdminDua(r.group || '', title),
      TEXT: [
        {
          ID: 100000 + n,
          ARABIC_TEXT: r.arabic || '',
          LANGUAGE_ARABIC_TRANSLATED_TEXT: r.transliteration || '',
          TRANSLATED_TEXT: r.translation || '',
          REPEAT: r.count && r.count > 1 ? r.count : undefined,
        },
      ],
    });
  }
  return out;
}

/**
 * Admin-managed duas, ready to be filed into the section grid. Empty until the
 * pack has loaded AND the API has answered, so the sections never reflow twice.
 */
export function useAdminContentDuas(bundled: ContentDua[]): SectionedDua[] {
  const [rows, setRows] = useState<AdminAthkar[]>([]);
  useEffect(() => {
    let on = true;
    athkarDuas()
      .then((d) => {
        if (on && d) setRows(d.duas ?? []);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  return useMemo(() => adminDuasAsContent(rows, bundled), [rows, bundled]);
}

