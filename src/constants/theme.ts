/**
 * DeenLink design tokens — ported from the deenlink.org web frontend
 * (theme/theme.css) and elevated for native. Gold stays an accent.
 */

export const brand = {
  primary: '#1D6F42',
  gold: '#D4AF37',
};

export const light = {
  background: '#F5F7F5',
  card: '#FFFFFF',
  card2: '#FBFDFB',
  cardSoft: '#F0F7F2',
  text: '#333333',
  heading: '#1F2D27',
  subtext: '#757575',
  border: '#E4E9E5',
  primary: '#1D6F42',
  primaryDark: '#155234',
  primarySoft: '#E8F5E9',
  accent: '#B8860B',
  accentSoft: '#FBF3DC',
  goldSoft: '#FBF3DC',
  danger: '#DC3545',
  dangerSoft: 'rgba(220, 53, 69, 0.10)',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(31, 45, 39, 0.45)',
  glow: 'rgba(29, 111, 66, 0.10)',
  goldBright: '#D4AF37',
};

export const dark = {
  background: '#141F26',
  card: '#22313E',
  card2: '#2C3E50',
  cardSoft: '#1E2C38',
  text: '#ECF0F1',
  heading: '#F5F8F9',
  subtext: '#BDC3C7',
  border: '#3A5063',
  primary: '#2ECC71',
  primaryDark: '#27AE60',
  primarySoft: '#1A3A2A',
  accent: '#F39C12',
  accentSoft: '#3A2E14',
  goldSoft: '#3A2E14',
  danger: '#E74C3C',
  dangerSoft: 'rgba(231, 76, 60, 0.16)',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(10, 18, 22, 0.55)',
  glow: 'rgba(46, 204, 113, 0.16)',
  goldBright: '#F39C12',
};

export type Theme = typeof light;

/* --------------------------- Quick tile tints --------------------------- */
/* Pastel tool tiles from the web quick-access grid (light / dark pairs). */

export type TileTint = { bg: string; bgDark: string; icon: string };

export const tiles = {
  dua: { bg: '#E8F5E9', bgDark: '#1A2E22', icon: '#1D6F42' },
  athkar: { bg: '#F3E5F5', bgDark: '#2A1F2E', icon: '#8E44AD' },
  donation: { bg: '#FFE5E5', bgDark: '#331E1E', icon: '#D64545' },
  tasbih: { bg: '#E0F2F1', bgDark: '#162B29', icon: '#00897B' },
  calendar: { bg: '#FFF3E0', bgDark: '#332A1A', icon: '#EF6C00' },
  hadith: { bg: '#FCE4EC', bgDark: '#322028', icon: '#C2185B' },
  names: { bg: '#E8EAF6', bgDark: '#1E2033', icon: '#3F51B5' },
  quiz: { bg: '#E0F7FA', bgDark: '#152B30', icon: '#00ACC1' },
  deenai: { bg: '#FFF8E1', bgDark: '#332D15', icon: '#F9A825' },
  videos: { bg: '#FCE4EC', bgDark: '#322028', icon: '#E91E63' },
  prayer: { bg: '#E0F2F1', bgDark: '#162B29', icon: '#00897B' },
  qibla: { bg: '#E8F5E9', bgDark: '#1A2E22', icon: '#1D6F42' },
  zakat: { bg: '#FFF3E0', bgDark: '#332A1A', icon: '#EF6C00' },
  question: { bg: '#E3F2FD', bgDark: '#172636', icon: '#1565C0' },
  learning: { bg: '#E8EAF6', bgDark: '#1E2033', icon: '#3F51B5' },
  wallpaper: { bg: '#E1F5FE', bgDark: '#152A33', icon: '#039BE5' },
} as const;

/* ----------------------------- Typography ----------------------------- */

export const fonts = {
  display: 'Poppins-ExtraBold',
  h: 'Poppins-Bold',
  hMedium: 'Poppins-SemiBold',
  body: 'Poppins-Medium',
  regular: 'Poppins',
  arabic: 'Amiri',
  arabicBold: 'Amiri-Bold',
} as const;

export type TypeVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyS'
  | 'caption'
  | 'meta'
  | 'stat'
  | 'button'
  | 'arabic'
  | 'arabicL';

/** family = the loaded font file (static weights); weight = CSS fontWeight. */
export const typeScale: Record<
  TypeVariant,
  { family: string; size: number; weight: string; lh: number; ls?: number }
> = {
  display: { family: 'Poppins-ExtraBold', size: 27, weight: '800', lh: 33 },
  h1: { family: 'Poppins-Bold', size: 21, weight: '700', lh: 27 },
  h2: { family: 'Poppins-Bold', size: 17.5, weight: '700', lh: 23 },
  h3: { family: 'Poppins-SemiBold', size: 15, weight: '600', lh: 21 },
  body: { family: 'Poppins-Medium', size: 14, weight: '500', lh: 20 },
  bodyS: { family: 'Poppins-Medium', size: 13, weight: '500', lh: 19 },
  caption: { family: 'Poppins-Medium', size: 12, weight: '500', lh: 17 },
  meta: { family: 'Poppins-SemiBold', size: 10.5, weight: '600', lh: 14, ls: 1 },
  stat: { family: 'Poppins-Bold', size: 20, weight: '700', lh: 26 },
  button: { family: 'Poppins-SemiBold', size: 13.5, weight: '600', lh: 18 },
  arabic: { family: 'Amiri', size: 21, weight: '400', lh: 40 },
  arabicL: { family: 'Amiri', size: 26, weight: '400', lh: 48 },
};

/* ----------------------------- Spacing ------------------------------ */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

/* --------------------------- Border radius --------------------------- */

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/* ----------------------------- Shadows ------------------------------ */

export const shadows = {
  light: {
    card: {
      shadowColor: '#1D6F42',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    float: {
      shadowColor: '#1D6F42',
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
  dark: {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    float: {
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
  },
} as const;
