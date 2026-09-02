/**
 * Daily routine tracking — Quran streak + today's goal.
 * Local-first (storage), so it works offline; the home dashboard reads
 * these to render the "Daily Progress" cards.
 */
import { storage } from '@/lib/storage';
import { isLive } from '@/api/client';

const dayKey = (d: Date = new Date()) => d.toDateString();

async function getDays(): Promise<string[]> {
  const raw = await storage.getItem('dl.streak.days');
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function getStreak(): Promise<{ days: number; demo: boolean }> {
  const days = await getDays();
  if (days.length === 0 && !isLive()) return { days: 7, demo: true };
  const set = new Set(days);
  const d = new Date();
  if (!set.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(d.toDateString())) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return { days: n, demo: false };
}

export async function markActive(): Promise<void> {
  const k = dayKey();
  const days = await getDays();
  if (!days.includes(k)) {
    await storage.setItem('dl.streak.days', JSON.stringify([...days, k].slice(-60)));
  }
}

const GOALS = [
  { key: 'surah', label: 'Read a surah' },
  { key: 'checkin', label: 'Daily check-in' },
  { key: 'dua', label: 'Make a dua' },
  { key: 'dhikr', label: 'Dhikr (33×)' },
] as const;

export async function getGoal(): Promise<{
  done: number;
  total: number;
  items: { key: string; label: string; done: boolean }[];
  demo: boolean;
}> {
  const raw = await storage.getItem(`dl.goal.${dayKey()}`);
  let rec: Record<string, boolean> = {};
  try {
    rec = raw ? JSON.parse(raw) : {};
  } catch {
    rec = {};
  }
  const empty = Object.keys(rec).length === 0;
  if (empty && !isLive()) {
    rec = { surah: true, checkin: true };
  }
  const items = GOALS.map((g) => ({ ...g, done: !!rec[g.key] }));
  return {
    done: items.filter((i) => i.done).length,
    total: GOALS.length,
    items,
    demo: empty && !isLive(),
  };
}

export async function setGoal(key: string, val: boolean): Promise<void> {
  const k = `dl.goal.${dayKey()}`;
  const raw = await storage.getItem(k);
  let rec: Record<string, boolean> = {};
  try {
    rec = raw ? JSON.parse(raw) : {};
  } catch {
    rec = {};
  }
  rec[key] = val;
  await storage.setItem(k, JSON.stringify(rec));
}

export async function markGoal(key: string): Promise<void> {
  const k = `dl.goal.${dayKey()}`;
  const raw = await storage.getItem(k);
  let rec: Record<string, boolean> = {};
  try {
    rec = raw ? JSON.parse(raw) : {};
  } catch {
    rec = {};
  }
  if (!rec[key]) {
    rec[key] = true;
    await storage.setItem(k, JSON.stringify(rec));
  }
}
