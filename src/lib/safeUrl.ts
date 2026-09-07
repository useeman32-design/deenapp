import { Linking } from 'react-native';

/* pass 81 — never hand a server/admin-supplied string straight to openURL:
 * javascript:/data: payloads would execute in the web build. Only real web
 * (and mail/tel) schemes pass. */
export function safeOpenUrl(url: string | null | undefined): void {
  if (!url) return;
  const u = url.trim();
  if (!/^(https?:|mailto:|tel:)/i.test(u)) return;
  Linking.openURL(u).catch(() => {});
}
