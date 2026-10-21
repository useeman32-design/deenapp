/**
 * pass 34b — cross-platform gzip + public-asset loading (Expo Go support).
 *
 * Web: DecompressionStream + fetch(url from window.location).
 * Native (Expo Go / dev builds): pako.ungzip + expo-file-system File for
 * bundled assets, and public/ files are fetched from the Metro dev server
 * (Constants.expoConfig.hostUri).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ungzip } from 'pako';

/* ---------- bytes → utf8 text (TextDecoder when available, manual else) ---------- */
export function utf8Decode(bytes: Uint8Array): string {
  try {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  } catch {}
  let s = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) s += String.fromCharCode(b);
    else if (b < 0xe0) s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0) s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const off = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (off >> 10), 0xdc00 + (off & 0x3ff));
    }
  }
  return s;
}

/* ---------- gunzip that works on BOTH platforms ---------- */
export function gunzipBytes(bytes: Uint8Array): Uint8Array {
  return ungzip(bytes);
}

/* ---------- base for files in public/ (translations, hadith-num, adhan) ---------- */
export function publicBase(): string {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return '';
    const p = window.location.pathname;
    // GitHub Pages serves the app under /deenapp; app.deenlink.org serves it from
    // the domain root (baseUrl "/"). Public data (islamqa.json, prophets/, quran …)
    // lives next to index.html in both cases, so the base is /deenapp or "" — never
    // the current route path (which previously produced /tools/fatwa/islamqa.json → 404).
    return p.startsWith('/deenapp') ? '/deenapp' : '';
  }
  /* Expo Go / dev: Metro serves public/ at the dev-server root */
  try {
    const host = (Constants as unknown as { expoConfig?: { hostUri?: string } }).expoConfig?.hostUri;
    if (host) return `http://${host}`;
  } catch {}
  /*
   * PASS 104 — RELEASE native build.
   *
   * There is no Metro server here, so hostUri is undefined and this used to
   * return ''. That made fetchGzText()/its callers build bare relative URLs
   * like "/translations/ur.json.gz", and React Native's fetch cannot resolve a
   * URL with no host — the request throws. Every one of the nine call sites has
   * a .catch() that silently degrades to empty data, so in a Play Store build:
   *
   *   - the Yorùbá / Français / বাংলা / اردو Qur'an translations never loaded,
   *     while the pill still displayed the selected language;
   *   - adhan audio had no host and could not play;
   *   - the prophet histories screen fetched an empty index;
   *   - islamqa.json (the fatwa corpus) and hadith-num/*.json never arrived.
   *
   * None of it was visible on web (window.location supplies the base) or in
   * Expo Go (Metro supplies it) — native release only.
   *
   * The public/ tree is served from the same origin as the web build, so use
   * that. Verified 2026-10-15: /prophets/index.json, /islamqa.json (4.3 MB),
   * /hadith-num/bukhari.json, /translations/{yo,fr,bn,ur}.json.gz and
   * /adhan/adhan{1,2,3}.mp3 all return HTTP 200 on app.deenlink.org, and 404 on
   * the old deenlink.org checkout.
   */
  return (
    (process.env.EXPO_PUBLIC_WEB_URL as string | undefined)?.replace(/\/+$/, '') ??
    'https://app.deenlink.org'
  );
}

/* ---------- fetch a .gz file from public/ and get its text (both platforms) ---------- */
export async function fetchGzText(path: string): Promise<string> {
  const url = `${publicBase()}${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetchGz ${path}: ${r.status}`);
  if (typeof DecompressionStream !== 'undefined' && r.body) {
    const stream = r.body.pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  /* native: no DecompressionStream in Hermes — inflate with pako */
  const buf = await r.arrayBuffer();
  return utf8Decode(gunzipBytes(new Uint8Array(buf)));
}
