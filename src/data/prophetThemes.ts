/**
 * prophetThemes (pass 37) — every prophet gets his own visual identity:
 * gradient, icon, motif line, a key Qur'anic ayah (arabic + translation)
 * and a Hausa summary (the reader's HA view). Keyed by chapter slug.
 */

export type ProphetTheme = {
  g: [string, string];
  icon: string;
  motif: string;
  ar: string;
  ayah: { ar: string; en: string; ref: string } | null;
  ha: string[];
};

export const PROPHET_THEMES: Record<string, ProphetTheme> = {
  adam: {
    g: ['#2E5339', '#12251A'], icon: 'user-friends', motif: 'The first man & the first repentance', ar: 'آدم',
    ayah: { ar: 'إِنِّي جَاعِلٌ فِي الْأَرْضِ خَلِيفَةً', en: '“Indeed, I will make upon the earth a successive authority.”', ref: 'Al-Baqarah 2:30' },
    ha: ['Allah ya halicci Adamu da hannunSa, ya koya masa dukkan sunayen abubuwa, kuma mala\'iku suka yi sujada gare shi.', 'Shaidan ya sa Adamu da matarsa (Hawwa) su ci daga itacen da Allah ya haramta, sai aka sauke su daga Aljanna.', 'Adamu ya tuba, Allah ya karɓi tobansa — shi ne babban mutum kuma annabi na farko.'],
  },
  idris: {
    g: ['#3A3357', '#171331'], icon: 'scroll', motif: 'The scribe who was raised high', ar: 'إدريس',
    ayah: { ar: 'وَرَفَعْنَاهُ مَكَانًا عَلِيًّا', en: '“And We raised him to a high station.”', ref: 'Maryam 19:57' },
    ha: ['Idris (Enoch) annabi ne na farko bayan Adamu; an san shi da ilimi da rubutu da hikima.', 'Allah ya ce a Kur\'ani: “Muka ɗaga masa matsayi mai girma.”', 'Ya kasance daga masu gaskiya masu hakuri, kamar yadda aka ambata a Suratul Anbiya.'],
  },
  nuh: {
    g: ['#153B5E', '#081E33'], icon: 'ship', motif: 'The ark & the great flood', ar: 'نوح',
    ayah: { ar: 'وَاصْنَعِ الْفُلْكَ بِأَعْيُنِنَا', en: '“And construct the ship under Our eyes.”', ref: 'Hud 11:37' },
    ha: ['Nuhu ya kira mutanensa tsawon shekaru dubu don su bauta wa Allah kaɗai, amma suka ƙi.', 'Allah ya umarce shi ya gina jirgi; ya ɗauki muminai da kowane dabbobi biyu biyu.', 'Ambaliyar ruwa ta lalata masu ƙaryata, aka tsira Nuhu da waɗanda suka bi shi.'],
  },
  hud: {
    g: ['#6B5322', '#2E2410'], icon: 'wind', motif: 'The prophet of the desert wind', ar: 'هود',
    ayah: { ar: 'وَيَا قَوْمِ اسْتَغْفِرُوا رَبَّكُمْ', en: '“And O my people, ask forgiveness of your Lord.”', ref: 'Hud 11:52' },
    ha: ['Hudu an aiko wa mutanen \'Ad — mutane masu ƙarfi da gine-gine masu tsayi.', 'Ya kira su zuwa ga tauhidi, suka tunda shi da girman kai.', 'Iska mai ƙarfi ta lalata su a ranar baƙin ciki — “rabeh” batawa.'],
  },
  salih: {
    g: ['#5E5346', '#26211B'], icon: 'mountain', motif: 'The she-camel from the rock', ar: 'صالح',
    ayah: { ar: 'هَٰذِهِ نَاقَةُ اللَّهِ لَكُمْ آيَةً', en: '“This is the she-camel of Allah — a sign for you.”', ref: 'Al-A\'raf 7:73' },
    ha: ['Salihu an aiko wa mutanan Thamud bayan lalakar \'Ad.', 'Allah ya fitar da rakumin mata daga dutsen a matsayin ayar.', 'Suka yanke makogwaronsa, sai tsawa da girgizar ƙasa ta halaka su.'],
  },
  ibrahim: {
    g: ['#8A4B1F', '#33170A'], icon: 'kaaba', motif: 'The friend of Allah & the cool fire', ar: 'إبراهيم',
    ayah: { ar: 'إِنِّي وَجَّهْتُ وَجْهِيَ لِلَّذِي فَطَرَ السَّمَاوَاتِ وَالْأَرْضَ', en: '“Indeed, I have turned my face toward He who created the heavens and earth.”', ref: 'Al-An\'am 6:79' },
    ha: ['Ibrahimu ya ware mutanensa daga allaolin ƙarya, ya tsere wa wuta ta Nemrud.', 'Allah ya ce: “Ya wuta! Ka zama sanyi da salama a kan Ibrahimu.”', 'Shi ne Khalilullah (abokin Allah); ya gina Ka\'aba tare da ɗansa Isma\'ilu.'],
  },
  lut: {
    g: ['#4A2E4F', '#1C1220'], icon: 'city', motif: 'The cities turned upside down', ar: 'لوط',
    ayah: { ar: 'إِنَّ مَوْعِدَهُمُ الصُّبْحُ ۖ أَلَيْسَ الصُّبْحُ بِقَرِيبٍ', en: '“Indeed, their appointment is the morning. Is not the morning near?”', ref: 'Hud 11:81' },
    ha: ['Lutu ƙanin Ibrahimu ne; an aiko shi zuwa ga mutanen Sodomu.', 'Su ne mutane na farko da suka aikata zunubi mai girma da babu wanda ya gabata da shi.', 'Allah ya juya garuruwansu bisa-ƙasa, ya sauke duwatsu a kansu — sai muminai kaɗai suka tsira.'],
  },
  'isma-il': {
    g: ['#7A5A1E', '#2E2210'], icon: 'hand-holding-heart', motif: 'The patience of the sacrifice', ar: 'إسماعيل',
    ayah: { ar: 'يَا أَبَتِ افْعَلْ مَا تُؤْمَرُ', en: '“O my father, do as you are commanded.”', ref: 'As-Saffat 37:102' },
    ha: ['Isma\'ilu ɗan Ibrahimu ne; shi ne ɗan gagarumin hakuri a lokacin yankan (sacrifice).', 'Allah ya fanshe shi da rago, kuma aka ba shi labari mai kyau.', 'Shi ne mahaifin Larabawa, kuma ya taimaki mahaifinsa wajen gina Ka\'aba.'],
  },
  ishaq: {
    g: ['#2F5D46', '#11291F'], icon: 'child', motif: 'The good tidings of a son', ar: 'إسحاق',
    ayah: { ar: 'فَبَشَّرْنَاهَا بِإِسْحَاقَ', en: '“So We gave her good tidings of Ishaq.”', ref: 'Al-Hijr 15:53' },
    ha: ['An haifi Is\'haƙa a matsayin bushara ga Ibrahimu da Satiya a tsatson shekaru.', 'Bayansa aka ba wa busharar Ya\'ƙubu (jikonsa) — zuriyar annabawa.', 'Ya kasance annabi mai gaskiya, mai hakuri, kuma Allah ya albarkaci shi.'],
  },
  yusuf: {
    g: ['#20345C', '#0C1530'], icon: 'moon', motif: 'Dreams, Egypt & beautiful patience', ar: 'يوسف',
    ayah: { ar: 'إِنَّهُ مِنْ عِبَادِنَا الْمُخْلَصِينَ', en: '“Indeed, he was of Our chosen servants.”', ref: 'Yusuf 12:24' },
    ha: ['Yusufu mai mafarki ne; ’yan’uwansa suka jefa shi rijiya saboda kishi.', 'An sayar da shi a Masar, amma Allah ya ɗaga shi daga kurkuku zuwa fada.', 'Labarinsa ne “mafi kyau na labarai” — yana koya da hakuri da gafara.'],
  },
  ayyub: {
    g: ['#2E6045', '#0F241A'], icon: 'seedling', motif: 'The patience that healed', ar: 'أيوب',
    ayah: { ar: 'أَنِّي مَسَّنِيَ الضُّرُّ وَأَنتَ أَرْحَمُ الرَّاحِمِينَ', en: '“Indeed, adversity has touched me, and You are the Most Merciful of the merciful.”', ref: 'Al-Anbiya 21:83' },
    ha: ['Ayyubu (Ayuba) annabi ne mai dukiya da iya, sai Allah ya jarrabe shi da cuta da asara.', 'Ya yi hakuri shekaru ba ya koka, sai addu\'arsa: “Cutar ta dame ni, Kai ne mafi rahama.”', 'Allah ya warkar da shi, ya mayar masa da iya da ‘ya\'ya — alamar lada ga masu hakuri.'],
  },
  'dhul-kifl': {
    g: ['#3E5566', '#15222E'], icon: 'balance-scale', motif: 'Steadfastness & keeping one\'s word', ar: 'ذو الكفل',
    ayah: { ar: 'وَاذْكُرْ إِسْمَاعِيلَ وَإِدْرِيسَ وَذَا الْكِفْلِ ۖ كُلٌّ مِّنَ الصَّابِرِينَ', en: '“And remember Isma\'il and Idris and Dhul-Kifl — all were of the patient.”', ref: 'Al-Anbiya 21:85' },
    ha: ['Dhul-Kifl an yaba da shi a Kur\'ani saboda hakuri da cika alkawari.', 'Wasu masana sun ce shi ne abyashiru (Ezekiel) ko wasu daga cikin annabawan Bani Isra\'ila.', 'Allah ya ambace shi a tsakanin masu hakuri gaskatu.'],
  },
  shuayb: {
    g: ['#0F5A55', '#062724'], icon: 'balance-scale-right', motif: 'Honest scales & fair trade', ar: 'شعيب',
    ayah: { ar: 'أَوْفُوا الْكَيْلَ وَلَا تَكُونُوا مِنَ الْمُبْخِسِينَ', en: '“Give full measure and do not be of those who cause loss.”', ref: 'Ash-Shu\'ara 26:181' },
    ha: ['Shu\'aibu an aiko wa mutanen Madyan — kasuwar ciniki mai munafunci.', 'Ya kira su zuwa ga tauhidi da adalci a ma\'auni da awo.', 'Sun ƙi, sai girgizar ƙasa ta kama su suka zama gawawwaki a cikin gidajensu.'],
  },
  musa: {
    g: ['#12406B', '#061C30'], icon: 'water', motif: 'The sea split & the staff', ar: 'موسى',
    ayah: { ar: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي', en: '“My Lord, expand for me my breast and ease for me my task.”', ref: 'Ta-Ha 20:25-26' },
    ha: ['Musa ya tashi a Masar ƙarƙashin Fir\'auna, sai Allah ya zaɓe shi ya ’yantar da Bani Isra\'ila.', 'Ya raba teku da staffensa, ya nutsar da Fir\'auna da sojojinsa.', 'An ba shi Attaura, kuma ɗan’uwansa Haruna ya taimake shi a manzanci.'],
  },
  harun: {
    g: ['#7A4A2A', '#2C180D'], icon: 'handshake', motif: 'The brother who shared the mission', ar: 'هارون',
    ayah: { ar: 'وَوَهَبْنَا لَهُ مِن رَّحْمَتِنَا أَخَاهُ هَارُونَ نَبِيًّا', en: '“And We gave him out of Our mercy his brother Harun as a prophet.”', ref: 'Maryam 19:53' },
    ha: ['Haruna ɗan\'uwan Musa ne; Allah ya mayar da shi ministan Musa kuma annabi.', 'Yana da magana mai laushi, yana taimon Musa gaban Fir\'auna.', 'Ya tsaya a madadin Bani Isra\'ila lokacin da aka bauta wa karamin sa.'],
  },
  dawud: {
    g: ['#7A5E17', '#2B2109'], icon: 'music', motif: 'The Psalms & the iron softened', ar: 'داود',
    ayah: { ar: 'وَشَدَّدْنَا مُلْكَهُ وَآتَيْنَاهُ الْحِكْمَةَ', en: '“And We strengthened his kingdom and gave him wisdom.”', ref: 'Sad 38:20' },
    ha: ['Dawuda (Daudi) mai zabin Zabura (Zaburi); duwatsu da tsuntsaye suke tasbihi tare da shi.', 'Allah ya ba shi mulki da hikima da sassaucin ƙarfe.', 'Ya halici Jaluta (Goliath), ya zama sarki-annabi na Bani Isra\'ila.'],
  },
  sulaiman: {
    g: ['#4B2E63', '#1B1125'], icon: 'crown', motif: 'A kingdom of wind, birds & jinn', ar: 'سليمان',
    ayah: { ar: 'رَبِّ اغْفِرْ لِي وَهَبْ لِي مُلْكًا لَّا يَنبَغِي لِأَحَدٍ مِّن بَعْدِي', en: '“My Lord, forgive me and grant me a kingdom that shall not belong to any after me.”', ref: 'Sad 38:35' },
    ha: ['Sulaimanu ya gaji Dawuda: annabci da mulki a lokaci guda.', 'Iska, tsuntsaye da aljannu suna ƙarƙashin umarninsa; ya fahimci harshen tsuntsaye.', 'Sarauniyar Saba\' (Bilqis) ta shiga Musulunci a hannunsa.'],
  },
  ilyas: {
    g: ['#6B2A2A', '#271010'], icon: 'fire', motif: 'One voice against the idol Ba\'l', ar: 'إلياس',
    ayah: { ar: 'سَلَامٌ عَلَىٰ إِلْ يَاسِينَ', en: '“Peace be upon Ilyas.”', ref: 'As-Saffat 37:130' },
    ha: ['Ilyasu (Iliya) ya tsaya kaɗai gaban bautar gumaka Ba\'l a kasar Isra\'ila.', 'Ya ce: “Kuna kira Ba\'l kuma kuna barin Mafi kyawun mahalicta?”', 'Allah ya amince wa shi da aminci, ya ambace shi a cikin bayin masu imani.'],
  },
  'al-yasa': {
    g: ['#57652A', '#1F2510'], icon: 'leaf', motif: 'The student who carried the mission', ar: 'اليسع',
    ayah: { ar: 'وَإِسْمَاعِيلَ وَالْيَسَعَ وَيُونُسَ وَلُوطًا ۚ وَكُلًّا فَضَّلْنَا عَلَى الْعَالَمِينَ', en: '“And Isma\'il and Al-Yasa and Yunus and Lut — and all We preferred over the worlds.”', ref: 'Al-An\'am 6:86' },
    ha: ['Al-Yasa (Elisha) ya bi Ilyasu, ya gaje shi a manzanci.', 'Ya kasance daga waɗanda suka ƙi bautar wuta da gumaka.', 'Kur\'ani ya ambace shi a cikin waɗanda Allah ya fiɓa a duniya.'],
  },
  yunus: {
    g: ['#0E3A52', '#051723'], icon: 'fish', motif: 'The call from the belly of the whale', ar: 'يونس',
    ayah: { ar: 'فَلَوْلَا أَنَّهُ كَانَ مِنَ الْمُسَبِّحِينَ', en: '“And had he not been of those who exalt Allah, he would have remained inside its belly.”', ref: 'As-Saffat 37:143' },
    ha: ['Yunusu (Yahana) ya bar mutanensa da wuri, aka hada shi da kifi ya yi shi.', 'A cikin cikin kifi ya ce: “Babu abin bauta sai Kai, tsarki nake maka! Lalle ni na zama daga masu zalunci.”', 'Allah ya cece shi; idan wani yana cikin baƙin ciki ya kira da kalmomin Yunusu, Allah ya karɓa.'],
  },
  zakariyya: {
    g: ['#6E5A2E', '#282110'], icon: 'praying-hands', motif: 'A son asked for in old age', ar: 'زكريا',
    ayah: { ar: 'رَبِّ هَبْ لِي مِن لَّدُنكَ ذُرِّيَّةً طَيِّبَةً', en: '“My Lord, grant me from Yourself a good offspring.”', ref: 'Al Imran 3:38' },
    ha: ['Zakariyya ya riƙa wa Maryama kula, ya ga abincinta ya zo daga Allah.', 'Ya roƙi Ubangijinsa da ɗa mai kyau duk da tsatson shekaru, ba ya magana da mutane kwana uku.', 'Allah ya ba shi Yahaya — yaro mai tsarki daga gare mu.'],
  },
  yahya: {
    g: ['#3C6B5A', '#152923'], icon: 'dove', motif: 'The ascetic who took the Scripture with power', ar: 'يحيى',
    ayah: { ar: 'يَا يَحْيَىٰ خُذِ الْكِتَابَ بِقُوَّةٍ', en: '“O Yahya, take the Scripture with determination.”', ref: 'Maryam 19:12' },
    ha: ['Yahaya (Yohanna) ɗan Zakariyya ne; an haife shi da kalma daga Allah.', 'Ya riƙe littafi da ƙarfi yana ƙarami, mai hikima da tsabta.', 'Ya kasance mai gaskiya da annabci, kuma mai birnin zunubi.'],
  },
  daniel: {
    g: ['#55552E', '#20210F'], icon: 'lion', motif: 'Faith in the lions\' den', ar: 'دانيال',
    ayah: { ar: 'أَلَا إِنَّ أَوْلِيَاءَ اللَّهِ لَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ', en: '“Unquestionably, the allies of Allah — no fear will be upon them, nor will they grieve.”', ref: 'Yunus 10:62' },
    ha: ['Daniu (Daniel) annabi ne daga zuriyar Bani Isra\'ila, mai fassarar mafarkai.', 'An jefa shi cikin ramin zakuna, sai Allah ya rufe bakinsu aka tsayar da shi.', 'Labarinsa yana koyar da cewa amana da sallah suna kiyaye mutum daga hatsari.'],
  },
  isa: {
    g: ['#1F5875', '#0B2331'], icon: 'heart', motif: 'The word of Allah & healer of the sick', ar: 'عيسى',
    ayah: { ar: 'إِنِّي عَبْدُ اللَّهِ آتَانِيَ الْكِتَابَ وَجَعَلَنِي نَبِيًّا', en: '“Indeed, I am the servant of Allah. He has given me the Scripture and made me a prophet.”', ref: 'Maryam 19:30' },
    ha: ['Isa ɗan Maryama ne; an haife shi ba tare da uba ba da kalmar Allah.', 'Allah ya ba shi Injila, ya warkar da makafi da kuturu, ya rayar da matafiyar da izinin Allah.', 'Mussulmi na gaskata shi annabi ne, ba daɗi Allah ba; za ya koma kafin Ranar Ƙiyama.'],
  },
  muhammad: {
    g: ['#14523A', '#07271B'], icon: 'mosque', motif: 'The seal of the prophets, mercy to the worlds', ar: 'محمد ﷺ',
    ayah: { ar: 'وَمَا أَرْسَلْنَاكَ إِلَّا رَحْمَةً لِّلْعَالَمِينَ', en: '“And We have not sent you except as a mercy to the worlds.”', ref: 'Al-Anbiya 21:107' },
    ha: ['Muhammadu ﷺ khātamin annabawa ne, an aiko shi ga dukan talakai.', 'An ba shi Alkur\'ani mai girma, kuma halarsa ta zama misali ga duka.', 'Shi ne rahama ga talakai duka; addininsa gare shi ne cikakken addini.'],
  },
};

export const themeFor = (slug: string): ProphetTheme =>
  PROPHET_THEMES[slug] ?? { g: ['#2E5339', '#12251A'], icon: 'scroll', motif: 'A prophet of Allah', ar: '', ayah: null, ha: [] };
