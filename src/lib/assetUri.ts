/* pass 93 — LOCAL images and the web bundle.
 *
 * Metro's web export compiles `require('…/deenpoints.png')` into
 *   { uri: './assets/assets/img/deenpoints.dba1f53a….png', width: 200, height: 200 }
 * — a RELATIVE uri (verified in the exported bundle). expo-image passes that
 * straight to <img src>, so the browser resolves it against the CURRENT route:
 *   /read/1        → /read/assets/…    → 404 → blank box
 *   /tools/qibla   → /tools/assets/…   → 404 → blank box
 * which is exactly the owner's report — the DeenPoints coin missing on the
 * theme chips (MushafPage + qibla skins) and on the reciter rows, and the
 * reciter portraits never showing on the reader screen.
 *
 * The bundle <script> is loaded with an ABSOLUTE path in both flavors
 * (app.deenlink.org root and the /deenapp/ gh-pages site), so its directory IS
 * the app root. Every local asset is resolved against it.
 *
 * Native is untouched: `require()` returns an asset id (number) there and
 * expo-image resolves it normally.
 */

function appBase(): string {
  if (typeof document === 'undefined') return '';
  try {
    const tags = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
    const entry = tags.find((t) => /_expo\/static\/js\/web\/entry-[^/]+\.js$/.test(t.src));
    if (entry?.src) return entry.src.replace(/\/_expo\/.*$/, '/');
    const { origin, pathname } = window.location;
    return origin + pathname.replace(/[^/]*$/, '');
  } catch {
    return '';
  }
}

/** Absolute URL for a Metro-relative asset uri ('./assets/…'). */
export function withAppBase(uri: string): string {
  if (!uri) return uri;
  if (/^(https?:|data:|blob:|\/)/i.test(uri)) return uri;
  const base = appBase();
  if (!base) return uri;
  try {
    return new URL(uri.replace(/^\.\//, ''), base).href;
  } catch {
    return uri;
  }
}

/** Pass a `require()`d image to expo-image/Image and still get a real URL on web. */
export function localAsset<T>(source: T): T {
  if (source == null || typeof source === 'number' || typeof source === 'string') return source;
  const s = source as { uri?: string };
  if (!s.uri) return source;
  const uri = withAppBase(s.uri);
  return uri === s.uri ? source : ({ ...(source as object), uri } as T);
}

/** Install the app-root <base> once, at startup, on web.
 *
 * Metro emits local images as `{ uri: './assets/assets/img/x.hash.png' }` — a
 * path relative to the DOCUMENT, so on a nested route such as /read/1 or
 * /tools/deenpoints the browser asks for /read/assets/… and gets a 404. Setting
 * <base> to the app root makes every relative asset URL resolve correctly from
 * any route — including the sites we did not touch individually — while leaving
 * absolute paths ('/api/…', '/tools/…') untouched.
 *
 * Called from src/app/_layout.tsx. No-op on native and when a base already
 * exists (the exported index.html has none).
 */
export function installWebAssetBase(): void {
  if (typeof document === 'undefined') return;
  try {
    if (document.querySelector('base')) return;
    const base = appBase();
    if (!base) return;
    const tag = document.createElement('base');
    tag.href = base;
    document.head.insertBefore(tag, document.head.firstChild);
  } catch {
    /* never break the app over an image path */
  }
}
