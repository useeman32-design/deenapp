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

/* pass 44 — Today's Goal is now AUTO-DETECTED, not manually tappable.
 * Each goal key maps to a real action the app already records via markGoal()
 * (see call sites: surah reader, profile check-in, dua, tasbeeh/zikr, quiz,
 * hadith, names, charity). The home modal only DISPLAYS state; it never writes.
 *
 * And the 4 fixed goals became 8 rotating SETS: a deterministic hash of the
 * calendar day picks one set, so every day a different combination appears but
 * the same day always shows the same set (stable across reloads). */
const GOAL_META: Record<string, string> = {
  surah: 'Read a surah',
  checkin: 'Daily check-in',
  dua: 'Make a dua',
  dhikr: 'Dhikr (33×)',
  quiz: 'Play a quiz',
  hadith: 'Read a hadith',
  names: 'Read the Names',
  charity: 'Give in charity',
};

const GOAL_SETS: string[][] = [
  ['surah', 'checkin', 'dua', 'dhikr'],
  ['surah', 'hadith', 'dhikr', 'dua'],
  ['surah', 'quiz', 'checkin', 'dua'],
  ['hadith', 'names', 'dhikr', 'checkin'],
  ['surah', 'names', 'dua', 'dhikr'],
  ['surah', 'checkin', 'quiz', 'dhikr'],
  ['hadith', 'charity', 'dua', 'checkin'],
  ['surah', 'hadith', 'names', 'dua'],
];

/** Stable per-day pick: same date -> same set, next day -> rotates. */
function daySet(): string[] {
  const s = dayKey();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GOAL_SETS[h % GOAL_SETS.length];
}

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
  const items = daySet().map((key) => ({
    key,
    label: GOAL_META[key] ?? key,
    done: !!rec[key],
  }));
  return {
    done: items.filter((i) => i.done).length,
    total: items.length,
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
