import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { typeScale, type TypeVariant, type Theme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type ColorKey = keyof Pick<
  Theme,
  'text' | 'heading' | 'subtext' | 'primary' | 'accent' | 'onPrimary' | 'danger'
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
 * Centralized typography. Every screen composes text through <T v="…"> so the
 * app never renders in a single flat font: Sora for display/headings,
 * Manrope for body/UI, Amiri for Arabic — each with its own size & line-height.
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
  const t = typeScale[v];
  const c = color ?? DEFAULT_COLOR[v];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: t.font,
          fontSize: t.size,
          fontWeight: t.weight as TextStyle['fontWeight'],
          lineHeight: t.lh,
          letterSpacing: t.ls,
          color: theme[c],
          textTransform: uppercase ? 'uppercase' : undefined,
        },
        style,
      ]}
    />
  );
}
