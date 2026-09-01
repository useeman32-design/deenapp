import { CalculationMethod, Coordinates, Madhab, PrayerTimes, Qibla } from 'adhan';
import { storage } from '@/lib/storage';

/** Ozubulu / Owerri, Anambra State, Nigeria — used when no location is available. */
export const FALLBACK_LOCATION = {
  latitude: 5.4805,
  longitude: 7.0088,
  name: 'Owerri, Anambra, Nigeria',
};

export type PrayerName = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export const PRAYER_NAMES: PrayerName[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi\'dah',
  'Dhu al-Hijjah',
];

export const HIJRI_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function computePrayerTimes(
  date: Date,
  coords: { latitude: number; longitude: number },
): Date[] {
  const params = CalculationMethod.MuslimWorldLeague();
  params.madhab = Madhab.Shafi;
  const times = new PrayerTimes(new Coordinates(coords.latitude, coords.longitude), date, params);
  return [times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha];
}

export function nextPrayer(date: Date, times: Date[]): { name: PrayerName; time: Date; index: number } {
  for (let i = 0; i < times.length; i++) {
    if (times[i] > date) return { name: PRAYER_NAMES[i], time: times[i], index: i };
  }
  return { name: 'Fajr', time: times[0], index: 0 };
}

export type Hijri = { day: number; month: number; year: number; weekday: number };

/**
 * Hijri date via the Umm al-Qura-based Intl calendar when the runtime
 * provides it (Hermes & browsers do), falling back to the civil tabular
 * Islamic calendar (may differ by 1–2 days from local moon sighting).
 */
export function hijriDate(date: Date): Hijri {
  try {
    const dtf = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = dtf.formatToParts(date);
    const num = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
    const day = num('day');
    const month = num('month');
    const year = num('year');
    if (day > 0 && month > 0 && year > 0) {
      return { day, month, year, weekday: date.getDay() };
    }
  } catch {
    // fall through to tabular calculation
  }
  return tabularHijri(date);
}

function tabularHijri(date: Date): Hijri {
  const jdn = Math.floor((date.getTime() - Date.UTC(1970, 0, 1)) / 86400000) + 2440588;
  const l = jdn - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 =
    l2 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const m = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * m) / 24);
  return { day, month: m, year: 30 * n + j - 30, weekday: date.getDay() };
}

export function formatHijri(date: Date): string {
  const h = hijriDate(date);
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} AH`;
}

export function formatGregorian(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function qiblaDirection(coords: { latitude: number; longitude: number }): number {
  return Qibla(new Coordinates(coords.latitude, coords.longitude));
}

export const KAABA = {
  latitude: 21.4225,
  longitude: 39.8262,
  name: 'Kaaba, Makkah, Saudi Arabia',
};

/** Great-circle distance in km (haversine). */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}



/* ---------------- pass 23: settings-aware prayer engine ---------------- */

export type MethodId = 'MWL' | 'Karachi' | 'Egyptian' | 'UmmAlQura' | 'Dubai' | 'Kuwait' | 'Qatar' | 'Singapore' | 'Turkey' | 'Tehran' | 'NorthAmerica' | 'Moonsighting';

export const METHODS: Array<{ id: MethodId; label: string; region: string }> = [
  { id: 'MWL', label: 'Muslim World League', region: 'Europe, Far East' },
  { id: 'Karachi', label: 'University of Islamic Sciences, Karachi', region: 'Pakistan, India, Bangladesh' },
  { id: 'Egyptian', label: 'Egyptian General Authority', region: 'Egypt, Africa' },
  { id: 'UmmAlQura', label: 'Umm al-Qura University', region: 'Saudi Arabia' },
  { id: 'Dubai', label: 'Dubai (UAE)', region: 'UAE' },
  { id: 'Kuwait', label: 'Kuwait', region: 'Kuwait' },
  { id: 'Qatar', label: 'Qatar', region: 'Qatar' },
  { id: 'Singapore', label: 'Singapore', region: 'Singapore, Malaysia' },
  { id: 'Turkey', label: 'Diyanet (Turkey)', region: 'Turkey' },
  { id: 'Tehran', label: 'Tehran Institute of Geophysics', region: 'Iran' },
  { id: 'NorthAmerica', label: 'ISNA (North America)', region: 'USA, Canada' },
  { id: 'Moonsighting', label: 'Moonsighting Committee', region: 'Worldwide' },
];

export type PrayerSettings = {
  method: MethodId;
  /** pass 35: IslamicAPI calculation-method id (1-23); used when online */
  apiMethod?: number;
  madhab: 'shafi' | 'hanafi';
  /** per-prayer minute adjustments (index matches PRAYER_NAMES) */
  adjustments: number[];
  adhan: boolean;
  /** pass 33: which adhan recitation plays at prayer time */
  adhanVoice: 'v1' | 'v2' | 'v3';
  city: string;
};

export const DEFAULT_SETTINGS: PrayerSettings = {
  method: 'MWL',
  madhab: 'shafi',
  adjustments: [0, 0, 0, 0, 0, 0],
  adhan: false,
  adhanVoice: 'v1',
  city: '',
};

const SETTINGS_KEY = 'dl.prayer.settings.v1';

export async function loadPrayerSettings(): Promise<PrayerSettings> {
  try {
    const raw = await storage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function savePrayerSettings(s: PrayerSettings) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(s)).catch(() => {});
}

const METHOD_FACTORIES: Record<MethodId, () => any> = {
  MWL: () => CalculationMethod.MuslimWorldLeague(),
  Karachi: () => CalculationMethod.Karachi(),
  Egyptian: () => CalculationMethod.Egyptian(),
  UmmAlQura: () => CalculationMethod.UmmAlQura(),
  Dubai: () => CalculationMethod.Dubai(),
  Kuwait: () => CalculationMethod.Kuwait(),
  Qatar: () => CalculationMethod.Qatar(),
  Singapore: () => CalculationMethod.Singapore(),
  Turkey: () => CalculationMethod.Turkey(),
  Tehran: () => CalculationMethod.Tehran(),
  NorthAmerica: () => CalculationMethod.NorthAmerica(),
  Moonsighting: () => CalculationMethod.MoonsightingCommittee(),
};

/** times with the user's method + madhab + per-prayer adjustments applied */
export function computePrayerTimesWith(date: Date, coords: { latitude: number; longitude: number }, s: PrayerSettings): Date[] {
  const params = METHOD_FACTORIES[s.method]();
  params.madhab = s.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const times = new PrayerTimes(new Coordinates(coords.latitude, coords.longitude), date, params);
  const base = [times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha];
  return base.map((t, i) => new Date(t.getTime() + (s.adjustments[i] ?? 0) * 60000));
}

/** hh:mm AA remaining e.g. "2h 14m" */
export function countdownTo(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${String(mm).padStart(2, '0')}m`;
  return `${mm}m ${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}s`;
}
