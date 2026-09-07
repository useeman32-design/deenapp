import { useEffect, useState } from 'react';
import { bookmarkToggle, bookmarksList, isLive } from '@/api/client';
import { storage } from '@/lib/storage';

/**
 * pass 69 — ONE bookmark store for every save button in the app
 * (hadith, ayah, surah, prophet chapter, seerah event, fatwa, reel, post…).
 *
 * Live: the server table is the source of truth (hydrated once, toggles are
 * optimistic and reconcile against the API response). Demo/offline: falls back
 * to the same local mirror the old per-screen keys used, so gh-pages keeps
 * working with zero backend.
 *
 * Kinds are free-form (validated server-side as [a-z0-9_]+); item ids are
 * strings so composite keys like "bukhari:1" or "2:255" are fine.
 */
export type BmItem = { kind: string; item_id: string; payload?: unknown; created_at?: string };

const LOCAL_KEY = 'dl.bookmarks.v1';

let cache: BmItem[] | null = null;
const listeners = new Set<() => void>();
let hydrating: Promise<void> | null = null;

const emit = () => listeners.forEach((l) => l());
const persist = () => storage.setItem(LOCAL_KEY, JSON.stringify(cache ?? [])).catch(() => {});

export function bmSubscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Load local mirror instantly, then let the server overwrite it. Once. */
export function bmHydrate(): Promise<void> {
  if (cache) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await storage.getItem(LOCAL_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) { cache = arr as BmItem[]; emit(); }
      }
    } catch { /* corrupt mirror — server (or empty) wins below */ }
    if (!cache) { cache = []; }
    if (isLive()) {
      const items = await bookmarksList().catch(() => null);
      if (items) { cache = items; await persist(); emit(); }
    }
  })();
  return hydrating;
}

export function bmHas(kind: string, id: string): boolean {
  return (cache ?? []).some((i) => i.kind === kind && i.item_id === id);
}

export function bmListOf(kind?: string): BmItem[] {
  const c = cache ?? [];
  return kind ? c.filter((i) => i.kind === kind) : c;
}

/** Optimistic toggle; reverts if the server disagrees. Returns new state. */
export async function bmToggle(kind: string, id: string, payload?: unknown): Promise<boolean> {
  cache = cache ?? [];
  const idx = cache.findIndex((i) => i.kind === kind && i.item_id === id);
  const turningOn = idx < 0;
  if (turningOn) {
    cache = [{ kind, item_id: id, payload, created_at: new Date().toISOString() }, ...cache];
  } else {
    cache = cache.filter((_, i) => i !== idx);
  }
  emit();
  void persist();
  if (isLive()) {
    const r = await bookmarkToggle(kind, id, payload).catch(() => null);
    if (r && r.bookmarked !== turningOn) {
      /* server is authoritative — resync from it */
      const items = await bookmarksList().catch(() => null);
      if (items) { cache = items; await persist(); emit(); }
    }
  }
  return turningOn;
}

/** Reactive hook for one kind (or the whole store when kind is omitted). */
export function useBookmarks(kind?: string) {
  const [, force] = useState(0);
  useEffect(() => {
    void bmHydrate();
    return bmSubscribe(() => force((n) => n + 1));
  }, []);
  return {
    has: (id: string) => (kind ? bmHas(kind, id) : false),
    list: bmListOf(kind),
    toggle: (id: string, payload?: unknown) => bmToggle(kind ?? '', id, payload),
  };
}
