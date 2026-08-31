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
    /* pass 34b — gzio works on web (DecompressionStream) AND native (pako +
     * the Metro dev-server URL), so FR/BN/UR/Yorùbá load in Expo Go too. */
    const { fetchGzText } = await import('@/lib/gzio');
    const j = JSON.parse(await fetchGzText(`/translations/${lang}.json.gz`)) as Record<string, string>;
    return j;
  })().catch((e) => {
    cache.delete(lang);
    throw e;
  });
  cache.set(lang, p);
  return p;
}
