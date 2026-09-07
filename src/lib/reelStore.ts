import type { MockReel } from '@/api/mocks';

/**
 * Tiny module-level store for user-created reels (demo).
 * The Videos feed and the Community composer both import it, so a video
 * posted from the composer appears in the feed without any backend.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
export const userReels: MockReel[] = [];

let nextId = 301;

export function addUserReel(reel: Omit<MockReel, 'id' | 'likes' | 'comments' | 'saves' | 'views'> &
  Partial<Pick<MockReel, 'likes' | 'comments' | 'saves' | 'views'>>): MockReel {
  const r: MockReel = { id: nextId++, likes: 0, comments: 0, saves: 0, views: 0, ...reel };
  userReels.unshift(r);
  listeners.forEach((l) => l());
  return r;
}

export function subscribeUserReels(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
