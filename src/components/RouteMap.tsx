import { View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { T } from '@/components/T';
import { Surface } from '@/components/Surface';
import { PinIcon, MosqueIcon } from '@/components/Icons';
import { useTheme } from '@/context/ThemeContext';

/**
 * Stylised "route card" for the Qibla screen: a subtle gridded map with a
 * dashed great-circle-ish path from the user's location to the Kaaba.
 * (A full interactive map needs a map SDK + API key — see README.)
 */
export function RouteMap({
  distanceKm,
  fromName,
  toName = 'Makkah',
  bearing,
}: {
  distanceKm: number;
  fromName: string;
  toName?: string;
  bearing: number;
}) {
  const { theme, isDark } = useTheme();
  const grid = isDark ? '#16302422' : '#E4E0D266';

  return (
    <Surface style={{ overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox="0 0 340 190" style={{ borderRadius: 18 }}>
        <Defs>
          <Pattern id="grid" width="27" height="27" patternUnits="userSpaceOnUse">
            <Path d="M 27 0 L 0 0 0 27" fill="none" stroke={grid} strokeWidth="1" />
          </Pattern>
          <SvgGradient id="route" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.primary} />
            <Stop offset="1" stopColor={theme.accent} />
          </SvgGradient>
        </Defs>
        <rect width="340" height="190" fill="transparent" />
        <rect width="340" height="190" fill="url(#grid)" />
        {/* soft terrain blobs */}
        <Circle cx="60" cy="40" r="46" fill={isDark ? theme.cardSoft : theme.cardSoft} opacity="0.5" />
        <Circle cx="300" cy="160" r="52" fill={isDark ? theme.cardSoft : theme.cardSoft} opacity="0.4" />

        {/* route path */}
        <Path
          d="M 62 138 C 130 150, 210 118, 272 62"
          fill="none"
          stroke="url(#route)"
          strokeWidth="2.4"
          strokeDasharray="7 6"
          strokeLinecap="round"
        />

        {/* Kaaba destination */}
        <G>
          <Circle cx="272" cy="62" r="26" fill={theme.accentSoft} />
          <Circle cx="272" cy="62" r="26" fill="none" stroke={theme.accent} strokeWidth="1.2" strokeDasharray="3 3" />
          <rect x="262" y="52" width="20" height="20" rx="4" fill={isDark ? '#1A1206' : '#241C0C'} />
          <rect x="262" y="58.5" width="20" height="3.4" rx="1.2" fill={theme.accent} />
          <text x="272" y="30" fontSize="10" fontWeight="700" fill={theme.heading} textAnchor="middle" fontFamily="Poppins-Bold">
            {toName}
          </text>
        </G>

        {/* user location */}
        <G>
          <Circle cx="62" cy="138" r="15" fill={theme.primary} opacity="0.18" />
          <Circle cx="62" cy="138" r="7.5" fill={theme.primary} />
          <Circle cx="62" cy="138" r="3" fill="#fff" />
          <text x="62" y="166" fontSize="10" fontWeight="700" fill={theme.heading} textAnchor="middle" fontFamily="Poppins-Bold">
            {fromName}
          </text>
        </G>

        {/* distance chip */}
        <G>
          <rect x="118" y="86" width="104" height="24" rx="12" fill={isDark ? '#0B1A13' : '#FFFFFF'} stroke={theme.border} strokeWidth="1" />
          <text x="170" y="102" fontSize="11" fontWeight="800" fill={theme.primary} textAnchor="middle" fontFamily="Poppins-Bold">
            {Math.round(distanceKm).toLocaleString()} km
          </text>
        </G>
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <PinIcon size={15} color={theme.primary} />
          <T v="caption">{fromName} → {toName}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <MosqueIcon size={13} color={theme.primary} />
          <T v="meta" color="primary" style={{ letterSpacing: 0.5 }}>QIBLA {Math.round(bearing)}°</T>
        </View>
      </View>
    </Surface>
  );
}
