/**
 * Daily routine tracking — Quran streak + today's goal.
 * Local-first (storage), so it works offline; the home dashboard reads
 * these to render the "Daily Progress" cards.
 */
import { storage } from '@/lib/storage';
import { appDefaults, isLive, awardDeenPoints } from '@/api/client';

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
  tafsir: 'Read a tafsir',
  athkar: 'Morning/evening athkar',
  prayer: 'Check prayer times',
  qibla: 'Find the qibla',
  fatwa: 'Ask a fatwa',
  prophets: "Read a prophet's story",
  seerah: 'Read the Seerah',
  ruqyah: 'Ruqyah Shariah',
  articles: 'Read an article',
  learn: 'Open the Learning Hub',
  zikr: 'Daily zikr challenge',
  course: 'Continue a course',
};

/* pass 46 — each goal opens its activity screen when tapped. */
const GOAL_ROUTES: Record<string, string> = {
  surah: '/(tabs)/quran',
  checkin: '/(tabs)/profile',
  dua: '/tools/dua',
  dhikr: '/tools/tasbeeh',
  quiz: '/tools/quiz',
  hadith: '/tools/hadith',
  names: '/tools/names',
  charity: '/tools/charity',
  tafsir: '/tools/tafsir',
  athkar: '/tools/athkar',
  prayer: '/tools/prayer',
  qibla: '/tools/qibla',
  fatwa: '/tools/fatwa',
  prophets: '/tools/prophets',
  seerah: '/tools/seerah',
  ruqyah: '/tools/ruqyah',
  articles: '/tools/articles',
  learn: '/tools/learning',
  zikr: '/tools/zikr-challenge',
  course: '/tools/courses',
};

export const goalRoute = (key: string): string | undefined => GOAL_ROUTES[key];

/* pass 44 — admin can override the rotating sets (api/defaults/get.php); the
 * bundled all-module shuffle remains the fallback. Fetched once, cached. */
let setsCache: string[][] | null = null;
let setsPromise: Promise<void> | null = null;
function ensureSets(): Promise<void> {
  if (setsCache) return Promise.resolve();
  if (!setsPromise) {
    setsPromise = appDefaults()
      .then((d) => {
        if (d && Array.isArray(d.goal_sets)) {
          const s = d.goal_sets.filter((x) => Array.isArray(x) && x.length > 0);
          if (s.length) setsCache = s;
        }
      })
      .catch(() => {});
  }
  return setsPromise;
}

/** Stable per-day pick: same date -> same set, next day -> rotates. */
function daySet(): string[] {
  const s = dayKey();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  // Admin override still wins if provided.
  if (setsCache && setsCache.length) return setsCache[h % setsCache.length];
  // Otherwise: a deterministic shuffle of ALL app modules — every day a different
  // order, but the same day is stable across reloads.
  const arr = Object.keys(GOAL_META);
  let seed = h || 1;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0x100000000; };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

export async function getGoal(): Promise<{
  done: number;
  total: number;
  items: { key: string; label: string; done: boolean; route?: string }[];
  demo: boolean;
}> {
  await ensureSets();
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
    route: GOAL_ROUTES[key],
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
    /* pass 44 — record WHICH goal completed; home dashboard consumes on focus */
    const pk = `dl.goal.pending.${dayKey()}`;
    let pend: string[] = [];
    try { const pr = await storage.getItem(pk); const parsed = pr ? JSON.parse(pr) : []; if (Array.isArray(parsed)) pend = parsed; } catch { pend = []; }
    if (!pend.includes(key)) pend.push(key);
    await storage.setItem(pk, JSON.stringify(pend));
    /* pass 48 — award DeenPoints server-side for completing this activity
     * (idempotent per activity per day, so re-opening won't double-award). */
    awardDeenPoints(key).then((r) => {
      // Keep the displayed balance in sync with the server ledger.
      if (r.ok && typeof r.balance === 'number') storage.setItem('dl.deenpoints', String(r.balance)).catch(() => {});
    }).catch(() => {});
  }
}

/** pass 44 — read+clear the just-completed goals; returns their labels for the celebration. */
export async function consumeGoalPending(): Promise<string[]> {
  const k = `dl.goal.pending.${dayKey()}`;
  const v = await storage.getItem(k);
  if (!v) return [];
  await storage.setItem(k, '[]');
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr) && arr.length) return arr.map((key) => GOAL_META[String(key)] ?? String(key));
  } catch { /* ignore */ }
  return [];
}

/** pass 44 — has the all-goals-complete 10 DP reward been granted today? */
export async function claimGoalReward(): Promise<boolean> {
  const k = `dl.goal.rewarded.${dayKey()}`;
  const v = await storage.getItem(k);
  if (v === '1') return false;
  await storage.setItem(k, '1');
  return true;
}
