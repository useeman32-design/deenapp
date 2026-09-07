import { storage } from '@/lib/storage';

/* Daily Zikr Challenge — per-day dhikr counts (reset each morning) + a streak
 * for completing the full morning+evening set. Counts are date-stamped so the
 * challenge genuinely resets daily while still tolerating legacy plain-number
 * values written by older builds. */

const countKey = (id: string) => `dl.athkar.${id}`;
const CH = 'dl.zikr.challenge';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayISO(): string {
  return iso(new Date());
}
function shiftISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
}

/** Today's count for a dhikr — resets each day. */
export async function readDhikrCount(id: string): Promise<number> {
  try {
    const raw = await storage.getItem(countKey(id));
    if (!raw) return 0;
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && 'd' in p) return p.d === todayISO() ? Number(p.c) || 0 : 0;
    if (typeof p === 'number') return p || 0; // legacy plain number — treat as today
  } catch {
    // ignore
  }
  return 0;
}

export async function writeDhikrCount(id: string, count: number): Promise<void> {
  try {
    await storage.setItem(countKey(id), JSON.stringify({ d: todayISO(), c: count }));
  } catch {
    // ignore
  }
}

export type Streak = { streak: number; lastFullDate: string | null };

/** Current streak. Survives only if the last full day was today or yesterday. */
export async function getStreak(): Promise<Streak> {
  try {
    const raw = await storage.getItem(CH);
    if (raw) {
      const p = JSON.parse(raw) as Streak;
      const last = p.lastFullDate ?? null;
      if (last === todayISO() || last === shiftISO(-1)) return { streak: p.streak || 0, lastFullDate: last };
      return { streak: 0, lastFullDate: last };
    }
  } catch {
    // ignore
  }
  return { streak: 0, lastFullDate: null };
}

/** Call once the full morning+evening set is done for the day; bumps the streak
 * at most once per day. */
export async function recordFullDay(): Promise<Streak> {
  const today = todayISO();
  const cur = await getStreak();
  if (cur.lastFullDate === today) return cur;
  const streak = (cur.lastFullDate === shiftISO(-1) ? cur.streak : 0) + 1;
  const next: Streak = { streak, lastFullDate: today };
  try {
    await storage.setItem(CH, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
