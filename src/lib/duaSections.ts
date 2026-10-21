import type { ContentDua } from '@/lib/content';

/**
 * Dua sections — the bundled pack is Hisn al-Muslim: a flat list of 132
 * situation duas whose `ID` is the book's own canonical number (verified:
 * 1..132, contiguous, unique).
 *
 * PASS 103 — this used to bucket duas by running regexes over the English
 * TITLE, first match wins. That was badly wrong:
 *
 *   · 60 of 132 duas (45%) matched nothing and fell into a "More Duas"
 *     catch-all, including obvious ones — "Invocations for rising from the
 *     Ruki'" and "Invocations for sitting between two prostrations" are prayer
 *     duas; "Invocation for when it rains" and the wind/thunder/new-moon duas
 *     have no keyword at all.
 *   · first-match-wins misfiled duas on an incidental word. "Invocation for
 *     when you see the first dates of the season" landed in Travel & Journey
 *     because the regex matched "sea" inside "sea·son". The whole Hajj set
 *     (115-121: Talbiyah, Black Stone, Safa and Marwah, Arafat, Muzdalifah,
 *     stoning at Mina) went to Travel for the same reason. Funeral duas for
 *     the dead (52, 55, 56) went to Family & Children because the titles
 *     contain "child"/"dying". The Qur'an prostration dua (21) was the sole
 *     member of "Qur'an & Knowledge".
 *
 * Titles are also inconsistent in the source data — lowercase first letters
 * ("supplications for when you wake up"), a typo ("vocation for someone who
 * says"), a smart apostrophe ("The groom's supplication") — so any keyword
 * approach is fragile by construction. The IDs are stable, so the mapping is
 * now explicit and exhaustive. `sectionOf()` still falls back to the regexes
 * for an ID outside 1..132 (e.g. if the pack is ever extended), and finally to
 * 'other', so nothing can be dropped.
 */

export type DuaSectionId =
  | 'morning'
  | 'sleep'
  | 'prayer'
  | 'fasting'
  | 'eating'
  | 'dressing'
  | 'home'
  | 'sickness'
  | 'weather'
  | 'protection'
  | 'distress'
  | 'family'
  | 'social'
  | 'travel'
  | 'hajj'
  | 'dhikr'
  | 'other';

export const DUA_SECTIONS: Array<{ id: DuaSectionId; label: string; icon: string; match: RegExp }> = [
  { id: 'morning', label: 'Morning & Evening', icon: 'sun', match: /morning|evening|day and night|dawn|adhān|athan|call to prayer/i },
  { id: 'sleep', label: 'Sleep & Waking', icon: 'moon', match: /sleep|wake|dream|nightmare|bed|stir in the night/i },
  { id: 'prayer', label: 'Ablution & Prayer', icon: 'star-and-crescent', match: /prayer|mosque|masjid|ablution|wudu|qibla|sujūd|sujood|ruku|prostrat|tashahhud|witr|qunut|adhan|athaan|istikharah/i },
  { id: 'fasting', label: 'Fasting & Ramadan', icon: 'cloud-moon', match: /\bfast\b|\bfasting\b|ramadan|iftar|breaking the fast/i },
  { id: 'eating', label: 'Eating & Drinking', icon: 'utensils', match: /eat|food|drink|meal|breakfast|dinner|zamzam|milk|fruit|honey|dates|slaughter|sacrific/i },
  { id: 'dressing', label: 'Wearing Clothes', icon: 'tshirt', match: /dress|clothes|wearing|garment|new clothes|shoe|sandals|undress/i },
  { id: 'home', label: 'Home & Marketplace', icon: 'home', match: /home|house|leave|leaving|enter|restroom|toilet|bathroom|market|town|city/i },
  { id: 'sickness', label: 'Sickness & Death', icon: 'hospital', match: /sick|ill|terminal|dying|death|dead|deceased|funeral|grave|bereav|bury|burial/i },
  { id: 'weather', label: 'Weather & Nature', icon: 'cloud-sun-rain', match: /wind|thunder|rain|moon|weather|storm/i },
  { id: 'protection', label: 'Protection & Forgiveness', icon: 'shield-alt', match: /protect|forgive|forgiveness|refuge|punishment|evil|satan|shaytan|devil|shirk|pain|evil eye|dajjal|messiah|repent|sin|portent/i },
  { id: 'distress', label: 'Anxiety & Hardship', icon: 'hand-holding-heart', match: /anxiety|worry|grief|sad|sorrow|anguish|hardship|debt|poverty|enemy|adversary|oppress|anger|patience|calam|tragedy|difficult|misfortune|fright/i },
  { id: 'family', label: 'Family & Marriage', icon: 'child', match: /wife|husband|child|children|family|son|daughter|mother|father|parents|marriage|wedding|groom|bride|intercourse|newly/i },
  { id: 'social', label: 'Everyday Interactions', icon: 'comments', match: /assembly|majlis|salam|greeting|sneez|praise|congratulat|love you|wealth|loan|lends|good to you|bless you|cock|donkey|dog barking|surprised|startled|please you|etiquette|goodness|spoken ill/i },
  { id: 'travel', label: 'Travel & Journey', icon: 'car', match: /travel|journey|vehicle|car|ride|mount|boat|plane|airport|layover|returning from a journey/i },
  { id: 'hajj', label: 'Hajj & Umrah', icon: 'kaaba', match: /hajj|umrah|pilgrim|talbiyah|black stone|safa|marwah|arafat|muzdalifah|mina|stoning/i },
  { id: 'dhikr', label: 'Remembrance of Allah', icon: 'praying-hands', match: /excellence of remembering|glorified Allah|blessings upon the prophet|remembrance|remembering Allah|glorif|tasbih|istighfar|seeking forgiveness|steadfast|heart|qalb|knowledge|increase me|learn|study|understand|wisdom|memory/i },
  { id: 'other', label: 'More Duas', icon: 'ellipsis-h', match: /.^/ },
];

/**
 * Explicit Hisn al-Muslim number → section. Every ID 1..132 is listed; the
 * verification script in scripts/dua-sections-check.mjs fails the build if a
 * pack ID is missing from this map or if any ID is listed twice.
 */
const SECTION_BY_ID: Record<number, DuaSectionId> = {
  /* Morning & Evening — 27 is the single morning-and-evening chapter */
  27: 'morning',

  /* Sleep & Waking */
  1: 'sleep', 28: 'sleep', 29: 'sleep', 30: 'sleep', 31: 'sleep',

  /* Ablution & Prayer — wudu, mosque, athan, the pillars, witr, istikharah */
  8: 'prayer', 9: 'prayer', 12: 'prayer', 13: 'prayer', 14: 'prayer', 15: 'prayer',
  16: 'prayer', 17: 'prayer', 18: 'prayer', 19: 'prayer', 20: 'prayer', 21: 'prayer',
  22: 'prayer', 23: 'prayer', 24: 'prayer', 25: 'prayer', 26: 'prayer', 32: 'prayer',
  33: 'prayer', 42: 'prayer',

  /* Fasting & Ramadan */
  68: 'fasting', 73: 'fasting', 74: 'fasting', 75: 'fasting',

  /* Eating & Drinking — incl. 76 (first dates of the season) and 127 (slaughtering) */
  69: 'eating', 70: 'eating', 71: 'eating', 72: 'eating', 76: 'eating', 127: 'eating',

  /* Wearing Clothes */
  2: 'dressing', 3: 'dressing', 4: 'dressing', 5: 'dressing',

  /* Home & Marketplace — restroom, leaving/entering home, arriving in a town, market */
  6: 'home', 7: 'home', 10: 'home', 11: 'home', 97: 'home', 98: 'home',

  /* Sickness & Death — visiting the sick, the dying, funeral, grave, bereavement */
  49: 'sickness', 50: 'sickness', 51: 'sickness', 52: 'sickness', 53: 'sickness',
  54: 'sickness', 55: 'sickness', 56: 'sickness', 57: 'sickness', 58: 'sickness',
  59: 'sickness', 60: 'sickness',

  /* Weather & Nature — wind, thunder, rain, the new moon */
  61: 'weather', 62: 'weather', 63: 'weather', 64: 'weather', 65: 'weather',
  66: 'weather', 67: 'weather',

  /* Protection & Forgiveness — harm, faith, sin, devil, children's protection,
     Dajjal, shirk, evil portent, bodily pain, the evil eye, repentance */
  39: 'protection', 40: 'protection', 44: 'protection', 45: 'protection',
  48: 'protection', 86: 'protection', 88: 'protection', 92: 'protection',
  94: 'protection', 124: 'protection', 125: 'protection', 128: 'protection',
  129: 'protection',

  /* Anxiety & Hardship — worry, anguish, adversaries, rulers, enemies, debt,
     difficulty, disliked events, anger, another's misfortune, fright */
  34: 'distress', 35: 'distress', 36: 'distress', 37: 'distress', 38: 'distress',
  41: 'distress', 43: 'distress', 46: 'distress', 82: 'distress', 83: 'distress',
  106: 'distress', 122: 'distress', 123: 'distress', 126: 'distress',

  /* Family & Marriage — new parents, the groom, the wedding night, intercourse */
  47: 'family', 79: 'family', 80: 'family', 81: 'family',

  /* Everyday Interactions — assemblies and their expiation, salam, sneezing,
     praise, gifts and loans, love for Allah's sake, omens in animals */
  77: 'social', 78: 'social', 84: 'social', 85: 'social', 87: 'social',
  89: 'social', 90: 'social', 91: 'social', 93: 'social', 108: 'social',
  109: 'social', 110: 'social', 111: 'social', 112: 'social', 113: 'social',
  114: 'social', 132: 'social',

  /* Travel & Journey — riding, setting out, a failing mount, farewells,
     glorifying Allah en route, the dawn invocation, a layover, returning */
  95: 'travel', 96: 'travel', 99: 'travel', 100: 'travel', 101: 'travel',
  102: 'travel', 103: 'travel', 104: 'travel', 105: 'travel',

  /* Hajj & Umrah — talbiyah, the Black Stone, Safa and Marwah, Arafat,
     Muzdalifah, stoning at Mina */
  115: 'hajj', 116: 'hajj', 117: 'hajj', 118: 'hajj', 119: 'hajj', 120: 'hajj',
  121: 'hajj',

  /* Remembrance of Allah — salawat, the virtue of dhikr, the Prophet's tasbih */
  107: 'dhikr', 130: 'dhikr', 131: 'dhikr',
};

/** Regex fallback, used only for an ID this build has never seen. */
function sectionByTitle(title: string): DuaSectionId {
  for (const s of DUA_SECTIONS) if (s.id !== 'other' && s.match.test(title)) return s.id;
  return 'other';
}

export function sectionOf(title: string, id?: number | null): DuaSectionId {
  if (id != null) {
    const mapped = SECTION_BY_ID[id];
    if (mapped) return mapped;
  }
  return sectionByTitle(title);
}

/**
 * A dua that already knows which section it belongs in. Admin-added rows carry
 * the owner's own Group choice here, which beats anything derived from a title.
 */
export type SectionedDua = ContentDua & { section?: DuaSectionId };

export function groupBySection(duas: SectionedDua[]): Record<DuaSectionId, ContentDua[]> {
  const out = {} as Record<DuaSectionId, ContentDua[]>;
  for (const s of DUA_SECTIONS) out[s.id] = [];
  for (const c of duas) {
    const forced = c.section;
    const id = forced && out[forced] ? forced : sectionOf(c.TITLE ?? '', c.ID ?? null);
    (out[id] ?? (out[id] = [])).push(c);
  }
  /* keep each section in the book's own order rather than file order; admin
     additions have no Hisn number, so they sort after it */
  for (const s of DUA_SECTIONS) out[s.id].sort((a, b) => (a.ID ?? 0) - (b.ID ?? 0));
  return out;
}

/** Section an arbitrary dua lands in — used to file admin-added duas. */
export function sectionIdOf(
  grouped: Record<DuaSectionId, ContentDua[]>,
  id: number,
): DuaSectionId {
  for (const s of DUA_SECTIONS) if (grouped[s.id]?.some((c) => c.ID === id)) return s.id;
  return 'other';
}

/** Every ID this build maps explicitly — exposed for the coverage check. */
export const MAPPED_DUA_IDS: number[] = Object.keys(SECTION_BY_ID).map(Number).sort((a, b) => a - b);

/**
 * PASS 103 — which section an admin-added dua belongs in.
 *
 * The admin panel has a free-text Group field, so the owner's own choice wins
 * when it is specific: a dua he groups as "Morning" or "After Prayer" goes
 * where he put it, even if its title would suggest otherwise. "General" (the
 * schema default) carries no information, so those fall through to the title
 * regexes — which is what files "Before eating" under Eating & Drinking and
 * "On entering the mosque" under Ablution & Prayer rather than dumping them in
 * the catch-all.
 */
const GROUP_TO_SECTION: Record<string, DuaSectionId> = {
  morning: 'morning',
  evening: 'morning',
  'morning & evening': 'morning',
  'after prayer': 'prayer',
  'after salah': 'prayer',
  'after salat': 'prayer',
  salah: 'prayer',
  salat: 'prayer',
  prayer: 'prayer',
  masjid: 'prayer',
  mosque: 'prayer',
  fasting: 'fasting',
  ramadan: 'fasting',
  sleep: 'sleep',
  night: 'sleep',
  eating: 'eating',
  food: 'eating',
  drink: 'eating',
  drinking: 'eating',
  clothes: 'dressing',
  dressing: 'dressing',
  home: 'home',
  house: 'home',
  market: 'home',
  sickness: 'sickness',
  illness: 'sickness',
  death: 'sickness',
  funeral: 'sickness',
  grave: 'sickness',
  weather: 'weather',
  rain: 'weather',
  protection: 'protection',
  forgiveness: 'protection',
  refuge: 'protection',
  anxiety: 'distress',
  hardship: 'distress',
  worry: 'distress',
  grief: 'distress',
  debt: 'distress',
  family: 'family',
  marriage: 'family',
  children: 'family',
  wedding: 'family',
  travel: 'travel',
  journey: 'travel',
  hajj: 'hajj',
  umrah: 'hajj',
  dhikr: 'dhikr',
  remembrance: 'dhikr',
  knowledge: 'dhikr',
};

export function sectionForAdminDua(group: string, title: string): DuaSectionId {
  const g = (group || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  /* "general" is the column default and tells us nothing — ignore it */
  if (g && g !== 'general' && g !== 'dua' && g !== 'other') {
    const mapped = GROUP_TO_SECTION[g];
    if (mapped) return mapped;
  }
  return sectionByTitle(title);
}
