/**
 * The REAL hadith library (pass 18) — generated from the user's /content
 * pack (chapters_meta + processed). Full texts load on demand via
 * src/lib/content.ts (assets/content/hadith/<book>.txt).
 */
export type HadithBookMeta = { id: string; name: string; arabic: string; author: string; total: number; chapters: number };

export const HADITH_BOOKS: HadithBookMeta[] = [
  { id: 'abudawud', name: 'Sunan Abu Dawud', arabic: 'سنن أبي داود', author: 'Imam Abu Dawud', total: 5276, chapters: 43 },
  { id: 'ahmed', name: 'Musnad Ahmad', arabic: 'مسند أحمد', author: 'Imam Ahmad ibn Hanbal', total: 1374, chapters: 8 },
  { id: 'aladab_almufrad', name: 'Al-Adab al-Mufrad', arabic: 'الأدب المفرد', author: 'Imam al-Bukhari', total: 1326, chapters: 57 },
  { id: 'buhari', name: 'Sahih al-Bukhari', arabic: 'صحيح البخاري', author: 'Imam al-Bukhari', total: 7277, chapters: 97 },
  { id: 'bulugh_almaram', name: 'Bulugh al-Maram', arabic: 'بلوغ المرام', author: 'Ibn Hajar al-Asqalani', total: 1767, chapters: 16 },
  { id: 'darimi', name: 'Sunan ad-Darimi', arabic: 'سنن الدارمي', author: 'Imam ad-Darimi', total: 3406, chapters: 23 },
  { id: 'ibnmajah', name: 'Sunan Ibn Majah', arabic: 'سنن ابن ماجه', author: 'Imam Ibn Majah', total: 4345, chapters: 37 },
  { id: 'malik', name: 'Muwatta Malik', arabic: 'موطأ مالك', author: 'Imam Malik ibn Anas', total: 1985, chapters: 61 },
  { id: 'mishkat_almasabih', name: 'Mishkat al-Masabih', arabic: 'مشكاة المصابيح', author: 'Al-Khatib at-Tabrizi', total: 4428, chapters: 24 },
  { id: 'muslim', name: 'Sahih Muslim', arabic: 'صحيح مسلم', author: 'Imam Muslim', total: 7459, chapters: 56 },
  { id: 'nasai', name: 'Sunan an-Nasa\'i', arabic: 'سنن النسائي', author: 'Imam an-Nasa’i', total: 5768, chapters: 51 },
  { id: 'nawawi40', name: 'An-Nawawi’s 40', arabic: 'الأربعون النووية', author: 'Imam an-Nawawi', total: 42, chapters: 1 },
  { id: 'riyad_assalihin', name: 'Riyad as-Salihin', arabic: 'رياض الصالحين', author: 'Imam an-Nawawi', total: 1896, chapters: 19 },
  { id: 'shamail_muhammadiyah', name: 'Shama’il Muhammadiyah', arabic: 'الشمائل المحمدية', author: 'Imam at-Tirmidhi', total: 402, chapters: 56 },
  { id: 'tirmidhi', name: 'Jami\' at-Tirmidhi', arabic: 'جامع الترمذي', author: 'Imam at-Tirmidhi', total: 4053, chapters: 49 },
];
