import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { getPackDir } from './nativePack';

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
/* pass 111 — face → pack-relative file. require() stays for web/dev; release
 * native reads the same files from the unpacked content pack (see nativePack). */
const FONT_FILES: Record<string, string> = {
  Poppins: 'Poppins-Regular.ttf',
  'Poppins-Medium': 'Poppins-Medium.ttf',
  'Poppins-SemiBold': 'Poppins-SemiBold.ttf',
  'Poppins-Bold': 'Poppins-Bold.ttf',
  'Poppins-ExtraBold': 'Poppins-ExtraBold.ttf',
  Amiri: 'Amiri-Regular.ttf',
  'Amiri-Bold': 'Amiri-Bold.ttf',
  ArefRuqaa: 'ArefRuqaa-Regular.ttf',
  'ArefRuqaa-Bold': 'ArefRuqaa-Bold.ttf',
  Sora: 'Sora.ttf',
  Manrope: 'Manrope.ttf',
};

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

export function useAppFonts(gate = true): [boolean] {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!gate) return; /* pass 111 — wait for the native pack before loading faces */
    let alive = true;
    (async () => {
      /* pass 111 — release native: the packaged ttf assets are unreadable
       * (gradle mangles them), so load each face straight from the unpacked
       * pack on disk. Web/dev keep the require()d resources. getPackDir()
       * already carries the file:// scheme + trailing slash. */
      const pdir = getPackDir();
      await Promise.all(
        Object.entries(FACES).map(async ([name, resource]) => {
          try {
            if (pdir && FONT_FILES[name]) {
              await Font.loadAsync(name, pdir + 'src/fonts/' + FONT_FILES[name]);
            } else {
              await Font.loadAsync(name, resource);
            }
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
  }, [gate]);

  return [loaded];
}
