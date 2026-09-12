/**
 * Demo data — REMOVED from the live app (pass 83-38: "we will only serve
 * real data"). What remains:
 *   • the TYPES the app still compiles against (SampleComment, MockProfile,
 *     MockReel, EventItem, Wallpaper, QuizQuestion),
 *   • MOCK_USER + the demo-session flags, used ONLY by FORCE_DEMO preview
 *     builds (never on the app domains — see client.ts IS_APP_DOMAIN),
 *   • MOCK_WALLPAPERS: bundled Qur'an wallpapers, a real shipped feature.
 * Every fabricated post/comment/account/video/reel roster is gone; screens
 * render what the server returns, with honest empty states.
 */
import type { Course, Post, Scholar, User, Video } from '@/api/types';

/* ---- types kept for existing screens ---- */
export type SampleComment = {
  id: number;
  name: string;
  handle: string;
  avatar?: number | string | null;
  badge?: 'blue' | 'green' | 'gold' | null;
  text: string;
  /** bundled animated sticker (pass 20 GIF comments) */
  gif?: number;
  /** pass 42 — in-app route for AI comment answers ("Open" button) */
  nav?: string;
  time: string;
  likes: number;
  liked?: boolean;
  replies?: SampleComment[];
  parentId?: number | null;
};

export interface MockProfile {
  username: string;
  full_name: string;
  badge?: import('@/api/types').BadgeType;
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

export interface MockReel {
  id: number;
  src: number | { uri: string };
  poster: number | { uri: string };
  /** watermarked copy used for downloads (legacy bundled samples only) */
  wm?: number;
  /** friend who reposted this reel into your feed (tiktok-style pill) */
  repostedBy?: string;
  username: string;
  caption: string;
  likes: number;
  comments: number;
  saves: number;
  views: number;
  music: string;
  /* real server reels merged into the feed carry these */
  liveId?: number;
  accountName?: string;
  accountPic?: string | null;
  reposts?: number;
  groupId?: number;
  groupName?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface EventItem {
  id: number;
  title: string;
  date: string;
  location: string;
  kind: 'Holiday' | 'Lecture' | 'Community' | 'Study';
  color: string;
}

export interface Wallpaper {
  id: number;
  arabic: string;
  caption: string;
  from: string;
}

/* ---- preview-only identity (FORCE_DEMO builds never run on the app domains) ---- */
export const MOCK_USER: User = {
  id: 1,
  username: 'demo',
  full_name: 'Demo User',
  email: 'demo@deenlink.org',
  user_type: 'user',
  deenpoints_balance: 0,
  is_email_verified: 1,
  account_status: 'active',
} as unknown as User;

/* ---- bundled Qur'an wallpaper tiles (real shipped feature, not demo data) ---- */
export const MOCK_WALLPAPERS: Wallpaper[] = [
  { id: 1, arabic: 'اَللّٰهُ', caption: 'Allah', from: 'linear-gradient(160deg, #0b3d25, #1D6F42)' },
  { id: 2, arabic: 'اَلصَّٰبَرِيْنَ', caption: 'For the patient', from: 'linear-gradient(160deg, #1a2a6c, #b8860b)' },
  { id: 3, arabic: 'سُبْحَانَ اللّٰهِ', caption: 'Glory be to Allah', from: 'linear-gradient(160deg, #232526, #414345)' },
  { id: 4, arabic: 'اَلْحَمْدُ لِلّٰهِ', caption: 'Praise be to Allah', from: 'linear-gradient(160deg, #5614b0, #dbd65c)' },
];

/* ---- legacy shapes referenced by removed code (kept for tsc hygiene) ---- */
export type LegacyPost = Post;
export type LegacyCourse = Course;
export type LegacyScholar = Scholar;
export type LegacyVideo = Video;
