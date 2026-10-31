import { useEffect, useState } from 'react';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { UIScaleProvider } from '@/context/UIScale';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useAppFonts } from '@/lib/fonts';
import { NetPill } from '@/lib/net';
import { LoginModalHost } from '@/components/LoginModal';
import { LocationModalHost } from '@/components/LocationModal';
import { AlertHost } from '@/lib/alert';
import { NotifyBanner } from '@/components/NotifyBanner';
import { GoogleCompleteModal } from '@/components/GoogleComplete';
import { useNotifyWatch } from '@/lib/notifyCenter';
import { SplashGate } from '@/components/SplashGate';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { CrashBoundary } from '@/components/CrashBoundary';
import { GlobalConfirmDialog } from '@/components/ConfirmDialog';
import { SuspensionNotice } from '@/components/SuspensionNotice';
import { QuranAudioProvider } from '@/context/QuranAudioContext';
import { initPushNotifications, registerPushResponseHandler } from '@/lib/push';
import { startAdhanBootSync } from '@/lib/adhanBoot';
import { useResponsive, webContentCss } from '@/lib/responsive';
import { bmHydrate } from '@/lib/bookmarks';
import { initGuest } from '@/lib/guest';
import { installWebAssetBase } from '@/lib/assetUri';

initGuest(); // pass 80 — restore guest flag once per app load

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  // Bundled fonts and images do not require a startup download.
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
    const t = setTimeout(() => setBooted(true), 5000);
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


  /* pass 49: Expo mobile push — handle taps once, and (re)register this
   * device's push token whenever a user is signed in. Native builds only. */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    return registerPushResponseHandler();
  }, []);

  /* pass 107 — the adhan schedule is built 3 days ahead, and until now the ONLY
   * thing that rebuilt it was tapping "enable adhan" on the Prayer screen. A
   * user who enabled it once and never returned to that screen stopped getting
   * prayer alerts on day 4 with nothing to explain why. This resyncs at boot and
   * on every return to the foreground. Native only; it no-ops on web, when the
   * adhan is off, and when permission was never granted. */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    return startAdhanBootSync();
  }, []);

  useEffect(() => {
    if (!user) return;
    /* Web and native registration both run after authentication. The helper
     * asks the browser/OS for permission, registers the subscription/token,
     * and is fully best-effort. */
    initPushNotifications().catch(() => {});
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
    const base = /^\/deenapp(?:\/|$)/.test(window.location.pathname) ? '/deenapp' : '';
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
    /* pass 107 — the old rule here pinned #root to a hard 480px column at any
     * viewport >= 620px. That is what made the web app look like a phone on a
     * laptop: a 1920px monitor got one narrow strip down the middle. Content
     * width is now decided by <ResponsiveShell> in JS, from one set of
     * breakpoints shared with the native build, so web and an Android tablet
     * behave the same way instead of one being letterboxed and the other
     * stretching edge-to-edge. What web still needs from CSS is the canvas
     * beside the column and keeping the body from scrolling. */
    const responsive = webContentCss();
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

  return (
    <SplashGate ready={bootOk}>
      <MaintenanceGate>
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
      {/* pass 102 — change-location sheet + the "you seem to have moved" prompt.
          Global so any screen can open it and every screen sees the result. */}
      <LocationModalHost />
      </QuranAudioProvider>
      </MaintenanceGate>
    </SplashGate>
  );
}

/* pass 93 — runs once, before anything renders, so nested routes resolve local assets */
installWebAssetBase();


/**
 * pass 107 — the ONE place content width is capped.
 *
 * There is no shared screen wrapper to hang this on: `components/Screen.tsx`
 * looks like one, but none of the 73 routes in src/app actually use it, so every
 * screen builds its own layout from raw Views. Editing 73 screens to add a max
 * width is not a change anyone could verify before a Play deadline, so the cap
 * goes here instead — above the router, which means every screen, every modal
 * and the floating tab bar are constrained together.
 *
 * On a phone `contentMaxWidth` is null and this renders its children with no
 * wrapper at all, so the mobile build is byte-for-byte the same tree it was
 * before. Only tablets and desktops get the centred column.
 */
function ResponsiveShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { contentMaxWidth } = useResponsive();
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: contentMaxWidth ?? undefined,
          alignSelf: 'center',
          backgroundColor: theme.background,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/* pass 97 — one polling loop for the whole app (badges + arrivals) */
function NotifyWatch(): null {
  useNotifyWatch();
  return null;
}

export default function RootLayout() {
  return (
    <CrashBoundary>
    <SafeAreaProvider>
      <ThemeProvider>
        <UIScaleProvider>
        <AuthProvider>
          {/* pass 107 — caps content width on tablets/desktop; a no-op wrapper on phones */}
          <ResponsiveShell>
          <Root />
          <NotifyWatch />
          {/* pass 89 — one confirm sheet for every screen; Alert.alert is a no-op
              on web, which silently killed the DeenPoints unlock prompt. */}
          {/* pass 90 — the suspension strip + refusal notices live at the root so
           * they follow the user into every screen (below the dialog layer). */}
          <SuspensionNotice />
          <GlobalConfirmDialog />
          {/* pass 97 — the in-app replacement for Alert.alert on web (the OS
              dialog does not exist there, so every confirm/report/reason picker
              behind it was silently dead in the PWA). */}
          <AlertHost />
          {/* pass 97 — live unread badges + an in-app banner when something
              arrives (the PWA had neither). */}
          <NotifyBanner />
          {/* pass 99 — a Google sign-up must be finished before the app is usable;
              the modal appears wherever the user lands, on any device. */}
          <GoogleCompleteModal />
          </ResponsiveShell>
        </AuthProvider>
        </UIScaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </CrashBoundary>
  );
}
