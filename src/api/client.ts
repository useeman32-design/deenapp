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
  /* pass 66-night — an UNVERIFIED account gets 403 needs_verification: the UI
   * resumes the OTP flow instead of signing in or showing a dead error. */
  const needsVerification = !!(r.data as { needs_verification?: boolean }).needs_verification;
  return {
    ok: false as const,
    user: null,
    demo: r.networkError,
    needsVerification,
    email: (r.data as { email?: string }).email,
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
  /* pass 66-night — with email verification on, the server creates the account
   * but grants NO session: the OTP step grants it. `needsVerification` tells the
   * UI to show the code screen without signing anyone in. */
  const needsVerification = !!(r.data as { needs_verification?: boolean }).needs_verification;
  if (r.ok && (r.data.user || needsVerification)) {
    live = true;
    if (r.data.user) await fetchCsrf();
    return { ok: true as const, user: r.data.user ?? null, demo: false, needsVerification };
  }
  if (r.networkError && FORCE_DEMO) await storage.setItem('dl.demoSession', '1');
  return {
    ok: false as const,
    user: null,
    demo: r.networkError,
    needsVerification: false,
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

/* pass 66-night — server polls arrive as {options:[{id,label,votes}], my_vote, total};
 * map them into the client PollOption shape the FeedCard already renders. */
function mapServerPoll(p: unknown): import('@/api/types').PostPoll | null {
  const poll = p as { options?: Array<{ id: number; label: string; votes: number }>; my_vote?: number | null } | null;
  if (!poll || !Array.isArray(poll.options) || !poll.options.length) return null;
  return {
    options: poll.options.map((o) => ({ id: o.id, text: o.label, votes: o.votes })),
    voted: poll.my_vote ?? null,
  };
}

export async function feed(tab: FeedTab = 'for-you', cursor = 0): Promise<FeedResponse> {
  const r = await request<FeedResponse>(`/api/feed/get_posts.php?tab=${tab}&limit=20&cursor=${cursor}`);
  if (r.ok && Array.isArray(r.data.posts)) {
    for (const p of r.data.posts) {
      const sp = mapServerPoll(p.poll);
      if (sp) p.poll = sp;
    }
    return r.data;
  }
  return {
    status: 'success',
    posts: MOCK_FEED.filter((p) => (tab === 'for-you' ? true : tab === 'scholars' ? p.user.scholar : p.user.verification_badge)),
    next_cursor: null,
  };
}

/* pass 66-night — the whole comment tree is server-backed on live: threaded
 * replies (one level of nesting, tree-shaped server-side), per-comment and
 * per-reply likes, and counts that both sides of the conversation agree on. */
export type ServerReply = {
  id: number;
  text: string;
  created_at: string;
  time_ago?: string;
  like_count: number;
  liked_by_me: boolean;
  user: { id: number; name: string; username: string; profile_image_url?: string | null };
  replies?: ServerReply[];
};
export type ServerComment = ServerReply & { is_post_creator?: boolean; reply_count?: number };
export async function getComments(postId: number): Promise<ServerComment[] | null> {
  const r = await request<{ status?: string; comments?: ServerComment[] }>(`/api/feed/get_comments.php?post_id=${postId}`, { auth: true });
  return r.ok && Array.isArray(r.data.comments) ? r.data.comments : null;
}
export async function addComment(postId: number, text: string): Promise<{ id: number; count: number } | null> {
  const r = await request<{ status?: string; comment_id?: number; comment_count?: number }>('/api/feed/add_comment.php', { method: 'POST', body: { post_id: postId, text }, auth: true });
  return r.ok && r.data.comment_id ? { id: r.data.comment_id as number, count: r.data.comment_count ?? 0 } : null;
}
export async function addReply(postId: number, commentId: number, text: string, parentReplyId = 0): Promise<{ id: number } | null> {
  const r = await request<{ status?: string; reply_id?: number }>('/api/feed/add_reply.php', { method: 'POST', body: { post_id: postId, comment_id: commentId, parent_reply_id: parentReplyId, text }, auth: true });
  return r.ok && r.data.reply_id ? { id: r.data.reply_id as number } : null;
}
export async function toggleCommentLike(commentId: number, desired: boolean): Promise<{ liked: boolean; like_count: number } | null> {
  const r = await request<{ status?: string; liked?: boolean; like_count?: number }>('/api/feed/toggle_comment_like.php', { method: 'POST', body: { comment_id: commentId, desired_liked: desired }, auth: true });
  return r.ok ? { liked: !!r.data.liked, like_count: r.data.like_count ?? 0 } : null;
}
export async function toggleReplyLike(replyId: number, desired: boolean): Promise<{ liked: boolean; like_count: number } | null> {
  const r = await request<{ status?: string; liked?: boolean; like_count?: number }>('/api/feed/toggle_reply_like.php', { method: 'POST', body: { reply_id: replyId, desired_liked: desired }, auth: true });
  return r.ok ? { liked: !!r.data.liked, like_count: r.data.like_count ?? 0 } : null;
}
export async function deletePost(postId: number): Promise<boolean> {
  const r = await request<{ status?: string }>('/api/feed/delete_post.php', { method: 'POST', body: { post_id: postId }, auth: true });
  return r.ok;
}
export async function reportPost(postId: number, reason: string): Promise<boolean> {
  const r = await request<{ status?: string }>('/api/feed/report_post.php', { method: 'POST', body: { post_id: postId, reason }, auth: true });
  return r.ok;
}

/* pass 66-night — groups, server-backed (schema self-creates in common.php). */
export type GroupRow = { id: number; name: string; bio?: string | null; desc?: string | null; category?: string | null; emoji?: string | null; cover?: string | null; member_count: number; is_member: boolean; is_owner: boolean; open_join: boolean; created_at?: string };
export async function groupsList(): Promise<GroupRow[] | null> {
  const r = await request<{ status?: string; groups?: GroupRow[] }>('/api/groups/list.php', { auth: true });
  return r.ok && Array.isArray(r.data.groups) ? r.data.groups : null;
}
export async function groupGet(id: number): Promise<GroupRow | null> {
  const r = await request<{ status?: string; group?: GroupRow }>(`/api/groups/get.php?id=${id}`, { auth: true });
  return r.ok && r.data.group ? r.data.group : null;
}
export async function groupJoin(id: number, join: boolean): Promise<boolean> {
  const r = await request<{ status?: string }>('/api/groups/join.php', { method: 'POST', body: { group_id: id, join }, auth: true });
  return r.ok;
}
export async function groupCreate(data: { name: string; bio?: string; category?: string; emoji?: string; open_join?: boolean }): Promise<{ id: number } | null> {
  const r = await request<{ status?: string; id?: number }>('/api/groups/create.php', { method: 'POST', body: data, auth: true });
  return r.ok && r.data.id ? { id: r.data.id as number } : null;
}
export async function groupPosts(id: number): Promise<import('@/api/types').Post[] | null> {
  const r = await request<{ status?: string; posts?: import('@/api/types').Post[] }>(`/api/groups/posts.php?id=${id}`, { auth: true });
  return r.ok && Array.isArray(r.data.posts) ? r.data.posts : null;
}
export async function groupCreatePost(groupId: number, contentText: string): Promise<{ id: number } | null> {
  const r = await request<{ status?: string; id?: number }>('/api/groups/create_post.php', { method: 'POST', body: { group_id: groupId, content_text: contentText }, auth: true });
  return r.ok && r.data.id ? { id: r.data.id as number } : null;
}

/* pass 66-night — polls ride on posts; options+votes live in their own tables. */
export type PollRow = { post_id: number; options: Array<{ id: number; label: string; votes: number }>; my_vote: number | null; total: number };
export async function votePoll(postId: number, optionId: number): Promise<PollRow | null> {
  const r = await request<PollRow & { status?: string }>('/api/feed/poll_vote.php', { method: 'POST', body: { post_id: postId, option_id: optionId }, auth: true });
  return r.ok && Array.isArray((r.data as PollRow).options) ? (r.data as PollRow) : null;
}

/* pass 66-night — link preview: the server fetches og:title/description/image so
 * shared URLs render as cards (CORS-safe on every platform). */
export type LinkPreview = { url: string; title?: string; description?: string; image?: string | null; site?: string };
export async function linkPreview(url: string): Promise<LinkPreview | null> {
  const r = await request<LinkPreview & { status?: string }>(`/api/feed/link_preview.php?url=${encodeURIComponent(url)}`);
  return r.ok && r.data.url ? (r.data as LinkPreview) : null;
}

/* pass 66-night — connections (follow graph) against the real tables. */
export type ConnectionRow = { id: number; name: string; username: string; user_type?: string; profile_image_url?: string | null; following_by_me?: boolean; follows_me?: boolean; is_me?: boolean; mutual_count?: number; followers_count?: number };
export async function getConnections(tab: 'following' | 'followers' | 'suggestions', q = ''): Promise<{ items: ConnectionRow[]; counts: { followers: number; following: number } } | null> {
  const r = await request<{ status?: string; items?: ConnectionRow[]; counts?: { followers: number; following: number } }>(`/api/users/get_connections.php?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { auth: true });
  return r.ok && Array.isArray(r.data.items) ? { items: r.data.items, counts: r.data.counts ?? { followers: 0, following: 0 } } : null;
}
export async function toggleFollow(userId: number, desired: boolean): Promise<boolean> {
  const r = await request<{ status?: string }>('/api/users/toggle_follow.php', { method: 'POST', body: { user_id: userId, desired_following: desired }, auth: true });
  return r.ok;
}
export type PublicProfile = { id: number; full_name: string; username: string; bio?: string | null; profile_image_url?: string | null; followers: number; following: number; posts: number; following_by_me?: boolean; is_private?: number };
/* pass 67 — the Search screen's Users tab rides the real account search. */
export type AccountResult = { id: number; username: string; full_name: string; user_type?: string; posts_count?: number; followers_count?: number; verification_badge?: string | null; profile_image_url?: string | null };
export async function searchAccounts(q: string, limit = 20): Promise<AccountResult[] | null> {
  const r = await request<{ status?: string; results?: AccountResult[] }>(`/api/users/search_accounts.php?q=${encodeURIComponent(q)}&limit=${limit}`, { auth: true });
  return r.ok && Array.isArray(r.data.results) ? r.data.results : null;
}
/** pass 68 — public post search (Search screen). Rows match get_posts shape. */
export async function searchPosts(q: string, limit = 12, cursor = 0): Promise<Post[] | null> {
  const r = await request<{ status?: string; posts?: Post[] }>(`/api/feed/search_posts.php?q=${encodeURIComponent(q)}&limit=${limit}&cursor=${cursor}`);
  if (r.ok && Array.isArray(r.data.posts)) { return r.data.posts; }
  return null;
}

export type NotifRow = {
  id: number;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: number | null;
  is_read: boolean;
  created_at: string;
  actor?: { id: number; username: string; name: string; profile_image_url?: string | null; following_by_me?: boolean; verification_badge?: string };
};

/** pass 68 — the live notifications inbox. */
export async function notificationsList(limit = 40): Promise<NotifRow[] | null> {
  const r = await request<{ status?: string; notifications?: NotifRow[] }>(`/api/notifications/list.php?limit=${limit}`, { auth: true });
  if (r.ok && Array.isArray(r.data.notifications)) { return r.data.notifications; }
  return null;
}

export async function notificationsMarkAllRead(): Promise<void> {
  await request('/api/notifications/mark_read.php', { method: 'POST', body: { all: true }, auth: true });
}

/* ─────────────── pass 69 — bookmarks (unified, every save button) ─────────────── */
export type BookmarkItem = { kind: string; item_id: string; payload: unknown; created_at: string };

export async function bookmarksList(kind?: string): Promise<BookmarkItem[] | null> {
  const r = await request<{ status?: string; items?: BookmarkItem[] }>(`/api/bookmarks/list.php${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`, { auth: true });
  if (r.ok && Array.isArray(r.data.items)) { return r.data.items; }
  return null;
}

export async function bookmarkToggle(kind: string, itemId: string, payload?: unknown): Promise<{ bookmarked: boolean } | null> {
  const r = await request<{ status?: string; bookmarked?: boolean }>('/api/bookmarks/toggle.php', { method: 'POST', body: { kind, item_id: itemId, payload }, auth: true });
  if (r.ok && typeof r.data.bookmarked === 'boolean') { return { bookmarked: r.data.bookmarked }; }
  return null;
}

/* ─────────────── pass 69 — DeenPoints: history + Flutterwave purchase ─────────────── */
export type PointsEvent = { delta: number; balance_after: number; event_type: string; ref: string | null; created_at: string };

export async function deenpointsHistory(limit = 40): Promise<{ balance: number; events: PointsEvent[] } | null> {
  const r = await request<{ status?: string; balance?: number; events?: PointsEvent[] }>(`/api/deenpoints/history.php?limit=${limit}`, { auth: true });
  if (r.ok && typeof r.data.balance === 'number') { return { balance: r.data.balance, events: Array.isArray(r.data.events) ? r.data.events : [] }; }
  return null;
}

export type PointsPricing = { price_per_point_ngn: number; currency: string; rate_ngn_to_currency: number; supported_currencies?: string[]; country?: string };

export async function pointsQuote(): Promise<PointsPricing | null> {
  const r = await request<{ status?: string; pricing?: PointsPricing }>('/api/payments/flutterwave/quote_deenpoints.php');
  if (r.ok && r.data.pricing) { return r.data.pricing; }
  return null;
}

export type FlwCheckout = {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options?: string;
  customer?: { email?: string; name?: string; phone_number?: string };
  customizations?: { title?: string; description?: string; logo?: string };
};

/** Start a DeenPoints purchase. Web → inline `checkout` payload for
 * FlutterwaveCheckout(); native → `redirect_url` hosted-checkout link. */
export async function pointsInit(points: number, opts?: { redirect?: boolean; redirectUrl?: string }): Promise<{ checkout?: FlwCheckout; mode?: string; tx_ref?: string; redirect_url?: string; message?: string } | null> {
  const body: Record<string, unknown> = { points };
  if (opts?.redirect) { body.redirect = true; if (opts.redirectUrl) { body.redirect_url = opts.redirectUrl; } }
  const r = await request<{ status?: string; checkout?: FlwCheckout; mode?: string; tx_ref?: string; redirect_url?: string; message?: string }>('/api/payments/flutterwave/init_deenpoints.php', { method: 'POST', body, auth: true });
  if (r.ok && r.data.status === 'success') { return r.data; }
  return null;
}

/** Server-side verification + crediting (idempotent). Call after checkout
 * closes (web) or when the user returns from the hosted page (native). */
export async function pointsVerify(txRef: string): Promise<{ ok: boolean; balance?: number; message?: string } | null> {
  const r = await request<{ status?: string; message?: string; deenpoints_balance?: number }>('/api/payments/flutterwave/verify.php', { method: 'POST', body: { tx_ref: txRef }, auth: true });
  if (r.ok && r.data.status === 'success') { return { ok: true, balance: r.data.deenpoints_balance, message: r.data.message }; }
  return { ok: false, message: r.data.message ?? 'Verification failed' };
}

/* ─────────────── pass 69 — donations + premium (same Flutterwave plumbing) ─────────────── */
export type PayInit = { checkout?: FlwCheckout; mode?: string; tx_ref?: string; redirect_url?: string; message?: string };

/** Start a donation (Sadaqah/Zakat/…). Web → inline checkout; native → hosted page. */
export async function donationInit(donationType: string, amount: number, opts?: { redirect?: boolean; redirectUrl?: string; note?: string; currency?: string }): Promise<PayInit | null> {
  const body: Record<string, unknown> = { donation_type: donationType, amount };
  if (opts?.currency) { body.currency = opts.currency; }
  if (opts?.note) { body.note = opts.note; }
  if (opts?.redirect) { body.redirect = true; if (opts.redirectUrl) { body.redirect_url = opts.redirectUrl; } }
  const r = await request<{ status?: string } & PayInit>('/api/payments/flutterwave/init_donation.php', { method: 'POST', body, auth: true });
  if (r.ok && r.data.status === 'success') { return r.data; }
  return null;
}

export type PremiumQuote = {
  premium_enabled: boolean;
  currency: string;
  monthly: number;
  annual: number;
  monthly_usd?: number;
  annual_usd?: number;
  annual_saves_usd?: number;
};

export async function quotePremium(): Promise<PremiumQuote | null> {
  const r = await request<{ status?: string } & PremiumQuote>('/api/payments/flutterwave/quote_premium.php', { auth: true });
  if (r.ok && r.data.status === 'success') { return r.data; }
  return null;
}

export async function premiumInit(plan: 'monthly' | 'annual', opts?: { redirect?: boolean; redirectUrl?: string }): Promise<PayInit | null> {
  const body: Record<string, unknown> = { plan };
  if (opts?.redirect) { body.redirect = true; if (opts.redirectUrl) { body.redirect_url = opts.redirectUrl; } }
  const r = await request<{ status?: string } & PayInit>('/api/payments/flutterwave/init_premium.php', { method: 'POST', body, auth: true });
  if (r.ok && r.data.status === 'success') { return r.data; }
  return null;
}

/* ─────────────── pass 69 — Ask Scholars (my side of the questions API) ─────────────── */
export type MyQuestion = {
  id: number;
  title: string;
  question?: string;
  status: string;
  answer?: string | null;
  answered_at?: string | null;
  created_at?: string;
  scholar?: { id?: number; name?: string; username?: string } | null;
};

export async function myQuestions(): Promise<{ questions: MyQuestion[]; counts: Record<string, number> } | null> {
  const r = await request<{ status?: string; questions?: MyQuestion[]; counts?: Record<string, number> }>('/api/questions/my_list.php', { auth: true });
  if (r.ok && Array.isArray(r.data.questions)) { return { questions: r.data.questions, counts: r.data.counts ?? {} }; }
  return null;
}

export async function askUnreadCount(): Promise<number> {
  const r = await request<{ status?: string; unread_answered_count?: number }>('/api/questions/unread_answered_count.php', { auth: true });
  return r.ok ? Number(r.data.unread_answered_count ?? 0) : 0;
}

export async function getUserProfile(username: string): Promise<PublicProfile | null> {
  const r = await request<{ status?: string; user?: PublicProfile }>(`/api/users/get_user_profile.php?u=${encodeURIComponent(username)}`, { auth: true });
  return r.ok && r.data.user ? r.data.user : null;
}

export async function toggleLike(postId: number, desired: boolean): Promise<{ like_count: number; liked_by_me: boolean }> {
  const r = await request<{ like_count?: number; liked_by_me?: boolean; status?: string }>(
    '/api/feed/toggle_like.php',
    { method: 'POST', body: { post_id: postId, desired_liked: desired } },
  );
  if (r.ok) return { like_count: r.data.like_count ?? 0, liked_by_me: r.data.liked_by_me ?? desired };
  return { like_count: 0, liked_by_me: desired };
}

export async function createPost(
  contentText: string,
  youtubeUrl?: string,
  pollOptions?: string[],
  images?: Array<{ uri: string; name?: string; type?: string }>,
): Promise<{ ok: boolean; post?: Post; id?: number | null }> {
  const form = new FormData();
  if (contentText) form.append('content_text', contentText);
  if (youtubeUrl) form.append('youtube_url', youtubeUrl);
  if (pollOptions && pollOptions.length >= 2) form.append('poll_options', JSON.stringify(pollOptions.slice(0, 6)));
  if (images && images.length) {
    for (const img of images.slice(0, 5)) {
      if (typeof window !== 'undefined' && img.uri.startsWith('blob:')) {
        const blob = await fetch(img.uri).then((r) => r.blob());
        form.append('images[]', new File([blob], img.name ?? 'photo.jpg', { type: blob.type || 'image/jpeg' }));
      } else {
        form.append('images[]', { uri: img.uri, name: img.name ?? 'photo.jpg', type: img.type ?? 'image/jpeg' } as never);
      }
    }
  }
  const r = await request<{ status?: string; post?: Post; post_id?: number; id?: number }>('/api/feed/create_post.php', {
    method: 'POST',
    form,
  });
  if (r.ok) return { ok: true, post: r.data.post, id: r.data.post_id ?? r.data.id ?? null };
  return { ok: false };
}

/* --------------------------- Other endpoints --------------------------- */

export async function videos(type: 'daily' | 'reel' | 'all' = 'daily'): Promise<Video[]> {
  const r = await request<{ status?: string; videos?: Video[]; items?: Video[] }>(`/api/videos/list.php?type=${type}&limit=20&source=homepage`);
  /* pass 70 — list.php returns `items` (the old `videos` key never existed, so
   * the app silently fell back to mock clips forever) */
  if (r.ok) {
    const list = r.data.items ?? r.data.videos;
    if (Array.isArray(list) && list.length) return list;
  }
  return MOCK_VIDEOS;
}

/* pass 70 — server-backed video reposts (notifications included). */
export async function videosRepost(videoId: number, action: 'repost' | 'undo' | 'toggle' = 'toggle'): Promise<{ reposted: boolean; repost_count: number } | null> {
  const r = await request<{ status?: string; reposted?: boolean; repost_count?: number }>('/api/videos/repost.php', { method: 'POST', body: { video_id: videoId, action }, auth: true });
  if (r.ok && r.data.status === 'success' && typeof r.data.reposted === 'boolean') {
    return { reposted: r.data.reposted, repost_count: Number(r.data.repost_count ?? 0) };
  }
  return null;
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

export async function profileCounts(userId?: number): Promise<{ posts: number; followers: number; following: number; donations: number }> {
  /* pass 71 — was triply broken: the endpoint REQUIRES ?user_id, answers with
   * FLAT counts (no `counts` wrapper), and the fallbacks were hard-coded
   * dummies (3/128/96). Real numbers or honest zeros now. */
  const r = await request<{ status?: string; posts?: number; followers?: number; following?: number; donations?: number }>(
    `/api/users/get_profile_counts.php?user_id=${Number(userId ?? 0)}`,
    { auth: true },
  );
  if (r.ok && r.data.status === 'success') {
    return {
      posts: Number(r.data.posts ?? 0),
      followers: Number(r.data.followers ?? 0),
      following: Number(r.data.following ?? 0),
      donations: Number(r.data.donations ?? 0),
    };
  }
  return { posts: 0, followers: 0, following: 0, donations: 0 };
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
  additional_deenpoints?: number;
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

export async function dailyCheckin(): Promise<{ ok: boolean; points?: number; balance?: number; already?: boolean }> {
  if (FORCE_DEMO) return { ok: true, points: 1 };
  /* pass 71 — the server answers points_awarded + new_balance (the old client
   * read keys that never existed, so the balance never moved on screen) */
  const r = await request<{ status?: string; points_awarded?: number; new_balance?: number; message?: string }>('/api/users/daily_checkin.php', {
    method: 'POST',
    body: {},
  });
  if (r.ok) {
    live = true;
    const pts = Number(r.data.points_awarded ?? 0);
    const bal = Number(r.data.new_balance ?? NaN);
    return { ok: true, points: pts, balance: Number.isFinite(bal) ? bal : undefined, already: pts === 0 };
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
export async function verifyOtp(email: string, code: string): Promise<{ ok: boolean; verified?: boolean; message?: string; wrong?: boolean; expired?: boolean; networkError?: boolean; user?: User | null }> {
  const r = await request<{ status?: string; message?: string; verified?: boolean; wrong?: boolean; expired?: boolean; user?: User | null }>('/api/auth/verify_otp.php', { body: { email, code } });
  /* the session cookie rides on this response; `user` lets the caller adopt it */
  if (r.ok && r.data.user) await fetchCsrf();
  return { ok: r.ok, verified: !!r.data.verified, message: r.data.message, wrong: !!r.data.wrong, expired: !!r.data.expired, networkError: r.networkError, user: r.data.user ?? null };
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
/* pass 63 contract (client types were never landed with the UI, so replies,
 * quotes and deletes had no types): messages.php returns `deleted` for soft-
 * deleted rows and a resolved `reply_to` quote ({id, kind, body, username});
 * a soft-deleted row comes back with body '' and media_url null. */
export type ChatReplyRef = { id: number; kind: 'msg' | 'share'; body: string; username: string };
export type ChatMessage = {
  id: number;
  sender_id: number;
  body: string;
  media_url: string | null;
  created_at: string;
  username?: string;
  read_at?: string | null;
  deleted?: boolean;
  reply_to?: ChatReplyRef | null;
};
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
/** pass 63 — optional quote: the row you are replying to, and whether it is a
 *  plain message or an in-app share. The server verifies it belongs to this
 *  conversation and stores the reference. */
export async function chatSend(
  conversationId: number,
  body: string,
  replyTo?: { id: number; kind: 'msg' | 'share' },
): Promise<{ id: number; created_at?: string } | null> {
  const r = await request<{ status?: string; id?: number; created_at?: string }>('/api/chat/send.php', {
    method: 'POST',
    body: {
      conversation_id: conversationId,
      body,
      reply_to_id: replyTo?.id,
      reply_to_kind: replyTo?.kind,
    },
    auth: true,
  });
  return r.ok && r.data.id ? { id: r.data.id as number, created_at: r.data.created_at } : null;
}
/** pass 63 — soft-delete YOUR OWN message ('msg') or share ('share'): the row
 *  stays and every client renders "Message deleted" (WhatsApp's behaviour). */
export async function chatDelete(conversationId: number, targetKind: 'msg' | 'share', targetId: number): Promise<boolean> {
  const r = await request<{ status?: string; deleted?: boolean }>('/api/chat/delete.php', {
    method: 'POST',
    body: { conversation_id: conversationId, target_kind: targetKind, target_id: targetId },
    auth: true,
  });
  return r.ok && !!r.data.deleted;
}
/* pass 62 — in-app shares and emoji reactions, server-backed so BOTH sides of a
 * conversation see the same thread instead of two local-only copies. */
export type ChatShare = { id: number; sender_id: number; kind: string; title: string; payload: Record<string, string> | null; created_at: string; username?: string; deleted?: boolean };
export type ChatReaction = { target_kind: 'msg' | 'share'; target_id: number; user_id: number; emoji: string; username?: string | null };
export type ChatThreadData = {
  messages: ChatMessage[];
  shares: ChatShare[];
  reactions: ChatReaction[];
  peer_typing?: boolean;
  peer_read_at?: string | null;
};
/**
 * One round trip for a whole thread: messages + shares + every reaction on them.
 * pass 68 — realtime: pass `since` (highest ids already rendered) to receive
 * ONLY newer rows, so the 3-second poll is a couple of indexed rows; every call
 * also carries peer_typing (dots) + peer_read_at (✓✓ watermark).
 */
export async function chatThread(conversationId: number, since?: { msg?: number; share?: number }): Promise<ChatThreadData | null> {
  let url = `/api/chat/messages.php?conversation_id=${conversationId}`;
  if (since) url += `&since_id=${since.msg ?? 0}&since_share_id=${since.share ?? 0}`;
  const r = await request<{ status?: string; messages?: ChatMessage[]; shares?: ChatShare[]; reactions?: ChatReaction[]; peer_typing?: boolean; peer_read_at?: string | null }>(url, { auth: true });
  if (!r.ok || !Array.isArray(r.data.messages)) { return null; }
  return {
    messages: r.data.messages,
    shares: Array.isArray(r.data.shares) ? r.data.shares : [],
    reactions: Array.isArray(r.data.reactions) ? r.data.reactions : [],
    peer_typing: !!r.data.peer_typing,
    peer_read_at: r.data.peer_read_at ?? null,
  };
}
/** pass 68 — typing indicator ping; the server expires it after ~6s. */
export async function chatTyping(conversationId: number, typing: boolean): Promise<void> {
  await request('/api/chat/typing.php', { method: 'POST', body: { conversation_id: conversationId, typing: typing ? 1 : 0 }, auth: true });
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

/* pass 66-night — does the live server hold an active provider key? When yes,
 * the app hides its manual key field entirely: the cloud key answers. */
export async function aiServerStatus(): Promise<{ connected: boolean }> {
  const r = await request<{ connected?: boolean }>('/api/deenai/status.php');
  return { connected: !!r.data.connected };
}

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
