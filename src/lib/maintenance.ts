/* pass 83-39 — module maintenance gating.
 * Admin → System Settings → App Modules toggles every module off/on
 * (settings/public.php). Off = the module shows "under maintenance" and is
 * inaccessible in the app. Cached for the session; fails OPEN (never locks
 * users out because of a network hiccup). */
import { publicSettings } from '@/api/client';

export type MaintenanceFlags = Record<string, boolean | string>;

/**
 * pass 121 — two defects in the code above, both of which made the Admin
 * "App Modules" switches less powerful than they looked:
 *
 *  1. `MaintenanceGate` re-reads the flags on foreground and every 60 seconds,
 *     but `if (cache) return cache` meant that poll could NEVER observe a
 *     change: the first answer was pinned for the whole app lifetime. Flipping
 *     Mirath off in Admin therefore did nothing for anyone until they killed and
 *     reopened the app — and the comment in the gate claiming "an admin flips a
 *     switch and the app follows without a reinstall" was describing intent,
 *     not behaviour. Now: a 60s TTL, matched to the gate's own interval.
 *  2. On a failed fetch, `inflight` stayed set to a resolved `{}` promise while
 *     `cache` stayed null, so every later call returned the SAME empty object.
 *     One network hiccup at boot muted the whole gating system for the session —
 *     including an emergency master switch. Now a failure keeps the last known
 *     good flags and the next poll retries.
 *
 * Fails OPEN in the same direction as before: an unreachable API never locks a
 * user out, it just defers the decision to the next poll.
 */
const TTL_MS = 60_000;

let cache: MaintenanceFlags | null = null;
let fetchedAt = 0;
let inflight: Promise<MaintenanceFlags> | null = null;

export async function maintenanceFlags(opts: { force?: boolean } = {}): Promise<MaintenanceFlags> {
  if (cache !== null && !opts.force && Date.now() - fetchedAt < TTL_MS) return cache;
  if (!inflight) {
    inflight = publicSettings()
      .then((s) => {
        /* An empty document is a valid answer, but it must not DISCARD flags we
         * already have (that would silently lift a maintenance switch). */
        if (s && Object.keys(s).length) cache = s;
        fetchedAt = Date.now();
        return cache ?? {};
      })
      .catch(() => {
        fetchedAt = Date.now(); /* don't hammer a failing endpoint every 60s */
        return cache ?? {};
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Drop the cached flags (after Admin saves, or to re-check immediately). */
export function invalidateMaintenance(): void {
  cache = null;
  fetchedAt = 0;
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

/**
 * pass 122 — one label per module key, so a gated screen reads "Mirath
 * Calculator is under maintenance" instead of the generic wording. Keys here are
 * the values of ROUTE_MODULE / TOPLEVEL_MODULE (i.e. the admin flag names), not
 * route names, so every gateable module must appear exactly once.
 */
export const MODULE_LABEL: Record<string, string> = {
  athkar: "Athkar & Du'a",
  quran: "Qur'an study",
  hadith: 'Hadith',
  tafsir: "Qur'an study",
  learning: 'Learning',
  courses: 'Courses',
  quiz: 'Quiz',
  names: 'Names of Allah',
  prophets: 'Prophets & Seerah',
  riddles: 'Riddles',
  jokes: 'Lifestyle',
  articles: 'Articles',
  videos: 'Videos',
  wallpapers: 'Wallpapers',
  events: 'Events',
  shop: 'Shop',
  donation: 'Charity',
  chat: 'Community',
  ai: 'DeenLink AI',
  mirath: 'Mirath Calculator',
  zakat: 'Zakat Calculator',
  prayer: 'Prayer times',
  qibla: 'Qibla',
  calendar: 'Calendar',
};

/** Human label for a module key, or undefined when the key is unknown. */
export function moduleLabel(key: string | null | undefined): string | undefined {
  return key ? MODULE_LABEL[key] : undefined;
}
