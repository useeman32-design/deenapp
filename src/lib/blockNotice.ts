/**
 * pass 90 — suspension, the "browse but don't post" rule.
 *
 * Owner: "for suspended account I should be able to login but he cannot do any
 * of these: posting, comment, like — in fact he cannot perform any social media
 * activity. And on the attempt the message should be: your account has been
 * suspended contact support for more information. On banning he cannot login
 * and on the login screen he will get the message with the reason, thats fine."
 *
 * The server enforces the rule (interaction_guard() on every social write).
 * This module makes the refusal VISIBLE: a central notice bus that the API
 * client feeds whenever a write comes back 403, and pure helpers screens use to
 * grey themselves out before the request even starts.
 */
import { useEffect, useState } from 'react';

export type BlockNotice = { id: number; text: string; at: number };

/** How long a refusal stays on screen, and how fresh it must be to be shown. */
const NOTICE_TTL = 7000;
const REPLAY_FRESHNESS = 4000;

let seq = 0;
let last: BlockNotice | null = null;
const subs = new Set<(n: BlockNotice) => void>();

/** Report a refused action (API client, and screens that block locally). */
export function reportBlockedAction(text: string): void {
  const msg = String(text || '').trim();
  if (!msg) return;
  seq += 1;
  last = { id: seq, text: msg, at: Date.now() };
  subs.forEach((f) => {
    try {
      f(last as BlockNotice);
    } catch {
      /* never let a listener break a request */
    }
  });
}

/** The most recent refusal, replayed to a subscriber only while it is fresh. */
export function subscribeBlockedAction(cb: (n: BlockNotice) => void): () => void {
  subs.add(cb);
  if (last && Date.now() - last.at < REPLAY_FRESHNESS) {
    try {
      cb(last);
    } catch {
      /* ignore */
    }
  }
  return () => {
    subs.delete(cb);
  };
}

/** Hook: latest refusal, auto-cleared after `NOTICE_TTL`. */
export function useBlockedAction(): { notice: BlockNotice | null; clear: () => void } {
  const [notice, setNotice] = useState<BlockNotice | null>(null);
  useEffect(() => subscribeBlockedAction(setNotice), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_TTL);
    return () => clearTimeout(t);
  }, [notice]);
  return { notice, clear: () => setNotice(null) };
}

export type MaybeUser = {
  account_status?: string;
  moderation_reason?: string;
  user_type?: string;
  scholar?: { approval_status?: string | null; level?: string | null; aqeedah?: string | null } | null;
} | null | undefined;

/** True while the signed-in account is suspended (read-only app access). */
export function isSuspendedUser(u: MaybeUser): boolean {
  return String(u?.account_status || '').toLowerCase() === 'suspended';
}

/** True when the account cannot sign in at all (banned / disabled). */
export function isLockedOutUser(u: MaybeUser): boolean {
  const st = String(u?.account_status || '').toLowerCase();
  return st === 'banned' || st === 'disabled';
}

/** The exact wording the server uses, so both sides read the same. */
export const SUSPENDED_MESSAGE =
  'Your account has been suspended. Contact support for more information.';

/** Block a social action locally and show the same message. Returns true when
 *  the action was blocked (call sites then return early). */
export function suspendedBlock(u: MaybeUser, fallback = SUSPENDED_MESSAGE): boolean {
  if (!isSuspendedUser(u)) return false;
  const reason = suspensionReason(u);
  reportBlockedAction(reason ? `${fallback} Reason: ${reason}` : fallback);
  return true;
}

/** Why the account is suspended (the reason the admin typed), if any. */
export function suspensionReason(u: MaybeUser): string {
  return String(u?.moderation_reason || '').trim();
}

/** "Mufti · Sunni" style label for the scholar tag, built from the session row. */
export function scholarTagLabel(u: MaybeUser): string {
  const sc = u?.scholar;
  if (!sc) return '';
  const status = String(sc.approval_status || '').toLowerCase();
  /* pass 91 — owner: "it logs me in as an ordinary user". A scholar whose
   * application is still with the verification team IS a scholar account: he
   * keeps the scholar tag, labelled with the review state, until the admin
   * assigns his level. */
  if (status === 'pending' || status === 'reviewing') return 'Scholar · under review';
  if (status !== 'approved') return '';
  const level = String(sc.level || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .filter(Boolean)
    .join(' ');
  const aqRaw = String(sc.aqeedah || '')
    .trim()
    .toLowerCase();
  let aq = '';
  if (aqRaw) {
    if (aqRaw.includes('sunna') || aqRaw.includes('sunni')) aq = 'Sunni';
    else if (aqRaw.includes('hadith')) aq = 'Ahle Hadith';
    else if (aqRaw.includes('shia') || aqRaw.includes('jafari')) aq = 'Shia';
    else if (aqRaw.includes('sufi')) aq = 'Sufi';
    else if (aqRaw.includes('ibadi')) aq = 'Ibadi';
    else
      aq = aqRaw
        .split(' ')
        .slice(0, 3)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
  return [level || 'Scholar', aq].filter(Boolean).join(' · ');
}
