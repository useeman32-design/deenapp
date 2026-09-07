import Svg, { Path } from 'react-native-svg';

/**
 * DeenLink brand mark: mihrab arch with crescent, star and open book.
 */
export function DeenLogo({
  size = 96,
  color = '#3E9463',
  accent = '#C9A227',
}: {
  size?: number;
  color?: string;
  accent?: string;
}) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 100 120">
      <Path
        d="M 8 116 L 8 52 Q 8 14 50 2 Q 92 14 92 52 L 92 116 Z"
        fill={color}
        stroke={accent}
        strokeWidth={2.5}
      />
      {/* crescent */}
      <Path d="M 52 26 A 14 14 0 1 0 69 45 A 11 11 0 1 1 52 26 Z" fill="#FFFFFF" />
      {/* star */}
      <Path
        d="M 70 26 l 1.7 3.5 3.9 0.6 -2.8 2.7 0.7 3.9 -3.5 -1.8 -3.5 1.8 0.7 -3.9 -2.8 -2.7 3.9 -0.6 Z"
        fill="#FFFFFF"
      />
      {/* open book */}
      <Path
        d="M 28 82 C 37 75.8 46.5 75.8 50 80 C 53.5 75.8 63 75.8 72 82 L 72 102 C 63 96.8 53.5 96.8 50 101 C 46.5 96.8 37 96.8 28 102 Z"
        fill="#FFFFFF"
      />
      <Path d="M 50 80 L 50 101" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}
