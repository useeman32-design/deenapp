import { useFonts } from 'expo-font';

/**
 * DeenLink type system (same families as the web frontend):
 *  - Poppins (Regular/Medium/SemiBold/Bold/ExtraBold) → UI
 *  - Amiri (Regular/Bold) → Arabic / Qur'an (RTL)
 */
export function useAppFonts(): [boolean] {
  const [loaded] = useFonts({
    Poppins: require('../fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../fonts/Poppins-Bold.ttf'),
    'Poppins-ExtraBold': require('../fonts/Poppins-ExtraBold.ttf'),
    Amiri: require('../fonts/Amiri-Regular.ttf'),
    'Amiri-Bold': require('../fonts/Amiri-Bold.ttf'),
    'ArefRuqaa': require('../fonts/ArefRuqaa-Regular.ttf'),
    'ArefRuqaa-Bold': require('../fonts/ArefRuqaa-Bold.ttf'),
    Sora: require('../fonts/Sora.ttf'),
    Manrope: require('../fonts/Manrope.ttf'),
  });
  return [loaded];
}
