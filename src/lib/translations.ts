/**
 * pass 33 — extra Qur'an translations (public/translations/<lang>.json.gz,
 * ~320KB each gzipped; 6,236 verses as "surah:ayah" → text):
 *   yo = Yoruba (Shaykh Abu Rahimah Mikael Aykyuni, via quran.com)
 *   fr = French (Montada Hamidullah) · bn = Bengali · ur = Urdu (Jalandhry)
 * Hausa (Gumi) + English already ship inside the content pack.
 */
export type TrLang = 'en' | 'ha' | 'yo' | 'fr' | 'bn' | 'ur';
export const TR_LANGS: Array<{ id: TrLang; code: string; label: string }> = [
  { id: 'en', code: 'EN', label: 'English' },
  { id: 'ha', code: 'HA', label: 'Hausa' },
  { id: 'yo', code: 'YO', label: 'Yorùbá' },
  { id: 'fr', code: 'FR', label: 'Français' },
  { id: 'bn', code: 'BN', label: 'বাংলা' },
  { id: 'ur', code: 'UR', label: 'اردو' },
];

const cache = new Map<TrLang, Promise<Record<string, string>>>();

export function loadTranslation(lang: TrLang): Promise<Record<string, string>> {
  if (lang === 'en' || lang === 'ha') return Promise.resolve({});
  let p = cache.get(lang);
  if (p) return p;
  p = (async () => {
    if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
    const base = typeof window !== 'undefined' ? window.location.pathname.replace(/^(\/deenapp\b).*$/, '$1') : '';
    const r = await fetch(`${base}/translations/${lang}.json.gz`);
    if (!r.ok) throw new Error(`translation ${lang}: ${r.status}`);
    const stream = r.body?.pipeThrough(new DecompressionStream('gzip'));
    if (!stream) throw new Error('no body');
    const j = JSON.parse(await new Response(stream).text()) as Record<string, string>;
    return j;
  })().catch((e) => {
    cache.delete(lang);
    throw e;
  });
  cache.set(lang, p);
  return p;
}
