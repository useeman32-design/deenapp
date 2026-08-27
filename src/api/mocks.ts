/**
 * Bundled demo data — used ONLY when deenlink.org is unreachable
 * (offline preview). Real content comes from the API client.
 * Usernames/profiles mirror the live deenlink.org community.
 */
import type { BadgeType, Course, Post, Scholar, User, Video } from '@/api/types';

/* Real community profile photos (from the DeenLink content pack). */
const p1 = require('../../assets/img/profiles/p1.jpg');
const p2 = require('../../assets/img/profiles/p2.jpg');
const p3 = require('../../assets/img/profiles/p3.jpg');
const p4 = require('../../assets/img/profiles/p4.jpg');
const p5 = require('../../assets/img/profiles/p5.jpg');
const p6 = require('../../assets/img/profiles/p6.jpg');
const p7 = require('../../assets/img/profiles/p7.jpg');
const postMosque = require('../../assets/img/post-mosque.jpg');
const vidYasin = require('../../assets/img/vid-yasin.jpg');
const vid99 = require('../../assets/img/vid-99names.jpg');
const vidReturn = require('../../assets/img/vid-return.jpg');
export const PROFILE_PHOTOS = { p1, p2, p3, p4, p5, p6, p7 } as Record<string, number>;

const u = (
  id: number,
  username: string,
  full_name: string,
  opts: {
    badge?: 'blue' | 'green' | 'gold' | null;
    scholar?: boolean;
    fields?: string;
    photo?: number;
  } = {},
): User => ({
  id,
  username,
  full_name,
  user_type: opts.scholar ? 'scholar' : 'user',
  profile_image_url: opts.photo ?? null,
  deenpoints_balance: 0,
  verification_badge: opts.badge ?? null,
  // aqeedah / field of knowledge shown on the post card
  fields: opts.fields ?? (opts.scholar ? 'Fiqh, Hadith' : undefined),
  scholar: opts.scholar
    ? {
        id,
        user_id: id,
        display_name: full_name,
        title: 'Sheikh',
        madhhab: 'Hanafi',
        institute: 'Qarawiyyin University',
        fields_of_knowledge: opts.fields ?? 'Fiqh, Hadith',
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

export const MOCK_PHOTOS: Record<number, number> = { 1: p1, 2: p2, 3: p3, 4: p4, 5: p5, 6: p6, 7: p7 };

export const MOCK_FEED: Post[] = [
  {
    id: 101,
    content_text:
      'Inna ma’al-‘usri yusra. Indeed, with hardship comes ease. May Allah make our paths easy this week. 🤍 #Tawbah',
    time_ago: '2h',
    like_count: 48,
    comment_count: 12,
    liked_by_me: false,
    is_public_qa: false,
    user: u(2, 'alameen', 'Aminu Muhammad Suleiman', { badge: 'green', scholar: true, fields: 'Sunni · Mufti', photo: p1 }),
    media: [],
  },
  {
    id: 107,
    content_text:
      'A reflection on the hadith: “Actions are by intentions” (Bukhari 1). The Prophet ﷺ made the heart the yardstick of every deed — not its appearance. A long surah recited without presence is less rewarding than a few verses recited with khauf and raja’. When you open the mushaf, pause for a moment and make the niyyah sincerely: not for showing off, not out of habit, but for the Face of Allah alone. This single intention transforms the same words into two completely different rewards. Guard your intentions, because Allah does not look at your bodies or your wealth — He looks at your hearts and your deeds. Make this your daily check before prayer: “Why am I doing this?” The answer should always be Him. May Allah purify our hearts and accept our deeds. 🤍 #Seerah',
    time_ago: '2h',
    like_count: 214,
    comment_count: 31,
    liked_by_me: false,
    is_public_qa: false,
    user: u(1, 'alameen', 'Sheikh Abdurrahman Al-Ameen', { badge: 'green', scholar: true, fields: 'Sunni · Mufti', photo: p1 }),
    media: [],
  },
  {
    id: 105,
    content_text:
      'Sometimes the masjid speaks louder than words. May our hearts always find their way back to the prayer. 🕌 #DailyDhikr',
    time_ago: '3h',
    like_count: 128,
    comment_count: 17,
    liked_by_me: false,
    is_public_qa: false,
    user: u(6, 'salamatu_b', 'Salamatu Bello', { badge: 'blue', fields: 'Sufi', photo: p5 }),
    media: [{ type: 'image', url: postMosque }],
  },
  {
    id: 102,
    content_text:
      'Reminder: the Prophet ﷺ said, “The best of you are those who learn the Quran and teach it.” (Bukhari 5027) #Tajweed',
    time_ago: '5h',
    like_count: 96,
    comment_count: 21,
    liked_by_me: true,
    is_public_qa: false,
    user: u(3, 'mayanchie12', 'Yahaya Umar', { badge: 'blue', fields: 'Sunni', photo: p2 }),
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
    user: u(4, 'usman_ahmad', 'Usman Ahmad Kanoma', { badge: 'gold', scholar: true, fields: 'Sunni · Sheikh', photo: p3 }),
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
    user: u(5, 'Gimba', 'Abdulhameed Hassan Gimba', { badge: 'blue', fields: 'Sufi', photo: p4 }),
    media: [],
  },
  {
    id: 106,
    content_text:
      'Beautiful recitation of Surah Al-Baqarah by Sheikh Ahmad Al-Shalabi. Press play, make wudu, and listen with your whole heart. 🌙',
    time_ago: '6h',
    like_count: 89,
    comment_count: 14,
    liked_by_me: false,
    is_public_qa: false,
    user: u(7, 'kunfai_ibrahim', 'Kunfa’i Ibrahim', { badge: 'green', scholar: true, fields: 'Sunni · Sheikh', photo: p6 }),
    youtube_url: 'https://www.youtube.com/watch?v=hwWpWoOtsBY',
    youtube_embed_url: 'https://www.youtube.com/embed/hwWpWoOtsBY',
    media: [],
  },
  {
    id: 108,
    content_text:
      'Does anyone have a good, accessible tafsir for Surah Ar-Rahman? Looking for something in English with the Arabic alongside. 📖',
    time_ago: '45m',
    like_count: 19,
    comment_count: 8,
    liked_by_me: false,
    is_public_qa: false,
    user: u(2, 'aisha_yusuf', 'Aisha Yusuf', { badge: 'blue', fields: 'Sufi', photo: p7 }),
    media: [],
  },
  {
    id: 109,
    content_text:
      'Alhamdulillah — our next community halaqah is this Thursday, 9 PM. Topic: “The manners of istikhara and making the right choice”. Bring your questions, the doors are open to everyone. 🕌',
    time_ago: '5h',
    like_count: 76,
    comment_count: 12,
    liked_by_me: false,
    is_public_qa: false,
    user: u(3, 'mayanchie12', 'Yahaya Umar', { badge: 'blue', fields: 'Sunni', photo: p2 }),
    media: [],
  },
  {
    id: 110,
    content_text:
      'Quick poll: which do you find hardest to keep — Fajr or the Du’aa after Fajr? Vote and tell us why in the comments. 🌅 #Istikhara #Halaqah',
    time_ago: '1h',
    like_count: 42,
    comment_count: 16,
    liked_by_me: false,
    is_public_qa: false,
    user: u(2, 'aisha_yusuf', 'Aisha Yusuf', { badge: 'blue', fields: 'Sufi', photo: p7 }),
    poll: {
      options: [
        { id: 1, text: 'Fajr itself', votes: 132 },
        { id: 2, text: 'The dhikr after Fajr', votes: 97 },
        { id: 3, text: 'Both, honestly', votes: 61 },
      ],
    },
    media: [],
  },
];

export type SampleComment = {
  id: number;
  name: string;
  handle: string;
  avatar?: number | string | null;
  badge?: 'blue' | 'green' | 'gold' | null;
  text: string;
  time: string;
  likes: number;
  liked?: boolean;
  replies?: SampleComment[];
};

/* Instagram-style sample comments (with nested replies + emoji). */
export interface MockProfile {
  username: string;
  full_name: string;
  badge?: BadgeType;
  fields?: string | null;
  photo?: number | null;
  bio?: string;
  location?: string;
  joined?: string;
  posts_count: number;
  followers: number;
  following: number;
  scholar?: boolean;
  scholar_title?: string;
  education?: string;
  experience?: string;
  publications?: string;
  expertise?: string;
}

export const MOCK_PROFILES: Record<string, MockProfile> = {
  alameen: {
    username: 'alameen', full_name: 'Sheikh Abdurrahman Al-Ameen', badge: 'green', fields: 'Sunni · Mufti', photo: p1,
    bio: 'Mufti & researcher in Fiqh and Aqeedah. Answering questions with mercy and evidence.',
    location: 'Owerri, Anambra · Nigeria', joined: 'Joined March 2023',
    posts_count: 214, followers: 18400, following: 320,
    scholar: true, scholar_title: 'Mufti',
    education: 'Sharia & Law, Al-Azhar University, Cairo',
    experience: 'Head Imam & Mufti, Owerri Central Masjid — 12 years',
    publications: '“Fawaat al-Masa’il” (Fiqh digest), 140+ published fatawa',
    expertise: 'Fiqh · Aqeedah · Usul al-Fiqh',
  },
  kunfai_ibrahim: {
    username: 'kunfai_ibrahim', full_name: 'Kunfa’i Ibrahim', badge: 'green', fields: 'Sunni · Sheikh', photo: p6,
    bio: 'Sheikh & teacher of Hifz. “Make your recitation your companion.”',
    location: 'Kaduna · Nigeria', joined: 'Joined January 2024',
    posts_count: 96, followers: 7200, following: 180,
    scholar: true, scholar_title: 'Sheikh',
    education: 'Hifz & Tajweed, Islamic University Madinah',
    experience: 'Hifz teacher, Al-Noor Quran Centre — 8 years',
    publications: 'Tajweed drill series (audio), 20+ recitation guides',
    expertise: 'Tajweed · Hifz · Qiraat',
  },
  salamatu_b: {
    username: 'salamatu_b', full_name: 'Salamatu Bello', badge: 'blue', fields: 'Sufi', photo: p5,
    bio: 'Writer & dhikr lover. Documenting the quiet moments that change you. ✨',
    location: 'Abuja · Nigeria', joined: 'Joined June 2024',
    posts_count: 58, followers: 2100, following: 940,
  },
  mayanchie12: {
    username: 'mayanchie12', full_name: 'Yahaya Umar', badge: 'blue', fields: 'Sunni', photo: p2,
    bio: 'Community organiser. Host of the Thursday halaqah. Ask me about events 🕌',
    location: 'Lagos · Nigeria', joined: 'Joined November 2023',
    posts_count: 74, followers: 3400, following: 610,
  },
  Gimba: {
    username: 'Gimba', full_name: 'Abdulhameed Hassan Gimba', badge: 'blue', fields: 'Sufi', photo: p4,
    bio: 'Student of knowledge. Sharing reminders from the Seerah, one lesson at a time.',
    location: 'Kano · Nigeria', joined: 'Joined August 2024',
    posts_count: 31, followers: 890, following: 450,
  },
  aisha_yusuf: {
    username: 'aisha_yusuf', full_name: 'Aisha Yusuf', badge: 'blue', fields: 'Sufi', photo: p7,
    bio: 'Tafsir reader, book hoarder, coffee-powered. Tag me in your book recs 📖',
    location: 'Ibadan · Nigeria', joined: 'Joined February 2025',
    posts_count: 22, followers: 540, following: 380,
  },
  usman_ahmad: {
    username: 'usman_ahmad', full_name: 'Usman Ahmad Kanoma', badge: 'gold', fields: 'Sunni · Sheikh', photo: p3,
    bio: 'Imam & hadith enthusiast. If it’s in Sahih, I’ll find it for you.',
    location: 'Sokoto · Nigeria', joined: 'Joined July 2023',
    posts_count: 142, followers: 9800, following: 260,
    scholar: true, scholar_title: 'Sheikh',
    education: 'Hadith & Uloom al-Hadith, University of Dar es Salaam',
    experience: 'Imam, Jamia Masjid Sokoto — 10 years',
    publications: 'Annotated hadith notebooks, 60+ community lessons',
    expertise: 'Hadith · Seerah · Fiqh',
  },
  abdalrahman: {
    username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', badge: null, fields: 'Sunni',
    bio: 'Here to learn, share and stay consistent. DeenPoints: 240 🔥',
    location: 'Abuja · Nigeria', joined: 'Joined May 2025',
    posts_count: 12, followers: 86, following: 142,
  },
};

export const MOCK_TRENDING: Array<{ tag: string; posts: string }> = [
  { tag: '#Tawbah', posts: '1.2k posts' },
  { tag: '#DailyDhikr', posts: '3.4k posts' },
  { tag: '#Seerah', posts: '860 posts' },
  { tag: '#Istikhara', posts: '2.1k posts' },
  { tag: '#Tajweed', posts: '1.7k posts' },
  { tag: '#Halaqah', posts: '540 posts' },
];

/** Accounts we follow (demo) — used by the Community “Following” tab. */
export const MOCK_FOLLOWED = ['alameen', 'salamatu_b', 'kunfai_ibrahim', 'usman_ahmad'];

export const MOCK_ACCOUNTS: Array<{ username: string; full_name: string; badge?: BadgeType; photo?: number | null; fields?: string | null }> = [
  { username: 'alameen', full_name: 'Sheikh Abdurrahman Al-Ameen', badge: 'green', photo: p1, fields: 'Sunni · Mufti' },
  { username: 'kunfai_ibrahim', full_name: 'Kunfa’i Ibrahim', badge: 'green', photo: p6, fields: 'Sunni · Sheikh' },
  { username: 'usman_ahmad', full_name: 'Usman Ahmad Kanoma', badge: 'gold', photo: p3, fields: 'Sunni · Sheikh' },
  { username: 'salamatu_b', full_name: 'Salamatu Bello', badge: 'blue', photo: p5, fields: 'Sufi' },
  { username: 'mayanchie12', full_name: 'Yahaya Umar', badge: 'blue', photo: p2, fields: 'Sunni' },
  { username: 'aisha_yusuf', full_name: 'Aisha Yusuf', badge: 'blue', photo: p7, fields: 'Sufi' },
  { username: 'Gimba', full_name: 'Abdulhameed Hassan Gimba', badge: 'blue', photo: p4, fields: 'Sufi' },
];

export const MOCK_COMMENTS: Record<number, SampleComment[]> = {
  107: [
    {
      id: 61, name: 'Yahaya Umar', handle: 'mayanchie12', avatar: p2, badge: 'blue',
      text: '“Allah looks at your hearts and your deeds” — this hit me today 🤲', time: '1h', likes: 14,
      replies: [
        { id: 62, name: 'Sheikh Abdurrahman Al-Ameen', handle: 'alameen', avatar: p1, badge: 'green', text: 'That is the essence, inshā’Allah 🌙', time: '50m', likes: 9 },
      ],
    },
    { id: 63, name: 'Aisha Yusuf', handle: 'aisha_yusuf', avatar: p7, text: 'Saving this for every time I open the mushaf 🤍', time: '40m', likes: 6 },
    { id: 64, name: 'Salamatu Bello', handle: 'salamatu_b', avatar: p5, text: 'Barakallahu feek, very clear 🕌', time: '20m', likes: 4 },
  ],
  108: [
    {
      id: 71, name: 'Kunfa’i Ibrahim', handle: 'kunfai_ibrahim', avatar: p6, badge: 'green',
      text: 'Tafsir As-Sa’di is excellent and written in plain language', time: '30m', likes: 7,
      replies: [
        { id: 72, name: 'Aisha Yusuf', handle: 'aisha_yusuf', avatar: p7, text: 'JazakAllah khair, starting tonight 📖', time: '20m', likes: 3 },
      ],
    },
    { id: 73, name: 'Usman Ahmad Kanoma', handle: 'usman_ahmad', avatar: p3, badge: 'gold', text: 'Madani tafsir app is great too — audio included', time: '15m', likes: 5 },
  ],
  109: [
    { id: 81, name: 'Maryam Sani', handle: 'maryam_sani', avatar: p4, text: 'Will be there, inshā’Allah 🕌✨', time: '4h', likes: 6 },
    {
      id: 82, name: 'Ibn Abubakar', handle: 'ibn_abubakar', avatar: p5,
      text: 'Can we get the recording afterwards for those who can’t attend?', time: '3h', likes: 4,
      replies: [
        { id: 83, name: 'Yahaya Umar', handle: 'mayanchie12', avatar: p2, badge: 'blue', text: 'Yes, we’ll share it in the group afterwards ✅', time: '2h', likes: 8 },
      ],
    },
  ],

  105: [
    {
      id: 41, name: 'Maryam Sani', handle: 'maryam_sani', avatar: p6,
      text: 'Assalamu alaikum, this picture brought tears to my eyes 🥺', time: '2h', likes: 12,
      replies: [
        { id: 42, name: 'Salamatu Bello', handle: 'salamatu_b', avatar: p5, badge: 'blue', text: 'Ameen, may we never lose that feeling 🤲', time: '1h', likes: 5 },
      ],
    },
    { id: 43, name: 'Usman Kanoma', handle: 'usman_ahmad', avatar: p3, badge: 'gold', text: 'Jumu’ah mubarak to everyone 🕌✨', time: '1h', likes: 8 },
    { id: 44, name: 'Aisha Yusuf', handle: 'aisha_yusuf', avatar: p7, text: 'Beautiful 🤍', time: '40m', likes: 3 },
  ],
  106: [
    {
      id: 51, name: 'Yahaya Umar', handle: 'mayanchie12', avatar: p2, badge: 'blue',
      text: 'Al-Shalabi’s recitation is unmatched 🎧', time: '5h', likes: 11,
    },
    { id: 52, name: 'Ibn Abubakar', handle: 'ibn_abubakar', avatar: p5, text: 'Listened twice already, jazakAllah khair 🤲', time: '4h', likes: 7,
      replies: [
        { id: 53, name: 'Kunfa’i Ibrahim', handle: 'kunfai_ibrahim', avatar: p6, badge: 'green', text: 'That is the intention, inshā’Allah 🌙', time: '3h', likes: 4 },
      ],
    },
    { id: 54, name: 'Salamatu Bello', handle: 'salamatu_b', avatar: p7, text: 'Perfect for the night before Fajr ✅', time: '2h', likes: 5 },
  ],
  101: [
    {
      id: 1, name: 'Usman Ahmad', handle: 'usman_ahmad', avatar: p3, badge: 'gold',
      text: 'Ameen, JazakAllah khair for this reminder 🤲', time: '1h', likes: 14,
      replies: [
        { id: 2, name: 'Aminu Suleiman', handle: 'alameen', avatar: p1, badge: 'green', text: 'Ameen and to you too, brother 🌙', time: '58m', likes: 6 },
      ],
    },
    {
      id: 3, name: 'Yahaya Umar', handle: 'mayanchie12', avatar: p2, badge: 'blue',
      text: 'This is the du’aa we all need this week. May Allah grant it to us all ✅', time: '1h', likes: 9,
    },
    {
      id: 4, name: 'Salamatu Bello', handle: 'salamatu_b', avatar: p5,
      text: 'SubhanAllah 🕌 I recited it this morning and felt such peace.', time: '42m', likes: 17,
      replies: [
        { id: 5, name: 'Kunfa’i Ibrahim', handle: 'kunfai_ibrahim', avatar: p6, text: 'Same here, alhamdulillah 🤍', time: '30m', likes: 4 },
        { id: 6, name: 'Aisha Yusuf', handle: 'aisha_yusuf', avatar: p7, text: 'Ameen ya Rabb 🌸', time: '12m', likes: 3 },
      ],
    },
    { id: 7, name: 'Ibn Abubakar', handle: 'ibn_abubakar', avatar: p5, text: 'Shared with my family, jazakAllah khair 📖', time: '20m', likes: 5 },
  ],
  102: [
    {
      id: 11, name: 'Abdulhameed Gimba', handle: 'gimba', avatar: p4, badge: 'blue',
      text: 'Buckle up 🚀 This hadith should be on every wall.', time: '4h', likes: 21,
      replies: [
        { id: 12, name: 'Yahaya Umar', handle: 'mayanchie12', avatar: p2, badge: 'blue', text: 'Exactly! Teaching is the best deed after prayer 🕌', time: '3h', likes: 8 },
      ],
    },
    { id: 13, name: 'Maryam Sani', handle: 'maryam_sani', avatar: p6, text: 'Ameen! Starting a hifz group with my colleagues inshā’Allah ✨', time: '3h', likes: 12 },
    { id: 14, name: 'Usman Kanoma', handle: 'usman_ahmad', avatar: p3, badge: 'gold', text: 'The Prophet ﷺ made it clear — the best of you. May we all be counted among them 🤲', time: '2h', likes: 19 },
  ],
  103: [
    {
      id: 21, name: 'Kunfa’i Ibrahim', handle: 'kunfai_ibrahim', avatar: p6,
      text: 'Very clear answer, jazakAllah khair 🙏', time: '7h', likes: 8,
      replies: [
        { id: 22, name: 'Usman Kanoma', handle: 'usman_ahmad', avatar: p3, badge: 'gold', text: 'Wallahulilm, and the scholars of each madhab have details worth studying 📚', time: '6h', likes: 11 },
      ],
    },
    { id: 23, name: 'Aisha Yusuf', handle: 'aisha_yusuf', avatar: p7, text: 'This saved my Umrah schedule, alhamdulillah 🕋', time: '5h', likes: 15 },
    { id: 24, name: 'Salamatu Bello', handle: 'salamatu_b', avatar: p5, text: 'What about combining Fajr with Dhuhr? 🤔', time: '4h', likes: 2,
      replies: [
        { id: 25, name: 'Usman Kanoma', handle: 'usman_ahmad', avatar: p3, badge: 'gold', text: 'No — only the pairs mentioned. Fajr is never combined with another prayer.', time: '3h', likes: 9 },
      ],
    },
  ],
  104: [
    {
      id: 31, name: 'Maryam Sani', handle: 'maryam_sani', avatar: p6,
      text: 'May Allah accept our Jumu’ah, ameen 🤲', time: '22h', likes: 10,
    },
    {
      id: 32, name: 'Ibn Abubakar', handle: 'ibn_abubakar', avatar: p5,
      text: 'The khutbah etiquette is often neglected. Great reminder 🕌', time: '20h', likes: 13,
      replies: [
        { id: 33, name: 'Salamatu Bello', handle: 'salamatu_b', avatar: p7, text: 'Salaam alaikum, exactly 👍', time: '18h', likes: 2 },
      ],
    },
    { id: 34, name: 'Yahaya Umar', handle: 'mayanchie12', avatar: p2, badge: 'blue', text: 'Jumu’ah Mubarak to everyone 🌙', time: '10h', likes: 7 },
  ],
};

export const MOCK_VIDEOS: Video[] = [
  {
    id: 1,
    video_type: 'daily',
    title: 'Surah Yasin — Beautiful Recitation',
    description: 'A soul-stirring recitation of Surah Yasin. Listen with khushoo’ and make du’aa.',
    poster_url: null,
    thumb: vidYasin,
    source_url: 'https://www.youtube.com/watch?v=0R1LKPRwxR4',
    embed_url: 'https://www.youtube.com/embed/0R1LKPRwxR4',
    duration: '27:32',
    view_count: 1840,
    like_count: 96,
  },
  {
    id: 2,
    video_type: 'daily',
    title: 'Asma-ul-Husna — The 99 Names of Allah',
    description: 'Reflect on the most beautiful names of Allah, one day at a time.',
    poster_url: null,
    thumb: vid99,
    source_url: 'https://www.youtube.com/watch?v=ta_tTZrarE0',
    embed_url: 'https://www.youtube.com/embed/ta_tTZrarE0',
    duration: '19:08',
    view_count: 3210,
    like_count: 210,
  },
  {
    id: 3,
    video_type: 'daily',
    title: 'Return to Allah — Daily Reminder',
    description: 'A short reminder: however far we stray, the door of tawbah is open.',
    poster_url: null,
    thumb: vidReturn,
    source_url: 'https://www.youtube.com/watch?v=tlG38jgInLc',
    embed_url: 'https://www.youtube.com/embed/tlG38jgInLc',
    duration: '1:12',
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
