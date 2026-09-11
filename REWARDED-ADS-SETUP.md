# DeenLink — Rewarded Ads with Google (AdMob) — Setup Guide

Pass 83-30 deliverable. Follow these steps in order. Nothing here needs the
web bundle — rewarded ads are a **native (Android/iOS) feature** and require a
**dev/store build** (Expo Go cannot load the ads module).

---

## 1. Create the AdMob account + app

1. Go to <https://apps.admob.com> and sign in with the Google account you want
   payouts to land on (same one you use for Play Console).
2. **Apps → Add app** → platform **Android** → app is **not listed** yet? Choose
   "No" and set the name `DeenLink`. (If DeenLink is already on Play Store,
   choose "Yes" and search it — better match rates.)
3. Note the **App ID** — looks like `ca-app-pub-XXXXXX~YYYYYY`. You'll paste it
   into the app config in step 3.

## 2. Create the Rewarded ad unit

1. In the app → **Ad units → Add ad unit → Rewarded**.
2. Name: `deenlink_reward_v1`.
3. Default reward: e.g. `1` of reward type `deenpoint` (the amount you grant in
   code — keep it in sync with the server award).
4. Note the **Ad Unit ID** — looks like `ca-app-pub-XXXXXX/RRRRRRR`.

Also add a **Test device** later (AdMob → Settings → Test devices) so you never
click your own live ads.

## 3. Wire the app (Expo)

```bash
npx expo install react-native-google-mobile-ads
```

`app.json`:

```json
{
  "expo": {
    "plugins": [
      ["react-native-google-mobile-ads", {
        "androidAppId": "ca-app-pub-XXXXXX~YYYYYY",
        "iosAppId": "ca-app-pub-XXXXXX~ZZZZZZ",
        "userTrackingUsageDescription": "Your data is used to show you relevant ads."
      }]
    ]
  }
}
```

Native module (new file, lazily imported — same safety pattern as
`lib/adhanNotify.ts`):

```ts
// lib/rewardedAds.ts
let mod: typeof import('react-native-google-mobile-ads') | null = null;
export async function showRewardedAd(onReward: () => void): Promise<boolean> {
  try {
    mod = mod ?? await import('react-native-google-mobile-ads');
    const { RewardedAd, RewardedAdEventType, TestIds } = mod;
    const ad = RewardedAd.createAdForId(TestIds.REWARDED, { requestNonPersonalizedAdsOnly: true });
    return await new Promise<boolean>((resolve) => {
      const s1 = ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show());
      const s2 = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { onReward(); });
      const s3 = ad.addAdEventListener(mod.AdEventType.CLOSED, () => { s1(); s2(); s3(); resolve(true); });
      const s4 = ad.addAdEventListener(mod.AdEventType.ERROR, () => { s1(); s2(); s3(); s4(); resolve(false); });
      ad.load();
    });
  } catch { return false; }
}
```

While testing use `TestIds.REWARDED` — switch to your real unit id only in the
store build (gate on `__DEV__` / an env var).

Where to hook it in DeenLink: the **DeenPoints** screen "Watch an ad → earn
points" button → call `showRewardedAd(() => awardPoints(...))` and make the
award go through the SERVER (`api/deenpoints/award.php` with a signed receipt)
so balances can't be faked client-side.

## 4. Build + verify

1. Dev build: `npx expo run:android` (ads module is native — Expo Go won't load it).
2. Watch a test ad end-to-end; confirm the reward fires.
3. Add your device as a test device, swap in the real unit id, build a release
   APK/AAB, and only then enable live ads.
4. Google requires an **app-ads.txt** on your web domain once the app is on
   Play: AdMob → Apps → app-ads.txt → host it at `https://app.deenlink.org/app-ads.txt`
   (drop the file into the web root — it goes out with the next cPanel deploy).

## 5. Policy must-knows (get approved + stay approved)

- Never place rewards behind required clicks that mislead; the user must be
  able to skip the ad (rewarded = opt-in).
- Don't trigger ads during prayer screens/adhan — keep deen content ad-free;
  ads fit naturally in DeenPoints "earn" flows.
- EEA/UK: enable the Google-funded **Consent Management Platform** message in
  AdMob (Privacy & messaging) before serving personalized ads there.
- Payout threshold is $10; complete identity + address PIN verification when
  prompted, or ads stop serving.
