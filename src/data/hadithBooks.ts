/**
 * The 14 hadith collections (pass 15). Structure mirrors the Qur’an browser:
 * collection → chapters → reader. Counts are the traditional totals.
 * Reader content is served from HADITHS (demo pool) mapped per collection.
 */
export type HadithBook = {
  id: string;
  name: string;
  arabic: string;
  author: string;
  total: number;
  desc: string;
  tint: string;
  grad: [string, string];
  chapters: Array<{ id: string; label: string; count: number }>;
};

const CH = (labels: Array<[string, number]>) => labels.map(([label, count], i) => ({ id: `c${i + 1}`, label, count }));

/** static import (require() inside the helper broke on native ESM) */
import { HADITHS } from './hadith';

export const HADITH_BOOKS: HadithBook[] = [
  {
    id: 'bukhari',
    name: 'Sahih al-Bukhari',
    arabic: 'صحيح البخاري',
    author: 'Imam al-Bukhari',
    total: 7563,
    desc: 'The most authentic book after the Qur’an',
    tint: '#4AE38F',
    grad: ['#1D6F42', '#0F3D24'],
    chapters: CH([['Faith (Kitab al-Iman)', 51], ['Knowledge (Kitab al-Ilm)', 186], ['Purification', 293], ['Prayer (As-Salat)', 1140], ['Fasting (As-Sawm)', 291], ['Charity (Az-Zakat)', 392], ['Pilgrimage (Hajj)', 721], ['Virtues of the Qur’an', 105]]),
  },
  {
    id: 'muslim',
    name: 'Sahih Muslim',
    arabic: 'صحيح مسلم',
    author: 'Imam Muslim',
    total: 7470,
    desc: 'The second of the Sahihain',
    tint: '#5BC8F5',
    grad: ['#155E75', '#0B3543'],
    chapters: CH([['Faith (Kitab al-Iman)', 422], ['Purification', 218], ['Prayer', 1089], ['Zakat', 384], ['Fasting', 277], ['Hajj', 759], ['Marriage (Nikah)', 178], ['Virtues and Merits', 434]]),
  },
  {
    id: 'abudawud',
    name: 'Sunan Abu Dawud',
    arabic: 'سنن أبي داود',
    author: 'Imam Abu Dawud',
    total: 5274,
    desc: 'One of the six canonical books',
    tint: '#E8C96A',
    grad: ['#8C6D1F', '#4A3A0E'],
    chapters: CH([['Purification', 184], ['Prayer', 517], ['Fasting', 122], ['Zakat', 168], ['Marriage', 130], ['Oaths and Vows', 98], ['Knowledge', 18], ['Sunan (Customs)', 189]]),
  },
  {
    id: 'tirmidhi',
    name: "Jami’ at-Tirmidhi",
    arabic: 'جامع الترمذي',
    author: 'Imam at-Tirmidhi',
    total: 3956,
    desc: 'The Jami — covering all aspects of deen',
    tint: '#C9A0F0',
    grad: ['#5B3A80', '#31204A'],
    chapters: CH([['Faith', 22], ['Purification', 122], ['Prayer', 425], ['Fasting', 68], ['Zakat', 65], ['Hajj', 96], ['Description of the Prophet ﷺ', 92], ['Virtues of Jihad', 48]]),
  },
  {
    id: 'nasai',
    name: "Sunan an-Nasa’i",
    arabic: 'سنن النسائي',
    author: 'Imam an-Nasa’i',
    total: 5758,
    desc: 'Al-Mujtaba — the selected sunan',
    tint: '#F09A5B',
    grad: ['#8A4B1F', '#47250E'],
    chapters: CH([['Purification', 326], ['Prayer', 1007], ['Zakat', 156], ['Fasting', 254], ['Hajj', 467], ['Marriage', 167], ['Eid and Rites', 84], ['Virtues of the Qur’an', 48]]),
  },
  {
    id: 'ibnmajah',
    name: 'Sunan Ibn Majah',
    arabic: 'سنن ابن ماجه',
    author: 'Imam Ibn Majah',
    total: 4341,
    desc: 'The sixth of the canonical six',
    tint: '#7FD8A8',
    grad: ['#2E7D54', '#153D28'],
    chapters: CH([['Purification', 340], ['Prayer', 393], ['Fasting', 96], ['Zakat', 62], ['Marriage', 153], ['Trade (Buyu)', 87], ['Medicine', 114], ['Du’a (Supplications)', 80]]),
  },
  {
    id: 'ahmad',
    name: 'Musnad Ahmad',
    arabic: 'مسند أحمد',
    author: 'Imam Ahmad ibn Hanbal',
    total: 27647,
    desc: 'The great musnad of the companions',
    tint: '#8FB8F0',
    grad: ['#2C4E8C', '#152847'],
    chapters: CH([['Musnad of the Ten Promised Paradise', 1247], ['Musnad of Umar ibn al-Khattab', 489], ['Musnad of Ali ibn Abi Talib', 819], ['Musnad of Ibn Abbas', 285], ['Musnad of Aisha', 928], ['Musnad of Abu Hurairah', 3691], ['Musnad of Anas ibn Malik', 1332], ['Musnad of the Early Companions', 2145]]),
  },
  {
    id: 'malik',
    name: 'Muwatta Malik',
    arabic: 'موطأ مالك',
    author: 'Imam Malik ibn Anas',
    total: 1720,
    desc: 'The earliest written collection of fiqh',
    tint: '#A8E06A',
    grad: ['#4E7A1F', '#273F0E'],
    chapters: CH([['Purification', 86], ['Prayer', 294], ['Zakat', 132], ['Fasting', 40], ['Hajj', 127], ['Marriage', 78], ['Trade', 61], ['Good Character', 42]]),
  },
  {
    id: 'darimi',
    name: 'Sunan ad-Darimi',
    arabic: 'سنن الدارمي',
    author: 'Imam ad-Darimi',
    total: 3542,
    desc: 'Musnad al-Darimi — early and revered',
    tint: '#F0A8C0',
    grad: ['#8C2E4E', '#47172A'],
    chapters: CH([['Faith', 214], ['Purification', 120], ['Prayer', 631], ['Zakat', 104], ['Fasting', 75], ['Hajj', 88], ['Marriage', 30], ['Virtues of the Qur’an', 156]]),
  },
  {
    id: 'ibnkhuzaymah',
    name: 'Sahih Ibn Khuzaymah',
    arabic: 'صحيح ابن خزيمة',
    author: 'Imam Ibn Khuzaymah',
    total: 3048,
    desc: 'Sahih — rigorously authenticated',
    tint: '#7AC8D8',
    grad: ['#1F6E7A', '#0E3A42'],
    chapters: CH([['Purification', 26], ['Prayer', 412], ['Fasting', 118], ['Zakat', 76], ['Hajj', 84], ['Marriage', 96], ['Hunting', 42], ['Virtues', 88]]),
  },
  {
    id: 'hakim',
    name: "Mustadrak al-Hakim",
    arabic: 'المستدرك للحاكم',
    author: 'Imam al-Hakim',
    total: 9046,
    desc: 'That which the Two Sahihs missed',
    tint: '#D8C87A',
    grad: ['#7A6A1F', '#3F360E'],
    chapters: CH([['Faith', 214], ['Knowledge', 218], ['Purification', 296], ['Prayer', 1194], ['Zakat', 348], ['Fasting', 254], ['Hajj', 552], ['Virtues of the Companions', 1762]]),
  },
  {
    id: 'bayhaqi',
    name: "Sunan al-Bayhaqi",
    arabic: 'سنن البيهقي',
    author: 'Imam al-Bayhaqi',
    total: 13778,
    desc: 'As-Sunan al-Kubra — the great compendium',
    tint: '#B0A8F0',
    grad: ['#44368C', '#231C47'],
    chapters: CH([['Purification', 342], ['Prayer', 2381], ['Zakat', 588], ['Fasting', 372], ['Hajj', 924], ['Marriage', 714], ['Trade', 1024], ['Inheritance', 682]]),
  },
  {
    id: 'riyad',
    name: 'Riyad as-Salihin',
    arabic: 'رياض الصالحين',
    author: 'Imam an-Nawawi',
    total: 1896,
    desc: 'Gardens of the righteous — daily companion',
    tint: '#66E0C4',
    grad: ['#157F6B', '#0B423A'],
    chapters: CH([['Sincerity and Significance of Intentions', 12], ['Repentance (Tawbah)', 18], ['Patience and Perseverance', 44], ['Truthfulness', 26], ['Guarding the Tongue', 48], ['Softness and Kindness', 34], ['Rights of Neighbours', 26], ['Virtues of Dhikr', 84]]),
  },
  {
    id: 'bulugh',
    name: 'Bulugh al-Maram',
    arabic: 'بلوغ المرام',
    author: 'Ibn Hajar al-Asqalani',
    total: 1596,
    desc: 'Attainment of the objective — fiqh evidence',
    tint: '#F0B26A',
    grad: ['#8C5B1F', '#472E0E'],
    chapters: CH([['Purification', 78], ['Prayer', 262], ['Zakat', 96], ['Fasting', 68], ['Hajj', 154], ['Marriage', 92], ['Transactions', 148], ['Punishments and Rulings', 98]]),
  },
];

/** Reader content for a chapter — the demo hadith pool, attributed to the book. */
export function chapterHadiths(book: HadithBook, chapterId: string) {
  // deterministic rotation of the shared demo pool
  const seed = book.id.length + chapterId.charCodeAt(chapterId.length - 1);
  return HADITHS.map((h: { arabic: string; translation: string; category: string }, i: number) => ({
    id: `${book.id}-${chapterId}-${i}`,
    arabic: h.arabic,
    translation: h.translation,
    category: h.category,
    source: `${book.name} ${(seed * 37 + i * 211) % Math.max(9, Math.floor(book.total / 100))}${i === 0 ? '' : ''}`,
    number: String((seed * 37 + i * 211) % Math.max(9, Math.floor(book.total / 100))),
  }));
}
