import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

/**
 * Mini semicircle showing the five daily prayers, with the next one
 * highlighted by a gold sun marker — as on the Home "Next Prayer" card.
 */
export function PrayerArc({ times, nextIndex, size = 158 }: { times: Date[]; nextIndex: number; size?: number }) {
  const { theme } = useTheme();
  const names = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const idx = [0, 2, 3, 4, 5];
  const angles = [158, 124, 90, 56, 22];
  const h = size * 0.66;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 24;

  const pt = (a: number) => ({
    x: cx + r * Math.cos((a * Math.PI) / 180),
    y: cy - r * Math.sin((a * Math.PI) / 180),
  });
  const p0 = pt(angles[0]);
  const p4 = pt(angles[4]);
  const arc = `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p4.x} ${p4.y}`;

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
      <Path d={arc} stroke={theme.border} strokeWidth={1.5} fill="none" strokeDasharray="1 5" strokeLinecap="round" />
      {angles.map((a, i) => {
        const p = pt(a);
        const isNext = idx[i] === nextIndex;
        return (
          <G key={names[i]}>
            {isNext ? (
              <Circle cx={p.x} cy={p.y} r={8} fill="none" stroke={theme.accent} strokeWidth={1.6} />
            ) : null}
            <Circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill={isNext ? theme.accent : theme.primarySoft}
              stroke={isNext ? theme.accent : theme.primary}
              strokeWidth={1.2}
            />
            <SvgText
              x={p.x}
              y={p.y - 15}
              fontSize={8}
              fontWeight="700"
              fill={isNext ? theme.accent : theme.subtext}
              textAnchor="middle"
            >
              {names[i]}
            </SvgText>
            <SvgText x={p.x} y={p.y - 5} fontSize={7} fill={theme.subtext} textAnchor="middle">
              {fmt(times[idx[i]])}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
