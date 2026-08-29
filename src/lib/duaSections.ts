import type { ContentDua } from '@/lib/content';

/**
 * Dua sections (pass 20) — the pack is a flat list of 132 situation duas;
 * we group them into readable sections for the section → duas flow.
 */

export type DuaSectionId =
  | 'morning'
  | 'sleep'
  | 'prayer'
  | 'home'
  | 'eating'
  | 'dressing'
  | 'travel'
  | 'protection'
  | 'family'
  | 'knowledge'
  | 'distress'
  | 'other';

export const DUA_SECTIONS: Array<{ id: DuaSectionId; label: string; icon: string; match: RegExp }> = [
  { id: 'morning', label: 'Morning & Evening', icon: 'sun', match: /morning|evening|day and night|dawn|adhān|athan|call to prayer/i },
  { id: 'sleep', label: 'Sleep & Waking', icon: 'moon', match: /sleep|wake|dream|nightmare|bed/i },
  { id: 'prayer', label: 'Prayer & Mosque', icon: 'mosque', match: /prayer|mosque|masjid|ablution|wudu|qibla|sujūd|sujood|ruku|ramadan|fast|itikaf|jumu|friday|eid|athaan/i },
  { id: 'home', label: 'Home & Leaving', icon: 'home', match: /home|house|leave|leaving|enter|restroom|toilet|bathroom/i },
  { id: 'eating', label: 'Eating & Drinking', icon: 'utensils', match: /eat|food|drink|meal|breakfast|dinner|zamzam|milk|fruit|honey/i },
  { id: 'dressing', label: 'Wearing Clothes', icon: 'tshirt', match: /dress|clothes|wearing|garment|new clothes|shoe|sandals/i },
  { id: 'travel', label: 'Travel & Journey', icon: 'car', match: /travel|journey|vehicle|car|ride|mount|sea|boat|plane|airport|returning from a journey/i },
  { id: 'protection', label: 'Protection & Forgiveness', icon: 'shield-alt', match: /protect|forgive|forgiveness|refuge|seek|punishment|grave|hell|evil|satan|shaytan|devil|sickness|illness|pain|fever|distress|harm/i },
  { id: 'family', label: 'Family & Children', icon: 'child', match: /wife|husband|child|children|family|son|daughter|mother|father|parents|marriage|wedding|newly/i },
  { id: 'knowledge', label: "Qur'an & Knowledge", icon: 'book-open', match: /qur|knowledge|learn|study|teacher|teaching|wisdom|memory|understand/i },
  { id: 'distress', label: 'Anxiety & Hardship', icon: 'hand-holding-heart', match: /anxiety|worry|sad|sorrow|hardship|debt|poverty|enemy|oppress|anger|patience|calam|trial|sicken|death|deceased|funeral|condolence/i },
  { id: 'other', label: 'More Duas', icon: 'ellipsis-h', match: /.^/ },
];

export function sectionOf(title: string): DuaSectionId {
  for (const s of DUA_SECTIONS) if (s.id !== 'other' && s.match.test(title)) return s.id;
  return 'other';
}

export function groupBySection(duas: ContentDua[]): Record<DuaSectionId, ContentDua[]> {
  const out = {} as Record<DuaSectionId, ContentDua[]>;
  for (const s of DUA_SECTIONS) out[s.id] = [];
  for (const c of duas) out[sectionOf(c.TITLE)].push(c);
  return out;
}
