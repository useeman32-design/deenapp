import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { UIScaleProvider } from '@/context/UIScale';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useAppFonts } from '@/lib/fonts';
import { NetPill } from '@/lib/net';
import { SplashGate } from '@/components/SplashGate';
import { QuranAudioProvider } from '@/context/QuranAudioContext';
import { initPushNotifications, registerPushResponseHandler } from '@/lib/push';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const [fontsLoaded] = useAppFonts();
  const { ready, user } = useAuth();
  const { theme, isDark } = useTheme();

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsLoaded]);

  /* pass 49: Expo mobile push — handle taps once, and (re)register this
   * device's push token whenever a user is signed in. Native builds only. */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    return registerPushResponseHandler();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !user) return;
    initPushNotifications().catch(() => {});
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
    ]
      .map(([fam, file]) => `@font-face{font-family:'${fam}';src:url('${base}/fonts/${file}.ttf') format('truetype');font-display:swap;}`)
      .join('');
    /* Large-screen responsiveness (web only): keep the exact mobile design but
     * centre it in a phone-width column on tablets/desktops so nothing stretches
     * edge-to-edge. Mobile widths and native builds are untouched. */
    const responsive = `
      @media (min-width: 620px) {
        html, body { background: #0B0F0E; }
        #root { max-width: 480px; margin: 0 auto; height: 100%; min-height: 100vh; position: relative;
                box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 18px 60px rgba(0,0,0,0.5); overflow: hidden; }
      }`;
    el.textContent = `${faces} html, body { font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif; } ${responsive}`;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SplashGate ready={ready}>
      <QuranAudioProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* TikTok-style reels feed — opens over everything, swipe up/down */}
        <Stack.Screen name="videos" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', statusBarHidden: false }} />
      </Stack>
      <RNStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.dash.bg} translucent={false} />
      {/* global connectivity pill — slow network while media loads, red banner when offline */}
      <NetPill />
      </QuranAudioProvider>
    </SplashGate>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <UIScaleProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
        </UIScaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
