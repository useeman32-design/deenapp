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

/* pass 44 — when the web app is self-hosted on app.deenlink.org it talks to its
   SAME origin (no CORS); anywhere else (gh-pages, native) use the env/prod API. */
const BASE =
  typeof window !== 'undefined' && /^https?:\/\/app\.deenlink\.org$/.test(window.location.origin)
    ? window.location.origin
    : ((process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'https://deenlink.org');
const TIMEOUT = 9000;

/**
 * FORCE_DEMO — mock-only mode.
 * Real authentication runs on the production app domain (app.deenlink.org),
 * where the API is same-origin. Everywhere else (GitHub Pages preview,
 * localhost) stays in demo mode so the UI is explorable without a backend.
 */
const IS_APP_DOMAIN =
  typeof window !== 'undefined' && /^https?:\/\/app\.deenlink\.org$/.test(window.location.origin);
export const FORCE_DEMO = !IS_APP_DOMAIN;

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

async function request<T = Record<string, unknown>>(path: string, opts: ReqOptions = {}, _retried = false): Promise<ApiResult<T>> {
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
      credentials: 'include', // always send the httpOnly session cookie (web)
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

  // pass 50 — the cached CSRF token can go stale (server rotated it, or the
  // session was regenerated). On a CSRF rejection, refresh the token and retry
  // the write once so profile edits don't fail with "invalid CSRF token".
  const _msg = String((data as { message?: string })?.message ?? '');
  const _isWrite = opts.method === 'POST' || opts.body !== undefined || !!opts.form;
  if (!_retried && _isWrite && (res.status === 403 || /csrf/i.test(_msg))) {
    const fresh = await fetchCsrf();
    if (fresh) return request<T>(path, opts, true);
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
  if (saved) session = saved;
  csrf = (await storage.getItem('dl.csrf')) || null;

  // On web the server's session cookie is httpOnly, so JS can't read it and
  // `dl.session` may be empty after a refresh — but the browser still sends the
  // cookie automatically. So ALWAYS probe /me instead of bailing (which used to
  // log the user out on every page refresh).
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

/** A public question answered by a DeenLink scholar — a "direct fatwa". */
export type DirectFatwa = {
  id: number;
  title: string;
  preview: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  answered_time_ago: string;
  scholar: { id: number; name: string; username: string; profile_image_url: string | null; country?: string };
};

/** Direct fatwas — public questions answered by verified DeenLink scholars
 * (api/questions/public_list.php). Empty in demo/offline mode. */
export async function directFatwas(limit = 30): Promise<DirectFatwa[]> {
  const r = await request<{ status?: string; questions?: DirectFatwa[] }>(
    `/api/questions/public_list.php?limit=${limit}&sort=newest`,
  );
  if (r.ok && Array.isArray(r.data.questions)) return r.data.questions;
  return [];
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
  security_question?: string;
  security_answer?: string;
  security_question_2?: string;
  security_answer_2?: string;
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

export async function uploadProfileImage(uri: string, name: string, type: string): Promise<{ ok: boolean; url?: string; message?: string }> {
  if (FORCE_DEMO) return { ok: false, message: 'Photo upload needs the live API' };
  await fetchCsrf(); // upload_profile_image.php requires the CSRF token
  const form = new FormData();
  // React Native file part
  form.append('profile_image', { uri, name, type } as unknown as Blob);
  const r = await request<{ status?: string; profile_image_url?: string; message?: string }>('/api/users/upload_profile_image.php', {
    method: 'POST',
    form,
  });
  if (r.ok && r.data.profile_image_url) return { ok: true, url: r.data.profile_image_url };
  return { ok: false, message: r.data?.message ?? 'Upload failed' };
}

export async function getSecurityQuestion(identifier: string): Promise<{ ok: boolean; found?: boolean; question?: string; message?: string }> {
  if (FORCE_DEMO) return { ok: false, message: 'Account recovery needs the live API' };
  const r = await request<{ status?: string; found?: boolean; security_question?: string; message?: string }>('/api/auth/get_security_question.php', {
    method: 'POST',
    body: { identifier },
  });
  if (r.ok) return { ok: true, found: r.data.found, question: r.data.security_question, message: r.data.message };
  return { ok: false, message: r.data?.message };
}

export async function recoverPassword(identifier: string, answer: string, password: string, confirmPassword: string): Promise<{ ok: boolean; message?: string }> {
  if (FORCE_DEMO) return { ok: false, message: 'Account recovery needs the live API' };
  const r = await request<{ status?: string; message?: string }>('/api/auth/recover_password.php', {
    method: 'POST',
    body: { identifier, answer, password, confirm_password: confirmPassword },
  });
  if (r.ok) return { ok: true, message: r.data.message };
  return { ok: false, message: r.data?.message ?? 'Could not reset password' };
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

/** Award DeenPoints for an activity — server-side, idempotent per activity per day. */
export async function awardDeenPoints(activity: string): Promise<{ ok: boolean; awarded?: number; balance?: number }> {
  if (FORCE_DEMO) return { ok: true, awarded: 0 };
  const r = await request<{ status?: string; awarded?: number; new_balance?: number }>('/api/deenpoints/award.php', {
    method: 'POST',
    body: { activity },
  });
  return { ok: r.ok, awarded: r.data.awarded, balance: r.data.new_balance };
}

/** pass 49 — register this device's Expo push token so the server can deliver mobile push. */
export async function registerPushToken(token: string, platform?: string): Promise<{ ok: boolean }> {
  if (FORCE_DEMO) return { ok: true };
  const r = await request<{ status?: string }>('/api/notifications/register_expo.php', {
    method: 'POST',
    body: { token, platform: platform ?? '' },
  });
  return { ok: r.ok };
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
/** Poll whether an email has been verified (via OTP or the email link). */
export async function checkEmailVerified(email: string): Promise<boolean> {
  const r = await request<{ verified?: boolean; is_email_verified?: number }>(`/api/auth/check_email_verified.php?email=${encodeURIComponent(email)}`);
  return !!r.ok && (r.data.verified === true || Number(r.data.is_email_verified) === 1);
}

/** Real-time username availability against the live database. */
export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; message?: string }> {
  if (FORCE_DEMO) return { available: true };
  const r = await request<{ available?: boolean; message?: string }>('/api/auth/check_username.php', {
    method: 'POST',
    body: { username },
  });
  if (r.ok) return { available: !!r.data.available, message: r.data.message };
  return { available: false, message: r.data?.message ?? 'Could not check username' };
}

/** Real-time email availability against the live database. */
export async function checkEmailAvailable(email: string): Promise<{ available: boolean; message?: string }> {
  if (FORCE_DEMO) return { available: true };
  const r = await request<{ available?: boolean; message?: string }>('/api/auth/check_email.php', {
    method: 'POST',
    body: { email },
  });
  if (r.ok) return { available: !!r.data.available, message: r.data.message };
  return { available: false, message: r.data?.message ?? 'Could not check email' };
}
export async function verifyOtp(email: string, code: string): Promise<{ ok: boolean; verified?: boolean; message?: string; wrong?: boolean; expired?: boolean; networkError?: boolean }> {
  const r = await request<{ status?: string; message?: string; verified?: boolean; wrong?: boolean; expired?: boolean }>('/api/auth/verify_otp.php', { body: { email, code } });
  return { ok: r.ok, verified: !!r.data.verified, message: r.data.message, wrong: !!r.data.wrong, expired: !!r.data.expired, networkError: r.networkError };
}

/** Request an email change — the server emails a confirmation link to the CURRENT address. */
export async function requestEmailChange(oldEmail: string, newEmail: string): Promise<{ ok: boolean; message?: string }> {
  if (FORCE_DEMO) return { ok: true, message: 'Saved (demo mode)' };
  const r = await request<{ status?: string; message?: string }>('/api/auth/change_email.php', { body: { old_email: oldEmail, new_email: newEmail } });
  return { ok: r.ok, message: r.data.message };
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

/* pass 44 — admin-managed app defaults (Slice 4): rotating goal sets + quick-access defaults */
export type AppDefaults = { goal_sets?: string[][]; quick_defaults?: string[] };
export async function appDefaults(): Promise<AppDefaults | null> {
  const r = await request<{ status?: string; goal_sets?: string[][]; quick_defaults?: string[] }>('/api/defaults/get.php');
  if (r.ok && (Array.isArray(r.data.goal_sets) || Array.isArray(r.data.quick_defaults))) return r.data;
  return null;
}

export async function prayerTimesCached(locationHash: string): Promise<PrayerTimesResponse | null> {
  const r = await request<PrayerTimesResponse>(`/api/get_prayer_times.php?locationHash=${encodeURIComponent(locationHash)}`);
  return r.ok && r.data.times ? r.data : null;
}

/* Slice 9 — live chat (DM + group). */
export type ChatConversation = { id: number; type: 'dm' | 'group'; title: string; last_body: string | null; peer: { id: number; username: string } | null; with_username?: string; with_photo?: string | null; peer_seen?: string | null; kind?: string };
export type ChatMessage = { id: number; sender_id: number; body: string; media_url: string | null; created_at: string; username?: string; read_at?: string | null; deleted?: boolean; reply_to?: { id: number; kind: 'msg' | 'share'; body: string; username: string | null } | null };
export async function chatConversations(): Promise<ChatConversation[] | null> {
  const r = await request<{ status?: string; conversations?: ChatConversation[] }>('/api/chat/conversations.php', { auth: true });
  return r.ok && Array.isArray(r.data.conversations) ? r.data.conversations : null;
}
export async function chatMessages(conversationId: number): Promise<ChatMessage[] | null> {
  const r = await request<{ status?: string; messages?: ChatMessage[] }>(`/api/chat/messages.php?conversation_id=${conversationId}`, { auth: true });
  return r.ok && Array.isArray(r.data.messages) ? r.data.messages : null;
}
export async function chatStartDM(userId: number): Promise<number | null> {
  const r = await request<{ status?: string; conversation_id?: number }>('/api/chat/start.php', { method: 'POST', body: { user_id: userId }, auth: true });
  return r.ok && r.data.conversation_id ? (r.data.conversation_id as number) : null;
}
/** pass 60 — open (or reuse) a DM by USERNAME. The app navigates profiles by
 *  username, so the id is resolved server-side and never exposed to the client. */
export async function chatStartDMByUsername(username: string): Promise<number | null> {
  const r = await request<{ status?: string; conversation_id?: number }>('/api/chat/start_username.php', { method: 'POST', body: { username }, auth: true });
  return r.ok && r.data.conversation_id ? (r.data.conversation_id as number) : null;
}
export async function chatSend(conversationId: number, body: string, replyTo?: { id: number; kind: 'msg' | 'share' }): Promise<{ id: number; created_at?: string } | null> {
  const r = await request<{ status?: string; id?: number; created_at?: string }>('/api/chat/send.php', { method: 'POST', body: { conversation_id: conversationId, body, reply_to_id: replyTo?.id, reply_to_kind: replyTo?.kind }, auth: true });
  return r.ok && r.data.id ? { id: r.data.id as number, created_at: r.data.created_at } : null;
}
/** pass 63 — delete YOUR OWN message or share. Soft delete: the slot stays and
 *  the thread shows "Message deleted", the text is withheld server-side. */
export async function chatDelete(conversationId: number, targetKind: 'msg' | 'share', targetId: number): Promise<boolean> {
  const r = await request<{ status?: string }>('/api/chat/delete.php', { method: 'POST', body: { conversation_id: conversationId, target_kind: targetKind, target_id: targetId }, auth: true });
  return r.ok;
}
/* pass 62 — in-app shares and emoji reactions, server-backed so BOTH sides of a
 * conversation see the same thread instead of two local-only copies. */
export type ChatShare = { id: number; sender_id: number; kind: string; title: string; payload: Record<string, string> | null; created_at: string; username?: string; deleted?: boolean };
export type ChatReaction = { target_kind: 'msg' | 'share'; target_id: number; user_id: number; emoji: string; username?: string | null };
export type ChatThreadData = { messages: ChatMessage[]; shares: ChatShare[]; reactions: ChatReaction[] };
/** One round trip for a whole thread: messages + shares + every reaction on them. */
export async function chatThread(conversationId: number): Promise<ChatThreadData | null> {
  const r = await request<{ status?: string; messages?: ChatMessage[]; shares?: ChatShare[]; reactions?: ChatReaction[] }>(`/api/chat/messages.php?conversation_id=${conversationId}`, { auth: true });
  if (!r.ok || !Array.isArray(r.data.messages)) { return null; }
  return {
    messages: r.data.messages,
    shares: Array.isArray(r.data.shares) ? r.data.shares : [],
    reactions: Array.isArray(r.data.reactions) ? r.data.reactions : [],
  };
}
/** Share in-app content into a conversation. Returns its server id + timestamp. */
export async function chatSendShare(conversationId: number, kind: string, title: string, payload?: Record<string, unknown>): Promise<{ id: number; created_at?: string } | null> {
  const r = await request<{ status?: string; id?: number; created_at?: string }>('/api/chat/send_share.php', { method: 'POST', body: { conversation_id: conversationId, kind, title, payload }, auth: true });
  return r.ok && r.data.id ? { id: r.data.id as number, created_at: r.data.created_at } : null;
}
/** React to a message ('msg') or a share ('share'). emoji '' removes MY reaction. */
export async function chatReact(conversationId: number, targetKind: 'msg' | 'share', targetId: number, emoji: string): Promise<{ ok: boolean; emoji: string | null }> {
  const r = await request<{ status?: string; emoji?: string | null }>('/api/chat/react.php', { method: 'POST', body: { conversation_id: conversationId, target_kind: targetKind, target_id: targetId, emoji }, auth: true });
  return { ok: r.ok, emoji: r.ok && r.data.emoji ? String(r.data.emoji) : null };
}
export async function chatRead(conversationId: number): Promise<void> { await request('/api/chat/read.php', { method: 'POST', body: { conversation_id: conversationId }, auth: true }); }
export async function chatPresence(): Promise<void> { await request('/api/chat/presence.php', { method: 'POST', auth: true }); }
/** Shared AI answer cache (live app only) — serves repeated/similar questions without an API call. */
export async function aiCacheLookup(q: string): Promise<string | null> {
  const r = await request<{ hit?: boolean; answer?: string }>(`/api/deenai/cache_lookup.php?q=${encodeURIComponent(q)}`);
  return r.ok && r.data.hit && r.data.answer ? String(r.data.answer) : null;
}
export async function aiCacheSave(question: string, answer: string): Promise<void> { await request('/api/deenai/cache_save.php', { method: 'POST', body: { question, answer } }); }

/* pass 53 — server-side AI using DB-stored Groq key (no manual key entry) */
export async function deenAiChatServer(question: string, messages?: Array<{ role: string; content: string }>, model?: string): Promise<{ ok: boolean; answer?: string; model?: string; error?: string }> {
  const r = await request<{ status?: string; answer?: string; model?: string; message?: string }>(`/api/deenai/chat.php`, {
    method: 'POST',
    body: { question, messages, model },
  });
  if (r.ok && r.data.answer) return { ok: true, answer: r.data.answer, model: r.data.model };
  return { ok: false, error: r.data.message ?? (r.networkError ? 'Offline' : 'AI unavailable') };
}

/* Slice 7 — admin-managed Prophets stories chapters; null when offline/empty so the bundled files stay. */
export type AdminProphetChapter = { slug: string; name: string; n: number; source: string; paras: string[]; summary_ha: string };
export async function prophetChapters(): Promise<AdminProphetChapter[] | null> {
  const r = await request<{ status?: string; chapters?: AdminProphetChapter[] }>('/api/prophets/list.php');
  if (r.ok && Array.isArray(r.data.chapters) && r.data.chapters.length > 0) return r.data.chapters;
  return null;
}
export async function prophetFull(slug: string): Promise<AdminProphetChapter | null> {
  const r = await request<{ status?: string; chapter?: AdminProphetChapter }>(`/api/prophets/get.php?slug=${encodeURIComponent(slug)}`);
  if (r.ok && r.data.chapter) return r.data.chapter;
  return null;
}

/* Slice 6 — admin-managed Names of Allah additions; null when offline/empty so the bundled set stays. */
export type AdminName = { number: number; name: string; transliteration: string; translation: string; meaning: string };
export async function namesOfAllah(): Promise<AdminName[] | null> {
  const r = await request<{ status?: string; names?: AdminName[] }>('/api/names/list.php');
  if (r.ok && Array.isArray(r.data.names) && r.data.names.length > 0) return r.data.names;
  return null;
}

/* Slice 5 — admin-managed Duas & Athkar additions; null when offline/empty so the bundled set stays. */
export type AdminAthkar = { group: string; name: string; arabic: string; transliteration: string; translation: string; note: string; count: number };
export type AdminAthkarDuas = { athkar: AdminAthkar[]; duas: AdminAthkar[] };
export async function athkarDuas(): Promise<AdminAthkarDuas | null> {
  const r = await request<{ status?: string; athkar?: AdminAthkar[]; duas?: AdminAthkar[] }>('/api/athkar/list.php');
  if (r.ok && (Array.isArray(r.data.athkar) || Array.isArray(r.data.duas)))
    return { athkar: r.data.athkar ?? [], duas: r.data.duas ?? [] };
  return null;
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
