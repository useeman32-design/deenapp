/**
 * pass 33 — hadith translations fetched ON DEMAND from the fawazahmed0
 * hadith-api CDN (jsDelivr). Zero bundle cost: each request pulls ONE
 * hadith's translation by its canonical number.
 *
 * Coverage of OUR books (editions <code>-<extBook>):
 *   fra (French)  : buhari, muslim, abudawud, nasai, ibnmajah, malik
 *   ben (Bengali) : buhari, muslim, abudawud, tirmidhi, nasai, ibnmajah, malik
 *   urd (Urdu)    : buhari, muslim, abudawud, tirmidhi, nasai, ibnmajah, malik
 * (No Hausa/Yoruba/Igbo hadith dataset exists anywhere — verified.)
 */
export type HadithTrLang = 'fr' | 'bn' | 'ur';

export const HADITH_TR_LANGS: Array<{ id: HadithTrLang; code: string; label: string; api: string }> = [
  { id: 'fr', code: 'FR', label: 'Français', api: 'fra' },
  { id: 'bn', code: 'BN', label: 'বাংলা', api: 'ben' },
  { id: 'ur', code: 'UR', label: 'اردو', api: 'urd' },
];

const EXT_BOOK: Partial<Record<string, string>> = {
  buhari: 'bukhari', muslim: 'muslim', abudawud: 'abudawud', tirmidhi: 'tirmidhi',
  nasai: 'nasai', ibnmajah: 'ibnmajah', malik: 'malik',
};

/** which translation languages exist for a given pack book id */
export function hadithTrLangsFor(bookId: string): typeof HADITH_TR_LANGS {
  if (!EXT_BOOK[bookId]) return [];
  return HADITH_TR_LANGS;
}

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export async function fetchHadithTranslation(bookId: string, lang: HadithTrLang, canonicalNumber: number): Promise<string | null> {
  const ext = EXT_BOOK[bookId];
  if (!ext) return null;
  const key = `${lang}:${ext}:${canonicalNumber}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let p = inflight.get(key);
  if (p) return p;
  p = (async () => {
    const r = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${HADITH_TR_LANGS.find((l) => l.id === lang)?.api}-${ext}/${canonicalNumber}.min.json`);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { hadiths?: Array<{ text?: string }> };
    const text = (j.hadiths?.[0]?.text ?? '').trim();
    return text || null;
  })()
    .then((t) => { cache.set(key, t); return t; })
    .catch(() => { cache.set(key, null); return null; })
    .finally(() => { inflight.delete(key); });
  return p;
}
