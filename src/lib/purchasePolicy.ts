import { Platform } from 'react-native';

/**
 * lib/purchasePolicy.ts — pass 105.
 *
 * WHICH IN-APP PURCHASES ARE ALLOWED ON THIS PLATFORM, IN ONE PLACE.
 *
 * Google Play's Payments policy requires digital goods that are used inside the
 * app to be sold through Google Play Billing. Two DeenLink products fall in that
 * category and are both charged through Flutterwave today:
 *
 *   · Premium    — unlocks extra reciters and premium cards, consumed in-app
 *   · DeenPoints — virtual credit spent on in-app unlocks
 *
 * That is correct on the web, but not permitted in an Android build distributed
 * on Google Play.
 *
 * External web checkout IS now a legitimate Google pattern — following the Epic
 * v. Google injunction and the March 2026 settlement, Google split its commission
 * into a 10% service fee (which applies to external web links too) plus a 5%
 * billing fee that only applies to Play Billing. But linking out is allowed only
 * inside an enrolled programme and only in specific markets: the US (External
 * Content Links, whose enrolment deadline of 28 Jan 2026 has passed), the UK and
 * EEA (Billing Choice, from 30 Jun 2026), then Australia (30 Sep 2026) and
 * Japan/Korea (31 Dec 2026), with the rest of the world — including Nigeria —
 * not before 30 September 2027. Where those programmes are live they also require
 * Play Billing to be offered ALONGSIDE the external link, after enrolment and
 * approval, with a disclosure shown before linking out.
 *
 * None of that applies to this build yet, so the Android purchase entry points
 * are closed until Play Billing is integrated. Flip `digitalPurchasesEnabled`
 * when that lands.
 *
 * ⚠️ THE WORDING CONSTRAINT — read this before editing the strings below.
 * The policy prohibits not just links but "language that encourages a user to
 * purchase the digital item outside of the app". So these notices must never
 * mention the website, a browser, "pay on the web", or any other route, even
 * though that route genuinely exists and works. They say "coming soon" and stop.
 * Telling Android users where else to buy is itself the violation.
 *
 * What is deliberately NOT gated here:
 *   · EARNING DeenPoints — not a purchase, so unaffected. Users keep earning and
 *     spending points they already have.
 *   · The physical drop-ship shop (`payShopOrder`) — Play's Payments policy does
 *     not cover physical goods, so Flutterwave stays.
 *   · Affiliate links (Jumia, Amazon, eBay, AliExpress) — third-party retailers,
 *     the user leaves the app.
 *   · The entire web build — the policy is specific to apps distributed on Play.
 */
export const digitalPurchasesEnabled: boolean = Platform.OS !== 'android';

export const COMING_SOON_TITLE = 'Coming soon';

export const PREMIUM_COMING_SOON =
  'Premium is not available for purchase in this version of the app yet. We will let you know when it opens.';

export const DEENPOINTS_COMING_SOON =
  'Buying DeenPoints is not available in this version of the app yet. You can still earn and use points as normal. We will let you know when purchases open.';

/**
 * Single place to test the gate, so screens read as intent rather than as a
 * platform comparison. Returns false on Android until Play Billing ships.
 */
export function canBuyDigital(): boolean {
  return digitalPurchasesEnabled;
}
