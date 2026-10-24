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

/**
 * tools route → maintenance key (single source for the tools gate).
 *
 * pass 107 — the owner asked for the mirath calculator and the other ungated
 * modules to be switchable from Admin → System Settings → App Modules. Auditing
 * every route under src/app/tools/ against this map found 11 unmapped, one of
 * which was a real bug rather than an omission:
 *
 *   hadith -> 'hadith'   the maintenance.hadith flag has existed in
 *                        settings/public.php and in the admin UI all along, but
 *                        no route was mapped to it, so toggling "Hadith" off in
 *                        admin did NOTHING. The flag was decoration.
 *
 * Routes deliberately left ungated, because they are utilities rather than
 * modules and switching them off would strand the user: search, notifications,
 * post (the composer), hashtag, suggestions, group.
 */
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

  /* ── pass 107 additions ─────────────────────────────────────────────── */
  /* the bug: this flag already existed server-side and in admin, unmapped */
  hadith: 'hadith',

  /* new flags — each needs a matching entry in api/settings/public.php,
   * api/admin/settings/get.php, the save.php schema, and admin/settings.html */
  mirath: 'mirath',
  zakat: 'zakat',
  prayer: 'prayer',
  'prayer-month': 'prayer',
  qibla: 'qibla',
  calendar: 'calendar',
  riddles: 'riddles',

  /* reuse an existing flag rather than adding a near-duplicate one */
  'scholar-apply': 'chat',
  'zikr-challenge': 'athkar',
};

/**
 * pass 118 — top-level routes that are modules the Admin panel can switch off.
 *
 * The tools/* routes were already gated by ROUTE_MODULE, but the owner's ask was
 * broader: "everything that can be controlled for the web app, if put under
 * maintenance, reflects in the app". The heavy modules live OUTSIDE /tools
 * (the reels feed, the Qur'an reader, the shop, the community tab), so they get
 * their own map. Anything absent here can never be gated — the home feed,
 * profile and settings stay reachable so a user is never stranded, and an
 * unknown flag can never lock the app.
 */
export const TOPLEVEL_MODULE: Record<string, string> = {
  videos: "videos",
  quran: "quran",
  read: "quran",
  shop: "shop",
  community: "chat",
};

/** module key for a pathname, or null when the route is not gateable. */
export function moduleForPath(pathname: string | null | undefined): string | null {
  const seg = String(pathname || "")
    .split("/")
    .filter(Boolean)
    .find((s) => !s.startsWith("(") && !s.startsWith("["));
  if (!seg) return null;
  if (seg === "tools") return null; // tools/_layout gates its own sub-routes
  return TOPLEVEL_MODULE[seg] ?? null;
}
