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
