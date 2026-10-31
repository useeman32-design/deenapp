import { FEMALE_AVATARS_ITEMS, MALE_AVATARS_ITEMS } from '@/data/avatars';

/** Only known app-library avatars are local; uploads and external URLs remain untouched. */
export function bundledAvatarFor(input: unknown): number | undefined {
  const raw = String(input ?? '').trim();
  if (!raw) return undefined;
  let path = raw;
  if (/^(?:https?:)?\/\//i.test(raw)) {
    const origin = raw.match(/^(?:https?:)?\/\/([^/]+)(\/.*)?$/i);
    if (!origin || !['app.deenlink.org', 'deenlink.org', 'www.deenlink.org'].includes(origin[1].toLowerCase())) return undefined;
    path = origin[2] ?? '';
  }
  const m = path.replace(/^\/+/, '').match(/^img\/profile\/(male|female)\/([^/?#]+)(?:[?#].*)?$/i);
  if (!m) return undefined;
  let name = m[2];
  try { name = decodeURIComponent(name); } catch { return undefined; }
  const list = m[1].toLowerCase() === 'male' ? MALE_AVATARS_ITEMS : FEMALE_AVATARS_ITEMS;
  return list.find((item) => item.name === name)?.src;
}
