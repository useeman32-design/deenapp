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

/** A save is kept when the server list does not carry it yet but it happened
 * seconds ago — i.e. the POST is still in flight. Prevents a hydrate that starts
 * while you tap the bookmark from erasing the save (pass 88, owner: “saved posts
 * are not in my profile until I refresh the whole page”). */
const PENDING_MS = 3 * 60 * 1000;

export function savedHydrate(force = false): Promise<void> {
  if (!isLive()) return Promise.resolve();
  if (hydrating && !force) return hydrating;
  hydrating = (async () => {
    const items = await bookmarksList('post').catch(() => null);
    if (!items) return;
    const mine = new Map<number, Snapshot>();
    for (const it of items) {
      const post = fromPayload(it.payload);
      if (post) mine.set(post.id, { post, saved_at: new Date(it.created_at || Date.now()).getTime() || Date.now() });
    }
    const before = read();
    /* MERGE: server rows win, and a brand-new local row survives until the
     * server confirms it; anything older and absent is genuinely gone. */
    const cutoff = Date.now() - PENDING_MS;
    const snaps: Snapshot[] = [...mine.values()];
    for (const s of before) {
      if (!mine.has(s.post.id) && s.saved_at >= cutoff) snaps.push(s);
    }
    snaps.sort((a, b) => b.saved_at - a.saved_at);
    write(snaps);
  })();
  const done = hydrating;
  /* allow the next focus to hydrate again */
  setTimeout(() => { if (hydrating === done) hydrating = null; }, 1500);
  return done;
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
  /** Move a saved snapshot to a new post id (an optimistic post id that the
   * server replaced after publishing). Keeps the local copy AND the server row
   * pointed at the real id, so “my post” saves never vanish on refresh. */
  swapId(fromId: number, toId: number): void {
    if (fromId === toId) return;
    const cur = read();
    const hit = cur.find((x) => x.post.id === fromId);
    if (!hit) return;
    write(cur.map((x) => (x.post.id === fromId ? { ...x, post: { ...x.post, id: toId } } : x)));
    if (isLive()) {
      void (async () => {
        await bookmarkToggle('post', String(fromId)).catch(() => null); /* drop the temp row */
        await bookmarkToggle('post', String(toId), snapshotOf({ ...hit.post, id: toId })).catch(() => null);
      })();
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    saved: savedStore.list(),
    isSaved: (id: number) => savedStore.has(id),
  };
}

/** Light subscription for feed cards: repaints the bookmark on any change and
 * never fires a request of its own (a 20-card list must not fetch 20 times). */
export function useSavedTick(): void {
  const [, bump] = useState(0);
  useEffect(() => savedStore.subscribe(() => bump((n) => n + 1)), []);
}

/** Focus-driven refresh (the profile “Saved” tab calls this) — re-reads the
 * server list and merges, so a save made elsewhere shows up without a reload. */
export function savedRefresh(): Promise<void> {
  return savedHydrate(true);
}
