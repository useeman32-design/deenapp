/* pass 83-39 — module maintenance gating.
 * Admin → System Settings → App Modules toggles every module off/on
 * (settings/public.php). Off = the module shows "under maintenance" and is
 * inaccessible in the app. Cached for the session; fails OPEN (never locks
 * users out because of a network hiccup). */
import { publicSettings } from '@/api/client';

export type MaintenanceFlags = Record<string, boolean | string>;

let cache: MaintenanceFlags | null = null;
let inflight: Promise<MaintenanceFlags> | null = null;

export async function maintenanceFlags(): Promise<MaintenanceFlags> {
  if (cache) return cache;
  if (!inflight) {
    inflight = publicSettings()
      .then((s) => { cache = s || {}; return cache; })
      .catch(() => { return {}; });
  }
  return inflight;
}

/** true = admin switched this module off. Unknown/failure = false (open). */
export function isUnderMaintenance(flags: MaintenanceFlags, key: string): boolean {
  return flags[`maintenance.${key}`] === true;
}

/** master switch off = whole app under maintenance (except the gate screen) */
export function isMasterMaintenance(flags: MaintenanceFlags): boolean {
  return flags['maintenance.master'] === true;
}

/** tools route → maintenance key (single source for the tools gate) */
export const ROUTE_MODULE: Record<string, string> = {
  dua: 'athkar',
  jokes: 'jokes',
  articles: 'articles',
  quiz: 'quiz',
  learning: 'learning',
  lessons: 'learning',
  courses: 'courses',
  names: 'names',
  prophets: 'prophets',
  wallpapers: 'wallpapers',
  events: 'events',
  shop: 'shop',
  ai: 'ai',
  scholars: 'chat',
  'scholar-inbox': 'chat',
  inbox: 'chat',
  connections: 'chat',
  fatwa: 'learning',
  tafsir: 'quran',
  seerah: 'prophets',
  ruqyah: 'athkar',
  tasbeeh: 'athkar',
  videos: 'videos',
  charity: 'donation',
  deenpoints: 'learning',
};
