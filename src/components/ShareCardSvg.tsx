import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { create as createQR } from 'qrcode';
import type { ShareCardInput } from '@/lib/shareCard';

/**
 * pass 35 — ShareCardSvg: the share card as live SVG, so "share as image"
 * works NATIVELY too (the canvas generator in lib/shareCard.ts is web-only).
 * Same geometry as the web classic design (1080-wide, gold frame, arabic,
 * meaning, QR, DeenLink footer). Export via lib/svgExport (toDataURL).
 */

const W = 1080;
const GOLD = '#D4AF37';
const WHITE = '#F5F8F5';

/* crude but effective text wrap by estimated char width (no canvas on native) */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].trim()}…`;
    return kept;
  }
  return lines;
}

function qrData(url: string): { size: number; get: (x: number, y: number) => boolean } | null {
  try {
    const qr = createQR(url, { margin: 0 });
    const m = qr.modules as unknown as { size: number; data: Uint8Array };
    const size = m.size;
    const data = m.data;
    return { size, get: (x, y) => !!data[y * size + x] };
  } catch {
    return null;
  }
}

export function ShareCardSvg({ input, ref, link = 'https://deenlink.org' }: { input: ShareCardInput; ref?: React.RefObject<any>; link?: string }) {
  const hasArabic = !!input.arabic;
  const arLines = hasArabic ? wrap(input.arabic ?? '', 26, 8) : [];
  const arFs = arLines.length > 5 ? 64 : arLines.length > 3 ? 78 : 92;
  const mLines = wrap(`“${input.meaning}”`, 34, 8);
  const mFs = mLines.length > 5 ? 32 : mLines.length > 3 ? 38 : 44;

  const aStart = 620;
  const afterArabic = hasArabic ? aStart + (arLines.length - 1) * (arFs * 1.42) + 60 : aStart - 90;
  const afterMeaning = afterArabic + 90 + (mLines.length - 1) * (mFs * 1.42) + 70;
  const footerTop = afterMeaning + 60;
  const H = Math.max(1350, footerTop + 336);
  const qr = qrData(link);

  return (
    <Svg ref={ref} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="scBg" x1="0" y1="0" x2="0.7" y2="1">
          <Stop offset="0%" stopColor="#132A1E" />
          <Stop offset="55%" stopColor="#0B1811" />
          <Stop offset="100%" stopColor="#060D09" />
        </LinearGradient>
        <RadialGradient id="scHalo" cx="50%" cy="24%" r="60%">
          <Stop offset="0%" stopColor="rgba(212,175,55,0.20)" />
          <Stop offset="100%" stopColor="rgba(212,175,55,0)" />
        </RadialGradient>
        <LinearGradient id="scGoldLine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="rgba(212,175,55,0)" />
          <Stop offset="50%" stopColor={GOLD} />
          <Stop offset="100%" stopColor="rgba(212,175,55,0)" />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width={W} height={H} fill="url(#scBg)" />
      <Rect x="0" y="0" width={W} height={H} fill="url(#scHalo)" />

      {/* frame */}
      <Rect x="52" y="52" width={W - 104} height={H - 104} rx="34" fill="none" stroke="rgba(212,175,55,0.75)" strokeWidth="2.5" />
      <Rect x="70" y="70" width={W - 140} height={H - 140} rx="26" fill="none" stroke="rgba(212,175,55,0.28)" strokeWidth="1.5" />

      {/* kind pill */}
      <Rect x={W / 2 - 150} y="150" width="300" height="64" rx="32" fill="rgba(212,175,55,0.12)" stroke="rgba(212,175,55,0.5)" strokeWidth="1.5" />
      <SvgText x={W / 2} y="193" textAnchor="middle" fontSize="28" fill={GOLD} fontFamily="Poppins-SemiBold" letterSpacing="6">{input.kind.toUpperCase()}</SvgText>
      <Rect x={W / 2 - 60} y="252" width="120" height="3" fill="url(#scGoldLine)" />

      {/* crescent mark */}
      <Circle cx={W / 2} cy="430" r="86" fill="rgba(212,175,55,0.85)" />
      <Circle cx={W / 2 + 30} cy="414" r="80" fill="#0C1B13" />

      {/* arabic */}
      {hasArabic
        ? arLines.map((ln, i) => (
            <SvgText key={i} x={W / 2} y={aStart + i * (arFs * 1.42)} textAnchor="middle" fontSize={arFs} fill={WHITE} fontFamily="Amiri-Bold" opacity="0.97">{ln}</SvgText>
          ))
        : null}

      {/* meaning */}
      {mLines.map((ln, i) => (
        <SvgText key={i} x={W / 2} y={afterArabic + 90 + i * (mFs * 1.42)} textAnchor="middle" fontSize={mFs} fill="rgba(245,248,245,0.85)" fontFamily="Poppins-Regular">{ln}</SvgText>
      ))}

      {/* ref */}
      <SvgText x={W / 2} y={afterMeaning + 10} textAnchor="middle" fontSize="34" fill={GOLD} fontFamily="Poppins-SemiBold" letterSpacing="2">{input.ref}</SvgText>

      {/* footer: brand + QR */}
      <G>
        {qr ? (
          <G transform={`translate(${W - 268} ${footerTop + 40})`}>
            <Rect x="0" y="0" width="196" height="196" rx="20" fill="rgba(245,248,245,0.96)" />
            {[...Array(qr.size * qr.size)].map((_, idx) => {
              const x = idx % qr.size;
              const y = Math.floor(idx / qr.size);
              return qr.get(x, y) ? <Rect key={idx} x={16 + (x * 164) / qr.size} y={16 + (y * 164) / qr.size} width={164 / qr.size + 0.5} height={164 / qr.size + 0.5} fill="#0B0F0D" /> : null;
            })}
          </G>
        ) : null}
        <SvgText x="120" y={footerTop + 118} fontSize="56" fill={WHITE} fontFamily="Poppins-ExtraBold" letterSpacing="2">DeenLink</SvgText>
        <SvgText x="120" y={footerTop + 172} fontSize="28" fill="rgba(245,248,245,0.6)" fontFamily="Poppins-Regular">Your daily deen, beautifully delivered</SvgText>
        <Path d={`M 120 ${footerTop + 210} h 260`} stroke={GOLD} strokeWidth="3" />
        <SvgText x="120" y={footerTop + 266} fontSize="26" fill="rgba(245,248,245,0.45)" fontFamily="Poppins-Regular" letterSpacing="4">SCAN TO OPEN DEENLINK</SvgText>
      </G>
    </Svg>
  );
}
