/** Shared Quick-Access catalog + persistence contract (home screen + editor). */

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
  { key: 'learning', label: 'Learning', icon: { fa: 'book-open' }, accent: 'gold', href: '/tools/learning' },
  { key: 'videos', label: 'Videos', icon: { fa: 'play-circle' }, accent: 'gold', href: '/videos' },
  { key: 'quiz', label: 'Quiz', icon: { fa: 'question-circle' }, accent: 'emerald', href: '/tools/quiz' },
  { key: 'scholars', label: 'Scholars', icon: { fa: 'user-graduate' }, accent: 'gold', href: '/tools/scholars' },
  { key: 'inbox', label: 'Inbox', icon: { fa: 'inbox' }, accent: 'emerald', href: '/tools/inbox' },
  { key: 'ai', label: 'DeenLink AI', icon: { fa: 'robot' }, accent: 'gold', href: '/tools/ai' },
];

export const DEFAULT_QUICK: string[] = ['videos', 'quran', 'hadith', 'dua', 'prayer', 'learning'];
export const QUICK_MAX = 6;
// v2: bumped so existing installs pick up the new defaults (Videos first)
export const QUICK_STORAGE_KEY = 'dl.quickaccess.v3';

/** Resolve stored keys to catalog items (drops unknown keys, keeps order). */
export function quickItems(keys: string[]): QuickItem[] {
  return keys
    .map((k) => QUICK_CATALOG.find((c) => c.key === k))
    .filter((c): c is QuickItem => Boolean(c));
}
