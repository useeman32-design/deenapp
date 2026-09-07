import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import type { BadgeType } from '@/api/types';

/**
 * DeenLink verification badge — same 12-point star polygon as the web frontend
 * (blue = verified account, green = verified scholar, gold = official DeenLink).
 */
export function VerificationBadge({ type, size = 16 }: { type: BadgeType; size?: number }) {
  if (!type || !['blue', 'green', 'gold'].includes(type)) return null;

  const fill = type === 'blue' ? '#2d7bf4' : type === 'green' ? '#1d6f42' : `url(#dlGold_${size})`;

  return (
    <Svg width={size} height={size} viewBox="0 0 122.88 116.87">
      {type === 'gold' ? (
        <Defs>
          <LinearGradient id={`dlGold_${size}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fff3b0" />
            <Stop offset="0.25" stopColor="#f6c343" />
            <Stop offset="0.55" stopColor="#d79215" />
            <Stop offset="0.78" stopColor="#fff0a6" />
            <Stop offset="1" stopColor="#c7860a" />
          </LinearGradient>
        </Defs>
      ) : null}
      <Polygon
        fill={fill}
        fillRule="evenodd"
        points="61.37 8.24 80.43 0 90.88 17.79 111.15 22.32 109.15 42.85 122.88 58.43 109.2 73.87 111.15 94.55 91 99 80.43 116.87 61.51 108.62 42.45 116.87 32 99.08 11.73 94.55 13.73 74.01 0 58.43 13.68 42.99 11.73 22.32 31.88 17.87 42.45 0 61.37 8.24"
      />
      <Path
        fill="#fff"
        d="M37.92,65c-6.07-6.53,3.25-16.26,10-10.1,2.38,2.17,5.84,5.34,8.24,7.49L74.66,39.66C81.1,33,91.27,42.78,84.91,49.48L61.67,77.2a7.13,7.13,0,0,1-9.9.44C47.83,73.89,42.05,68.5,37.92,65Z"
      />
    </Svg>
  );
}
