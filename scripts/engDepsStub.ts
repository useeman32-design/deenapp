/* faithful copy of normalizeArabic from quranSearch.ts (unit-test stub) */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
export function normalizeArabic(t: string): string {
  return t
    .replace(DIACRITICS, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/[\u061F\u061B\u060C\u061B.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function getRecognition(): null { return null; }
export function speechSupported(): boolean { return false; }
