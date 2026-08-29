import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

/**
 * LIVE qibla compass (pass 18).
 *
 * The rose rotates by −heading (so it mirrors the real world: the top of
 * the phone is where you're pointing). The Qibla marker sits at `bearing`
 * on the rose; when it reaches the fixed top pointer you face the Kaaba.
 *
 *  · heading == null → static rose + qibla marker (manual mode)
 *  · |delta| <= tolerance → glow + "aligned"
 */
export function Compass({
  bearing,
  heading,
  size = 260,
  delta,
}: {
  bearing: number;
  /** live compass heading in degrees, null = no sensor */
  heading: number | null;
  size?: number;
  /** signed qibla−heading difference; used for the glow */
  delta: number | null;
}) {
  const { theme, isDark } = useTheme();
  const c = size / 2;
  const R = size / 2 - 10;
  const aligned = delta != null && Math.abs(delta) <= 3;

  const ticks: React.ReactNode[] = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const rad = ((d - 90) * Math.PI) / 180;
    const len = major ? 14 : 7;
    ticks.push(
      <Line
        key={d}
        x1={c + (R - 3) * Math.cos(rad)}
        y1={c + (R - 3) * Math.sin(rad)}
        x2={c + (R - 3 - len) * Math.cos(rad)}
        y2={c + (R - 3 - len) * Math.sin(rad)}
        stroke={d === 0 ? '#E05B5B' : major ? theme.subtext : theme.border}
        strokeWidth={major ? 1.6 : 1}
      />,
    );
  }

  const labels = [
    { d: 0, t: 'N' },
    { d: 90, t: 'E' },
    { d: 180, t: 'S' },
    { d: 270, t: 'W' },
  ];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={R} fill={isDark ? '#0B120E' : '#FFFFFF'} stroke={theme.border} strokeWidth={1.5} />

        {/* rotating rose */}
        <G transform={`rotate(${heading == null ? 0 : -heading} ${c} ${c})`}>
          {ticks}
          {labels.map((l) => {
            const rad = ((l.d - 90) * Math.PI) / 180;
            const x = c + (R - 26) * Math.cos(rad);
            const y = c + (R - 26) * Math.sin(rad);
            return (
              <SvgText key={l.d} x={x} y={y + 5} fontSize={14} fontWeight="800" fill={l.d === 0 ? '#E05B5B' : theme.text} textAnchor="middle">
                {l.t}
              </SvgText>
            );
          })}

          {/* Qibla marker at its true bearing on the rose */}
          <G transform={`rotate(${bearing} ${c} ${c})`}>
            <Line x1={c} y1={c - (R - 6)} x2={c} y2={c - (R - 40)} stroke="#D4AF37" strokeWidth={3} strokeLinecap="round" />
            <G transform={`translate(${c} ${c - (R - 55)})`}>
              <Rect x={-15} y={-12} width={30} height={24} rx={3.5} fill="#0D120F" stroke={aligned ? '#4AE38F' : '#D4AF37'} strokeWidth={1.8} />
              <Rect x={-15} y={-4} width={30} height={5} fill={aligned ? '#4AE38F' : '#D4AF37'} />
            </G>
          </G>
        </G>

        {/* centre hub + Kaaba glyph */}
        <Rect x={c - 17} y={c - 14} width={34} height={28} rx={4} fill="#0D120F" stroke="#2A2F2A" strokeWidth={1.5} />
        <Rect x={c - 17} y={c - 6} width={34} height={5} fill="#D4AF37" />
        <Circle cx={c} cy={c} r={2.6} fill={theme.primary} />

        {/* fixed pointer: the direction the top of the phone points */}
        <Polygon points={`${c},${c - R + 2} ${c - 8},${c - R - 10} ${c + 8},${c - R - 10}`} fill={aligned ? '#4AE38F' : theme.text} />

        {aligned ? <Circle cx={c} cy={c} r={R - 2} fill="none" stroke="#4AE38F" strokeWidth={2.5} opacity={0.65} /> : null}
      </Svg>
    </View>
  );
}
