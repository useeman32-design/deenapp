/** pass 29 — Learning hub content: riddles & jokes (own datasets, clean and
 * authentic), kept short and family-friendly. */

export type Riddle = { q: string; a: string; hint?: string };
export const RIDDLES: Riddle[] = [
  { q: 'I am a surah whose recitation is said to equal a third of the Qur’an. Which surah am I?', a: 'Surah Al-Ikhlas (112)', hint: 'It is all about tawhid.' },
  { q: 'I am the only surah named after a woman. Who am I?', a: 'Surah Maryam (19)' },
  { q: 'I am a prayer with no adhan and no iqamah, performed standing silently. What am I?', a: 'The funeral (janazah) prayer' },
  { q: 'Built by a father and his son together, I am the first house of worship for mankind. What am I?', a: 'The Kaaba in Makkah — raised by Ibrahim and Ismail (peace be upon them)' },
  { q: 'There is a chapter of the Qur’an named after an insect. Which one?', a: 'Surah An-Naml — The Ants (27)' },
  { q: 'I am the longest surah of the Qur’an. What is my name?', a: 'Surah Al-Baqarah (2)' },
  { q: 'I am the night journey of the Prophet ﷺ from Makkah to Jerusalem and then to the heavens. What am I called?', a: 'Al-Isra wal-Mi’raj' },
  { q: 'Which battle was fought in the 2nd year after the Hijrah and was the first great victory of Islam?', a: 'The Battle of Badr' },
  { q: 'I am the bird that carried a letter and spoke with a prophet in the Qur’an. Who am I?', a: 'The hoopoe (hudhud) — with Prophet Sulaiman (peace be upon him)' },
  { q: 'How many surahs are named directly after prophets?', a: 'Six: Yunus, Hud, Yusuf, Ibrahim, Muhammad and Nuh' },
  { q: 'Which surah of the Qur’an does not begin with Bismillah?', a: 'Surah At-Tawbah (9)' },
  { q: 'In which surah does Bismillah appear twice?', a: 'Surah An-Naml (27) — at the start, and in the letter of Sulaiman (27:30)' },
  { q: 'What is the only month mentioned by name in the Qur’an?', a: 'Ramadan — in Surah Al-Baqarah (2:185)' },
  { q: 'I am always ahead of you yet you can never see me. What am I?', a: 'The future — and every soul shall meet its appointed time' },
  { q: 'I am the first fard prayer of the day, its time ends at sunrise. What am I?', a: 'Fajr' },
  { q: 'I was the first man and the first prophet. Who am I?', a: 'Adam (peace be upon him)' },
];

export type Joke = { setup: string; punch: string };
export const JOKES: Joke[] = [
  { setup: 'Why did the student bring a ladder to the madrasah?', punch: 'Because he wanted to reach the high levels of jannah… and the top shelf of the library.' },
  { setup: 'What did the date say to the hungry Muslim at iftar?', punch: '“Finally! I have been waiting for you since suhoor.”' },
  { setup: 'The teacher asked: “Who wants a reward that never stops?”', punch: 'Everyone raised a hand — he said “small deeds done regularly.” Everyone went home to floss daily.' },
  { setup: 'Why don’t Ramadan calendars ever lie?', punch: 'Because every single day they fast-forward to the truth.' },
  { setup: 'A kid asked: “Is it true that good deeds are multiplied in Ramadan?”', punch: '“Yes.” “Then can my Ramadan homework count for the whole year?”' },
  { setup: 'Why was the masjid’s shoe rack so organized?', punch: 'Because everyone there had already learned to line up — in prayer.' },
  { setup: 'What is a Muslim’s favourite kind of maths?', punch: 'Multiplication — of rewards for good deeds.' },
  { setup: 'Two friends raced to the masjid for fajr. Who won?', punch: 'Both — one earned the congregation reward, the other earned extra steps.' },
  { setup: 'Why did the phone finally behave during the khutbah?', punch: 'It kept hearing “silence it for Allah” and took it personally.' },
  { setup: 'What did the traveller say when he finally found the qibla?', punch: '“Direction confirmed — heart at ease, luggage still lost.”' },
];

export type Article = { title: string; tag: string; mins: number; icon: string; body: string[] };
export const ARTICLES: Article[] = [
  {
    title: 'How to Build a Daily Connection with the Qur’an',
    tag: 'Qur’an', mins: 3, icon: 'book-open',
    body: [
      'The Prophet ﷺ said the best of you are those who learn the Qur’an and teach it (Bukhari 5027) — and every journey with the Book begins with a single, consistent page.',
      'Pick a fixed time — after Fajr is the sunnah of recitation and the quietest hour — and commit to one page, no more. Consistency beats quantity: “The most beloved deeds to Allah are the most constant, even if small” (Bukhari 6464).',
      'Read a little of the meaning alongside the recitation, even one line of tafsir per page. Understanding transforms recitation from habit into conversation.',
    ],
  },
  {
    title: 'The Sunnah of Sleeping and Waking',
    tag: 'Sunnah', mins: 3, icon: 'moon',
    body: [
      'Sleep itself can be worship when done the prophetic way: dust the bed, lie on the right side, and recite the sleeping dua — “In Your name, O Allah, I die and I live.”',
      'Before sleep, settle your debts and disputes — “the believer does not sleep while angry at his brother.” Wudu before bed is a shield, and the last words of the night should be good ones.',
      'Wake with “Alhamdulillahilladhi ahyana ba’da ma amatana” — praise to Allah who gave us life after death — and let Fajr be the first light your eyes meet.',
    ],
  },
  {
    title: 'Duas of the Daily Journey',
    tag: 'Dua', mins: 2, icon: 'hands-helping',
    body: [
      'The day of a believer is framed by short remembrances: leaving the home (“In the name of Allah, I trust in Allah”), entering it (“Bismillah” with salam to the family), and travelling (“Subhanalladhi sakhkhara lana hadha”).',
      'These brief sentences take seconds but turn ordinary motion into reward. Teach them to children by saying them aloud — the sunnah is caught, not just taught.',
      'When you don’t know what to ask for, the Qur’an itself gives the words: “Our Lord, give us good in this world and good in the Hereafter” (2:201).',
    ],
  },
  {
    title: 'Why the Early Generations Prayed at Night',
    tag: 'Spirituality', mins: 3, icon: 'star-and-crescent',
    body: [
      'Qiyam al-layl was the counsel of the Prophet ﷺ to nearly every companion: “Stand at night, for it was the habit of the righteous before you” (Tirmidhi 3549).',
      'The night prayer is not a burden for the elite — begin with two rak’ahs after waking, even minutes before Fajr. Allah descends in the last third of the night asking who is calling, so He may answer.',
      'The secret is softness of heart, not length of standing: weep a little, even if only inside, and the night begins to give back what the day took.',
    ],
  },
  {
    title: 'A Beginner’s Map to the Five Pillars',
    tag: 'Aqeedah', mins: 3, icon: 'landmark',
    body: [
      'Islam stands on five: the shahadah, salah, zakah, sawm and hajj — a complete schedule for body, wealth and soul.',
      'Shahadah is the entry; salah five times a day is the heartbeat; zakah purifies what you own; Ramadan purifies the year; and hajj, once in a lifetime for those able, purifies the whole life.',
      'Each pillar trains a different muscle of faith — say it, bow it, give it, leave it, and travel for it. Start where you are: perfect one prayer this week before perfecting all five.',
    ],
  },
  {
    title: 'Kindness: the Forgotten Worship',
    tag: 'Character', mins: 2, icon: 'hand-holding-heart',
    body: [
      'The Prophet ﷺ was never coarse. He said smiling is charity, that the best of people are the most beneficial, and that Allah is gentle and loves gentleness in all things (Muslim 2593).',
      'Kindness is worship with the hands: carrying a neighbour’s bag, visiting the sick, making room in the row. Even removing harm from the road is a branch of faith.',
      'Start small today — one message to someone who is struggling. The dua of an angel follows the one who feeds others.',
    ],
  },
];
