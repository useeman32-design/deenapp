import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

/**
 * LIVE qibla compass (pass 22 redesign):
 *  · a REAL Kaaba icon (dark cube + gold band + door) on the rose
 *  · chevron arrow pointers that show which way to rotate the phone
 *  · gold/emerald GLOW when aligned (within 3°)
 */
/* pass 38 — six selectable compass designs */
export type QiblaDesign = 'classic' | 'minimal' | 'night' | 'royal' | 'bedouin' | 'digital';

export const QIBLA_DESIGNS: Array<{ id: QiblaDesign; label: string; dot: [string, string] }> = [
  { id: 'classic', label: 'Classic', dot: ['#FFFFFF', '#D4AF37'] },
  { id: 'minimal', label: 'Minimal', dot: ['#F2F5F8', '#5F6B7A'] },
  { id: 'night', label: 'Night', dot: ['#0A1220', '#35E0FF'] },
  { id: 'royal', label: 'Royal', dot: ['#1C1230', '#D4AF37'] },
  { id: 'bedouin', label: 'Bedouin', dot: ['#F7EFDD', '#C07A2A'] },
  { id: 'digital', label: 'Digital', dot: ['#04120A', '#39FF9C'] },
];

type Palette = {
  dial: string; ring: string; tickMaj: string; tickMin: string; north: string;
  label: string; accent: string; ok: string; dots?: boolean; degrees?: boolean; cross?: boolean; ornate?: boolean; dashed?: boolean;
};

const PALETTES: Record<QiblaDesign, Palette> = {
  classic: { dial: '#FFFFFF', ring: 'rgba(127,140,130,0.35)', tickMaj: '#7F8C82', tickMin: 'rgba(127,140,130,0.35)', north: '#E05B5B', label: '#1F2A24', accent: '#D4AF37', ok: '#4AE38F' },
  minimal: { dial: '#F7F9FA', ring: 'rgba(95,107,122,0.25)', tickMaj: '#8B98A5', tickMin: 'rgba(139,152,165,0.3)', north: '#D9646E', label: '#3E4A56', accent: '#5F6B7A', ok: '#2FAE72', dots: true },
  night: { dial: '#0A1220', ring: 'rgba(53,224,255,0.28)', tickMaj: '#35E0FF', tickMin: 'rgba(53,224,255,0.28)', north: '#FF6B7A', label: '#CFE9F5', accent: '#35E0FF', ok: '#39FF9C' },
  royal: { dial: '#1C1230', ring: 'rgba(212,175,55,0.4)', tickMaj: '#E8C96A', tickMin: 'rgba(212,175,55,0.3)', north: '#E05B5B', label: '#F0E6F5', accent: '#D4AF37', ok: '#4AE38F', ornate: true },
  bedouin: { dial: '#F7EFDD', ring: 'rgba(192,122,42,0.4)', tickMaj: '#8A5A2B', tickMin: 'rgba(138,90,43,0.35)', north: '#C0392B', label: '#4A321F', accent: '#C07A2A', ok: '#2E8B57', dashed: true },
  digital: { dial: '#04120A', ring: 'rgba(57,255,156,0.3)', tickMaj: '#39FF9C', tickMin: 'rgba(57,255,156,0.25)', north: '#FF7A7A', label: '#BFFFE3', accent: '#39FF9C', ok: '#FFE066', degrees: true, cross: true },
};

export function Compass({
  bearing,
  heading,
  size = 260,
  delta,
  design = 'classic',
}: {
  bearing: number;
  heading: number | null;
  size?: number;
  delta: number | null;
  design?: QiblaDesign;
}) {
  const { theme } = useTheme();
  const c = size / 2;
  const R = size / 2 - 12;
  const aligned = delta != null && Math.abs(delta) <= 3;
  const P = PALETTES[design] ?? PALETTES.classic;

  const ticks: React.ReactNode[] = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const rad = ((d - 90) * Math.PI) / 180;
    const len = major ? 13 : 6;
    const col = d === 0 ? P.north : major ? P.tickMaj : P.tickMin;
    if (P.dots && !major) {
      ticks.push(<Circle key={d} cx={c + (R - 8) * Math.cos(rad)} cy={c + (R - 8) * Math.sin(rad)} r={1.4} fill={col} />);
    } else {
      ticks.push(
        <Line
          key={d}
          x1={c + (R - 2) * Math.cos(rad)}
          y1={c + (R - 2) * Math.sin(rad)}
          x2={c + (R - 2 - len) * Math.cos(rad)}
          y2={c + (R - 2 - len) * Math.sin(rad)}
          stroke={col}
          strokeWidth={major ? 1.6 : 1}
          strokeDasharray={P.dashed && major ? '3 2' : undefined}
        />,
      );
    }
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
          <Polygon points="0,-8.5 8.5,6 0,2 -8.5,6" fill={i === 0 ? P.accent : `${P.accent}99`} stroke={i === 0 ? '#8C6D1F' : 'none'} strokeWidth={0.6} />
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
            <Stop offset="0.94" stopColor={aligned ? P.ok : P.accent} stopOpacity={aligned ? 0.5 : 0.16} />
            <Stop offset="1" stopColor={aligned ? P.ok : P.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* halo / glow */}
        <Circle cx={c} cy={c} r={R + 10} fill="url(#qiblaGlow)" />
        <Circle cx={c} cy={c} r={R} fill={P.dial} stroke={aligned ? P.ok : P.ring} strokeWidth={aligned ? 2.2 : 1.5} />
        {P.ornate ? <Circle cx={c} cy={c} r={R - 7} fill="none" stroke={`${P.accent}66`} strokeWidth={1} /> : null}
        {P.cross ? (
          <>
            <Line x1={c} y1={c - R} x2={c} y2={c + R} stroke={P.tickMin} strokeWidth={0.6} />
            <Line x1={c - R} y1={c} x2={c + R} y2={c} stroke={P.tickMin} strokeWidth={0.6} />
          </>
        ) : null}

        {/* rotating rose */}
        <G transform={`rotate(${heading == null ? 0 : -heading} ${c} ${c})`}>
          {ticks}
          {labels.map((l) => {
            const rad = ((l.d - 90) * Math.PI) / 180;
            const x = c + (R - 25) * Math.cos(rad);
            const y = c + (R - 25) * Math.sin(rad);
            return (
              <SvgText key={l.d} x={x} y={y + 5} fontSize={13} fontWeight="800" fill={l.d === 0 ? P.north : P.label} textAnchor="middle">
                {l.t}
              </SvgText>
            );
          })}

          {P.degrees
            ? [...Array(12)].map((_, i) => {
                const dd = i * 30;
                const rad2 = ((dd - 90) * Math.PI) / 180;
                const dx = c + (R - 40) * Math.cos(rad2);
                const dy = c + (R - 40) * Math.sin(rad2);
                return (
                  <SvgText key={dd} x={dx} y={dy + 3} fontSize={8} fill={`${P.tickMaj}AA`} textAnchor="middle" fontFamily="Poppins">
                    {dd === 0 ? 360 : dd}
                  </SvgText>
                );
              })
            : null}

          {/* marker seat at the TRUE bearing (photo marker overlays above) */}
          <G transform={`rotate(${bearing} ${c} ${c})`}>
            <Circle cx={c} cy={c - (R - 44)} r={17} fill={aligned ? P.ok : P.accent} opacity={aligned ? 0.22 : 0.14} />
            <Line x1={c} y1={c - (R - 66)} x2={c} y2={c - (R - 30)} stroke={aligned ? P.ok : P.accent} strokeWidth={2} strokeLinecap="round" opacity={0.55} strokeDasharray="3 4" />
          </G>

          {/* tick line from hub toward the kaaba */}
          <G transform={`rotate(${bearing} ${c} ${c})`}>
            <Line x1={c} y1={c - (R - 66)} x2={c} y2={c - (R - 30)} stroke={aligned ? '#4AE38F' : '#D4AF37'} strokeWidth={2} strokeLinecap="round" opacity={0.55} strokeDasharray="3 4" />
          </G>
        </G>

        {/* direction chevrons (fixed, near the top pointer) */}
        {chevrons}

        {/* fixed pointer at top: where the top of the phone points */}
        <Polygon points={`${c},${c - R + 1} ${c - 8},${c - R - 11} ${c + 8},${c - R - 11}`} fill={aligned ? P.ok : P.label} />
        {/* hub */}
        <Circle cx={c} cy={c} r={5} fill={aligned ? P.ok : P.accent} />
        <Circle cx={c} cy={c} r={2} fill="#FFFFFF" />
        {aligned ? (
          <>
            <Circle cx={c} cy={c} r={R - 3} fill="none" stroke={P.ok} strokeWidth={2.4} opacity={0.7} />
            <Circle cx={c} cy={c} r={R + 3} fill="none" stroke={P.ok} strokeWidth={1} opacity={0.4} />
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
            {/* pass 34: fa-kaaba icon (free FontAwesome solid) in a gold
             * ring — replaces the photo circle */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: mx - 19,
                top: my - 19,
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: aligned ? P.ok : P.accent,
                backgroundColor: '#08110C',
                shadowColor: '#000',
                shadowOpacity: 0.45,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 2 },
              }}
            >
              <FontAwesome5 name="kaaba" size={15} color={aligned ? P.ok : P.accent} />
            </View>
            <Svg width={size} height={size} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
              {/* pass 33: the needles START AT THE CENTER DOT — a bold gold
               * one pointing at the Kaaba (front) and a dim one pointing the
               * exact opposite way (qibla behind you). */}
              <Line x1={c + 8 * Math.sin(a)} y1={c - 8 * Math.cos(a)} x2={mx - 26 * Math.sin(a)} y2={my + 26 * Math.cos(a)} stroke={aligned ? P.ok : P.accent} strokeWidth={2.6} strokeLinecap="round" />
              <G transform={`translate(${mx - 26 * Math.sin(a)} ${my + 26 * Math.cos(a)}) rotate(${(a * 180) / Math.PI})`}>
                <Polygon points="0,-10 8,8 0,3.5 -8,8" fill={aligned ? P.ok : P.accent} stroke="none" strokeWidth={0.7} />
              </G>
              <Line x1={c + 8 * Math.sin(backA)} y1={c - 8 * Math.cos(backA)} x2={bx} y2={by} stroke={P.label} strokeWidth={1.6} strokeLinecap="round" opacity={0.45} strokeDasharray="4 3" />
              <G transform={`translate(${bx} ${by}) rotate(${(backA * 180) / Math.PI})`} opacity={0.5}>
                <Polygon points="0,-7 5.5,5.5 0,2.2 -5.5,5.5" fill="none" stroke={P.label} strokeWidth={1.2} />
              </G>
            </Svg>
          </>
        );
      })()}
    </View>
  );
}
