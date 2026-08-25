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
      const loc: Loc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        name: 'Your location',
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
