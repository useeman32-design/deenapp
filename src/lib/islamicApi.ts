/**
 * pass 35 — IslamicAPI client (islamicapi.com) with the user's key.
 *  · prayer times (today / specific date / FULL MONTH) + qibla + hijri
 *  · zakat nisab (gold/silver thresholds, live prices, many currencies)
 *  · ruqyah shariah (3 programs, Quran + Sunnah sources, topic articles)
 *
 * The key ships with the app (revocable — if the API ever returns 401/403,
 * callers fall back to the built-in offline calculation).
 */

/* pass 35 — key moved to EXPO_PUBLIC_ISLAMIC_API_KEY (.env); inline fallback keeps
 * `npx expo export` + gh-pages working even without the env file (key is revocable/public). */
const KEY = process.env.EXPO_PUBLIC_ISLAMIC_API_KEY || '1HmsIFcy3PEAdEWx7Jsk67j5jSxSnP6S0H5mXU2qVKL3Ssdq';
const BASE = 'https://islamicapi.com/api/v1';

export const PRAYER_METHODS: Array<{ id: number; label: string }> = [
  { id: 1, label: 'University of Islamic Sciences, Karachi' },
  { id: 2, label: 'Islamic Society of North America (ISNA)' },
  { id: 3, label: 'Muslim World League' },
  { id: 4, label: 'Umm Al-Qura University, Makkah' },
  { id: 5, label: 'Egyptian General Authority of Survey' },
  { id: 7, label: 'Institute of Geophysics, Tehran' },
  { id: 8, label: 'Gulf Region' },
  { id: 9, label: 'Kuwait' },
  { id: 10, label: 'Qatar' },
  { id: 11, label: 'MUIS, Singapore' },
  { id: 12, label: 'UOIF, France' },
  { id: 13, label: 'Diyanet, Turkey' },
  { id: 14, label: 'Russia' },
  { id: 15, label: 'Moonsighting Committee Worldwide' },
  { id: 16, label: 'Dubai' },
  { id: 17, label: 'JAKIM, Malaysia' },
  { id: 18, label: 'Tunisia' },
  { id: 19, label: 'Algeria' },
  { id: 20, label: 'KEMENAG, Indonesia' },
  { id: 21, label: 'Morocco' },
  { id: 22, label: 'Lisbon, Portugal' },
  { id: 23, label: 'Jordan' },
];

export const SCHOOLS: Array<{ id: 1 | 2; label: string }> = [
  { id: 1, label: 'Shafi (standard)' },
  { id: 2, label: 'Hanafi' },
];

export type ApiPrayerTimes = {
  Fajr: string; Sunrise: string; Dhuhr: string; Asr: string;
  Sunset: string; Maghrib: string; Isha: string; Imsak: string;
  Midnight: string; Firstthird: string; Lastthird: string;
};
export type HijriDate = {
  date: string;
  day: string;
  month: { number: number; en: string; ar: string };
  year: string;
};
export type PrayerDay = {
  date: string;              /* YYYY-MM-DD */
  times: ApiPrayerTimes;
  hijri_date?: HijriDate;
  readable?: string;
};
export type PrayerResponse = {
  times: ApiPrayerTimes;
  hijri?: HijriDate;
  readable?: string;
  qibla?: { degrees: number; distanceKm: number };
};

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const q = new URLSearchParams({ api_key: KEY } as Record<string, string>);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${BASE}${path}/?${q.toString()}`, { signal: ctrl.signal });
    const j = (await r.json()) as T & { status?: string; message?: string };
    if ((j as { status?: string }).status === 'error') throw new Error((j as { message?: string }).message ?? 'api error');
    return j;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- prayer times ---------------- */

export async function fetchPrayerDay(opts: {
  lat: number; lon: number; method?: number; school?: 1 | 2; date?: string;
}): Promise<PrayerResponse> {
  const r = await get<{ data: { times: ApiPrayerTimes; date?: { hijri?: HijriDate; readable?: string }; qibla?: { direction?: { degrees?: number }; distance?: { value?: number } } } }>(
    '/prayer-time',
    { lat: opts.lat, lon: opts.lon, method: opts.method, school: opts.school, date: opts.date },
  );
  const d = r.data;
  return {
    times: d.times,
    hijri: d.date?.hijri,
    readable: d.date?.readable,
    qibla: d.qibla ? { degrees: d.qibla.direction?.degrees ?? 0, distanceKm: d.qibla.distance?.value ?? 0 } : undefined,
  };
}

export async function fetchPrayerMonth(opts: {
  lat: number; lon: number; method?: number; school?: 1 | 2; month?: string; /* YYYY-MM */
}): Promise<PrayerDay[]> {
  const ym = opts.month ?? new Date().toISOString().slice(0, 7);
  const r = await get<{ data: PrayerDay[] | { times: ApiPrayerTimes; hijri_date?: HijriDate; date?: string }[] }>(
    '/prayer-time',
    { lat: opts.lat, lon: opts.lon, method: opts.method, school: opts.school, date: ym },
  );
  const list = Array.isArray(r.data) ? r.data : [];
  /* month entries arrive as { date, times, hijri_date } — normalise */
  return list.map((d) => {
    const day = d as PrayerDay & { hijri_date?: HijriDate };
    return {
      date: day.date,
      times: day.times,
      hijri_date: day.hijri_date,
      readable: day.readable,
    } as PrayerDay;
  }).filter((d) => d.date && d.times);
}

/* ---------------- zakat nisab ---------------- */

export type Nisab = {
  gold: { weight: number; unit_price: number; nisab_amount: number };
  silver: { weight: number; unit_price: number; nisab_amount: number };
  zakat_rate: string;
  currency: string;
  standard: string;
};

export async function fetchNisab(currency = 'ngn', standard: 'classical' | 'common' = 'classical'): Promise<Nisab> {
  const r = await get<{
    calculation_standard: string; currency: string;
    data: { nisab_thresholds: Nisab['gold'] extends never ? never : { gold: Nisab['gold']; silver: Nisab['silver'] }; zakat_rate: string };
  }>('/zakat-nisab', { standard, currency, unit: 'g' });
  return {
    gold: r.data.nisab_thresholds.gold,
    silver: r.data.nisab_thresholds.silver,
    zakat_rate: r.data.zakat_rate,
    currency: r.currency,
    standard: r.calculation_standard,
  };
}

/* ---------------- ruqyah ---------------- */

export type RuqyahEntry = {
  id: number | string;
  title: string;
  arabic: string;
  transliteration?: string;
  translation?: string;
  reference?: string;
  category?: string;
  sub_category?: string;
  introduction?: string;
};
export type RuqyahProgram = {
  title: string;
  subcategories: Array<{ subcategory: string; 'subcategory-slug': string; ruqyah: Array<{ id: string; title: string }> }>;
};
export type RuqyahTopicCat = { slug?: string; title?: string; articles?: Array<{ id: string | number; title: string }> };

export const RUQYAH_PROGRAMS = [
  { id: 'brief-ruqya', label: 'Brief Ruqya', sub: '22 entries — quick daily protection' },
  { id: 'a-medium-ruqya', label: 'Medium Ruqya', sub: '81 entries — complete session' },
  { id: 'a-long-ruqya', label: 'Long Ruqya', sub: '205 entries — full treatment program' },
] as const;

export const RUQYAH_TOPICS = [
  { slug: 'introduction-to-ruqyah', label: 'Introduction to Ruqyah', icon: 'book-open' },
  { slug: 'protect-yourself-from-jinn', label: 'Protection from Jinn', icon: 'shield-alt' },
  { slug: 'black-magic-sihr', label: 'Black Magic (Sihr)', icon: 'ban' },
  { slug: 'evil-eye-and-envy', label: 'Evil Eye & Envy', icon: 'eye' },
  { slug: 'about-raqi', label: 'About the Raqi', icon: 'user-tie' },
  { slug: 'types-of-hijamah-bloodletting', label: 'Hijamah (Cupping)', icon: 'tint' },
  { slug: 'ruqyah-materials', label: 'Ruqyah Materials', icon: 'box-open' },
  { slug: '7-day-detoxification-program', label: '7-Day Detox Program', icon: 'calendar-check' },
  { slug: 'waswasah-whisperings', label: 'Waswasah (Whisperings)', icon: 'wind' },
  { slug: 'the-ruqyah-bath-against-sihr', label: 'The Ruqyah Bath', icon: 'bath' },
  { slug: 'other-diseases', label: 'Other Diseases', icon: 'notes-medical' },
  { slug: 'treatment-for-general-problems', label: 'General Treatment', icon: 'hand-holding-heart' },
  { slug: 'full-ruqyah-program', label: 'Full Ruqyah Program', icon: 'clipboard-list' },
] as const;

export const ruqyah = {
  programs: (lang = 'en') => get<{ data: RuqyahProgram[] }>('/ruqyah', { type: 'instant-category', lang }).then((r) => r.data),
  entries: (program: string, source: 'from-quran' | 'from-sunnah', lang = 'en') =>
    get<{ data: RuqyahEntry[] }>('/ruqyah', { type: 'instant', lang, program, source }).then((r) => r.data),
  topicCategories: (lang = 'en') => get<{ data: RuqyahTopicCat[] }>('/ruqyah', { type: 'topic-category', lang }).then((r) => r.data),
  topic: (topic: string, lang = 'en') =>
    get<{ data: RuqyahEntry[] }>('/ruqyah', { type: 'topic', lang, topic }).then((r) => r.data),
};
