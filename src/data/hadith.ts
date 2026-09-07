export type Hadith = {
  id: string;
  arabic: string;
  translation: string;
  source: string;
  number: string;
  book: 'Sahih Bukhari' | 'Sahih Muslim' | 'Other';
  category: 'Aqidah' | 'Worship' | 'Character' | 'Daily Life';
};

export const DAILY_HADITH: Hadith = {
  id: 'h1',
  arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
  translation: '“The deeds are (judged) by intentions.”',
  source: 'Sahih Bukhari',
  number: '1',
  book: 'Sahih Bukhari',
  category: 'Character',
};

export const HADITHS: Hadith[] = [
  DAILY_HADITH,
  {
    id: 'h2',
    arabic: 'الدِّينُ النَّصِيحَةُ',
    translation: 'The religion is sincere counsel.',
    source: 'Sahih Muslim',
    number: '55',
    book: 'Sahih Muslim',
    category: 'Character',
  },
  {
    id: 'h3',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    translation: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.',
    source: 'Sahih Bukhari',
    number: '6018',
    book: 'Sahih Bukhari',
    category: 'Daily Life',
  },
  {
    id: 'h4',
    arabic: 'الطُّهُورُ شَطْرُ الإِيمَانِ',
    translation: 'Purity is half of faith.',
    source: 'Sahih Muslim',
    number: '223',
    book: 'Sahih Muslim',
    category: 'Worship',
  },
  {
    id: 'h5',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    translation: 'None of you truly believes until he loves for his brother what he loves for himself.',
    source: 'Sahih Bukhari',
    number: '13',
    book: 'Sahih Bukhari',
    category: 'Character',
  },
  {
    id: 'h6',
    arabic: 'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    translation: 'The deeds most beloved to Allah are those done most consistently, even if they are few.',
    source: 'Sahih Bukhari',
    number: '6464',
    book: 'Sahih Bukhari',
    category: 'Worship',
  },
  {
    id: 'h7',
    arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
    translation: 'Whoever travels a path in search of knowledge, Allah makes easy for him a path to Paradise.',
    source: 'Sahih Muslim',
    number: '2699',
    book: 'Sahih Muslim',
    category: 'Daily Life',
  },
  {
    id: 'h8',
    arabic: 'المُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ',
    translation: 'A Muslim is one from whose tongue and hand the Muslims are safe.',
    source: 'Sahih Bukhari',
    number: '10',
    book: 'Sahih Bukhari',
    category: 'Character',
  },
  {
    id: 'h9',
    arabic: 'الرَّاحِمُونَ يَرْحَمُهُمُ الرَّحْمَنُ، ارْحَمُوا مَنْ فِي الأَرْضِ يَرْحَمْكُمْ مَنْ فِي السَّمَاءِ',
    translation: 'The merciful are shown mercy by the Most Merciful. Show mercy to those on earth, and the One in heaven will show mercy to you.',
    source: 'Abu Dawud',
    number: '4941',
    book: 'Other',
    category: 'Character',
  },
  {
    id: 'h10',
    arabic: 'إِذَا قَامَ أَحَدُكُمْ مِنَ الْمَنَامِ فَلَا يَغْسِلْ يَدَيْهِ حَتَّى يَجْعَلَ مِنْ غُسْلِهِمَا ثَلَاثًا',
    translation: 'When any of you wakes from sleep, let him not put his hand in the vessel until he has washed it three times.',
    source: 'Sahih Bukhari',
    number: '174',
    book: 'Sahih Bukhari',
    category: 'Worship',
  },
  {
    id: 'h11',
    arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    translation: 'The best of you are those who learn the Qur’an and teach it.',
    source: 'Sahih Bukhari',
    number: '5027',
    book: 'Sahih Bukhari',
    category: 'Daily Life',
  },
  {
    id: 'h12',
    arabic: 'مَنْ لَمْ يَشْكُرِ النَّاسَ لَمْ يَشْكُرِ اللَّهَ',
    translation: 'Whoever does not thank people has not thanked Allah.',
    source: 'Jami at-Tirmidhi',
    number: '1954',
    book: 'Other',
    category: 'Character',
  },
  {
    id: 'h13',
    arabic: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    translation: 'Fear Allah wherever you are, follow a bad deed with a good one and it will erase it, and treat people with good character.',
    source: 'Jami at-Tirmidhi',
    number: '1987',
    book: 'Other',
    category: 'Aqidah',
  },
  {
    id: 'h14',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
    translation: 'O Allah, I ask You for guidance, piety, chastity and self-sufficiency.',
    source: 'Sahih Muslim',
    number: '2690',
    book: 'Sahih Muslim',
    category: 'Worship',
  },
  {
    id: 'h15',
    arabic: 'وَالَّذِي نَفْسِي بِيَدِهِ لَا تَدْخُلُونَ الْجَنَّةَ حَتَّى تُؤْمِنُوا وَلَا تُؤْمِنُوا حَتَّى تَحَابُّوا',
    translation: 'By Him in whose hand is my soul, you will not enter Paradise until you believe, and you will not believe until you love one another.',
    source: 'Sahih Muslim',
    number: '54',
    book: 'Sahih Muslim',
    category: 'Aqidah',
  },
];

export const HADITH_CATEGORIES = [
  { id: 'Aqidah', label: 'Aqidah', icon: 'shield' },
  { id: 'Worship', label: 'Worship', icon: 'star-and-crescent' },
  { id: 'Character', label: 'Character', icon: 'heart' },
  { id: 'Daily Life', label: 'Daily Life', icon: 'home' },
] as const;
