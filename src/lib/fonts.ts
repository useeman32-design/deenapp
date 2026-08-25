import { useFonts } from 'expo-font';

/**
 * Loads the DeenLink type system:
 *  - Sora     → display & headings (modern, geometric, premium)
 *  - Manrope  → body, captions, buttons
 *  - Amiri    → Arabic / Qur'an (Naskh, highly readable, RTL)
 */
export function useAppFonts(): [boolean] {
  const [loaded] = useFonts({
    Sora: require('../fonts/Sora.ttf'),
    Manrope: require('../fonts/Manrope.ttf'),
    Amiri: require('../fonts/Amiri-Regular.ttf'),
    'Amiri-Bold': require('../fonts/Amiri-Bold.ttf'),
  });
  return [loaded];
}
