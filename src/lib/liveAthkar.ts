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

export function allAthkar(): Athar[] {
  return extra.length ? [...ATHKAR, ...extra] : ATHKAR;
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
