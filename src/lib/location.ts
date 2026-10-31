import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { storage } from './storage';
import { FALLBACK_LOCATION } from './prayer';

export type Loc = {
  latitude: number;
  longitude: number;
  name: string;
  isFallback?: boolean;
};

const KEY = 'dl.location';
// Multiple mounted screens must never open competing native permission prompts.
let permissionFlight: ReturnType<typeof Location.requestForegroundPermissionsAsync> | null = null;
function requestPermission() {
  if (!permissionFlight) permissionFlight = Location.requestForegroundPermissionsAsync().finally(() => { permissionFlight = null; });
  return permissionFlight;
}
function deadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location timed out')), ms);
    work.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function resolveLocation(): Promise<Loc> {
  const saved = await storage.getItem(KEY).catch(() => null);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Loc;
      if (Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude) && Math.abs(parsed.latitude) <= 90 && Math.abs(parsed.longitude) <= 180) {
        /* pass 40 — caches saved before real geocoding (or from a failed
         * lookup) carry a placeholder name; re-resolve it once, in place.
         * This is why a NORMAL browser said "Your location" while an
         * incognito window (empty cache) showed the real place name. */
        if (!parsed.name || /^(your location|current location|unknown)$/i.test(parsed.name.trim()) || /^-?\d/.test(parsed.name.trim())) {
          const fresh = await cityName(parsed.latitude, parsed.longitude);
          if (fresh && fresh !== parsed.name) {
            const updated = { ...parsed, name: fresh };
            await storage.setItem(KEY, JSON.stringify(updated));
            return updated;
          }
        }
        return parsed;
      }
    } catch {
      // ignore corrupt storage
    }
  }
  try {
    const granted = await requestPermission();
    if (Platform.OS === 'web' || granted.granted) {
      const pos = await deadline(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000);
      /* pass 29: resolve a REAL place name (used to literally say
       * "Your location") — free reverse geocoder, no key, cached. */
      const name = await cityName(pos.coords.latitude, pos.coords.longitude);
      const loc: Loc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        name,
      };
      await storage.setItem(KEY, JSON.stringify(loc));
      return loc;
    }
  } catch {
    // permission denied or unavailable — fall through
  }
  return { ...FALLBACK_LOCATION, isFallback: true };
}

export async function resetLocation(): Promise<Loc> {
  await storage.removeItem(KEY);
  /* pass 102 — go through setLocation so every mounted screen hears about it */
  const fresh = await resolveLocation();
  setLocation(fresh);
  return fresh;
}

/* ── pass 102 — reactive location store ──────────────────────────────────────
 *
 * THE BUG: applyLocation / detectLocationChange / watchLocation existed but
 * had ZERO callers anywhere in the app. Tapping the location pill ran
 * `resolveLocation()`, which returns the CACHED value — so a member who moved
 * from Gusau to Kano kept seeing "Gusau" forever, and there was no modal to
 * change it. Nothing was broken in the geocoding; the whole change-location
 * feature was simply never wired up.
 *
 * Now every screen subscribes through useLocation(), so one change updates the
 * home hero, prayer times, the month table and the qibla at once — no stale
 * "Gusau" surviving on a screen that mounted before the change.
 */
const listeners = new Set<(loc: Loc | null) => void>();
let current: Loc | null = null;
let inflight: Promise<Loc> | null = null;

/** Subscribe to location changes. Returns an unsubscribe function. */
export function onLocationChange(cb: (loc: Loc | null) => void): () => void {
  listeners.add(cb);
  if (current) cb(current);
  return () => {
    listeners.delete(cb);
  };
}

function emit(loc: Loc | null): void {
  current = loc;
  for (const cb of listeners) {
    try {
      cb(loc);
    } catch {
      /* one bad listener must not stop the others */
    }
  }
}

/** The last known location without touching GPS or storage. */
export function peekLocation(): Loc | null {
  return current;
}

/** Publish a new location to every subscriber. */
export function setLocation(loc: Loc | null): void {
  emit(loc);
}

/** Resolve once and publish. Concurrent callers share one GPS fix / one read. */
export function refreshLocation(): Promise<Loc> {
  if (current && !current.isFallback) return Promise.resolve(current);
  inflight =
    inflight ??
    resolveLocation()
      .then((loc) => {
        emit(loc);
        return loc;
      })
      .finally(() => {
        inflight = null;
      });
  return inflight;
}

/** Save a chosen location and publish it everywhere in one step. */
export async function applyLocation(loc: Loc): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(loc));
  emit({ ...loc, isFallback: false });
}

/** Force a brand-new GPS fix, reverse-geocode it, save and publish it. */
export async function useCurrentGpsLocation(): Promise<Loc> {
  const granted = await requestPermission();
  if (Platform.OS !== 'web' && !granted.granted) {
    throw new Error('Location permission was denied. Enable it in your device settings, or pick your city manually.');
  }
  const pos = await deadline(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000);
  const name = await cityName(pos.coords.latitude, pos.coords.longitude);
  const loc: Loc = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    name,
  };
  await applyLocation(loc);
  return loc;
}


/** Reverse-geocode coordinates to "City, Country" (BigDataCloud free client
 * API — no key). Falls back to a coordinate label so it never lies. */
export async function cityName(lat: number, lon: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const r = await deadline(fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: controller.signal },
    ).finally(() => clearTimeout(timer)), 4500);
    if (r.ok) {
      const j = (await r.json()) as { city?: string; locality?: string; principalSubdivision?: string; countryName?: string };
      const city = j.city || j.locality || j.principalSubdivision || '';
      const country = j.countryName || '';
      const label = [city, country].filter(Boolean).join(', ');
      if (label) return label;
    }
  } catch {
    /* offline / blocked — coordinate label below */
  }
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}

/* ── pass 38 — location persistence + change detection ──
 * Watches device GPS (when permitted). If the user has moved >15 km from
 * their saved location, reverse-geocode the new spot and surface a prompt:
 * "New location detected: Kano, Nigeria — update prayer times?" The app
 * never switches silently — the user confirms first. */
export const CHANGE_THRESHOLD_KM = 15;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** One-shot check: returns the detected new location when the user has
 * moved beyond the threshold, else null. Persists the last-seen fix. */
export async function detectLocationChange(): Promise<Loc | null> {
  try {
    const granted = await Location.getForegroundPermissionsAsync();
    if (Platform.OS === 'web' || !granted.granted) return null;
    const pos = await deadline(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000);
    const saved = await resolveLocation();
    if (saved.isFallback) return null; /* nothing saved yet — nothing to compare */
    const km = distanceKm(saved.latitude, saved.longitude, pos.coords.latitude, pos.coords.longitude);
    if (km < CHANGE_THRESHOLD_KM) return null;
    const name = await cityName(pos.coords.latitude, pos.coords.longitude);
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, name };
  } catch {
    return null;
  }
}

/** Live watcher: calls cb with a candidate new location on significant
 * moves. Returns a stop function (or null where unsupported). */
export function watchLocation(cb: (candidate: Loc) => void): (() => void) | null {
  let stopped = false;
  let subscription: { remove: () => void } | null = null;
  void (async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted || stopped) return;
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 120_000, distanceInterval: CHANGE_THRESHOLD_KM * 1000 },
        (pos) => { void (async () => {
          const saved = await resolveLocation();
          if (stopped || saved.isFallback || distanceKm(saved.latitude, saved.longitude, pos.coords.latitude, pos.coords.longitude) < CHANGE_THRESHOLD_KM) return;
          const name = await cityName(pos.coords.latitude, pos.coords.longitude);
          if (!stopped) cb({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, name });
        })().catch(() => {}); },
      );
      if (stopped) sub.remove(); else subscription = sub;
    } catch { /* permission or GPS unavailable */ }
  })();
  return () => { stopped = true; subscription?.remove(); };
}

/** Accept a detected change: persist it as the new saved location.
 *  pass 102 — now defined once, above, next to the store; it also publishes
 *  the change so every subscribed screen updates immediately. */
