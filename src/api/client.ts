import {
  MOCK_ANNOUNCEMENT,
  MOCK_EVENTS,
  MOCK_POSTS,
  MOCK_SCHOLARS,
  MOCK_VIDEOS,
  MOCK_WALLPAPERS,
  type EventItem,
  type Post,
  type Scholar,
  type Video,
  type Wallpaper,
} from './mocks';

/**
 * DeenLink API client.
 *
 * Every read endpoint falls back to bundled demo data when the PHP backend
 * is not (yet) reachable, so the app is fully explorable from day one.
 * When you confirm the real route names in your PHP code, update the paths
 * below and remove the fallbacks you no longer need.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://deenlink.org/api').replace(/\/+$/, '');

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export type FeedTab = 'foryou' | 'following' | 'scholars';

export const api = {
  // --- Auth (must match your PHP endpoints) ---
  login: (email: string, password: string) =>
    http<{ token: string; user: { id: string; name: string; username: string; mizhab?: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  register: (body: { name: string; username: string; email: string; password: string; mizhab: string }) =>
    http<{ token: string; user: { id: string; name: string; username: string; mizhab?: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // --- Reads (fall back to demo data) ---
  feed: (tab: FeedTab) => withFallback(http<Post[]>(`/posts?tab=${tab}`), MOCK_POSTS),
  post: (id: string) =>
    withFallback(http<Post>(`/posts/${id}`), MOCK_POSTS.find((p) => p.id === id) ?? MOCK_POSTS[0]),
  announcement: () => withFallback(http<{ text: string }>('/announcement'), { text: MOCK_ANNOUNCEMENT }),
  videos: () => withFallback(http<Video[]>('/videos'), MOCK_VIDEOS),
  wallpapers: () => withFallback(http<Wallpaper[]>('/wallpapers'), MOCK_WALLPAPERS),
  events: () => withFallback(http<EventItem[]>('/events'), MOCK_EVENTS),
  scholars: () => withFallback(http<Scholar[]>('/scholars'), MOCK_SCHOLARS),
};
