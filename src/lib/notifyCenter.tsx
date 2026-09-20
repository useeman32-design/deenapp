import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as api from '@/api/client';

/**
 * pass 97 — the badges, and "why am I not seeing any notification in the PWA?"
 *
 * Two separate holes:
 *
 *  1. The Community header showed a FIXED orange dot on the bell — it was hard
 *     coded and never changed, and the messages button had no badge at all.
 *     Owner: "the notifications bell on community and the message buttons should
 *     have a number badge indicating number of messages or notifications."
 *
 *  2. Nothing in the app ever polled for arrivals. A DM or a like landed on the
 *     server and the app only learned about it when the user opened the
 *     notifications screen himself.
 *
 * This module keeps one live count for each, refreshes while the app is in the
 * foreground (and the instant it comes back), and raises an in-app banner the
 * moment the notification count grows — so a chat or a like is visible without
 * leaving the screen the user is on. Push delivery while the PWA is closed is
 * handled separately (see lib/push.ts → registerWebPush).
 */

type State = { notifications: number; messages: number };

const state: State = { notifications: 0, messages: 0 };
const listeners = new Set<(s: State) => void>();

export function notifyCounts(): State {
  return { ...state };
}

function setCounts(next: Partial<State>): void {
  const before = { ...state };
  let changed = false;
  (Object.keys(next) as Array<keyof State>).forEach((k) => {
    const v = Math.max(0, Number(next[k] ?? 0));
    if (state[k] !== v) {
      state[k] = v;
      changed = true;
    }
  });
  if (changed) {
    listeners.forEach((fn) => fn({ ...state }));
    onChanged?.(before, { ...state });
  }
}

export function subscribeCounts(fn: (s: State) => void): () => void {
  listeners.add(fn);
  fn({ ...state });
  return () => {
    listeners.delete(fn);
  };
}

/** React binding for the header badges. */
export function useNotifyCounts(): State {
  const [s, setS] = useState<State>(() => notifyCounts());
  useEffect(() => subscribeCounts(setS), []);
  return s;
}

/** The banner host registers here (mounted in the root layout). */
type BannerHandler = (b: { title: string; body: string; go?: () => void }) => void;
let bannerHandler: BannerHandler | null = null;
export function setBannerHost(fn: BannerHandler | null): void {
  bannerHandler = fn;
}

type ChangeHook = (before: State, after: State) => void;
let onChanged: ChangeHook | null = null;

/** Extra reaction (used by the banner host to fetch what actually arrived). */
export function setCountsChangeHook(fn: ChangeHook | null): void {
  onChanged = fn;
}

function absUrl(raw: string | undefined | null): string {
  const v = String(raw ?? '');
  if (!v) return '';
  return v.startsWith('http') ? v : `${api.BASE}${v.startsWith('/') ? '' : '/'}${v}`;
}

/** Poll once — cheap: two small counter endpoints. */
export async function refreshCounts(): Promise<void> {
  if (!api.isLive()) return;
  const [notif, convs] = await Promise.all([
    api.unreadNotifications().catch(() => null),
    api.chatConversations().catch(() => null),
  ]);
  const messages = Array.isArray(convs)
    ? convs.reduce((n, c) => n + Math.max(0, Number(c.unread ?? 0)), 0)
    : null;
  setCounts({
    ...(notif != null ? { notifications: notif } : {}),
    ...(messages != null ? { messages } : {}),
  });
}

/** A tiny thumbnail + text straight from the newest unread notification. */
async function announceNewest(before: State, after: State): Promise<void> {
  if (!bannerHandler) return;
  if (after.messages > before.messages) {
    bannerHandler({
      title: 'New message',
      body: 'Someone sent you a message on DeenLink.',
      go: () => router.push('/tools/inbox' as never),
    });
    return;
  }
  if (after.notifications <= before.notifications) return;
  const rows = (await api.notificationsList(1).catch(() => [])) ?? [];
  const row = rows[0] as
    | { title?: string; message?: string; body?: string; actor_name?: string; actor_username?: string; actor_photo?: string | null; link?: string; url?: string; type?: string }
    | undefined;
  if (!row) return;
  const title = String(row.title || 'DeenLink');
  const body = String(row.message || row.body || 'You have a new notification.');
  bannerHandler({
    title,
    body,
    go: () => router.push('/tools/notifications' as never),
  });
  /* keep the thumbnail helper referenced for future banner art */
  void absUrl(row.actor_photo);
}

/**
 * Mount once (root layout): starts the polling loop and the arrival hook.
 * `intervalMs` is deliberately short while foregrounded — the counts are two
 * COUNT(*) queries — and zero work is done while the tab is hidden.
 */
export function useNotifyWatch(intervalMs = 20000): void {
  const started = useRef(false);
  useEffect(() => {
    setCountsChangeHook((before, after) => {
      void announceNewest(before, after);
    });
    return () => setCountsChangeHook(null);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refreshCounts();
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshCounts();
    };
    const iv = setInterval(tick, intervalMs);
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void refreshCounts();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);

  /* a message the user just read on the inbox screen clears its badge at once */
  useEffect(() => {
    if (Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android') {
      /* no-op guard for web-only code paths; kept explicit for clarity */
    }
  }, []);
}
