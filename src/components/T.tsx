import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { typeScale, type TypeVariant, type Theme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useUIScale } from '@/context/UIScale';

type ColorKey = keyof Pick<
  Theme,
  'text' | 'heading' | 'subtext' | 'primary' | 'accent' | 'onPrimary' | 'danger' | 'goldBright'
>;

const DEFAULT_COLOR: Record<TypeVariant, ColorKey> = {
  display: 'heading',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  body: 'text',
  bodyS: 'text',
  caption: 'subtext',
  meta: 'subtext',
  stat: 'heading',
  button: 'onPrimary',
  arabic: 'text',
  arabicL: 'text',
};

/**
 * Centralized typography — Poppins for UI, Amiri for Arabic.
 * Every screen composes text through <T v="…"> so the hierarchy stays
 * consistent (matching the web frontend's font system).
 */
export function T({
  v = 'body',
  color,
  style,
  uppercase,
  ...rest
}: TextProps & {
  v?: TypeVariant;
  color?: ColorKey;
  uppercase?: boolean;
}) {
  const { theme } = useTheme();
  const ui = useUIScale();
  const t = typeScale[v];
  const c = color ?? DEFAULT_COLOR[v];
  /* pass 35 — scale every explicit fontSize too; ignore the OS font scale so
   * a small system font setting can no longer shrink the whole app (~80% bug) */
  const scaledStyle = Array.isArray(style) ? style : [style];
  const withScale = [
    {
      fontFamily: t.family,
      fontSize: Math.round(t.size * ui * 100) / 100,
      fontWeight: t.weight as TextStyle['fontWeight'],
      lineHeight: t.lh && t.lh >= t.size ? Math.round(t.lh * ui * 100) / 100 : t.lh,
      letterSpacing: t.ls,
      color: theme[c],
      textTransform: uppercase ? 'uppercase' : undefined,
    },
    ...scaledStyle.map((st) =>
      st && typeof st === 'object' && 'fontSize' in st && typeof (st as TextStyle).fontSize === 'number'
        ? { ...st, fontSize: Math.round(((st as TextStyle).fontSize as number) * ui * 100) / 100 }
        : st,
    ),
  ];
  return (
    <RNText
      {...rest}
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      style={withScale as TextStyle[]}
    />
  );
}
