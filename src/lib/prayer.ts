import { CalculationMethod, Coordinates, Madhab, PrayerTimes, Qibla } from 'adhan';

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
