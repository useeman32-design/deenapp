/**
 * Bundled demo data — used ONLY when deenlink.org is unreachable
 * (offline preview). Real content comes from the API client.
 * Usernames/profiles mirror the live deenlink.org community.
 */
import type { Course, Post, Scholar, User, Video } from '@/api/types';

const u = (
  id: number,
  username: string,
  full_name: string,
  badge: 'blue' | 'green' | 'gold' | null = null,
  scholar?: boolean,
): User => ({
  id,
  username,
  full_name,
  user_type: scholar ? 'scholar' : 'user',
  profile_image_url: null,
  deenpoints_balance: 0,
  verification_badge: badge,
  scholar: scholar
    ? {
        id,
        user_id: id,
        display_name: full_name,
        title: 'Sheikh',
        madhhab: 'Hanafi',
        institute: 'Qarawiyyin University',
        fields_of_knowledge: 'Fiqh, Hadith',
        approval_status: 'approved',
      }
    : null,
});

export const MOCK_USER: User = {
  id: 1,
  username: 'deenlink_user',
  full_name: 'DeenLink User',
  user_type: 'user',
  profile_image_url: null,
  deenpoints_balance: 120,
  is_email_verified: 1,
  account_status: 'active',
  verification_badge: null,
  scholar: null,
};

export const MOCK_FEED: Post[] = [
  {
    id: 101,
    content_text:
      'Inna ma’al-‘usri yusra. Indeed, with hardship comes ease. May Allah make our paths easy this week. 🤍',
    time_ago: '2h',
    like_count: 48,
    comment_count: 12,
    liked_by_me: false,
    is_public_qa: false,
    user: u(2, 'alameen', 'Aminu Muhammad Suleiman', 'green', true),
    media: [],
  },
  {
    id: 102,
    content_text:
      'Reminder: the Prophet ﷺ said, “The best of you are those who learn the Quran and teach it.” (Bukhari 5027)',
    time_ago: '5h',
    like_count: 96,
    comment_count: 21,
    liked_by_me: true,
    is_public_qa: false,
    user: u(3, 'mayanchie12', 'Yahaya Umar', 'blue'),
    media: [],
  },
  {
    id: 103,
    content_text:
      'Q: What is the ruling on combining prayers while travelling?\nA: It is permissible to combine Dhuhr with Asr and Maghrib with Isha during travel, following the practice of the Prophet ﷺ.',
    time_ago: '8h',
    like_count: 34,
    comment_count: 9,
    liked_by_me: false,
    is_public_qa: true,
    public_qa: {
      question: 'What is the ruling on combining prayers while travelling?',
      answer:
        'It is permissible to combine Dhuhr with Asr and Maghrib with Isha during travel, following the practice of the Prophet ﷺ.',
    },
    user: u(4, 'usman_ahmad', 'Usman Ahmad Kanoma', 'gold', true),
    media: [],
  },
  {
    id: 104,
    content_text:
      'Jumu’ah reminder: listen and be silent while the khutbah is being delivered. (Al-Mumtahanah 102:1)',
    time_ago: '1d',
    like_count: 71,
    comment_count: 5,
    liked_by_me: false,
    is_public_qa: false,
    user: u(5, 'Gimba', 'Abdulhameed Hassan Gimba', 'blue'),
    media: [],
  },
];

export const MOCK_VIDEOS: Video[] = [
  {
    id: 1,
    video_type: 'daily',
    title: 'Understanding Niyyah (Intention) in Worship',
    description: 'A short reminder on the importance of intention in every deed.',
    poster_url: null,
    source_url: 'https://www.youtube.com/@DeenLink',
    duration: '12:41',
    view_count: 1840,
    like_count: 96,
  },
  {
    id: 2,
    video_type: 'daily',
    title: 'How to Make the Most of Rajab',
    description: 'Virtues of the month of Rajab and how to prepare for Ramadan.',
    poster_url: null,
    source_url: 'https://www.youtube.com/@DeenLink',
    duration: '18:05',
    view_count: 3210,
    like_count: 210,
  },
  {
    id: 3,
    video_type: 'daily',
    title: 'The Manners of Reciting the Qur’an',
    description: 'Tajwid basics and the adab of the reciter, explained simply.',
    poster_url: null,
    source_url: 'https://www.youtube.com/@DeenLink',
    duration: '9:58',
    view_count: 954,
    like_count: 61,
  },
];

export const MOCK_SCHOLARS: Scholar[] = [
  {
    id: 1,
    user_id: 11,
    display_name: 'Sheikh Abdurrahman Al-Ameen',
    title: 'Sheikh',
    madhhab: 'Shafiʿi',
    institute: 'Al-Azhar University',
    fields_of_knowledge: 'Fiqh, Aqeedah',
    approval_status: 'approved',
  },
  {
    id: 2,
    user_id: 12,
    display_name: 'Ustadh Usman Ahmad',
    title: 'Ustadh',
    madhhab: 'Hanafi',
    institute: 'Qarawiyyin University',
    fields_of_knowledge: 'Hadith, Tafsir',
    approval_status: 'approved',
  },
  {
    id: 3,
    user_id: 13,
    display_name: 'Ustadhah Maya Nchie',
    title: 'Ustadhah',
    madhhab: 'Maliki',
    institute: 'Islamic University of Madinah',
    fields_of_knowledge: 'Taharah, Salah',
    approval_status: 'approved',
  },
];

export const MOCK_COURSES: Course[] = [
  {
    id: 1,
    title: 'Tajwid Essentials',
    slug: 'tajwid-essentials',
    description: 'Master the rules of beautiful Qur’an recitation, one lesson at a time.',
    cover_image: null,
    level: 'Beginner',
    lessons_count: 12,
  },
  {
    id: 2,
    title: 'Fiqh of Worship for Beginners',
    slug: 'fiqh-worship',
    description: 'Wudu, Salah and everything in between — a complete practical guide.',
    cover_image: null,
    level: 'Beginner',
    lessons_count: 18,
  },
  {
    id: 3,
    title: 'The Seerah: Life of the Prophet ﷺ',
    slug: 'seerah',
    description: 'A chronological journey through the life of Muhammad ﷺ, Makkah to Madinah.',
    cover_image: null,
    level: 'Intermediate',
    lessons_count: 24,
  },
];

/* --------------------------- Quiz (demo) ---------------------------- */

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

export const MOCK_QUIZ: QuizQuestion[] = [
  { question: 'How many pillars of Islam are there?', options: ['Four', 'Five', 'Six', 'Seven'], answer: 1 },
  { question: 'Which surah is known as the Heart of the Quran?', options: ['Al-Fatiha', 'Al-Mulk', 'Yasin', 'Al-Kahf'], answer: 2 },
  { question: 'In which month did the Quran begin to be revealed?', options: ['Rajab', 'Sha\u2019ban', 'Ramadan', 'Shawwal'], answer: 2 },
  { question: 'How many times a day are the five prayers performed?', options: ['Four', 'Five', 'Six', 'Seven'], answer: 1 },
  { question: 'Who was the first Khalifah after the Prophet ﷺ?', options: ['Umar ibn al-Khattab', 'Uthman ibn Affan', 'Abu Bakr as-Siddiq', 'Ali ibn Abi Talib'], answer: 2 },
  { question: 'Which pillar comes after Shahadah?', options: ['Sawm', 'Zakat', 'Salah', 'Hajj'], answer: 2 },
  { question: 'How many rak\u2019at are in Fajr salah?', options: ['Two', 'Three', 'Four', 'Five'], answer: 0 },
  { question: 'Which prophet was given the Zabur?', options: ['Musa \u2019alaihissalam', 'Dawud \u2019alaihissalam', 'Isa \u2019alaihissalam', 'Yusuf \u2019alaihissalam'], answer: 1 },
  { question: 'The Kaaba is located in which city?', options: ['Madinah', 'Makkah', 'Jerusalem', 'Cairo'], answer: 1 },
  { question: 'What does \u2018SubhanAllah\u2019 mean?', options: ['Praise be to Allah', 'Glory be to Allah', 'Allahu Akbar', 'La ilaha illallah'], answer: 1 },
];

/* --------------------------- Events (demo) ---------------------------- */

export interface EventItem {
  id: number;
  title: string;
  date: string;
  location: string;
  kind: 'Holiday' | 'Lecture' | 'Community' | 'Study';
  color: string;
}

export const MOCK_EVENTS: EventItem[] = [
  { id: 1, title: 'Laylat al-Bara\u2019ah Gathering', date: 'Mid-Sha\u2019ban', location: 'Mosque Hall', kind: 'Community', color: '#1D6F42' },
  { id: 2, title: 'Tafsir of Surah Al-Kahf (Weekly)', date: 'Every Friday', location: 'Online', kind: 'Study', color: '#3F51B5' },
  { id: 3, title: 'Lecture: The Ethics of Speech', date: 'Sat 8 PM', location: 'DeenLink Live', kind: 'Lecture', color: '#8E44AD' },
  { id: 4, title: 'Id Preparation & Community Iftar', date: 'Ramadan', location: 'Community Centre', kind: 'Community', color: '#EF6C00' },
];

/* --------------------------- Wallpapers (demo) ---------------------------- */

export interface Wallpaper {
  id: number;
  arabic: string;
  caption: string;
  from: string;
}

export const MOCK_WALLPAPERS: Wallpaper[] = [
  { id: 1, arabic: 'اَللّٰهُ', caption: 'Allah', from: 'linear-gradient(160deg, #0b3d25, #1D6F42)' },
  { id: 2, arabic: 'اَلصَّٰبَرِيْنَ', caption: 'For the patient', from: 'linear-gradient(160deg, #1a2a6c, #b8860b)' },
  { id: 3, arabic: 'سُبْحَانَ اللّٰهِ', caption: 'Glory be to Allah', from: 'linear-gradient(160deg, #232526, #414345)' },
  { id: 4, arabic: 'اَلْحَمْدُ لِلّٰهِ', caption: 'Praise be to Allah', from: 'linear-gradient(160deg, #5614b0, #dbd65c)' },
];
