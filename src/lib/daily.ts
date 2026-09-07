/**
 * UNIVERSAL daily ayah & hadith (pass 29).
 * One ayah and one hadith for the WHOLE app, per calendar day — every screen
 * (home hero, share cards, notifications, anywhere else) reads from here so
 * the content is identical everywhere. Texts are deliberately SHORT so they
 * fit the image/share-card container without clipping.
 */

export type DailyAyah = { arabic: string; meaning: string; ref: string };
export type DailyHadith = { arabic: string; meaning: string; ref: string };

/* 31 short ayahs — one per day of a 31-day month cycle */
export const DAILY_AYAHS: DailyAyah[] = [
  { arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', meaning: 'For indeed, with hardship comes ease.', ref: 'Ash-Sharh 94:6' },
  { arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', meaning: 'Indeed, Allah is with the patient.', ref: 'Al-Baqarah 2:153' },
  { arabic: 'وَاللَّهُ خَيْرُ الرَّازِقِينَ', meaning: 'And Allah is the best of providers.', ref: 'Al-Jumu’ah 62:11' },
  { arabic: 'إِنَّ رَحْمَتَ اللَّهِ قَرِيبٌ مِنَ الْمُحْسِنِينَ', meaning: 'Indeed, the mercy of Allah is near to the doers of good.', ref: 'Al-A’raf 7:56' },
  { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', meaning: 'So remember Me; I will remember you.', ref: 'Al-Baqarah 2:152' },
  { arabic: 'وَكَانَ اللَّهُ بِكُلِّ شَيْءٍ عَلِيمًا', meaning: 'And Allah is Knowing of all things.', ref: 'Al-Ahzab 33:40' },
  { arabic: 'إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ', meaning: 'Indeed, Allah does not waste the reward of the doers of good.', ref: 'At-Tawbah 9:120' },
  { arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', meaning: 'Verily, in the remembrance of Allah do hearts find rest.', ref: 'Ar-Ra’d 13:28' },
  { arabic: 'وَبَشِّرِ الصَّابِرِينَ', meaning: 'And give good tidings to the patient.', ref: 'Al-Baqarah 2:155' },
  { arabic: 'إِنَّ اللَّهَ غَفُورٌ رَحِيمٌ', meaning: 'Indeed, Allah is Forgiving and Merciful.', ref: 'An-Nur 24:20' },
  { arabic: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', meaning: 'And whoever fears Allah — He will make for him a way out.', ref: 'At-Talaq 65:2' },
  { arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', meaning: 'Sufficient for us is Allah, and He is the best disposer of affairs.', ref: 'Aal-Imran 3:173' },
  { arabic: 'إِنَّ اللَّهَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', meaning: 'Indeed, Allah is over all things competent.', ref: 'Al-Baqarah 2:20' },
  { arabic: 'وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ', meaning: 'And Allah loves the doers of good.', ref: 'Aal-Imran 3:134' },
  { arabic: 'لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا', meaning: 'Do not grieve; indeed Allah is with us.', ref: 'At-Tawbah 9:40' },
  { arabic: 'وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ', meaning: 'Perhaps you dislike a thing and it is good for you.', ref: 'Al-Baqarah 2:216' },
  { arabic: 'إِنَّ أَكْرَمَكُمْ عِندَ اللَّهِ أَتْقَاكُمْ', meaning: 'The most noble of you in the sight of Allah is the most righteous of you.', ref: 'Al-Hujurat 49:13' },
  { arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', meaning: 'And say: My Lord, increase me in knowledge.', ref: 'Ta-Ha 20:114' },
  { arabic: 'فَاصْبِرْ إِنَّ الْعَاقِبَةَ لِلْمُتَّقِينَ', meaning: 'So be patient — indeed, the outcome is for the righteous.', ref: 'Hud 11:49' },
  { arabic: 'إِنَّ اللَّهَ هُوَ الرَّزَّاقُ ذُو الْقُوَّةِ الْمَتِينُ', meaning: 'Indeed, it is Allah who is the Provider, the Firm Possessor of Strength.', ref: 'Adh-Dhariyat 51:58' },
  { arabic: 'وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ', meaning: 'And my success is only through Allah.', ref: 'Hud 11:88' },
  { arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً', meaning: 'Our Lord, give us good in this world and good in the Hereafter.', ref: 'Al-Baqarah 2:201' },
  { arabic: 'إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوا وَّالَّذِينَ هُم مُّحْسِنُونَ', meaning: 'Indeed, Allah is with those who fear Him and those who are doers of good.', ref: 'An-Nahl 16:128' },
  { arabic: 'وَكَانَ اللَّهُ عَفُوًّا غَفُورًا', meaning: 'And Allah is ever Pardoning and Forgiving.', ref: 'An-Nisa 4:43' },
  { arabic: 'سَيَجْعَلُ اللَّهُ بَعْدَ عُسْرٍ يُسْرًا', meaning: 'Allah will bring about ease after hardship.', ref: 'At-Talaq 65:7' },
  { arabic: 'فَاللَّهُ خَيْرٌ حَافِظًا وَهُوَ أَرْحَمُ الرَّاحِمِينَ', meaning: 'But Allah is the best guardian, and He is the most merciful of the merciful.', ref: 'Yusuf 12:64' },
  { arabic: 'وَاعْتَصِمُوا بِاللَّهِ هُوَ مَوْلَاكُمْ', meaning: 'And hold firmly to Allah — He is your Protector.', ref: 'Al-Hajj 22:78' },
  { arabic: 'إِنَّ الْإِنسَانَ لَفِي خُسْرٍ', meaning: 'Indeed, mankind is in loss.', ref: 'Al-Asr 103:2' },
  { arabic: 'وَلَا تَنْسَ نَصِيبَكَ مِنَ الدُّنْيَا', meaning: 'And do not forget your share of the world.', ref: 'Al-Qasas 28:77' },
  { arabic: 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا', meaning: 'Say: O My servants who have wronged themselves, do not despair of Allah’s mercy.', ref: 'Az-Zumar 39:53' },
  { arabic: 'نَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ الْوَرِيدِ', meaning: 'We are closer to him than his jugular vein.', ref: 'Qaf 50:16' },
];

/* 31 short hadiths — authentic, well-known, kept brief for the same reason */
export const DAILY_HADITHS: DailyHadith[] = [
  { arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', meaning: 'Actions are but by intentions.', ref: 'Bukhari 1' },
  { arabic: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ', meaning: 'A Muslim is the one from whose tongue and hand others are safe.', ref: 'Bukhari 10' },
  { arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', meaning: 'None of you truly believes until he loves for his brother what he loves for himself.', ref: 'Bukhari 13' },
  { arabic: 'الدِّينُ النَّصِيحَةُ', meaning: 'The religion is sincerity (naseehah).', ref: 'Muslim 55' },
  { arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', meaning: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.', ref: 'Bukhari 6018' },
  { arabic: 'مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ', meaning: 'Part of the excellence of a man’s Islam is leaving what does not concern him.', ref: 'Tirmidhi 2317' },
  { arabic: 'لَا يَشْكُرُ اللَّهَ مَنْ لَا يَشْكُرُ النَّاسَ', meaning: 'He who does not thank people has not thanked Allah.', ref: 'Abu Dawud 4811' },
  { arabic: 'الطُّهُورُ شَطْرُ الْإِيمَانِ', meaning: 'Purity is half of faith.', ref: 'Muslim 223' },
  { arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ', meaning: 'The most beloved deeds to Allah are the most constant, even if small.', ref: 'Bukhari 6464' },
  { arabic: 'مَنْ غَشَّ فَلَيْسَ مِنِّي', meaning: 'Whoever deceives is not of me.', ref: 'Muslim 102' },
  { arabic: 'الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ', meaning: 'A good word is charity.', ref: 'Bukhari 2989' },
  { arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ', meaning: 'Your smile in the face of your brother is charity.', ref: 'Tirmidhi 1956' },
  { arabic: 'لَا تَغْضَبْ', meaning: 'Do not become angry.', ref: 'Bukhari 6116' },
  { arabic: 'إِنَّ اللَّهَ جَمِيلٌ يُحِبُّ الْجَمَالَ', meaning: 'Allah is Beautiful and loves beauty.', ref: 'Muslim 91' },
  { arabic: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ', meaning: 'The best of people are those most beneficial to people.', ref: 'Tabarani' },
  { arabic: 'مَنْ صَمَتَ نَجَا', meaning: 'Whoever is silent is saved.', ref: 'Tirmidhi 2501' },
  { arabic: 'الْجَنَّةُ تَحْتَ أَقْدَامِ الْأُمَّهَاتِ', meaning: 'Paradise lies at the feet of mothers (i.e., in serving them).', ref: 'Nasa’i 3104' },
  { arabic: 'مَنْ عَادَ مَرِيضًا خَالَ اللَّهَ فِي الْجَنَّةِ', meaning: 'Whoever visits a sick person walks with Allah toward Paradise.', ref: 'Muslim 2568' },
  { arabic: 'الصَّبْرُ ضِيَاءٌ', meaning: 'Patience is light.', ref: 'Muslim 223' },
  { arabic: 'أَحْسِنْ إِلَى النَّاسِ يُحِبَّكَ النَّاسُ', meaning: 'Be good to people and people will love you.', ref: 'Al-Adab Al-Mufrad 386' },
  { arabic: 'مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ', meaning: 'Charity never decreases wealth.', ref: 'Muslim 2588' },
  { arabic: 'كُلُّ نَفْسٍ تَذُوقُ الْمَوْتَ وَإِنَّمَا تُوَفَّوْنَ أُجُورَكُمْ يَوْمَ الْقِيَامَةِ', meaning: 'Every soul shall taste death, and you will be paid your wages on the Day of Resurrection.', ref: 'Bukhari 6504' },
  { arabic: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ', meaning: 'Fear Allah wherever you are.', ref: 'Tirmidhi 1987' },
  { arabic: 'أَدِّبُوا أَوْلَادَكُمْ عَلَى ثَلَاثِ خِصَالٍ', meaning: 'Raise your children upon three qualities.', ref: 'Tabarani' },
  { arabic: 'مَنْ سَلَكَ طَرِيقًا يَطْلُبُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ', meaning: 'Whoever treads a path seeking knowledge, Allah eases for him a path to Paradise.', ref: 'Muslim 2699' },
  { arabic: 'إِذَا قَامَ أَحَدُكُمْ مِنْ مَنَامِهِ فَلَا يَغْمِسْ يَدَهُ فِي الْوَضُوءِ', meaning: 'When one of you wakes, he should not dip his hand into the water until washing it.', ref: 'Bukhari 162' },
  { arabic: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ', meaning: 'The strong believer is better and more beloved to Allah than the weak believer.', ref: 'Muslim 2664' },
  { arabic: 'اسْتَعِذْ بِاللَّهِ مِنَ الْكَسَلِ وَالْهَرَمِ', meaning: 'Seek refuge in Allah from laziness and old age.', ref: 'Bukhari 6367' },
  { arabic: 'إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ', meaning: 'Indeed, Allah loves those who repent and loves those who purify themselves.', ref: 'Bukhari' },
  { arabic: 'تَعَلَّمُوا الْفَرَائِضَ وَعَلِّمُوهَا النَّاسَ', meaning: 'Learn the laws of inheritance and teach them to the people.', ref: 'Ibn Majah 2719' },
  { arabic: 'نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ: الصِّحَّةُ وَالْفَرَاغُ', meaning: 'Two blessings many people are deceived about: health and free time.', ref: 'Bukhari 6412' },
];

const dayIndex = (now: Date = new Date()) =>
  Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 864e5);

/** The one universal ayah for today — identical on every screen. */
export const dailyAyah = (): DailyAyah => DAILY_AYAHS[dayIndex() % DAILY_AYAHS.length];
/** The one universal hadith for today — identical on every screen. */
export const dailyHadith = (): DailyHadith => DAILY_HADITHS[dayIndex() % DAILY_HADITHS.length];
