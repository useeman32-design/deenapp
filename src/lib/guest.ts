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
try {
  /* pass 81 — read the flag synchronously on web so guarded screens never
   * flash their content before the async AsyncStorage read lands. */
  if (typeof localStorage !== 'undefined') guest = localStorage.getItem(GUEST_KEY) === '1';
} catch { /* native falls through to initGuest() */ }
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
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(GUEST_KEY, '1'); } catch { /* ignore */ }
  try { await AsyncStorage.setItem(GUEST_KEY, '1'); } catch { /* ignore */ }
  router.replace('/(tabs)'); /* pass 83-6: guests land on Home, not Tools */
}

export async function exitGuest(): Promise<void> {
  if (!guest) return;
  guest = false; emit();
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
  try { await AsyncStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
}

/* pass 83-6 — the LoginModalHost (mounted in _layout) registers itself here.
 * RN's Alert.alert is a NO-OP on web, so the styled modal is the real UI. */
type LoginModalHandler = (message?: string) => void;
let loginModalHandler: LoginModalHandler | null = null;
export function setLoginModalHandler(h: LoginModalHandler | null): void { loginModalHandler = h; }

/** Social actions: popup, then smooth redirect to login. Returns true when blocked. */
export function guestBlock(message?: string): boolean {
  if (!guest) return false;
  if (loginModalHandler) { loginModalHandler(message); return true; }
  /* fallback (host not mounted yet — e.g. very early boot): native alert */
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
