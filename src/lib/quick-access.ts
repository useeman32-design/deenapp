/** Shared Quick-Access catalog + persistence contract (home screen + editor). */
import { appDefaults } from '@/api/client';

export type QuickItem = {
  key: string;
  label: string;
  icon: { fa?: string; beads?: boolean };
  accent: 'emerald' | 'gold';
  href: string;
};

export const QUICK_CATALOG: QuickItem[] = [
  { key: 'quran', label: 'Quran', icon: { fa: 'quran' }, accent: 'emerald', href: '/(tabs)/quran' },
  { key: 'hadith', label: 'Hadith', icon: { fa: 'book-reader' }, accent: 'gold', href: '/tools/hadith' },
  { key: 'dua', label: 'Dua', icon: { fa: 'hands-helping' }, accent: 'emerald', href: '/tools/dua' },
  { key: 'prayer', label: 'Prayer Times', icon: { fa: 'clock' }, accent: 'gold', href: '/tools/prayer' },
  { key: 'dhikr', label: 'Dhikr', icon: { beads: true }, accent: 'emerald', href: '/tools/tasbeeh' },
  { key: 'qibla', label: 'Qibla', icon: { fa: 'kaaba' }, accent: 'gold', href: '/tools/qibla' },
  { key: 'calendar', label: 'Calendar', icon: { fa: 'calendar' }, accent: 'emerald', href: '/tools/calendar' },
  { key: 'names', label: 'Names of Allah', icon: { fa: 'gem' }, accent: 'gold', href: '/tools/names' },
  { key: 'zakat', label: 'Zakat', icon: { fa: 'hand-holding-heart' }, accent: 'gold', href: '/tools/charity' },
  { key: 'zakatcalc', label: 'Zakat Calc', icon: { fa: 'balance-scale' }, accent: 'emerald', href: '/tools/zakat' },
  { key: 'wallpapers', label: 'Wallpapers', icon: { fa: 'image' }, accent: 'emerald', href: '/tools/wallpapers' },
  { key: 'courses', label: 'Courses', icon: { fa: 'graduation-cap' }, accent: 'emerald', href: '/tools/learning' },
  /* pass 44 — renamed per user: the learning shortcut now reads Learning Hub */
  { key: 'learning', label: 'Learning Hub', icon: { fa: 'book-open' }, accent: 'gold', href: '/tools/learning' },
  { key: 'videos', label: 'Videos', icon: { fa: 'play-circle' }, accent: 'gold', href: '/videos' },
  { key: 'quiz', label: 'Quiz', icon: { fa: 'question-circle' }, accent: 'emerald', href: '/tools/quiz' },
  { key: 'scholars', label: 'Scholars', icon: { fa: 'user-graduate' }, accent: 'gold', href: '/tools/scholars' },
  { key: 'inbox', label: 'Inbox', icon: { fa: 'inbox' }, accent: 'emerald', href: '/tools/inbox' },
  { key: 'ai', label: 'DeenLink AI', icon: { fa: 'robot' }, accent: 'gold', href: '/tools/ai' },
  { key: 'ruqyah', label: 'Ruqyah', icon: { fa: 'shield-alt' }, accent: 'emerald', href: '/tools/ruqyah' },
  /* pass 78 — DeenLink Shop */
  { key: 'shop', label: 'Shop', icon: { fa: 'shopping-bag' }, accent: 'gold', href: '/shop' },
];

export const DEFAULT_QUICK: string[] = ['shop', 'videos', 'quran', 'hadith', 'dua', 'prayer', 'learning'];
/* pass 79 — the home rail now lists EVERY shortcut; the editor only removes
 * or rearranges them, so QUICK_MAX only bounds legacy saved selections. */
export const QUICK_MAX = 20;
export const QUICK_STORAGE_KEY = 'dl.quickaccess.v5';

/** v5 storage: explicit order + hidden set. Legacy v3/v4 arrays = order only. */
export type QuickPrefs = { order: string[]; hidden: string[] };

export function parseQuickPrefs(raw: string | null): QuickPrefs | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return { order: v.filter((k): k is string => typeof k === 'string'), hidden: [] };
    if (v && typeof v === 'object') {
      const o = v as { order?: unknown; hidden?: unknown };
      return {
        order: Array.isArray(o.order) ? o.order.filter((k): k is string => typeof k === 'string') : [],
        hidden: Array.isArray(o.hidden) ? o.hidden.filter((k): k is string => typeof k === 'string') : [],
      };
    }
  } catch { /* corrupt → defaults */ }
  return null;
}

/** Every visible shortcut: saved order first, then the rest of the catalog. */
export function resolveQuick(prefs: QuickPrefs | null, orderPrefix: string[] = []): QuickItem[] {
  const hidden = new Set(prefs?.hidden ?? []);
  const order = [...(prefs?.order ?? []), ...orderPrefix];
  const byKey = new Map(QUICK_CATALOG.map((c) => [c.key, c] as const));
  const out: QuickItem[] = [];
  const seen = new Set<string>();
  for (const k of order) {
    const it = byKey.get(k);
    if (it && !hidden.has(k) && !seen.has(k)) { out.push(it); seen.add(k); }
  }
  for (const it of QUICK_CATALOG) {
    if (!hidden.has(it.key) && !seen.has(it.key)) { out.push(it); seen.add(it.key); }
  }
  return out;
}

/** Resolve stored keys to catalog items (drops unknown keys, keeps order). */
export function quickItems(keys: string[]): QuickItem[] {
  return keys
    .map((k) => QUICK_CATALOG.find((c) => c.key === k))
    .filter((c): c is QuickItem => Boolean(c));
}

/* pass 44 — admin-set default shortcuts (Slice 4); cached, bundled DEFAULT_QUICK fallback. */
let liveQuick: string[] | null = null;
export async function loadQuickDefaults(): Promise<string[]> {
  if (liveQuick) return liveQuick;
  try {
    const d = await appDefaults();
    if (d && Array.isArray(d.quick_defaults) && d.quick_defaults.length) liveQuick = d.quick_defaults.slice(0, QUICK_MAX);
  } catch { /* offline — keep bundled */ }
  return liveQuick ?? DEFAULT_QUICK;
}
