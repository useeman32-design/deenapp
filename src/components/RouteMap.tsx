import { View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Rect, Stop, LinearGradient as SvgGradient, Text as SvgText } from 'react-native-svg';
import { T } from '@/components/T';
import { Surface } from '@/components/Surface';
import { KAABA } from '@/lib/prayer';
import { useTheme } from '@/context/ThemeContext';

/**
 * GLOBE route card (pass 22) — the user's position and Makkah plotted on a
 * globe (equirectangular projection clipped to the sphere), with a glowing
 * thread arcing from the user to the Kaabah. No map SDK needed.
 */

const PROJECT = (lat: number, lon: number, c: number, R: number) => {
  /* clip lat so both markers always sit on the globe */
  const la = Math.max(-84, Math.min(84, lat));
  return { x: c + (R - 6) * Math.sin(((lon + 180) / 360) * 2 * Math.PI - Math.PI), y: c - (R - 6) * Math.sin((la / 90) * (Math.PI / 2)) * 0.94 };
};

export function RouteMap({
  distanceKm,
  fromName,
  toName = 'Makkah',
  bearing,
  userLoc,
}: {
  distanceKm: number;
  fromName: string;
  toName?: string;
  bearing: number;
  userLoc?: { lat: number; lon: number } | null;
}) {
  const { theme, isDark } = useTheme();
  const W = 340;
  const H = 210;
  const c = H / 2 + 4;
  const R = H / 2 - 8;

  const you = PROJECT(userLoc?.lat ?? 9.06, userLoc?.lon ?? 7.49, c, R); /* Abuja default */
  const kaaba = PROJECT(KAABA.latitude, KAABA.longitude, c, R);

  /* control point pushed outward from the globe centre → arced thread */
  const mid = { x: (you.x + kaaba.x) / 2, y: (you.y + kaaba.y) / 2 };
  const dx = mid.x - c;
  const dy = mid.y - c;
  const len = Math.hypot(dx, dy) || 1;
  const push = 26 + len * 0.18;
  const ctrl = { x: mid.x + (dx / len) * push, y: mid.y + (dy / len) * push };

  return (
    <Surface style={{ overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 18 }}>
        <Defs>
          <SvgGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={isDark ? '#0D211A' : '#DFF2E9'} />
            <Stop offset="1" stopColor={isDark ? '#08130E' : '#CBE8DB'} />
          </SvgGradient>
          <SvgGradient id="thread" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#1F8F5C" />
            <Stop offset="1" stopColor="#D4AF37" />
          </SvgGradient>
          <SvgGradient id="atmo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.7" stopColor="#4AE38F" stopOpacity="0" />
            <Stop offset="1" stopColor="#4AE38F" stopOpacity={isDark ? 0.35 : 0.25} />
          </SvgGradient>
        </Defs>

        {/* atmosphere + globe */}
        <Circle cx={c} cy={c} r={R + 7} fill="url(#atmo)" />
        <Circle cx={c} cy={c} r={R} fill="url(#ocean)" stroke={isDark ? 'rgba(74,227,143,0.45)' : 'rgba(29,111,66,0.5)'} strokeWidth={1.4} />

        {/* graticule */}
        <G opacity={isDark ? 0.35 : 0.5}>
          {[-60, -30, 0, 30, 60].map((la) => {
            const y = c - Math.sin((la / 90) * (Math.PI / 2)) * (R - 6) * 0.94;
            const half = Math.sqrt(Math.max(0, (R - 4) * (R - 4) - (y - c) * (y - c)));
            return <Path key={la} d={`M ${c - half} ${y} L ${c + half} ${y}`} stroke={isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.25)'} strokeWidth={la === 0 ? 1 : 0.6} strokeDasharray={la === 0 ? undefined : '2 4'} />;
          })}
          {[-90, -30, 30, 90].map((lo) => {
            const x = c + (R - 6) * Math.sin(((lo + 180) / 360) * 2 * Math.PI - Math.PI);
            const half = Math.sqrt(Math.max(0, (R - 4) * (R - 4) - (x - c) * (x - c)));
            return <Path key={lo} d={`M ${x} ${c - half} L ${x} ${c + half}`} stroke={isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.25)'} strokeWidth={0.6} strokeDasharray="2 4" />;
          })}
        </G>

        {/* landmasses — soft stylised blobs (africa/europe/arabia visible from africa) */}
        <G opacity={0.85}>
          <Path d={`M ${c - 10} ${c - 52} C ${c + 26} ${c - 44}, ${c + 30} ${c - 6}, ${c + 16} ${c + 18} C ${c + 6} ${c + 34}, ${c - 22} ${c + 30}, ${c - 30} ${c + 6} C ${c - 36} ${c - 22}, ${c - 30} ${c - 44}, ${c - 10} ${c - 52} Z`} fill={isDark ? '#173326' : '#A8D8C0'} />
          <Path d={`M ${c - 34} ${c - 60} C ${c - 10} ${c - 70}, ${c + 22} ${c - 64}, ${c + 36} ${c - 50} C ${c + 16} ${c - 46}, ${c - 12} ${c - 48}, ${c - 30} ${c - 54} Z`} fill={isDark ? '#142E23' : '#B7E2CC'} />
          <Path d={`M ${c + 24} ${c - 34} C ${c + 40} ${c - 30}, ${c + 46} ${c - 16}, ${c + 38} ${c - 6} C ${c + 30} ${c - 10}, ${c + 26} ${c - 22}, ${c + 20} ${c - 26} Z`} fill={isDark ? '#142E23' : '#B7E2CC'} />
        </G>

        {/* the thread: user → Kaabah */}
        <Path d={`M ${you.x} ${you.y} Q ${ctrl.x} ${ctrl.y} ${kaaba.x} ${kaaba.y}`} fill="none" stroke="url(#thread)" strokeWidth={2.6} strokeLinecap="round" />
        <Path d={`M ${you.x} ${you.y} Q ${ctrl.x} ${ctrl.y} ${kaaba.x} ${kaaba.y}`} fill="none" stroke="#FFFFFF" strokeWidth={0.8} strokeLinecap="round" strokeDasharray="1 6" opacity={0.8} />

        {/* Kaabah marker */}
        <G>
          <Circle cx={kaaba.x} cy={kaaba.y} r={14} fill="#D4AF37" opacity={0.2} />
          <G transform={`translate(${kaaba.x} ${kaaba.y})`}>
            <Path d="M -7 -8 L 7 -8 L 7 9 L -7 9 Z" fill="#171310" stroke="#D4AF37" strokeWidth={1.4} />
            <Path d="M -7 -3 L 7 -3 L 7 0 L -7 0 Z" fill="#D4AF37" />
          </G>
          <SvgText x={kaaba.x} y={kaaba.y - 20} fontSize={9.5} fontWeight="800" fill={theme.heading} textAnchor="middle" fontFamily="Poppins-Bold">
            {toName.toUpperCase()}
          </SvgText>
        </G>

        {/* user marker */}
        <G>
          <Circle cx={you.x} cy={you.y} r={10} fill="#1F8F5C" opacity={0.22} />
          <Circle cx={you.x} cy={you.y} r={5} fill="#1F8F5C" stroke="#FFFFFF" strokeWidth={1.4} />
          <SvgText x={you.x} y={you.y + 20} fontSize={9} fontWeight="700" fill={theme.heading} textAnchor="middle" fontFamily="Poppins-SemiBold">
            {fromName.length > 16 ? `${fromName.slice(0, 15)}…` : fromName}
          </SvgText>
        </G>

        {/* distance chip on the thread */}
        <G transform={`translate(${(you.x + kaaba.x) / 2 + 14} ${(you.y + kaaba.y) / 2 - 18})`}>
          <Rect x={-44} y={-12} width={88} height={22} rx={11} fill={isDark ? '#0B1A13' : '#FFFFFF'} stroke={theme.border} strokeWidth={1} />
          <SvgText y={3.5} fontSize={10} fontWeight="800" fill="#1F8F5C" textAnchor="middle" fontFamily="Poppins-Bold">
            {Math.round(distanceKm).toLocaleString()} km
          </SvgText>
        </G>
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Svg width={14} height={14}>
            <Circle cx={7} cy={7} r={5} fill="#1F8F5C" stroke="#FFFFFF" strokeWidth={1.4} />
          </Svg>
          <T v="caption">{fromName} → {toName}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Svg width={11} height={11}>
            <Rect x={1.5} y={1} width={8} height={9} fill="#171310" stroke="#D4AF37" strokeWidth={1} />
            <Rect x={1.5} y={4} width={8} height={1.6} fill="#D4AF37" />
          </Svg>
          <T v="meta" color="primary" style={{ letterSpacing: 0.5 }}>QIBLA {Math.round(bearing)}°</T>
        </View>
      </View>
    </Surface>
  );
}
