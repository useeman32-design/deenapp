/**
 * DeenLink design tokens — ported from the deenlink.org web frontend
 * (theme/theme.css) and elevated for native. Gold stays an accent.
 */

export const brand = {
  primary: '#1D6F42',
  gold: '#D4AF37',
};

/* --------------------- Premium dashboard palette --------------------- */
/* Home dashboard + floating nav (Phase 2 design language):
   deep forest green / near black, glass cards, emerald + warm gold. */

export interface DashTheme {
  bg: string;
  bgSoft: string;
  card: string;
  cardBorder: string; // gold hairline
  greenBorder: string;
  emerald: string;
  emeraldDeep: string;
  gold: string;
  goldBright: string;
  text: string;
  subtext: string;
  faint: string;
  navBg: string;
  heroTop: string;
  heroBottom: string;
  patternOpacity: number;
}

const dashLight: DashTheme = {
  bg: '#F1F5EF',
  bgSoft: '#E8EFE6',
  card: '#FFFFFF',
  cardBorder: 'rgba(29,111,66,0.16)',
  greenBorder: 'rgba(29,111,66,0.22)',
  emerald: '#1D6F42',
  emeraldDeep: '#155C35',
  gold: '#B8860B',
  goldBright: '#D4AF37',
  text: '#182420',
  subtext: 'rgba(24,36,32,0.62)',
  faint: 'rgba(24,36,32,0.38)',
  navBg: 'rgba(255,255,255,0.82)',
  heroTop: 'rgba(8,26,17,0.88)',
  heroBottom: 'rgba(8,26,17,0.7)',
  patternOpacity: 0.3,
};

const dashDark: DashTheme = {
  bg: '#060D09',
  bgSoft: '#0A1710',
  card: '#0D1B13',
  cardBorder: 'rgba(212,175,55,0.22)',
  greenBorder: 'rgba(46,204,113,0.28)',
  emerald: '#2ECC71',
  emeraldDeep: '#1E9E5A',
  gold: '#D4AF37',
  goldBright: '#F1C40F',
  text: '#F2F7F3',
  subtext: 'rgba(226,240,230,0.62)',
  faint: 'rgba(226,240,230,0.36)',
  navBg: 'rgba(8,18,12,0.86)',
  heroTop: 'rgba(4,12,8,0.88)',
  heroBottom: 'rgba(4,12,8,0.68)',
  patternOpacity: 0.5,
};


export const light = {
  background: '#F5F5F5',
  card: '#FFFFFF',
  card2: '#FFFFFF',
  cardSoft: '#F5F5F5',
  text: '#333333',
  heading: '#1F2D27',
  subtext: '#757575',
  border: '#E0E0E0',
  primary: '#1D6F42',
  primaryDark: '#155C35',
  primarySoft: '#E8F5E9',
  accent: '#D4AF37',
  accentSoft: '#FBF3DC',
  goldSoft: '#FBF3DC',
  danger: '#DC3545',
  dangerSoft: 'rgba(220, 53, 69, 0.10)',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.55)',
  glass: 'rgba(255, 255, 255, 0.2)',
  glow: 'rgba(29, 111, 66, 0.10)',
  goldBright: '#D4AF37',
  quranBlue: '#1A5F7A',
  hadithPurple: '#6A1B9A',
  prayerBlue: '#1976D2',
  calendarPurple: '#7B1FA2',
  dash: dashLight,
};

export const dark = {
  background: '#0B0F14',
  card: '#2C3E50',
  card2: '#34495E',
  cardSoft: '#34495E',
  text: '#ECF0F1',
  heading: '#F5F8F9',
  subtext: '#BDC3C7',
  border: '#4A6572',
  primary: '#2ECC71',
  primaryDark: '#27AE60',
  primarySoft: '#1A3A2A',
  accent: '#F39C12',
  accentSoft: '#3A2E14',
  goldSoft: '#3A2E14',
  danger: '#E74C3C',
  dangerSoft: 'rgba(231, 76, 60, 0.16)',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.62)',
  glass: 'rgba(255, 255, 255, 0.2)',
  glow: 'rgba(46, 204, 113, 0.16)',
  goldBright: '#F39C12',
  quranBlue: '#3498DB',
  hadithPurple: '#9B59B6',
  prayerBlue: '#3498DB',
  calendarPurple: '#9B59B6',
  dash: dashDark,
};

export type Theme = typeof light;

/* --------------------------- Quick tile tints --------------------------- */
/* Pastel tool tiles from the web quick-access grid (light / dark pairs). */

export type TileTint = { from: string; to: string; icon: string };

/**
 * Web quick-access tile gradients (theme.css / index.html vars, 135deg).
 * Keys follow the web class names; icon = FA-equivalent tint on light tiles.
 */
export const tiles = {
  askquestion: { from: '#E3F2FD', to: '#BBDEFB', icon: '#1565C0' },
  videos: { from: '#FFE5EC', to: '#FFB6C1', icon: '#C2185B' },
  deenai: { from: '#E8F5E9', to: '#C8E6C9', icon: '#1D6F42' },
  shop: { from: '#FFF8E1', to: '#FFECB3', icon: '#F9A825' },
  dua: { from: '#E8F5E9', to: '#C8E6C9', icon: '#1D6F42' },
  athkar: { from: '#F3E5F5', to: '#E1BEE7', icon: '#8E44AD' },
  addpost: { from: '#F1F8E9', to: '#DCEDC8', icon: '#558B2F' },
  wallpaper: { from: '#E1F5FE', to: '#B3E5FC', icon: '#0277BD' },
  donation: { from: '#FFE5E5', to: '#FFB3B3', icon: '#D32F2F' },
  calendar: { from: '#FFF3E0', to: '#FFCC80', icon: '#EF6C00' },
  tasbih: { from: '#E0F2F1', to: '#B2DFDB', icon: '#00796B' },
  hadith: { from: '#FCE4EC', to: '#F8BBD0', icon: '#C2185B' },
  quran: { from: '#E8F5E9', to: '#C8E6C9', icon: '#1D6F42' },
  names: { from: '#F3E5F5', to: '#E1BEE7', icon: '#6A1B9A' },
  quiz: { from: '#E0F7FA', to: '#80DEEA', icon: '#00838F' },
} as const;

/** Dark-theme tile pairs (theme.css dark vars). */
export const tilesDark: Record<keyof typeof tiles, { from: string; to: string }> = {
  askquestion: { from: '#1A2526', to: '#0D1A1A' },
  videos: { from: '#261A26', to: '#1A0D1A' },
  deenai: { from: '#26261A', to: '#1A1A0D' },
  shop: { from: '#26261A', to: '#1A1A0D' },
  dua: { from: '#1A2526', to: '#0D1A1A' },
  athkar: { from: '#1A1A26', to: '#0D0D1A' },
  addpost: { from: '#1A261A', to: '#0D1A0D' },
  wallpaper: { from: '#1A2626', to: '#0D1A1A' },
  donation: { from: '#261A1A', to: '#1A0D0D' },
  calendar: { from: '#26261A', to: '#1A1A0D' },
  tasbih: { from: '#1A2626', to: '#0D1A1A' },
  hadith: { from: '#261A26', to: '#1A0D1A' },
  quran: { from: '#1A2526', to: '#0D1A1A' },
  names: { from: '#1A1A26', to: '#0D0D1A' },
  quiz: { from: '#1A2626', to: '#0D1A1A' },
};

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
