export const brand = {
  primary: '#0E7A5F',
  primaryDark: '#0A5946',
  primarySoft: '#E3F1EC',
  gold: '#C9A227',
  danger: '#D64545',
};

export const light = {
  background: '#F5F8F6',
  card: '#FFFFFF',
  text: '#15241F',
  subtext: '#5D6E67',
  border: '#E2E9E5',
  primary: brand.primary,
  primaryDark: brand.primaryDark,
  primarySoft: brand.primarySoft,
  accent: brand.gold,
  danger: brand.danger,
};

export const dark = {
  background: '#0C1512',
  card: '#15211C',
  text: '#EDF5F1',
  subtext: '#93A69D',
  border: '#24352E',
  primary: '#2FB58C',
  primaryDark: '#238F70',
  primarySoft: '#14332A',
  accent: '#D9B44A',
  danger: '#E56A6A',
};

export type Theme = typeof light;
