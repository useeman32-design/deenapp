export type Athar = {
  id: string;
  group: 'Morning' | 'Evening' | 'After Prayer' | 'General';
  name: string;
  arabic: string;
  transliteration: string;
  count: number; // 0 = unlimited
  note?: string;
};

export const ATHKAR: Athar[] = [
  {
    id: 'a1',
    group: 'Morning',
    name: 'Morning Declaration',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ',
    transliteration: 'Asbahna wa asbahal mulku lillahi',
    count: 1,
  },
  {
    id: 'a2',
    group: 'Morning',
    name: 'SubhanAllahi wa bihamdihi',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'Subhanallahi wa bihamdih',
    count: 100,
    note: 'Whoever says it 100 times a day, their sins are erased even if they were like the foam of the sea. (Bukhari & Muslim)',
  },
  {
    id: 'a3',
    group: 'Morning',
    name: 'Refuge from the Shaytan',
    arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration: 'Audhu billahi minash shaytanir rajim',
    count: 3,
  },
  {
    id: 'a4',
    group: 'Morning',
    name: 'Ayat al-Kursi',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
    transliteration: 'Allahu la ilaha illa Huwal Hayyul Qayyum',
    count: 1,
    note: 'Whoever recites it in the morning is protected until evening. (Abu Dawud)',
  },
  {
    id: 'a5',
    group: 'Morning',
    name: 'As al-Allaha al-Azeem',
    arabic: 'أَسْأَلُ اللَّهَ الْعَظِيمَ رَبَّ الْعَرْشِ الْعَظِيمِ',
    transliteration: 'As al-Allaha al-Azeem Rabbal Arshil Azeem',
    count: 1,
  },
  {
    id: 'a6',
    group: 'Evening',
    name: 'Evening Declaration',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ',
    transliteration: 'Amsayna wa amsal mulku lillahi',
    count: 1,
  },
  {
    id: 'a7',
    group: 'Evening',
    name: 'Complete Words of Allah',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ',
    transliteration: 'Audhu bikalimatillahit tammah',
    count: 3,
  },
  {
    id: 'a8',
    group: 'Evening',
    name: 'Raditu billahi Rabba',
    arabic: 'رَضِيتُ بِاللَّهِ رَبًّا وَبِالْإِسْلَامِ دِينًا وَبِمُحَمَّدٍ ﷺ نَبِيًّا',
    transliteration: 'Raditu billahi Rabban wa bil-islami deena wa bi-Muhammadin ﷺ nabiyya',
    count: 3,
  },
  {
    id: 'a9',
    group: 'After Prayer',
    name: 'SubhanAllahi',
    arabic: 'سُبْحَانَ اللَّهِ',
    transliteration: 'SubhanAllahi',
    count: 33,
  },
  {
    id: 'a10',
    group: 'After Prayer',
    name: 'Alhamdulillah',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'Alhamdulillah',
    count: 33,
  },
  {
    id: 'a11',
    group: 'After Prayer',
    name: 'Allahu Akbar',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar',
    count: 34,
    note: '33 SubhanAllahi, 33 Alhamdulillah, 34 Allahu Akbar — completes 100 after the prayer. (Muslim)',
  },
  {
    id: 'a12',
    group: 'After Prayer',
    name: 'Salam after Salah',
    arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ',
    transliteration: 'Allahumma antas Salamu wa minkas Salam',
    count: 1,
  },
  {
    id: 'a13',
    group: 'General',
    name: 'Salawat upon the Prophet ﷺ',
    arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
    transliteration: 'Allahumma salli ala Muhammad',
    count: 11,
  },
  {
    id: 'a14',
    group: 'General',
    name: 'Astaghfirullah',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    transliteration: 'Astaghfirullah',
    count: 100,
  },
  {
    id: 'a15',
    group: 'General',
    name: 'La ilaha illallah',
    arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ',
    transliteration: 'La ilaha illallah',
    count: 0,
    note: 'Custom dhikr runs in unlimited mode so you can keep counting without a target cap.',
  },
];
