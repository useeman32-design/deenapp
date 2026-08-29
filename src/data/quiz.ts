/** Quiz dataset (pass 16) — pooled across categories, dash quiz screen consumes this. */
export type QuizQ = {
  id: number;
  category: 'Quran' | 'Hadith' | 'Fiqh' | 'Seerah' | 'Aqidah';
  question: string;
  options: string[];
  answer: number;
};

export const QUIZ_POOL: QuizQ[] = [
  { id: 1, category: 'Quran', question: 'How many surahs are in the Qur’an?', options: ['110', '112', '114', '116'], answer: 2 },
  { id: 2, category: 'Quran', question: 'Which surah is called the heart of the Qur’an?', options: ['Al-Fatiha', 'Yasin', 'Al-Mulk', 'Ar-Rahman'], answer: 1 },
  { id: 3, category: 'Quran', question: 'In which month did revelation begin?', options: ['Rajab', 'Ramadan', 'Sha’ban', 'Muharram'], answer: 1 },
  { id: 4, category: 'Quran', question: 'Which surah does NOT begin with Bismillah?', options: ['At-Tawbah', 'Al-Anfal', 'Yunus', 'Hud'], answer: 0 },
  { id: 5, category: 'Quran', question: 'The longest surah of the Qur’an is…', options: ['Aal-Imran', 'An-Nisa', 'Al-Baqarah', 'Al-Ma’idah'], answer: 2 },
  { id: 6, category: 'Quran', question: 'How many juz (parts) is the Qur’an divided into?', options: ['20', '30', '40', '60'], answer: 1 },
  { id: 7, category: 'Quran', question: 'Which surah is recited in every unit of prayer?', options: ['Al-Ikhlas', 'Al-Fatiha', 'Ayat al-Kursi', 'Al-Kawthar'], answer: 1 },
  { id: 8, category: 'Hadith', question: '“Actions are judged by intentions” is from…', options: ['Sahih Muslim', 'Sunan Abu Dawud', 'Sahih al-Bukhari', 'Muwatta Malik'], answer: 2 },
  { id: 9, category: 'Hadith', question: 'How many canonical hadith collections are the “Kutub as-Sittah”?', options: ['Four', 'Five', 'Six', 'Seven'], answer: 2 },
  { id: 10, category: 'Hadith', question: 'The book of the most authentic reports after the Qur’an is…', options: ['Sahih al-Bukhari', 'Musnad Ahmad', 'Sunan at-Tirmidhi', 'Mustadrak al-Hakim'], answer: 0 },
  { id: 11, category: 'Hadith', question: '“None of you truly believes until he loves for his brother what he loves for himself” — where is it recorded?', options: ['Only in Bukhari', 'Bukhari & Muslim', 'Only in Muslim', 'Ibn Majah only'], answer: 1 },
  { id: 12, category: 'Fiqh', question: 'How many rak’ahs is Fajr prayer?', options: ['2', '3', '4', '5'], answer: 0 },
  { id: 13, category: 'Fiqh', question: 'Zakat on saved wealth is normally…', options: ['1.5%', '2.5%', '5%', '10%'], answer: 1 },
  { id: 14, category: 'Fiqh', question: 'Which prayer has no adhan called specifically for it?', options: ['Fajr', 'Jumu’ah', 'Eid', 'Isha'], answer: 2 },
  { id: 15, category: 'Fiqh', question: 'The talbiyah of Hajj begins with…', options: ['Allahu Akbar', 'Labbayk Allahumma Labbayk', 'Subhanallah', 'Alhamdulillah'], answer: 1 },
  { id: 16, category: 'Fiqh', question: 'Fasting is obligatory from which age (typically)?', options: ['7', '10', 'Puberty', '15 exactly'], answer: 2 },
  { id: 17, category: 'Seerah', question: 'The Prophet ﷺ was born in the year…', options: ['570 CE', '610 CE', '622 CE', '632 CE'], answer: 0 },
  { id: 18, category: 'Seerah', question: 'The first revelation came in the cave of…', options: ['Uhud', 'Thawr', 'Hira', 'Safa'], answer: 2 },
  { id: 19, category: 'Seerah', question: 'The hijrah to Madinah took place in…', options: ['610 CE', '615 CE', '622 CE', '630 CE'], answer: 2 },
  { id: 20, category: 'Seerah', question: 'Which battle came first?', options: ['Uhud', 'Badr', 'Khandaq', 'Hunayn'], answer: 1 },
  { id: 21, category: 'Seerah', question: 'The Prophet ﷺ passed away in…', options: ['622 CE', '628 CE', '632 CE', '636 CE'], answer: 2 },
  { id: 22, category: 'Seerah', question: 'The first mosque built by the Prophet ﷺ was…', options: ['Masjid an-Nabawi', 'Masjid Quba', 'Masjid al-Aqsa', 'Masjid al-Qiblatayn'], answer: 1 },
  { id: 23, category: 'Aqidah', question: 'How many pillars of iman (faith) are there?', options: ['5', '6', '7', '8'], answer: 1 },
  { id: 24, category: 'Aqidah', question: 'The angels are created from…', options: ['Clay', 'Light', 'Fire', 'Water'], answer: 1 },
  { id: 25, category: 'Aqidah', question: 'Al-Qadar means…', options: ['Prophethood', 'Divine decree', 'Charity', 'Pilgrimage'], answer: 1 },
  { id: 26, category: 'Aqidah', question: 'Tawhid refers to…', options: ['Fasting', 'The oneness of Allah', 'Prayer', 'Zakat'], answer: 1 },
];
