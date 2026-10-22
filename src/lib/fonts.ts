import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { Platform } from 'react-native';
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
    /* pass 115 — RELEASE NATIVE: every face is embedded at build time by the
     * expo-font config plugin (fonts/ -> android/app/src/main/assets/fonts/).
     * Android resolves fontFamily="Amiri" straight from that directory, and
     * expo-font's isLoaded() reports bundled fonts as loaded, so there is
     * nothing to fetch and nothing that can fail at runtime. The previous
     * approach (download a content pack, then loadAsync from disk) failed
     * silently on device: every face fell back to the system font, which is
     * why Arabic rendered in Roboto/Noto instead of Amiri.
     * Web and Expo Go still load the require()d files below. */
    if (Platform.OS !== 'web' && !__DEV__) {
      setLoaded(true);
      return;
    }
    if (!gate) return;
    let alive = true;
    (async () => {
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
            /* this face is unusable here — fall back to system font */
          }
        }),
      );
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [gate]);

  return [loaded];
}
