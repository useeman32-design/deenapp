import { useEffect, useState } from 'react';
import { ATHKAR, type Athar } from '@/data/athkar';
import { athkarDuas, type AdminAthkar } from '@/api/client';

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

/** Admin-managed duas for inline display on the Duas screen. */
export function useAdminDuas(): AdminAthkar[] {
  const [duas, setDuas] = useState<AdminAthkar[]>([]);
  useEffect(() => {
    let on = true;
    athkarDuas()
      .then((d) => {
        if (on && d) setDuas(d.duas ?? []);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  return duas;
}
