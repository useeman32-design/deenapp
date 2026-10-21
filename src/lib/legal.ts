import { Linking } from 'react-native';

/**
 * lib/legal.ts — pass 104.
 *
 * The signup screen showed an "I agree to the Terms of Service and the Privacy
 * Policy" checkbox whose two document names were styled text with no onPress, so
 * a user was asked to agree to two documents they could not open — and, until
 * this pass, that did not exist anywhere. Google Play requires a hosted privacy
 * policy URL for the Data Safety form, and its account-deletion and UGC reviews
 * expect terms too.
 *
 * One module so every screen resolves the same URLs from the same origin as the
 * API and the public/ assets (see lib/gzio.ts::publicBase and EXPO_PUBLIC_API_URL
 * in .env — all three are app.deenlink.org; deenlink.org is the old checkout and
 * 404s for these files).
 */

const ORIGIN = (
  (process.env.EXPO_PUBLIC_WEB_URL as string | undefined) ??
  'https://app.deenlink.org'
).replace(/\/+$/, '');

export const WEB_ORIGIN = ORIGIN;
export const TERMS_URL = `${ORIGIN}/terms.html`;
export const PRIVACY_URL = `${ORIGIN}/privacy.html`;

/** Open a legal document in the system browser. Never throws. */
export function openLegalDoc(url: string): void {
  try {
    void Linking.openURL(url).catch(() => {});
  } catch {
    /* a browser that cannot be opened must not block signup */
  }
}
