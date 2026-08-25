import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export function ProgressRing({
  size = 62,
  stroke = 6,
  progress,
  color,
  trackColor,
  children,
}: {
  size?: number;
  stroke?: number;
  /** 0..1 */
  progress: number;
  color: string;
  trackColor: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, c * progress)} ${c}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}
