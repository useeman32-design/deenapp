import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { Post } from '@/api/types';

/**
 * Saved posts (pass 18) — tiny persisted store of full post snapshots.
 * Feed cards show a bookmark toggle; the owner profile has a Saved tab.
 * Persists to localStorage on web; falls back to in-memory on native
 * (AsyncStorage wiring can be added without touching consumers).
 */

const KEY = 'dl.saved.posts.v1';
type Snapshot = { post: Post; saved_at: number };

let cache: Snapshot[] | null = null;
const listeners = new Set<() => void>();

const read = (): Snapshot[] => {
  if (cache) return cache;
  try {
    const raw = Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    cache = raw ? (JSON.parse(raw) as Snapshot[]) : [];
  } catch {
    cache = [];
  }
  return cache!;
};

const write = (next: Snapshot[]) => {
  cache = next;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
};

export const savedStore = {
  list(): Post[] {
    return read().map((s) => s.post);
  },
  has(id: number): boolean {
    return read().some((s) => s.post.id === id);
  },
  toggle(post: Post): boolean {
    const cur = read();
    if (cur.some((s) => s.post.id === post.id)) {
      write(cur.filter((s) => s.post.id !== post.id));
      return false;
    }
    write([{ post, saved_at: Date.now() }, ...cur]);
    return true;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** React binding — re-renders on any change to the saved set. */
export function useSaved(): { saved: Post[]; isSaved: (id: number) => boolean } {
  const [, bump] = useState(0);
  useEffect(() => savedStore.subscribe(() => bump((n) => n + 1)), []);
  return {
    saved: savedStore.list(),
    isSaved: (id: number) => savedStore.has(id),
  };
}
