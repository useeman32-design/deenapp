import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { api } from '@/api/client';
import { Alert } from '@/lib/alert';
import { haptic } from '@/lib/haptics';

/**
 * pass 99 — "Continue with Google".
 *
 * Asks the API for the authorise URL (so the Client ID lives in Admin, not in
 * this bundle), then hands the browser to Google. On the web PWA that is a
 * full-page navigation, so the session cookie the callback sets applies to the
 * whole app; the app comes back with ?google=complete (new account, completion
 * modal) or ?google=login / ?google=linked (already a member). On native it
 * opens the system browser — the same round trip, the PWA handles the return.
 */
export function useGoogleAuth() {
  const [busy, setBusy] = useState(false);

  const start = useCallback(async (mode: 'signup' | 'signin') => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.googleStart(mode);
      if (!res.ok || !res.url) {
        setBusy(false);
        Alert.alert(
          'Google sign-in',
          res.message || 'Google sign-in is not available yet. Please use email and password.',
        );
        return;
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(res.url);
        return; /* the page is navigating away */
      }
      await Linking.openURL(res.url).catch(() => {
        setBusy(false);
        haptic.medium();
        Alert.alert('Google sign-in', 'Could not open the browser. Please try again.');
      });
    } catch {
      setBusy(false);
      Alert.alert('Google sign-in', 'Something went wrong. Please try again.');
    }
  }, [busy]);

  return { start, busy };
}
