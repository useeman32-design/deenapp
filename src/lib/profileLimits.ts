import { storage } from '@/lib/storage';

/**
 * Name / username change limits — "you can only change it twice within 14 days".
 * Change timestamps are kept locally; the server stores the authoritative value.
 */

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MAX_CHANGES = 2;

export type LimitKey = 'name' | 'username';
const storeKey = (k: LimitKey) => `dl.profile.${k}.changes`;

async function read(k: LimitKey): Promise<number[]> {
  const raw = await storage.getItem(storeKey(k));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(Number).filter((n) => !Number.isNaN(n)) : [];
  } catch {
    return [];
  }
}

function prune(list: number[]): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  return list.filter((t) => t >= cutoff).sort((a, b) => a - b);
}

export type LimitState = {
  used: number;        // changes used in the current 14-day window
  remaining: number;   // changes still allowed (0..2)
  blocked: boolean;    // true when no changes remain
  /** ms until the next change is allowed (only meaningful when blocked) */
  waitMs: number;
  waitDays: number;    // ceil days to wait (for the "wait N days" copy)
};

export async function getLimit(k: LimitKey): Promise<LimitState> {
  const list = prune(await read(k));
  const used = list.length;
  const remaining = Math.max(0, MAX_CHANGES - used);
  const blocked = remaining === 0;
  // When blocked, the next slot frees up 14 days after the OLDEST change in the window.
  const waitMs = blocked && list.length ? Math.max(0, list[0] + WINDOW_MS - Date.now()) : 0;
  return { used, remaining, blocked, waitMs, waitDays: Math.ceil(waitMs / (24 * 60 * 60 * 1000)) };
}

export async function recordChange(k: LimitKey): Promise<void> {
  const list = prune(await read(k));
  list.push(Date.now());
  await storage.setItem(storeKey(k), JSON.stringify(list.slice(-MAX_CHANGES)));
}

export function daysLabel(ms: number): string {
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (d <= 0) return 'less than a day';
  if (d === 1) return '1 day';
  return `${d} days`;
}
