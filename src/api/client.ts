/**
 * DeenLink API client — session + CSRF based, per the OpenAPI contract.
 *
 * Auth model (same as the web frontend):
 *  - POST /api/auth/login.php {identifier, password, remember_me}
 *    → JSON body; the `deenlink_session` cookie is captured from Set-Cookie
 *      and re-sent manually on every request (works cross-platform without
 *      a cookie jar).
 *  - Write endpoints need the X-CSRF-Token header (GET /api/auth/csrf.php).
 *
 * Demo mode: when the network is unreachable (offline / no API), every
 * call resolves against bundled mock data and `isDemo()` is true, so the
 * UI always works in previews.
 */

import { storage } from '@/lib/storage';
import {
  MOCK_COURSES,
  MOCK_EVENTS,
  type EventItem,
  MOCK_FEED,
  MOCK_SCHOLARS,
  MOCK_USER,
  MOCK_VIDEOS,
  MOCK_WALLPAPERS,
} from '@/api/mocks';
import type {
  Course,
  FeedResponse,
  FeedTab,
  PrayerTimesResponse,
  Post,
  Scholar,
  User,
  Video,
} from '@/api/types';

const BASE = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'https://deenlink.org';
const TIMEOUT = 9000;

/**
 * FORCE_DEMO — mock-only mode.
 * While true, NO network request is ever made: every call resolves against
 * bundled mock data and the signed-in user is the demo profile.
 * Flip to false to go live against deenlink.org.
 */
export const FORCE_DEMO = true;

let session: string | null = null;
let csrf: string | null = null;
let live = false; // true once we've reached the real API this session

export const isLive = () => live;

interface ReqOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  form?: FormData;
  auth?: boolean;
}

export interface ApiResult<T> {
  ok: boolean;
  data: T;
  networkError: boolean;
  httpStatus?: number;
}

async function request<T = Record<string, unknown>>(path: string, opts: ReqOptions = {}): Promise<ApiResult<T>> {
  // Mock-only mode: never touch the network; every caller falls back to bundled data.
  if (FORCE_DEMO) return { ok: false, data: {} as T, networkError: true };

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (session) headers['Cookie'] = `deenlink_session=${session}`;
  if (opts.method === 'POST' && csrf) headers['X-CSRF-Token'] = csrf;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ? opts.form : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return { ok: false, data: {} as T, networkError: true };
  }
  clearTimeout(timer);

  // Capture / refresh the session cookie
  const setCookie = res.headers.get('set-cookie') ?? '';
  const m = setCookie.match(/deenlink_session=([^;,\s]+)/);
  if (m && m[1] !== 'deleted') session = m[1];

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }

  if (res.ok) live = true;
  if (res.status === 401) {
    session = null;
    csrf = null;
  }

  return {
    ok: res.ok && !(typeof (data as { status?: string })?.status === 'string' && (data as { status: string }).status === 'error'),
    data,
    networkError: false,
    httpStatus: res.status,
  };
}

/* ------------------------------- Session ------------------------------ */

export async function restoreSession(): Promise<{ user: User | null; ok: boolean }> {
  if (FORCE_DEMO) {
    // Demo session persists after the first sign-in, so the (redesigned)
    // login screen is shown once — not on every single boot.
    const saved = await storage.getItem('dl.demoSession');
    return saved === '1' ? { user: MOCK_USER, ok: false } : { user: null, ok: false };
  }

  const saved = await storage.getItem('dl.session');
  if (!saved) return { user: null, ok: false };
  session = saved;
  csrf = (await storage.getItem('dl.csrf')) || null;

  const me = await request<{ status: string; user?: User }>('/api/auth/me.php');
  if (me.ok && me.data.user) return { user: me.data.user, ok: true };

  if (!me.networkError) {
    // Server says the session is invalid.
    session = null;
    csrf = null;
    return { user: null, ok: false };
  }

  // Offline → demo mode with the stored profile.
  const u = await storage.getItem('dl.user');
  return { user: u ? (JSON.parse(u) as User) : null, ok: false };
}

export function setSession(s: string | null, c?: string | null) {
  session = s;
  if (c !== undefined) csrf = c;
}

export const currentSession = () => session;

export async function fetchCsrf(): Promise<string | null> {
  const r = await request<{ status: string; csrf_token?: string }>('/api/auth/csrf.php');
  if (r.ok && r.data.csrf_token) {
    csrf = r.data.csrf_token;
    return csrf;
  }
  return csrf;
}

export async function login(identifier: string, password: string, rememberMe = true) {
  const r = await request<{ status: string; user?: User; message?: string }>('/api/auth/login.php', {
    method: 'POST',
    body: { identifier, password, remember_me: rememberMe },
  });
  if (r.ok && r.data.user) {
    live = true;
    await fetchCsrf();
    return { ok: true as const, user: r.data.user, demo: false };
  }
  if (r.networkError && FORCE_DEMO) await storage.setItem('dl.demoSession', '1');
  return {
    ok: false as const,
    user: null,
    demo: r.networkError,
    message: r.data.message ?? (r.networkError ? 'Offline — demo mode' : 'Invalid credentials'),
  };
}

export async function register(payload: {
  full_name: string;
  email: string;
  username: string;
  password: string;
  aqeedah?: string;
  country?: string;
  gender?: string;
}) {
  const r = await request<{ status: string; user?: User; message?: string }>('/api/auth/register.php', {
    method: 'POST',
    body: {
      full_name: payload.full_name,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      confirm_password: payload.password,
      agree_terms: true,
      aqeedah: payload.aqeedah ?? 'Sunni',
      country: payload.country,
      gender: payload.gender,
    },
  });
  if (r.ok && r.data.user) {
    live = true;
    await fetchCsrf();
    return { ok: true as const, user: r.data.user, demo: false };
  }
  if (r.networkError && FORCE_DEMO) await storage.setItem('dl.demoSession', '1');
  return {
    ok: false as const,
    user: null,
    demo: r.networkError,
    message: r.data.message ?? (r.networkError ? 'Offline — demo mode' : 'Registration failed'),
  };
}

export async function logout() {
  await request('/api/auth/logout.php', { method: 'POST' });
  session = null;
  csrf = null;
  if (FORCE_DEMO) await storage.removeItem('dl.demoSession');
}

/* -------------------------------- Feed -------------------------------- */

export async function feed(tab: FeedTab = 'for-you', cursor = 0): Promise<FeedResponse> {
  const r = await request<FeedResponse>(`/api/feed/get_posts.php?tab=${tab}&limit=20&cursor=${cursor}`);
  if (r.ok && Array.isArray(r.data.posts)) return r.data;
  return {
    status: 'success',
    posts: MOCK_FEED.filter((p) => (tab === 'for-you' ? true : tab === 'scholars' ? p.user.scholar : p.user.verification_badge)),
    next_cursor: null,
  };
}

export async function toggleLike(postId: number, desired: boolean): Promise<{ like_count: number; liked_by_me: boolean }> {
  const r = await request<{ like_count?: number; liked_by_me?: boolean; status?: string }>(
    '/api/feed/toggle_like.php',
    { method: 'POST', body: { post_id: postId, desired_liked: desired } },
  );
  if (r.ok) return { like_count: r.data.like_count ?? 0, liked_by_me: r.data.liked_by_me ?? desired };
  return { like_count: 0, liked_by_me: desired };
}

export async function createPost(contentText: string, youtubeUrl?: string): Promise<{ ok: boolean; post?: Post }> {
  const form = new FormData();
  if (contentText) form.append('content_text', contentText);
  if (youtubeUrl) form.append('youtube_url', youtubeUrl);
  const r = await request<{ status?: string; post?: Post; id?: number }>('/api/feed/create_post.php', {
    method: 'POST',
    form,
  });
  if (r.ok) return { ok: true, post: r.data.post };
  return { ok: false };
}

/* --------------------------- Other endpoints --------------------------- */

export async function videos(type: 'daily' | 'reel' | 'all' = 'daily'): Promise<Video[]> {
  const r = await request<{ status?: string; videos?: Video[] }>(`/api/videos/list.php?type=${type}&limit=20&source=homepage`);
  if (r.ok && Array.isArray(r.data.videos)) return r.data.videos;
  return MOCK_VIDEOS;
}

export async function courses(): Promise<Course[]> {
  const r = await request<{ status?: string; courses?: Course[] }>('/api/courses/list.php');
  if (r.ok && Array.isArray(r.data.courses)) return r.data.courses;
  return MOCK_COURSES;
}

export async function userPosts(): Promise<Post[]> {
  const r = await request<{ status?: string; posts?: Post[]; data?: Post[] }>('/api/feed/get_user_posts.php');
  if (r.ok) {
    const list = r.data.posts ?? r.data.data;
    if (Array.isArray(list)) return list;
  }
  return MOCK_FEED.filter((p) => p.user.username === (MOCK_USER.username ?? ''));
}

export async function profileCounts(): Promise<{ posts: number; followers: number; following: number; donations: number }> {
  const r = await request<{ status?: string; counts?: { posts?: number; followers?: number; following?: number; donations?: number } }>(
    '/api/users/get_profile_counts.php',
  );
  const c = r.ok ? r.data.counts : null;
  return {
    posts: c?.posts ?? 3,
    followers: c?.followers ?? 128,
    following: c?.following ?? 96,
    donations: c?.donations ?? 5,
  };
}

export async function scholars(): Promise<Scholar[]> {
  const r = await request<{ status?: string; scholars?: Scholar[]; data?: Scholar[] }>('/api/questions/scholars.php');
  if (r.ok) {
    const list = r.data.scholars ?? r.data.data;
    if (Array.isArray(list) && list.length) return list;
  }
  return MOCK_SCHOLARS;
}

export async function submitQuestion(payload: {
  scholar_id: number;
  title: string;
  details: string;
  privacy?: 'public' | 'private';
  category?: string;
}): Promise<{ ok: boolean; demo?: boolean }> {
  const r = await request<{ status?: string; message?: string }>('/api/questions/submit.php', {
    method: 'POST',
    body: { privacy: 'public', ...payload },
  });
  if (r.ok) return { ok: true };
  return { ok: false, demo: true };
}

export async function updateProfile(payload: {
  full_name?: string;
  username?: string;
  bio?: string;
  aqeedah?: string;
  phone?: string;
  hide_charity_balance?: boolean;
}): Promise<{ ok: boolean; user?: User; message?: string }> {
  if (FORCE_DEMO) {
    return { ok: true, user: { ...MOCK_USER, ...payload } as User, message: 'Saved (demo mode)' };
  }
  const r = await request<{ status?: string; message?: string; user?: User }>('/api/users/update_profile.php', {
    method: 'POST',
    body: payload,
  });
  if (r.ok) {
    live = true;
    return { ok: true, user: r.data.user, message: r.data.message };
  }
  return { ok: false, message: r.data?.message };
}

export async function dailyCheckin(): Promise<{ ok: boolean; points?: number }> {
  if (FORCE_DEMO) return { ok: true, points: 1 };
  const r = await request<{ status?: string; points?: number; deenpoints?: number }>('/api/users/daily_checkin.php', {
    method: 'POST',
    body: {},
  });
  if (r.ok) {
    live = true;
    return { ok: true, points: r.data.points ?? r.data.deenpoints ?? 1 };
  }
  return { ok: false };
}

export async function events(): Promise<EventItem[]> {
  const r = await request<{ status?: string; events?: EventItem[] }>('/api/events/list.php');
  if (r.ok && Array.isArray(r.data.events) && r.data.events.length > 0) return r.data.events;
  return MOCK_EVENTS; // Slice 3 — admin-managed events; sample list is the fallback
}

export async function wallpapers() {
  return MOCK_WALLPAPERS;
}

export async function unreadNotifications(): Promise<number> {
  const r = await request<{ status?: string; unread_count?: number }>('/api/notifications/unread_count.php');
  return r.ok ? r.data.unread_count ?? 0 : 0;
}

export async function announcement(): Promise<string | null> {
  const r = await request<{ status?: string; text?: string; announcement?: string }>('/api/announcements/active.php');
  if (r.ok) return r.data.text ?? r.data.announcement ?? null;
  return null;
}

/* pass 44 — 6-digit email OTP for registration (api/auth/send_otp.php + verify_otp.php). */
export async function sendOtp(email: string): Promise<{ ok: boolean; message?: string; already?: boolean; networkError?: boolean }> {
  const r = await request<{ status?: string; message?: string; already?: boolean }>('/api/auth/send_otp.php', { body: { email } });
  return { ok: r.ok, message: r.data.message, already: !!r.data.already, networkError: r.networkError };
}
export async function verifyOtp(email: string, code: string): Promise<{ ok: boolean; verified?: boolean; message?: string; wrong?: boolean; expired?: boolean; networkError?: boolean }> {
  const r = await request<{ status?: string; message?: string; verified?: boolean; wrong?: boolean; expired?: boolean }>('/api/auth/verify_otp.php', { body: { email, code } });
  return { ok: r.ok, verified: !!r.data.verified, message: r.data.message, wrong: !!r.data.wrong, expired: !!r.data.expired, networkError: r.networkError };
}
export type Campaign = { key: string; title: string; subtitle?: string; imageUrl?: string; href?: string };

/* pass 44 — Learning Hub sections managed by the admin (api/learning/list.php) */
export type LearningSection = {
  kind: 'quick' | 'library';
  title: string;
  subtitle?: string | null;
  iconKey?: string | null;
  gradFrom?: string | null;
  gradTo?: string | null;
  chip?: string | null;
  cta?: string | null;
  href?: string | null;
};
export async function campaigns(): Promise<Campaign[] | null> {
  const r = await request<{ status?: string; campaigns?: Campaign[] }>('/api/campaigns/list.php');
  if (r.ok && Array.isArray(r.data.campaigns) && r.data.campaigns.length > 0) return r.data.campaigns;
  return null;
}

/** Admin-managed Learning Hub sections; null when offline/empty so the bundled list stays. */
export async function learningSections(): Promise<LearningSection[] | null> {
  const r = await request<{ status?: string; sections?: LearningSection[] }>('/api/learning/list.php');
  if (r.ok && Array.isArray(r.data.sections) && r.data.sections.length > 0) return r.data.sections;
  return null;
}

export async function prayerTimesCached(locationHash: string): Promise<PrayerTimesResponse | null> {
  const r = await request<PrayerTimesResponse>(`/api/get_prayer_times.php?locationHash=${encodeURIComponent(locationHash)}`);
  return r.ok && r.data.times ? r.data : null;
}

/* ----------------------------- Persistence ---------------------------- */

export async function persistSession(s: string, c: string | null, user: User) {
  await storage.setItem('dl.session', s);
  if (c) await storage.setItem('dl.csrf', c);
  await storage.setItem('dl.user', JSON.stringify(user));
}

export async function clearSession() {
  await storage.removeItem('dl.session');
  await storage.removeItem('dl.csrf');
  session = null;
  csrf = null;
}

/* ------------------- Namespace (back-compat) ------------------------ */
/* Older screens import { api } from '@/api/client' — keep that shape. */

export const api = {
  isLive,
  login,
  register,
  logout,
  feed,
  userPosts,
  profileCounts,
  toggleLike,
  createPost,
  videos,
  courses,
  scholars,
  submitQuestion,
  updateProfile,
  dailyCheckin,
  wallpapers,
  unreadNotifications,
  announcement,
  prayerTimesCached,
};
