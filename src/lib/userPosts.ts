import { storage } from '@/lib/storage';

/**
 * User posts (pass 32) — a tiny shared store so ANY screen can publish a
 * "shared as post" item (quiz score, riddle, joke, ayah…) and the community
 * feed picks it up at mount. In-memory cache + persisted list, newest first.
 */
export type UserPost = { id: string; at: number; text: string; kind: string };

const KEY = 'dl.userPosts.v1';
let cache: UserPost[] | null = null;

export async function listUserPosts(): Promise<UserPost[]> {
  if (cache) return cache;
  try {
    const raw = await storage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as UserPost[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function addUserPost(text: string, kind = 'post'): Promise<UserPost> {
  const p: UserPost = { id: Math.random().toString(36).slice(2), at: Date.now(), text: text.trim(), kind };
  const all = await listUserPosts();
  cache = [p, ...all].slice(0, 80);
  try {
    await storage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  return p;
}
