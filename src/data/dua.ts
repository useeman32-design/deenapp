export type Dua = {
  id: string;
  title: string;
  category: string;
  arabic: string;
  transliteration: string;
  translation: string;
  source: string;
};

export const DUA_CATEGORIES = [
  'All',
  'Morning',
  'Evening',
  'Sleep & Waking',
  'Travel',
  'Food',
  'Family',
  'General',
] as const;

export const DUAS: Dua[] = [
  {
    id: 'd1',
    title: 'Sayyidul Istighfar (Master of Seekings Forgiveness)',
    category: 'General',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ',
    transliteration: 'Allahumma anta Rabbi la ilaha illa anta khalaqtani wa ana abduka',
    translation: 'O Allah, You are my Lord, there is no god but You. You created me and I am Your servant.',
    source: 'Sahih al-Bukhari',
  },
  {
    id: 'd2',
    title: 'Morning Declaration',
    category: 'Morning',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration: 'Asbahna wa asbahal mulku lillahi wal hamdu lillah, la ilaha illallah wahdahu la sharika lah',
    translation: 'We have entered the morning and the dominion has become Allah’s. All praise is for Allah. There is no god but Allah alone, without partner.',
    source: 'Sahih Muslim',
  },
  {
    id: 'd3',
    title: 'Evening Declaration',
    category: 'Evening',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration: 'Amsayna wa amsal mulku lillahi wal hamdu lillah, la ilaha illallah wahdahu la sharika lah',
    translation: 'We have entered the evening and the dominion has become Allah’s. All praise is for Allah. There is no god but Allah alone, without partner.',
    source: 'Sahih Muslim',
  },
  {
    id: 'd4',
    title: 'For Your Parents',
    category: 'Family',
    arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    transliteration: 'Rabbi irhamhuma kama rabbayani sagheera',
    translation: 'My Lord, have mercy upon them as they brought me up when I was small.',
    source: 'Qur’an 17:24',
  },
  {
    id: 'd5',
    title: 'For Knowledge',
    category: 'General',
    arabic: 'رَبِّ زِدْنِي عِلْمًا',
    transliteration: 'Rabbi zidni ilma',
    translation: 'My Lord, increase me in knowledge.',
    source: 'Qur’an 20:114',
  },
  {
    id: 'd6',
    title: 'For Anxiety and Distress',
    category: 'General',
    arabic: 'اللَّهُمَّ إِنِّي عَبْدُكَ، ابْنُ عَبْدِكَ، ابْنُ أَمَتِكَ، نَاصِيَتِي بِيَدِكَ',
    transliteration: 'Allahumma inni abduka, ibnu abduka, ibnu amatika, nasiyati biyadik',
    translation: 'O Allah, I am Your servant, the son of Your servant, the son of Your handmaiden. My forelock is in Your hand.',
    source: 'Sahih al-Bukhari & Muslim',
  },
  {
    id: 'd7',
    title: 'Before Sleeping',
    category: 'Sleep & Waking',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Bismika Allahumma amutu wa ahya',
    translation: 'In Your name, O Allah, I die and I live.',
    source: 'Sahih al-Bukhari',
  },
  {
    id: 'd8',
    title: 'Upon Waking',
    category: 'Sleep & Waking',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: 'Al hamdu lillahi alladhi ahyana ba’da ma amatan wa ilayhin nusur',
    translation: 'All praise is for Allah who gave us life after having taken it from us, and to Him is the resurrection.',
    source: 'Sahih al-Bukhari',
  },
  {
    id: 'd9',
    title: 'Before Travel',
    category: 'Travel',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَىٰ رَبِّنَا لَمُنْقَلِبُونَ',
    transliteration: 'Subhana alladhi sakhkhara lana hadha wa ma kunna lah muqrinin, wa inna ila Rabbina lamunqalibun',
    translation: 'Glory to Him who subjected this to us, and we could not have done it on our own. And to our Lord we will surely return.',
    source: 'Qur’an 39:48, Sahih al-Bukhari',
  },
  {
    id: 'd10',
    title: 'Entering the Mosque',
    category: 'General',
    arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: 'Allahumma ftah li abwaba rahmatik',
    translation: 'O Allah, open for me the gates of Your mercy.',
    source: 'Sahih Muslim',
  },
  {
    id: 'd11',
    title: 'Before Eating',
    category: 'Food',
    arabic: 'بِسْمِ اللَّهِ، فَإِنْ نَسِيتَ فَقُلْ: بِسْمِ اللَّهِ فِي أَوَّلِهِ وَآخِرِهِ',
    transliteration: 'Bismillah. Fa in nasi’ta fa qul: Bismillahi fi awwalihi wa aakhirih',
    translation: 'In the name of Allah. And if you forgot, say: In the name of Allah at its beginning and its end.',
    source: 'Jami at-Tirmidhi',
  },
  {
    id: 'd12',
    title: 'Ayat al-Kursi (After Every Prayer)',
    category: 'General',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ',
    transliteration: 'Allahu la ilaha illa Huwal Hayyul Qayyum, la ta’khudhuhu sinatun wa la nawm…',
    translation: 'Allah — there is no god but He, the Ever-Living, the Sustainer of existence. Neither drowsiness overtakes Him nor sleep…',
    source: 'Qur’an 2:255, Jami at-Tirmidhi',
  },
  {
    id: 'd13',
    title: 'For a Steadfast Heart',
    category: 'General',
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَىٰ دِينِكَ',
    transliteration: 'Ya Muqallibal qulub, thabbit qalbi ala dinik',
    translation: 'O Turner of hearts, make my heart firm upon Your religion.',
    source: 'Jami at-Tirmidhi',
  },
  {
    id: 'd14',
    title: 'Seeking Forgiveness',
    category: 'General',
    arabic: 'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ',
    transliteration: 'Astaghfirullaha wa atubu ilayh',
    translation: 'I seek forgiveness of Allah and I repent to Him.',
    source: 'Sunan Ibn Majah',
  },
];
