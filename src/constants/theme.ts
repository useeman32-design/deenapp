/**
 * DeenLink design tokens — the single source of truth for the visual system.
 * Emerald + gold, cream / deep-forest themes. Gold is an accent, never dominant.
 */

export const brand = {
  primary: '#2F8A5B',
  gold: '#C9A227',
};

export const light = {
  background: '#F7F5EF',
  card: '#FFFFFF',
  card2: '#FBFAF5',
  cardSoft: '#F1F4EE',
  text: '#20302A',
  heading: '#122419',
  subtext: '#6E7F74',
  border: '#E8E4D7',
  primary: '#2F8A5B',
  primaryDark: '#256C48',
  primarySoft: '#E8F2EA',
  accent: '#B8912E',
  accentSoft: '#F6EFDB',
  danger: '#D6455C',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(18, 33, 25, 0.45)',
  glow: 'rgba(47, 138, 91, 0.10)',
};

export const dark = {
  background: '#07130D',
  card: '#0E211A',
  card2: '#132B21',
  cardSoft: '#152E23',
  text: '#E8F3EC',
  heading: '#F5FBF7',
  subtext: '#7E9789',
  border: '#1D372A',
  primary: '#34A66E',
  primaryDark: '#2B8A5B',
  primarySoft: '#143224',
  accent: '#D4AF4E',
  accentSoft: '#2B2412',
  danger: '#E0607A',
  onPrimary: '#FFFFFF',
  overlay: 'rgba(3, 10, 7, 0.55)',
  glow: 'rgba(52, 166, 110, 0.16)',
};

export type Theme = typeof light;

/* ----------------------------- Typography ----------------------------- */

export const fonts = {
  display: 'Sora',
  body: 'Manrope',
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

export const typeScale: Record<
  TypeVariant,
  { font: string; size: number; weight: string; lh: number; ls?: number }
> = {
  display: { font: 'Sora', size: 27, weight: '800', lh: 33 },
  h1: { font: 'Sora', size: 21, weight: '700', lh: 27 },
  h2: { font: 'Sora', size: 17.5, weight: '700', lh: 23 },
  h3: { font: 'Sora', size: 15, weight: '600', lh: 21 },
  body: { font: 'Manrope', size: 14, weight: '500', lh: 20 },
  bodyS: { font: 'Manrope', size: 13, weight: '500', lh: 19 },
  caption: { font: 'Manrope', size: 12, weight: '500', lh: 17 },
  meta: { font: 'Manrope', size: 10.5, weight: '700', lh: 14, ls: 1.1 },
  stat: { font: 'Sora', size: 20, weight: '700', lh: 26 },
  button: { font: 'Manrope', size: 13.5, weight: '700', lh: 18 },
  arabic: { font: 'Amiri', size: 21, weight: '400', lh: 40 },
  arabicL: { font: 'Amiri', size: 26, weight: '400', lh: 48 },
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
      shadowColor: '#16301F',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    float: {
      shadowColor: '#16301F',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
  dark: {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    float: {
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
  },
} as const;
