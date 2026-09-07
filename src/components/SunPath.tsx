import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient as SvgRadial, LinearGradient as SvgLinear, Stop } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import { T } from '@/components/T';
import { formatTime } from '@/lib/prayer';

/** Shared prayer-day visual — used by the HOME hero and the PRAYER page hero
 *  (pass 29: extracted verbatim from the home screen). */

/* Professional prayer-day visual: markers at their REAL positions on the
   day's arc, sun/moon at the CURRENT time, next prayer highlighted. */

/* pass 37 — cache the last measured width so remounts (navigating back to
 * home/prayer) start at the CORRECT width instead of 338 → no visible
 * "adjust-and-snap-back" glitch on the arc. */
let cachedW = 0;

export function SunPath({ times, now, nextIndex }: { times: Date[] | null; now: Date; nextIndex: number | null }) {
  const [w, setW] = useState(cachedW || 338);
  const H = 120;
  const pad = 18;
  const baseline = 84;
  const peak = 20;
  // fixed palette — SunPath always renders on the dark hero card
  const c = {
    horizon: 'rgba(255,255,255,0.16)',
    nowLine: 'rgba(255,255,255,0.22)',
    curve: '#D4AF37',
    elapsed: '#F1C40F',
    area: '#D4AF37',
    dotFill: '#0E241A',
    dotStroke: 'rgba(255,255,255,0.5)',
    active: '#2ECC71',
    label: 'rgba(255,255,255,0.62)',
    labelActive: '#4AE38F',
    time: 'rgba(255,255,255,0.4)',
    halo: '#F1C40F',
    sunDay: '#F1C40F',
    sunNight: '#B9C7E4',
    sunRingDay: '#D4AF37',
    sunRingNight: 'rgba(255,255,255,0.45)',
    card: '#0E241A',
  };

  if (!times) {
    return (
      <View
        onLayout={(e) => { const mw = Math.max(e.nativeEvent.layout.width, 200); cachedW = mw; setW(mw); }}
        style={{ height: H, justifyContent: 'center' }}
      >
        <View
          style={{
            position: 'absolute',
            left: pad - 6,
            right: pad - 6,
            top: baseline,
            borderTopWidth: 1,
            borderTopColor: c.horizon,
            opacity: 0.6,
          }}
        />
        <T v="caption" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>
          Calculating prayer times…
        </T>
      </View>
    );
  }

  const fajr = times[0].getTime();
  const dhuhr = times[2].getTime();
  const asr = times[3].getTime();
  const maghrib = times[4].getTime();
  const isha = times[5].getTime();
  const end = isha + 45 * 60e3;
  const span = Math.max(end - fajr, 3600e3);

  const X = (t: number) => pad + ((t - fajr) / span) * (w - 2 * pad);
  const Y = (t: number) => {
    const p = Math.min(Math.max((t - fajr) / span, 0), 1);
    return baseline - (baseline - peak) * Math.sin(Math.PI * p);
  };

  const N = 48;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = fajr + (span * i) / N;
    pts.push(`${X(t).toFixed(1)},${Y(t).toFixed(1)}`);
  }
  const curve = `M ${pts.join(' L ')}`;
  const area = `${curve} L ${X(end).toFixed(1)},${baseline} L ${X(fajr).toFixed(1)},${baseline} Z`;

  const nowMs = now.getTime();
  /* pass 40 — WRAP FIX: after Isha(+45m) the marker used to keep walking
   * PAST the arc's right edge until the next day's times snapped it back.
   * Now the night RETRACES the arc: the moon glides from Isha back toward
   * Fajr, arriving exactly as the next day begins — no snap, no off-arc. */
  const nextFajr = fajr + 24 * 3600e3;
  const isNight = nowMs > end;
  const nf = isNight ? Math.min((nowMs - end) / Math.max(nextFajr - end, 1), 1) : 0;
  const sunT = isNight
    ? end - nf * (end - fajr)
    : Math.max(nowMs, fajr);
  // bright "day so far" segment: Fajr → now
  const elapsedIdx = isNight ? 0 : Math.min(Math.round(((sunT - fajr) / span) * N), N);
  const elapsed =
    elapsedIdx > 0
      ? `M ${pts.slice(0, elapsedIdx + 1).join(' L ')} ${X(sunT).toFixed(1)},${Y(sunT).toFixed(1)}`
      : '';
  const sx = X(sunT);
  const sy = Y(sunT);
  const isDay = nowMs >= fajr && nowMs < maghrib;
  const npIndex = nextIndex;

  const markers = [
    { label: 'Fajr', t: fajr, idx: 0, icon: 'moon' as const },
    { label: 'Dhuhr', t: dhuhr, idx: 2, icon: 'sun' as const },
    { label: 'Asr', t: asr, idx: 3, icon: 'sun' as const },
    { label: 'Maghrib', t: maghrib, idx: 4, icon: 'sunset' as const },
    { label: 'Isha', t: isha, idx: 5, icon: 'moon' as const },
  ];


  return (
    <View onLayout={(e) => { const mw = Math.max(e.nativeEvent.layout.width, 200); cachedW = mw; setW(mw); }} style={{ height: H }}>
      <Svg width={w} height={H}>
        <Defs>
          <SvgLinear id="sun-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={c.area} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={c.area} stopOpacity={0} />
          </SvgLinear>
          <SvgRadial id="sun-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.halo} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={c.halo} stopOpacity={0} />
          </SvgRadial>
          <SvgRadial id="active-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.active} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={c.active} stopOpacity={0} />
          </SvgRadial>
        </Defs>
        {/* horizon */}
        <Line x1={pad - 8} y1={baseline} x2={w - pad + 8} y2={baseline} stroke={c.horizon} strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" />
        {/* soft fill under the arc */}
        <Path d={area} fill="url(#sun-area)" />
        {/* the day arc (remaining) */}
        <Path d={curve} stroke={c.curve} strokeOpacity={0.3} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {/* the elapsed portion, brighter */}
        {elapsed ? <Path d={elapsed} stroke={c.elapsed} strokeOpacity={0.95} strokeWidth={2} fill="none" strokeLinecap="round" /> : null}
        {/* now line */}
        <Line x1={sx} y1={sy + 13} x2={sx} y2={baseline} stroke={c.nowLine} strokeWidth={1} />
        {/* prayer markers at their real positions */}
        {markers.map((m) => {
          const active = npIndex === m.idx;
          return (
            <React.Fragment key={m.label}>
              {active ? <Circle cx={X(m.t)} cy={Y(m.t)} r={13} fill="url(#active-glow)" /> : null}
              <Circle
                cx={X(m.t)}
                cy={Y(m.t)}
                r={8}
                fill={c.dotFill}
                stroke={active ? c.active : c.dotStroke}
                strokeWidth={active ? 1.5 : 1}
              />
            </React.Fragment>
          );
        })}
        {/* sun / moon at the current time */}
        <Circle cx={sx} cy={sy} r={16} fill="url(#sun-halo)" />
        <Circle cx={sx} cy={sy} r={11} fill={c.card} stroke={isDay ? c.sunRingDay : c.sunRingNight} strokeWidth={1.2} />
        {isDay ? (
          <G>
            <Circle cx={sx} cy={sy} r={4} fill={c.sunDay} />
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * Math.PI) / 4;
              return (
                <Line
                  key={k}
                  x1={sx + Math.cos(a) * 6}
                  y1={sy + Math.sin(a) * 6}
                  x2={sx + Math.cos(a) * 8.4}
                  y2={sy + Math.sin(a) * 8.4}
                  stroke={c.sunDay}
                  strokeWidth={1.3}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        ) : (
          <G>
            {/* crescent moon after sunset (two-circle carve — reliable) */}
            <Circle cx={sx} cy={sy} r={5} fill={c.sunNight} />
            <Circle cx={sx + 2.4} cy={sy - 1.7} r={4.2} fill={c.card} />
          </G>
        )}
      </Svg>


      {/* prayer icons inside the dots */}
      {markers.map((m) => (
        <View
          key={`gi-${m.label}`}
          style={{
            position: 'absolute',
            left: X(m.t) - 8,
            top: Y(m.t) - 8,
            width: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {m.icon === 'sunset' ? (
            <Svg width={11} height={9}>
              <Path
                d="M 1.8 4.6 A 3.7 3.7 0 0 1 9.2 4.6 Z"
                fill={npIndex === m.idx ? c.active : 'rgba(255,255,255,0.82)'}
              />
              <Line
                x1={0.7}
                y1={6.6}
                x2={10.3}
                y2={6.6}
                stroke={npIndex === m.idx ? c.active : 'rgba(255,255,255,0.82)'}
                strokeWidth={1.1}
                strokeLinecap="round"
              />
            </Svg>
          ) : (
            <FontAwesome5 name={m.icon} size={7.5} color={npIndex === m.idx ? c.active : 'rgba(255,255,255,0.82)'} />
          )}
        </View>
      ))}

      {/* labels: name + real time under each marker (collisions resolved L→R) */}
      {(() => {
        const W = [40, 40, 38, 48, 40]; // per-label box widths (fit name + time)
        const GAP = 3;
        const lefts = markers.map((m, i) => Math.min(Math.max(X(m.t) - W[i] / 2, 2), w - W[i] - 2));
        // Right-to-left pass: the rightmost labels (Maghrib/Isha) are close in time,
        // so keep the last at the edge and pull earlier boxes left of their neighbours.
        for (let i = markers.length - 2; i >= 0; i--) {
          lefts[i] = Math.min(lefts[i], lefts[i + 1] - W[i] - GAP);
          lefts[i] = Math.max(lefts[i], 2);
        }
        return markers.map((m, i) => {
          const active = npIndex === m.idx;
          return (
            <View key={`l-${m.label}`} style={{ position: 'absolute', left: lefts[i], top: baseline + 10, width: W[i], alignItems: 'center' }}>
              <T v="caption" style={{ color: active ? c.labelActive : c.label, fontSize: 9, fontWeight: active ? '700' : '500' }}>
                {m.label}
              </T>
              <T v="caption" style={{ color: c.time, fontSize: 8.5, marginTop: 1 }}>
                {formatTime(new Date(m.t))}
              </T>
            </View>
          );
        });
      })()}
    </View>
  );
}
