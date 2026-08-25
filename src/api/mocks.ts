/**
 * Demo data used until the app is pointed at the real DeenLink API.
 * Shapes mirror what the PHP backend should return — adjust both sides to match.
 */

export type User = { id: string; name: string; username: string; mizhab?: string };

export type Comment = { id: string; author: string; color: string; body: string; time: string };

export type Post = {
  id: string;
  author: { name: string; username: string; mizhab?: string; color: string };
  time: string;
  body: string;
  arabic?: string;
  image?: { color: string; label: string };
  video?: boolean;
  likes: number;
  liked?: boolean;
  comments: Comment[];
};

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    author: { name: 'Aminu Muhammad Suleiman', username: 'alameen', mizhab: 'Sunni', color: '#0E7A5F' },
    time: '5 days ago',
    body: 'Sheikh Muhammad Albani, Zaria. May Allah keep our scholars and reward him for his reminders.',
    video: true,
    likes: 10,
    comments: [
      { id: 'c1', author: 'Yahaya Umar', color: '#7C3AED', body: 'May Allah reward you for sharing 🙏', time: '4 days ago' },
    ],
  },
  {
    id: 'p2',
    author: { name: 'Yahaya Umar', username: 'mayanchie12', color: '#7C3AED' },
    time: '8 days ago',
    body: 'Lecture by Sheikh Ahmad Tijjani Yusuf Guruntum, may Allah preserve him — a full lesson on the Month of Ramadan.',
    image: { color: '#134E4A', label: 'Lecture · Sheikh A. T. Yusuf Guruntum' },
    likes: 50,
    comments: [],
  },
  {
    id: 'p3',
    author: { name: 'Usman Ahmad', username: 'usman_ahmad', mizhab: 'Sunni', color: '#B45309' },
    time: '11 days ago',
    body: 'Indeed, everything living shall taste death. A reminder to make the most of every breath.',
    likes: 30,
    comments: [],
  },
  {
    id: 'p4',
    author: { name: 'Usman Ahmad', username: 'usman_ahmad', mizhab: 'Sunni', color: '#B45309' },
    time: '12 days ago',
    body: 'Today’s Ayah 🌿 “Indeed, with hardship comes ease.” (Qur’an 94:5)\n\nWhatever you are going through today, remember that hardship does not last forever. What are you asking Allah to make easy for you? 🤲',
    arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
    likes: 40,
    comments: [
      { id: 'c2', author: 'Aminu Muhammad Suleiman', color: '#0E7A5F', body: 'JazakAllahu khairan for the reminder', time: '11 days ago' },
      { id: 'c3', author: 'Abubakar Sadiq', color: '#0369A1', body: 'Amin 🤲', time: '10 days ago' },
    ],
  },
  {
    id: 'p5',
    author: { name: 'Usman Ahmad', username: 'usman_ahmad', mizhab: 'Sunni', color: '#B45309' },
    time: '12 days ago',
    body: 'Let’s test our knowledge! 🧠\n\nWhich of these invalidates Wudu?\nA. Reading Qur’an\nB. Sleeping deeply\nC. Making Dhikr\nD. Giving charity\n\n👇 Comment your answer.',
    likes: 20,
    comments: [
      { id: 'c4', author: 'Abdulhameed Hassan', color: '#9F1239', body: 'B — sleeping deeply', time: '12 days ago' },
    ],
  },
  {
    id: 'p6',
    author: { name: 'Abdulhameed Hassan Gimba', username: 'Gimba', color: '#9F1239' },
    time: 'May 17, 2026',
    body: 'Saudi Supreme Court announces the sighting of the new moon for Dhu al-Hijjah 1447. May Allah accept the Hajj of those who are able.',
    image: { color: '#3F6212', label: 'Moon sighting announcement' },
    likes: 31,
    comments: [],
  },
  {
    id: 'p7',
    author: { name: 'خالد إسحاق', username: 'arabyy', color: '#4338CA' },
    time: 'May 10, 2026',
    body: '“Do not despair of the mercy of Allah.” — a gentle reminder for a heavy heart.',
    likes: 50,
    comments: [],
  },
  {
    id: 'p8',
    author: { name: 'Abubakar Sadiq Marafa-Koko', username: 'Ibn_Abubakar', mizhab: 'Sunnah', color: '#0369A1' },
    time: '23 days ago',
    body: 'Alhamdulillah — for a heart that remembers, and a tongue that is grateful.',
    likes: 51,
    comments: [],
  },
];

export type Video = { id: string; title: string; teacher: string; duration: string; url: string; color: string };

export const MOCK_VIDEOS: Video[] = [
  { id: 'v1', title: 'Sheikh Muhammad Albani, Zaria — Reminder', teacher: 'Daily DeenLink', duration: '18:24', url: 'https://www.youtube.com/results?search_query=deenlink+sheikh+muhammad+albani+zaria', color: '#0E7A5F' },
  { id: 'v2', title: 'Lecture on the Month of Ramadan', teacher: 'Sheikh A. T. Yusuf Guruntum', duration: '42:10', url: 'https://www.youtube.com/results?search_query=sheikh+ahmad+tijjani+yusuf+guruntum+ramadan', color: '#134E4A' },
  { id: 'v3', title: 'Tafsir with Sheikh Kanoma', teacher: 'Sheikh Ahmad Umar Kanoma', duration: '35:47', url: 'https://www.youtube.com/results?search_query=sheikh+ahmad+umar+kanoma+tafsir', color: '#3F6212' },
  { id: 'v4', title: 'Jum’at Huddubah', teacher: 'Sheikh Ahmad Umar Kanoma', duration: '28:03', url: 'https://www.youtube.com/results?search_query=kanoma+jummat+huddubah', color: '#7C3AED' },
  { id: 'v5', title: 'A reminder about arrogance and pride', teacher: 'Sheikh A. T. Yusuf Guruntum', duration: '15:58', url: 'https://www.youtube.com/results?search_query=sheikh+guruntum+arrogance', color: '#9F1239' },
  { id: 'v6', title: 'Do not despair of the mercy of Allah', teacher: 'DeenLink', duration: '9:41', url: 'https://www.youtube.com/results?search_query=deenlink+mercy+of+allah', color: '#B45309' },
];

export type Scholar = { id: string; name: string; mizhab: string; expertise: string; color: string };

export const MOCK_SCHOLARS: Scholar[] = [
  { id: 's1', name: 'Sheikh Ahmad Umar Kanoma', mizhab: 'Sunni', expertise: 'Tafsir & Hadith', color: '#0E7A5F' },
  { id: 's2', name: 'Sheikh Muhammad Albani', mizhab: 'Sunni', expertise: 'Hadith & Reminders', color: '#134E4A' },
  { id: 's3', name: 'Sheikh Ahmad Tijjani Yusuf Guruntum', mizhab: 'Sunni', expertise: 'Fiqh & Lectures', color: '#3F6212' },
  { id: 's4', name: 'Sheikh Aliyu', mizhab: 'Sunnah', expertise: 'Qur’an & Seerah', color: '#0369A1' },
];

export type EventItem = {
  id: string;
  title: string;
  date: string;
  location: string;
  kind: 'Holiday' | 'Lecture' | 'Community' | 'Study';
  color: string;
};

export const MOCK_EVENTS: EventItem[] = [
  { id: 'e1', title: 'Prophet’s Birthday (Mawlid) — 12 Rabi al-Awwal 1448', date: 'Sat, Aug 25, 2026', location: 'Owerri, Nigeria', kind: 'Holiday', color: '#0E7A5F' },
  { id: 'e2', title: 'Qur’an Memorization Circle (Hifz)', date: 'Every Thursday', location: 'Aba, Nigeria', kind: 'Community', color: '#7C3AED' },
  { id: 'e3', title: 'Jumu’ah Special Lecture', date: 'Every Friday', location: 'Online (YouTube)', kind: 'Lecture', color: '#B45309' },
  { id: 'e4', title: 'Islamic Study Circle (Halaqa)', date: 'Every Wednesday', location: 'Online', kind: 'Study', color: '#0369A1' },
  { id: 'e5', title: 'Community Iftar', date: 'During Ramadan', location: 'Online + Owerri', kind: 'Community', color: '#9F1239' },
];

export type QuizQuestion = { question: string; options: string[]; answer: number };

export const MOCK_QUIZ: QuizQuestion[] = [
  { question: 'How many pillars of Islam are there?', options: ['3', '4', '5', '7'], answer: 2 },
  { question: 'Which is the longest surah in the Qur’an?', options: ['Al Imran', 'Al Baqarah', 'An Nisa', 'Al Kahf'], answer: 1 },
  { question: 'What is the shortest surah in the Qur’an?', options: ['Al Kawthar', 'Al Ikhlas', 'An Nas', 'Al Falaq'], answer: 0 },
  { question: 'How many obligatory prayers are there in a day?', options: ['3', '4', '5', '6'], answer: 2 },
  { question: 'What is the first surah of the Qur’an?', options: ['Al Ikhlas', 'Al Fatihah', 'Al Baqarah', 'An Nas'], answer: 1 },
  { question: 'In which month is fasting obligatory?', options: ['Muharram', 'Shawwal', 'Ramadan', 'Dhu al-Hijjah'], answer: 2 },
  { question: 'Which of these invalidates Wudu?', options: ['Reading Qur’an', 'Sleeping deeply', 'Making dhikr', 'Giving charity'], answer: 1 },
  { question: 'What is the prayer before sunrise called?', options: ['Dhuhr', 'Asr', 'Fajr', 'Isha'], answer: 2 },
  { question: 'How many verses are in the Qur’an (common count)?', options: ['6,000', '6,236', '6,500', '7,000'], answer: 1 },
  { question: 'Who is the last prophet in Islam?', options: ['Musa (AS)', 'Isa (AS)', 'Ibrahim (AS)', 'Muhammad (ﷺ)'], answer: 3 },
];

export type Wallpaper = { id: string; arabic: string; caption: string; from: string; to: string };

export const MOCK_WALLPAPERS: Wallpaper[] = [
  { id: 'w1', arabic: 'ٱللَّهُ', caption: 'Allah', from: '#0E7A5F', to: '#04231B' },
  { id: 'w2', arabic: 'سُبْحَانَ ٱللَّهِ', caption: 'Subhan Allah', from: '#134E4A', to: '#02201C' },
  { id: 'w3', arabic: 'ٱلْحَمْدُ لِلَّهِ', caption: 'Alhamdulillah', from: '#854D0E', to: '#1C1204' },
  { id: 'w4', arabic: 'ٱللَّهُ أَكْبَرُ', caption: 'Allahu Akbar', from: '#0F766E', to: '#042F2E' },
  { id: 'w5', arabic: 'بِسْمِ ٱللَّهِ', caption: 'Bismillah', from: '#1E3A8A', to: '#0A1230' },
  { id: 'w6', arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', caption: 'Surah Al Ikhlas', from: '#4C1D95', to: '#170B2E' },
  { id: 'w7', arabic: 'ٱلْجَنَّةُ', caption: 'Al Jannah', from: '#166534', to: '#052E16' },
  { id: 'w8', arabic: 'ٱلْقُرْءَان', caption: 'Al Qur’an', from: '#7C2D12', to: '#241007' },
];

export const MOCK_ANNOUNCEMENT =
  'Jumu’ah Mubarak! 🕌 May Allah accept our prayers. New lectures from Sheikh Kanoma are live in the Videos tab this week.';
