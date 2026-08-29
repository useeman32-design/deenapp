import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

/**
 * LIVE qibla compass (pass 22 redesign):
 *  · a REAL Kaaba icon (dark cube + gold band + door) on the rose
 *  · chevron arrow pointers that show which way to rotate the phone
 *  · gold/emerald GLOW when aligned (within 3°)
 */
export function Compass({
  bearing,
  heading,
  size = 260,
  delta,
}: {
  bearing: number;
  heading: number | null;
  size?: number;
  delta: number | null;
}) {
  const { theme, isDark } = useTheme();
  const c = size / 2;
  const R = size / 2 - 12;
  const aligned = delta != null && Math.abs(delta) <= 3;

  const ticks: React.ReactNode[] = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const rad = ((d - 90) * Math.PI) / 180;
    const len = major ? 13 : 6;
    ticks.push(
      <Line
        key={d}
        x1={c + (R - 2) * Math.cos(rad)}
        y1={c + (R - 2) * Math.sin(rad)}
        x2={c + (R - 2 - len) * Math.cos(rad)}
        y2={c + (R - 2 - len) * Math.sin(rad)}
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

  /* rotation-direction chevrons: pointing from the top pointer toward the
   * qibla marker along the ring — the shortest way round */
  const chevrons: React.ReactNode[] = [];
  if (delta != null && !aligned) {
    const dir = delta > 0 ? 1 : -1; // right / left
    const spread = Math.min(150, Math.abs(delta));
    for (let i = 0; i < 3; i++) {
      const deg = dir * (12 + i * 22);
      const rad = ((deg - 90) * Math.PI) / 180;
      const rr = R - 34;
      const x = c + rr * Math.cos(rad);
      const y = c + rr * Math.sin(rad);
      const rot = deg + (dir > 0 ? 90 : -90);
      chevrons.push(
        <G key={i} transform={`translate(${x} ${y}) rotate(${rot})`} opacity={0.85 - i * 0.18}>
          <Polygon points="0,-6 6,4 0,1 -6,4" fill={i === 0 ? '#D4AF37' : 'rgba(212,175,55,0.55)'} />
        </G>,
      );
    }
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="qiblaGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0.72" stopColor={aligned ? '#4AE38F' : 'transparent'} stopOpacity="0.0" />
            <Stop offset="0.94" stopColor={aligned ? '#4AE38F' : '#D4AF37'} stopOpacity={aligned ? 0.5 : 0.16} />
            <Stop offset="1" stopColor={aligned ? '#4AE38F' : '#D4AF37'} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* halo / glow */}
        <Circle cx={c} cy={c} r={R + 10} fill="url(#qiblaGlow)" />
        <Circle cx={c} cy={c} r={R} fill={isDark ? '#0B120E' : '#FFFFFF'} stroke={aligned ? '#4AE38F' : theme.border} strokeWidth={aligned ? 2.2 : 1.5} />

        {/* rotating rose */}
        <G transform={`rotate(${heading == null ? 0 : -heading} ${c} ${c})`}>
          {ticks}
          {labels.map((l) => {
            const rad = ((l.d - 90) * Math.PI) / 180;
            const x = c + (R - 25) * Math.cos(rad);
            const y = c + (R - 25) * Math.sin(rad);
            return (
              <SvgText key={l.d} x={x} y={y + 5} fontSize={13} fontWeight="800" fill={l.d === 0 ? '#E05B5B' : theme.text} textAnchor="middle">
                {l.t}
              </SvgText>
            );
          })}

          {/* Kaaba icon at the TRUE bearing on the rose */}
          <G transform={`rotate(${bearing} ${c} ${c}) translate(${c} ${c - (R - 44)})`}>
            {/* glow behind the kaaba when aligned */}
            {aligned ? <Circle r={26} fill="#4AE38F" opacity="0.18" /> : null}
            {/* the Kaaba — dark silk cube with the gold band (hizam) */}
            <G transform="rotate(-8)">
              <Rect x={-16} y={-19} width={32} height={38} rx={4} fill={isDark ? '#100E0B' : '#171310'} stroke={aligned ? '#4AE38F' : '#D4AF37'} strokeWidth={1.6} />
              {/* gold band */}
              <Path d="M -16 -8 L 16 -8 L 16 -1 L -16 -1 Z" fill="#D4AF37" />
              <Rect x={-16} y={-19} width={32} height={38} rx={4} fill="none" stroke="rgba(212,175,55,0.35)" strokeWidth={0.7} />
              {/* the door (bab al-kaaba) */}
              <Rect x={-4.5} y={5} width={9} height={14} rx={4} fill="#D4AF37" opacity={0.92} />
              <Rect x={-4.5} y={5} width={9} height={14} rx={4} fill="none" stroke={isDark ? '#3A2E14' : '#8C6D1F'} strokeWidth={0.8} />
            </G>
          </G>

          {/* tick line from hub toward the kaaba */}
          <G transform={`rotate(${bearing} ${c} ${c})`}>
            <Line x1={c} y1={c - (R - 66)} x2={c} y2={c - (R - 30)} stroke={aligned ? '#4AE38F' : '#D4AF37'} strokeWidth={2} strokeLinecap="round" opacity={0.55} strokeDasharray="3 4" />
          </G>
        </G>

        {/* direction chevrons (fixed, near the top pointer) */}
        {chevrons}

        {/* fixed pointer at top: where the top of the phone points */}
        <Polygon points={`${c},${c - R + 1} ${c - 8},${c - R - 11} ${c + 8},${c - R - 11}`} fill={aligned ? '#4AE38F' : theme.text} />
        {/* hub */}
        <Circle cx={c} cy={c} r={5} fill={aligned ? '#4AE38F' : theme.primary} />
        <Circle cx={c} cy={c} r={2} fill="#FFFFFF" />

        {aligned ? (
          <>
            <Circle cx={c} cy={c} r={R - 3} fill="none" stroke="#4AE38F" strokeWidth={2.4} opacity={0.7} />
            <Circle cx={c} cy={c} r={R + 3} fill="none" stroke="#4AE38F" strokeWidth={1} opacity={0.4} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
