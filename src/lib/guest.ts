import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

/* pass 80 — guest mode. "Skip" on the login screen browses the app as a
 * guest: ONLY the Tools module is available. Every other module renders the
 * LoginRequired popup (Log in / Cancel), and social actions (like, comment,
 * inbox) pop the same dialog then route to login. The flag clears on any
 * successful login/registration/session restore. */

const GUEST_KEY = 'dl.guest.v1';
let guest = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function initGuest(): void {
  AsyncStorage.getItem(GUEST_KEY)
    .then((v) => { if (v === '1' && !guest) { guest = true; emit(); } })
    .catch(() => {});
}

export function isGuestNow(): boolean { return guest; }

export function useIsGuest(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => guest,
    () => false,
  );
}

export async function enterGuest(): Promise<void> {
  guest = true; emit();
  try { await AsyncStorage.setItem(GUEST_KEY, '1'); } catch { /* ignore */ }
  router.replace('/(tabs)/tools');
}

export async function exitGuest(): Promise<void> {
  if (!guest) return;
  guest = false; emit();
  try { await AsyncStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
}

/** Social actions: popup, then smooth redirect to login. Returns true when blocked. */
export function guestBlock(message?: string): boolean {
  if (!guest) return false;
  // Lazy import avoids a cycle; Alert works on web + native.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Alert } = require('react-native') as typeof import('react-native');
  Alert.alert(
    'Login required',
    message ?? 'Sign in or create a free account to use this feature.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log in', onPress: () => { void exitGuest().then(() => router.push('/(auth)/login')); } },
    ],
  );
  return true;
}
