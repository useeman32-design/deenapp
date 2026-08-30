import { Image, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { T } from '@/components/T';
import { KAABA } from '@/lib/prayer';
import { useTheme } from '@/context/ThemeContext';

/**
 * pass 29 — QiblaMap: a REAL flat world map (public-domain equirectangular
 * projection) with the user's location and Makkah plotted on it and a gold
 * thread arc drawn between them. Replaces the 3D globe WebView, which was
 * heavy and often rendered a black box on iOS Safari.
 */

const W = 336;
const H = 168; /* equirectangular 2:1 */

/* equirectangular projection: lon −180..180 → 0..W, lat 90..−90 → 0..H */
const px = (lon: number) => ((lon + 180) / 360) * W;
const py = (lat: number) => ((90 - lat) / 180) * H;

export function QiblaMap({
  userLoc,
  userName,
  distanceKm,
  bearing,
}: {
  userLoc: { lat: number; lon: number };
  userName: string;
  distanceKm: number;
  bearing: number;
}) {
  const { theme, isDark } = useTheme();

  const x1 = px(userLoc.lon);
  const y1 = py(userLoc.lat);
  const x2 = px(KAABA.longitude);
  const y2 = py(KAABA.latitude);

  /* thread arc — bow it north so it reads like a flight path */
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(26, len * 0.22);
  const cxq = mx - (dy / len) * bow;
  const cyq = my + (dx / len) * bow;
  const thread = `M ${x1} ${y1} Q ${cxq} ${cyq} ${x2} ${y2}`;

  const place = (userName || 'You').split(',')[0].slice(0, 16);

  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, backgroundColor: isDark ? '#0A100D' : '#F2F6F3' }}>
      <View style={{ position: 'relative' }}>
        <Image
          source={require('../../assets/images/worldmap.jpg')}
          style={{ width: '100%', height: undefined, aspectRatio: W / H }}
          resizeMode="cover"
        />
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          {/* thread: user → Makkah */}
          <Path d={thread} fill="none" stroke="#D4AF37" strokeWidth={1.8} strokeLinecap="round" />
          <Path d={thread} fill="none" stroke="rgba(212,175,55,0.28)" strokeWidth={5} strokeLinecap="round" />

          {/* user marker */}
          <G>
            <Circle cx={x1} cy={y1} r={7.5} fill="rgba(46,204,113,0.25)" />
            <Circle cx={x1} cy={y1} r={3.6} fill="#1F8F5C" stroke="#fff" strokeWidth={1} />
            <SvgText x={x1 + 9} y={y1 + 3.5} fontSize={8.5} fontWeight="800" fill={isDark ? '#B9F6D3' : '#0E7A46'}>
              {place}
            </SvgText>
          </G>

          {/* Makkah: gold pin + ring */}
          <G>
            <Circle cx={x2} cy={y2} r={9} fill="rgba(212,175,55,0.22)" />
            <Circle cx={x2} cy={y2} r={4.4} fill="#D4AF37" stroke={isDark ? '#3A2E14' : '#8C6D1F'} strokeWidth={1} />
            <SvgText x={x2 + 9} y={y2 + 3.5} fontSize={8.5} fontWeight="800" fill={isDark ? '#EAD9A0' : '#8C6D1F'}>
              Makkah
            </SvgText>
          </G>
        </Svg>

        {/* REAL Kaaba photo chip at the Makkah endpoint */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${(x2 / W) * 100}%`,
            top: `${(y2 / H) * 100}%`,
            marginLeft: -26,
            marginTop: -30,
            width: 26,
            height: 26,
            borderRadius: 13,
            overflow: 'hidden',
            borderWidth: 1.6,
            borderColor: '#D4AF37',
            backgroundColor: '#000',
          }}
        >
          <Image source={require('../../assets/images/kaaba.jpg')} style={{ width: 26, height: 26 }} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
        <T v="caption" style={{ fontSize: 10 }}>
          {distanceKm.toFixed(0)} km to the Kaaba
        </T>
        <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#8C6D1F' }}>
          Qibla {Math.round((bearing + 360) % 360)}° from North
        </T>
      </View>
    </View>
  );
}
