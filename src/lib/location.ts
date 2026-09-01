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

export async function resolveLocation(): Promise<Loc> {
  const saved = await storage.getItem(KEY).catch(() => null);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Loc;
      if (parsed.latitude && parsed.longitude) return parsed;
    } catch {
      // ignore corrupt storage
    }
  }
  try {
    const granted = await Location.requestForegroundPermissionsAsync();
    if (Platform.OS === 'web' || granted.granted) {
      const pos = await Location.getCurrentPositionAsync();
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
  return resolveLocation();
}


/** Reverse-geocode coordinates to "City, Country" (BigDataCloud free client
 * API — no key). Falls back to a coordinate label so it never lies. */
export async function cityName(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
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
    const granted = await Location.requestForegroundPermissionsAsync();
    if (Platform.OS === 'web' || !granted.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
  try {
    const sub = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 120_000, distanceInterval: CHANGE_THRESHOLD_KM * 1000 },
      (pos) => {
        void (async () => {
          const saved = await resolveLocation();
          if (saved.isFallback) return;
          const km = distanceKm(saved.latitude, saved.longitude, pos.coords.latitude, pos.coords.longitude);
          if (km < CHANGE_THRESHOLD_KM) return;
          const name = await cityName(pos.coords.latitude, pos.coords.longitude);
          cb({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, name });
        })();
      },
    );
    return () => {
      void sub.then((s) => s.remove()).catch(() => {});
    };
  } catch {
    return null;
  }
}

/** Accept a detected change: persist it as the new saved location. */
export async function applyLocation(loc: Loc): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(loc));
}
