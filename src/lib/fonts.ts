import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

/**
 * DeenLink type system (same families as the web frontend):
 *  - Poppins (Regular/Medium/SemiBold/Bold/ExtraBold) → UI
 *  - Amiri (Regular/Bold) → Arabic / Qur'an (RTL)
 *  - ArefRuqaa (Regular/Bold) → calligraphic honorifics
 *  - Sora / Manrope → display accents (these two are VARIABLE fonts)
 *
 * pass 51 — this used `useFonts`, which resolves to `loaded` only if EVERY
 * face loads. `Sora.ttf` and `Manrope.ttf` are variable fonts and some Android
 * versions reject them; one rejection left `loaded` false forever, and because
 * the root layout gates both its first render and SplashScreen.hideAsync() on
 * that flag, the app sat on the splash until Android killed it. Fonts are now
 * loaded individually with per-face error swallowing, and the hook ALWAYS
 * resolves — a missing face degrades to the system font instead of killing
 * startup.
 */
const FACES: Record<string, number> = {
  Poppins: require('../fonts/Poppins-Regular.ttf'),
  'Poppins-Medium': require('../fonts/Poppins-Medium.ttf'),
  'Poppins-SemiBold': require('../fonts/Poppins-SemiBold.ttf'),
  'Poppins-Bold': require('../fonts/Poppins-Bold.ttf'),
  'Poppins-ExtraBold': require('../fonts/Poppins-ExtraBold.ttf'),
  Amiri: require('../fonts/Amiri-Regular.ttf'),
  'Amiri-Bold': require('../fonts/Amiri-Bold.ttf'),
  ArefRuqaa: require('../fonts/ArefRuqaa-Regular.ttf'),
  'ArefRuqaa-Bold': require('../fonts/ArefRuqaa-Bold.ttf'),
  Sora: require('../fonts/Sora.ttf'),
  Manrope: require('../fonts/Manrope.ttf'),
};

export function useAppFonts(): [boolean] {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all(
        Object.entries(FACES).map(async ([name, resource]) => {
          try {
            await Font.loadAsync(name, resource);
          } catch {
            /* this face is unusable on this device — fall back to system font */
          }
        }),
      );
      /* Always resolve: never let a font problem hold boot hostage. */
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return [loaded];
}
