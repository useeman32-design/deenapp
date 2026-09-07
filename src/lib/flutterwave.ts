import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { donationInit, pointsInit, pointsVerify, premiumInit, shopPayInit, type FlwCheckout, type PayInit } from '@/api/client';
import { storage } from '@/lib/storage';

/**
 * pass 69 — one Flutterwave flow for the whole app.
 *
 * WEB: loads checkout.flutterwave.com/v3.js once, opens the Inline Checkout
 * modal with the server-built payload, then verifies server-side the moment
 * the modal closes (callback or user-dismiss — verify is idempotent, so a
 * cancelled payment simply comes back "not paid").
 *
 * NATIVE: no JS checkout exists, so the server creates the transaction via
 * Flutterwave's API (init redirect mode) and we open the hosted page in the
 * system browser. The tx_ref is parked in storage; `settlePendingPayment()`
 * verifies it the next time the purchase screen regains focus.
 */

const PENDING_KEY = 'dl.flw.pending_tx';

let v3Loading: Promise<boolean> | null = null;
function loadFlwScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { FlutterwaveCheckout?: unknown }).FlutterwaveCheckout) return Promise.resolve(true);
  if (v3Loading) return v3Loading;
  v3Loading = new Promise<boolean>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.flutterwave.com/v3.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { v3Loading = null; resolve(false); };
    document.head.appendChild(s);
  });
  return v3Loading;
}

function inlineCheckout(checkout: FlwCheckout): Promise<'closed' | 'error'> {
  return new Promise((resolve) => {
    const w = window as unknown as { FlutterwaveCheckout?: (o: Record<string, unknown>) => void };
    if (!w.FlutterwaveCheckout) { resolve('error'); return; }
    let done = false;
    w.FlutterwaveCheckout({
      ...checkout,
      callback: () => { if (!done) { done = true; resolve('closed'); } },
      onclose: () => { if (!done) { done = true; resolve('closed'); } },
    });
  });
}

export type PayResult = { ok: boolean; verified: boolean; balance?: number; message?: string; txRef?: string };

/** One payment runner for every purpose (DeenPoints, donation, premium).
 * The server decides what verify.php credits; this only drives the checkout. */
export async function runPayment(init: (redirect: boolean, redirectUrl?: string) => Promise<PayInit | null>): Promise<PayResult> {
  if (Platform.OS === 'web') {
    const r0 = await init(false);
    if (!r0?.checkout) { return { ok: false, verified: false, message: 'Could not start the payment. Check that Flutterwave is configured.' }; }
    const ready = await loadFlwScript();
    if (!ready) { return { ok: false, verified: false, message: 'Payment script failed to load. Check your connection.' }; }
    await inlineCheckout(r0.checkout);
    const v = await pointsVerify(r0.checkout.tx_ref);
    if (v?.ok) { return { ok: true, verified: true, balance: v.balance, message: v.message, txRef: r0.checkout.tx_ref }; }
    return { ok: true, verified: false, message: v?.message ?? 'Payment not completed.', txRef: r0.checkout.tx_ref };
  }
  /* native (pass 79) — hosted checkout in the IN-APP browser (Custom Tabs /
   * SFSafariViewController overlay) so the user never leaves DeenLink;
   * falls back to the system browser only if the overlay cannot open. */
  const r0 = await init(true, 'deenlink://pay-done');
  const link = r0?.redirect_url;
  const tx = r0?.tx_ref;
  if (!link || !tx) { return { ok: false, verified: false, message: 'Could not start the payment. Check that Flutterwave is configured.' }; }
  await storage.setItem(PENDING_KEY, tx).catch(() => {});
  let opened = false;
  try {
    const res = await WebBrowser.openAuthSessionAsync(link, 'deenlink://pay-done');
    opened = res.type !== 'dismiss';
    /* Returned from the overlay already? Verify right away (idempotent). */
    if (opened) {
      const v = await pointsVerify(tx);
      await storage.setItem(PENDING_KEY, '').catch(() => {});
      if (v?.ok) { return { ok: true, verified: true, balance: v.balance, message: v.message, txRef: tx }; }
      return { ok: true, verified: false, message: v?.message ?? 'Payment not completed.', txRef: tx };
    }
  } catch { opened = false; }
  if (!opened) { await Linking.openURL(link).catch(() => {}); }
  return { ok: true, verified: false, message: 'Complete the payment — it lands when you come back.', txRef: tx };
}

/** Buy DeenPoints. Returns after the server has had its verification shot. */
export function buyDeenPoints(points: number): Promise<PayResult> {
  return runPayment((redirect, redirectUrl) => pointsInit(points, redirect ? { redirect: true, redirectUrl } : undefined));
}

/** Donate (Sadaqah / Zakat / …) — live Flutterwave checkout. */
export function donate(donationType: string, amount: number, opts?: { note?: string; currency?: string }): Promise<PayResult> {
  return runPayment((redirect, redirectUrl) =>
    donationInit(donationType, amount, redirect ? { redirect: true, redirectUrl, ...opts } : { ...opts }));
}

/** Subscribe to Premium — live Flutterwave checkout. */
export function buyPremium(plan: 'monthly' | 'annual'): Promise<PayResult> {
  return runPayment((redirect, redirectUrl) => premiumInit(plan, redirect ? { redirect: true, redirectUrl } : undefined));
}

/** Pay a DeenLink Shop order (pass 79). Web → inline modal; native → in-app browser. */
export function payShopOrder(orderId: number): Promise<PayResult> {
  return runPayment((redirect, redirectUrl) => shopPayInit(orderId, redirect ? { redirect: true, redirectUrl } : undefined));
}

/** Native: verify the parked tx_ref when the user returns from the browser. */
export async function settlePendingPayment(): Promise<{ verified: boolean; balance?: number } | null> {
  if (Platform.OS === 'web') return null;
  const tx = await storage.getItem(PENDING_KEY).catch(() => null);
  if (!tx) return null;
  await storage.setItem(PENDING_KEY, '').catch(() => {});
  const v = await pointsVerify(tx);
  if (v?.ok) { return { verified: true, balance: v.balance }; }
  return { verified: false };
}
