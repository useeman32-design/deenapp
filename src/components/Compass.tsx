import React from 'react';
import { Image, View } from 'react-native';
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
  /* bold rotation arrows — point the way the phone must turn (pass 23) */
  const chevrons: React.ReactNode[] = [];
  if (delta != null && !aligned) {
    const dir = delta > 0 ? 1 : -1; // right / left
    for (let i = 0; i < 4; i++) {
      const deg = dir * (10 + i * 20);
      const rad = ((deg - 90) * Math.PI) / 180;
      const rr = R - 30;
      const x = c + rr * Math.cos(rad);
      const y = c + rr * Math.sin(rad);
      const rot = deg + (dir > 0 ? 90 : -90);
      chevrons.push(
        <G key={i} transform={`translate(${x} ${y}) rotate(${rot})`} opacity={1 - i * 0.2}>
          <Polygon points="0,-8.5 8.5,6 0,2 -8.5,6" fill={i === 0 ? '#D4AF37' : 'rgba(212,175,55,0.6)'} stroke={i === 0 ? '#8C6D1F' : 'none'} strokeWidth={0.6} />
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

          {/* marker seat at the TRUE bearing (photo marker overlays above) */}
          <G transform={`rotate(${bearing} ${c} ${c})`}>
            <Circle cx={c} cy={c - (R - 44)} r={17} fill={aligned ? '#4AE38F' : '#D4AF37'} opacity={aligned ? 0.22 : 0.14} />
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

      {/* pass 29: REAL Kaaba photo marker at the live bearing (overlays the
       * SVG — the rose rotates under it) with a front arrow pointing at the
       * Kaaba and a back arrow on the opposite side of the dial */}
      {(() => {
        const a = ((bearing - (heading ?? 0)) * Math.PI) / 180;
        const rr = R - 44;
        const mx = c + rr * Math.sin(a);
        const my = c - rr * Math.cos(a);
        const backA = a + Math.PI;
        const bx = c + (R - 16) * Math.sin(backA);
        const by = c - (R - 16) * Math.cos(backA);
        return (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: mx - 17,
                top: my - 17,
                width: 34,
                height: 34,
                borderRadius: 17,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: aligned ? '#4AE38F' : '#D4AF37',
                backgroundColor: '#000',
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 2 },
              }}
            >
              <Image source={require('../../assets/images/kaaba.jpg')} style={{ width: 34, height: 34 }} />
            </View>
            <Svg width={size} height={size} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
              {/* FRONT arrow — right beside the Kaaba marker, pointing at it */}
              <G transform={`translate(${mx + 24 * Math.sin(a)} ${my - 24 * Math.cos(a)}) rotate(${(a * 180) / Math.PI})`}>
                <Polygon points="0,-9 7,7 0,3 -7,7" fill="#D4AF37" stroke="#8C6D1F" strokeWidth={0.7} />
              </G>
              {/* BACK arrow — opposite side, pointing away (qibla behind you) */}
              <G transform={`translate(${bx} ${by}) rotate(${(backA * 180) / Math.PI})`} opacity={0.5}>
                <Polygon points="0,-7 5.5,5.5 0,2.2 -5.5,5.5" fill="none" stroke={theme.text} strokeWidth={1.2} />
              </G>
            </Svg>
          </>
        );
      })()}
    </View>
  );
}
