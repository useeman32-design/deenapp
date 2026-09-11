import { useEffect, useState } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { UIScaleProvider } from '@/context/UIScale';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useAppFonts } from '@/lib/fonts';
import { NetPill } from '@/lib/net';
import { LoginModalHost } from '@/components/LoginModal';
import { SplashGate } from '@/components/SplashGate';
import { CrashBoundary } from '@/components/CrashBoundary';
import { QuranAudioProvider } from '@/context/QuranAudioContext';
import { initPushNotifications, registerPushResponseHandler } from '@/lib/push';
import { bmHydrate } from '@/lib/bookmarks';
import { initGuest } from '@/lib/guest';
import { IosPwaPrompt } from '@/components/IosPwaPrompt';

initGuest(); // pass 80 — restore guest flag once per app load

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const [fontsLoaded] = useAppFonts();
  const { ready, user } = useAuth();
  const { theme, isDark } = useTheme();

  /* pass 51 — BOOT WATCHDOG. `fontsLoaded` gated BOTH the first render and
   * SplashScreen.hideAsync(). If expo-font ever fails on a device (variable
   * fonts are rejected by some Android versions), the splash stayed up forever
   * with nothing rendered behind it and Android killed the process — exactly
   * the reported "shows the app logo, then terminates". Boot must never depend
   * on a resource that might not load: after 8s we proceed regardless. */
  const [booted, setBooted] = useState(false);
useEffect(() => {
    const t = setTimeout(() => setBooted(true), 8000);
    return () => clearTimeout(t);
  }, []);
  const bootOk = (ready && fontsLoaded) || booted;

  /* pass 83-5 — iOS Safari zooms the WHOLE screen when focusing an input whose
   * font-size is under 16px (owner: "search screens zoom when text field is
   * clicked"). Force 16px inputs on touch devices only; desktop + native
   * rendering are untouched. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.getElementById('dl-no-ios-zoom')) return;
    const st = document.createElement('style');
    st.id = 'dl-no-ios-zoom';
    st.textContent = '@media (pointer: coarse) { input, textarea { font-size: 16px !important; } }';
    document.head.appendChild(st);
  }, []);

  useEffect(() => {
    if (bootOk) SplashScreen.hideAsync().catch(() => {});
  }, [bootOk]);

  /* pass 49: Expo mobile push — handle taps once, and (re)register this
   * device's push token whenever a user is signed in. Native builds only. */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    return registerPushResponseHandler();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !user) return;
    initPushNotifications().catch(() => {});
    /* pass 83-30 — ring the adhan even when DeenLink is closed: rebuild the
     * lock-screen schedule (respects dl.prayer.settings.v1.adhan; self-guards
     * to native + no-op on web). */
    void import('@/lib/adhanNotify').then(({ syncAdhanSchedule }) => syncAdhanSchedule()).catch(() => {});
  }, [user?.id]);

  /* pass 69 — unified bookmark mirror: local first (instant UI), then the
   * server list overwrites it when signed in */
  useEffect(() => {
    if (!user) return;
    void bmHydrate();
  }, [user?.id]);

  /* pass 29: warm the Qur'an corpus in the background — the first
   * recite-search used to pay the whole 114-surah load */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    import('@/lib/quranSearch').then((m) => m.ensureQuranCorpus().catch(() => {})).catch(() => {});
  }, []);

  /* Web typography (pass 28): stable un-hashed font URLs Every deploy used
   * to orphan the hashed asset names — a cached bundle then got 404 fonts and
   * the WHOLE app fell back to one system font. These @font-face rules point
   * at /fonts/*.ttf (copied verbatim from public/), survive every deploy, and
   * match the exact family names RN styles request. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = document.createElement('style');
    const base = window.location.pathname.replace(/^(\/deenapp\b).*$/, '$1');
    const faces = [
      ['Poppins', 'Poppins-Regular'],
      ['Poppins-Medium', 'Poppins-Medium'],
      ['Poppins-SemiBold', 'Poppins-SemiBold'],
      ['Poppins-Bold', 'Poppins-Bold'],
      ['Poppins-ExtraBold', 'Poppins-ExtraBold'],
      ['Amiri', 'Amiri-Regular'],
      ['Amiri-Bold', 'Amiri-Bold'],
      ['ArefRuqaa', 'ArefRuqaa-Regular'],
      ['ArefRuqaa-Bold', 'ArefRuqaa-Bold'],
      /* pass 64 (restored in 66) — the composer types in Manrope and a few
       * headings in Sora; without these faces the web build silently fell back
       * to a system font and the two looked nothing like native. */
      ['Manrope', 'Manrope'],
      ['Sora', 'Sora'],
    ]
      .map(([fam, file]) => `@font-face{font-family:'${fam}';src:url('${base}/fonts/${file}.ttf') format('truetype');font-display:swap;}`)
      .join('');
    /* pass 64 (restored in 66) — WhatsApp rule: nothing in the app highlights.
     * Copy lives in the hold-menu, not in a text-selection drag. Inputs keep
     * their caret because -webkit-user-select:auto is re-asserted below. */
    const noSelect = `
      html, body, #root, div, span, p, h1, h2, h3, h4, h5, h6, li, a, button, label {
        -webkit-user-select: none; -webkit-touch-callout: none; user-select: none;
      }
      input, textarea, [contenteditable="true"] { -webkit-user-select: auto; user-select: auto; }`;
    /* pass 66 — the app canvas is FULL BLEED and theme-matched, the way a
     * professional app looks. Before this, the overscroll margin (and the
     * desktop letterbox) was a hard-coded #0B0F0E, which read as a grey band
     * under a light theme and as a wrong-black band under the green dashboard.
     * Now html/body/#root paint the live theme background everywhere the eye can
     * reach — above the header on an upward overscroll, below the composer on a
     * downward one, and beside the phone column on desktop — so there is no
     * white gap and no mismatched strip. Content still gets its safe-area
     * insets; only the canvas is full-bleed. --app-bg is written by the effect
     * below on every theme change, and overscroll-behavior:none stops the
     * browser's own pull-to-refresh from tearing the page down. */
    const canvas = `
      html, body { margin: 0; padding: 0; height: 100%; background: var(--app-bg, #0B0F14); overscroll-behavior: none; }
      body { color-scheme: dark light; }
      #root { height: 100%; background: var(--app-bg, #0B0F14); }`;
    /* Large-screen responsiveness (web only): keep the exact mobile design but
     * centre it in a phone-width column on tablets/desktops so nothing stretches
     * edge-to-edge. Mobile widths and native builds are untouched. */
    const responsive = `
      @media (min-width: 620px) {
        #root { max-width: 480px; margin: 0 auto; height: 100%; min-height: 100vh; position: relative;
                box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 18px 60px rgba(0,0,0,0.5); overflow: hidden; }
      }`;
    el.textContent = `${faces}${noSelect}${canvas} html, body { font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif; } ${responsive}`;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  /* pass 66 — keep the web canvas in lockstep with the live theme, and tell the
   * browser (mobile address bar, iOS safe area, dark-mode UI) which colour the
   * app is wearing, so the browser chrome never clashes with it either. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const bg = theme.background;
    document.documentElement.style.setProperty('--app-bg', bg);
    document.body.style.background = bg;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
  }, [theme.background]);

  if (!bootOk) return null;

  return (
    <SplashGate ready={bootOk}>
      <QuranAudioProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* TikTok-style reels feed — opens over everything, swipe up/down */}
        <Stack.Screen name="videos" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', statusBarHidden: false }} />
      </Stack>
      <RNStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.dash.bg} translucent={false} />
      {/* global connectivity pill — slow network while media loads, red banner when offline */}
      <NetPill />
      {/* pass 83-6 — guest "Login required" modal (works on web; RN Alert is a no-op there) */}
      <LoginModalHost />
      </QuranAudioProvider>
    </SplashGate>
  );
}

export default function RootLayout() {
  return (
    <CrashBoundary>
    <SafeAreaProvider>
      <ThemeProvider>
        <UIScaleProvider>
        <AuthProvider>
          <Root />
          {/* pass 83-31 — iOS Safari: "Add to Home Screen" nudge (dismissable) */}
          <IosPwaPrompt />
        </AuthProvider>
        </UIScaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </CrashBoundary>
  );
}
