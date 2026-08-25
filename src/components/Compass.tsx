import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

/**
 * Qibla compass dial: degree ring, cardinal labels, rotating needle
 * and the Kaaba at the centre. When `aligned` the needle is drawn
 * pointing north with a glow ring.
 */
export function Compass({ bearing, aligned, size = 250 }: { bearing: number; aligned: boolean; size?: number }) {
  const { theme } = useTheme();
  const c = size / 2;
  const R = size / 2 - 8;

  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const rad = ((d - 90) * Math.PI) / 180;
    const len = major ? 15 : 7;
    ticks.push(
      <Line
        key={d}
        x1={c + (R - 3) * Math.cos(rad)}
        y1={c + (R - 3) * Math.sin(rad)}
        x2={c + (R - 3 - len) * Math.cos(rad)}
        y2={c + (R - 3 - len) * Math.sin(rad)}
        stroke={major ? theme.subtext : theme.border}
        strokeWidth={major ? 1.5 : 1}
      />,
    );
  }

  const labels = [
    { d: 0, t: 'N' },
    { d: 45, t: '45' },
    { d: 90, t: 'E' },
    { d: 135, t: '135' },
    { d: 180, t: 'S' },
    { d: 225, t: '225' },
    { d: 270, t: 'W' },
    { d: 315, t: '315' },
  ];

  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={R} fill="none" stroke={theme.border} strokeWidth={1.5} />
      {ticks}
      {labels.map((l) => {
        const rad = ((l.d - 90) * Math.PI) / 180;
        const x = c + (R - 32) * Math.cos(rad);
        const y = c + (R - 32) * Math.sin(rad);
        const cardinal = l.d % 90 === 0;
        return (
          <SvgText
            key={l.d}
            x={x}
            y={y + 4}
            fontSize={cardinal ? 14 : 9.5}
            fontWeight={cardinal ? '800' : '500'}
            fill={cardinal ? theme.text : theme.subtext}
            textAnchor="middle"
          >
            {l.t}
          </SvgText>
        );
      })}

      {/* needle */}
      <G transform={`rotate(${aligned ? 0 : bearing} ${c} ${c})`}>
        <Path d={`M ${c} ${c - 94} L ${c + 15} ${c - 24} L ${c} ${c - 40} L ${c - 15} ${c - 24} Z`} fill={theme.primary} />
        <Path d={`M ${c} ${c + 94} L ${c + 15} ${c + 24} L ${c} ${c + 40} L ${c - 15} ${c + 24} Z`} fill={theme.border} />
      </G>

      {/* Kaaba */}
      <G>
        <Rect x={c - 27} y={c - 21} width={54} height={42} rx={5} fill="#0D120F" stroke="#2A2F2A" strokeWidth={1.5} />
        <Rect x={c - 27} y={c - 13} width={54} height={7} fill={theme.accent} />
      </G>
      <Circle cx={c} cy={c} r={3.5} fill={theme.primary} />

      {aligned ? <Circle cx={c} cy={c} r={R - 9} fill="none" stroke={theme.primary} strokeWidth={2} opacity={0.5} /> : null}
    </Svg>
  );
}
