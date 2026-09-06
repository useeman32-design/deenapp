import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { Post } from '@/api/types';
import { storage } from '@/lib/storage';
import { bookmarkToggle, bookmarksList, isLive } from '@/api/client';

/**
 * Saved posts (pass 18, server-synced in pass 69) — bookmarked post snapshots.
 * Feed cards show a bookmark toggle; the owner profile has a Saved tab.
 *
 * Live: the unified `user_bookmarks` table (kind `post`) is the source of
 * truth — the payload carries a COMPACT snapshot (the server caps payloads at
 * 4 KB, so long post bodies are clipped) and hydrates the Saved tab anywhere
 * you sign in. Demo/offline: local mirror only, exactly like before.
 */

const KEY = 'dl.saved.posts.v1';
type Snapshot = { post: Post; saved_at: number };

let cache: Snapshot[] | null = null;
const listeners = new Set<() => void>();
let hydrating: Promise<void> | null = null;

const emit = () => listeners.forEach((l) => l());

const read = (): Snapshot[] => {
  if (cache) return cache;
  try {
    const raw = Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    cache = raw ? (JSON.parse(raw) as Snapshot[]) : [];
  } catch {
    cache = [];
  }
  if (Platform.OS !== 'web') {
    void storage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          cache = JSON.parse(raw) as Snapshot[];
          emit();
        } catch {}
      }
    }).catch(() => {});
  }
  return cache!;
};

const write = (next: Snapshot[]) => {
  cache = next;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(next));
    else void storage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  } catch {}
  emit();
};

/* compact snapshot keeps the server payload well under the 4 KB cap */
const snapshotOf = (post: Post): Post => ({
  ...post,
  content_text: (post.content_text ?? '').slice(0, 600),
});

const fromPayload = (p: unknown): Post | null => {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (typeof o.id !== 'number' || !o.user) return null;
  return o as unknown as Post;
};

export function savedHydrate(): Promise<void> {
  if (!isLive()) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    const items = await bookmarksList('post').catch(() => null);
    if (!items) return;
    const snaps: Snapshot[] = [];
    for (const it of items) {
      const post = fromPayload(it.payload);
      if (post) snaps.push({ post, saved_at: new Date(it.created_at || Date.now()).getTime() || Date.now() });
    }
    write(snaps);
  })();
  return hydrating;
}

export const savedStore = {
  list(): Post[] {
    return read().map((s) => s.post);
  },
  has(id: number): boolean {
    return read().some((s) => s.post.id === id);
  },
  toggle(post: Post): boolean {
    const cur = read();
    const removing = cur.some((s) => s.post.id === post.id);
    if (removing) {
      write(cur.filter((s) => s.post.id !== post.id));
    } else {
      write([{ post, saved_at: Date.now() }, ...cur]);
    }
    if (isLive()) {
      void (async () => {
        const r = await bookmarkToggle('post', String(post.id), removing ? undefined : snapshotOf(post)).catch(() => null);
        if (r && r.bookmarked === removing) {
          /* server disagreed with the optimistic guess — resync */
          const items = await bookmarksList('post').catch(() => null);
          if (items) {
            const snaps: Snapshot[] = [];
            for (const it of items) {
              const p = fromPayload(it.payload);
              if (p) snaps.push({ post: p, saved_at: Date.now() });
            }
            write(snaps);
          }
        }
      })();
    }
    return !removing;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** React binding — re-renders on any change to the saved set. */
export function useSaved(): { saved: Post[]; isSaved: (id: number) => boolean } {
  const [, bump] = useState(0);
  useEffect(() => {
    void savedHydrate();
    return savedStore.subscribe(() => bump((n) => n + 1));
  }, []);
  return {
    saved: savedStore.list(),
    isSaved: (id: number) => savedStore.has(id),
  };
}
