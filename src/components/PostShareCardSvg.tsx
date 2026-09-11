import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText } from 'react-native-svg';
import { create as createQR } from 'qrcode';

/**
 * pass 83-31 — PostShareCardSvg: "Share as image" for POSTS renders an exact
 * replica of the post card — avatar, name, @username, badge, content, photo,
 * like + comment counts — plus the DeenLink logo strip and a QR code, as live
 * SVG (exported to JPEG via lib/svgExport, same pipeline as ShareCardSvg).
 * The web uses the canvas twin in lib/shareCard.ts (generatePostShareCard).
 */

const W = 1080;
const PAD = 54;
const GOLD = '#B8860B';
const GREEN = '#1D6F42';
const TEXT = '#1E2B24';
const SUB = '#6C7F74';
const LINE = '#E3E9E4';

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = (text || '').split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) { lines.push(cur); cur = w; } else cur = test;
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
    return { size: m.size, get: (x, y) => !!m.data[y * m.size + x] };
  } catch { return null; }
}

export interface PostShareCardInput {
  name: string;
  username: string;
  photoUri?: string | null;
  badge?: string | null; /* 'green' | 'gold' | 'blue' | null */
  text?: string | null;
  imageUrl?: string | null;
  likeCount?: number;
  commentCount?: number;
  link: string;
  timeAgo?: string;
}

export function PostShareCardSvg({ input, ref: _ref }: { input: PostShareCardInput; ref?: React.RefObject<unknown> }) {
  const nameLines = wrap(input.name, 30, 1);
  const textLines = input.text ? wrap(input.text, 52, 10) : [];
  const hasImg = !!input.imageUrl;
  const badgeColor = input.badge === 'green' ? '#27AE60' : input.badge === 'gold' ? '#D4AF37' : input.badge === 'blue' ? '#3F51B5' : null;

  /* pass 83-31 — FIXED canvas (1080×1280) so the raster export opts match the
   * layout exactly; content is clamped (wrap() caps lines) and the photo band
   * keeps a fixed height whether or not there is a photo. */
  const headerH = 132;
  const textH = textLines.length ? textLines.length * 58 + 26 : 0;
  const imgH = 560;
  const countsH = 96;
  const footerH = 190;
  const H = 1280;

  const qr = qrData(input.link);
  const qrX = W - PAD - 128;
  const qrY = H - footerH + 10;

  const countsY = PAD + headerH + textH + imgH + 18;
  const footY = H - footerH + 34;

  const initials = (input.name || '?').trim().slice(0, 1).toUpperCase();

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id="avclip"><Circle cx={PAD + 39} cy={PAD + 39} r={39} /></ClipPath>
        <ClipPath id="imgclip"><Rect x={PAD} y={PAD + headerH + textH} width={W - PAD * 2} height={imgH} rx={26} /></ClipPath>
      </Defs>

      {/* card background */}
      <Rect x={0} y={0} width={W} height={H} rx={40} fill="#FFFFFF" />
      <Rect x={3} y={3} width={W - 6} height={H - 6} rx={38} fill="none" stroke={LINE} strokeWidth={3} />

      {/* header — avatar + name + @username + badge + time */}
      <Circle cx={PAD + 39} cy={PAD + 39} r={41} fill="#EEF4EF" />
      {input.photoUri ? (
        <G clipPath="url(#avclip)">
          <SvgImage href={input.photoUri ?? undefined} x={PAD} y={PAD} width={78} height={78} preserveAspectRatio="xMidYMid slice" />
        </G>
      ) : (
        <SvgText x={PAD + 39} y={PAD + 54} fontSize={40} fontWeight="800" fill={GREEN} textAnchor="middle">{initials}</SvgText>
      )}
      <SvgText x={PAD + 100} y={PAD + 30} fontSize={34} fontWeight="800" fill={TEXT}>{nameLines[0]}</SvgText>
      <SvgText x={PAD + 100} y={PAD + 68} fontSize={27} fontWeight="600" fill={SUB}>@{input.username}{input.timeAgo ? ` · ${input.timeAgo}` : ''}</SvgText>
      {badgeColor ? (
        <G>
          <Circle cx={PAD + 100 + 10 + (input.username.length * 14.2)} cy={PAD + 59} r={13} fill={badgeColor} />
          <Path d={`M ${PAD + 100 + 4 + (input.username.length * 14.2)} ${PAD + 59} l 4 5 l 8 -9`} stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      ) : null}

      {/* content */}
      {textLines.map((ln, i) => (
        <SvgText key={i} x={PAD} y={PAD + headerH + 42 + i * 58} fontSize={34} fontWeight="500" fill={TEXT}>{ln}</SvgText>
      ))}

      {/* photo */}
      {hasImg ? (
        <G clipPath="url(#imgclip)">
          <SvgImage href={input.imageUrl ?? undefined} x={PAD} y={PAD + headerH + textH} width={W - PAD * 2} height={imgH} preserveAspectRatio="xMidYMid slice" />
        </G>
      ) : null}

      {/* likes + comments — the same counts the card shows in-app.
          pass 83-32: feather-style stroke icons (owner: the old glyphs were ugly). */}
      <G transform={`translate(${PAD + 2}, ${countsY + 10}) scale(1.7)`}>
        <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="#E74C3C" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <SvgText x={PAD + 58} y={countsY + 44} fontSize={32} fontWeight="700" fill={SUB}>{input.likeCount ?? 0}</SvgText>
      <G transform={`translate(${PAD + 126}, ${countsY + 10}) scale(1.7)`}>
        <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="none" stroke={SUB} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <SvgText x={PAD + 182} y={countsY + 44} fontSize={32} fontWeight="700" fill={SUB}>{input.commentCount ?? 0}</SvgText>

      {/* footer: DeenLink brand + QR */}
      <Rect x={0} y={H - footerH} width={W} height={footerH} rx={0} fill="#F2F5F2" />
      <Rect x={PAD} y={H - footerH} width={W - PAD * 2} height={2} fill={LINE} />
      <Circle cx={PAD + 34} cy={footY + 34} r={34} fill={GREEN} />
      <SvgText x={PAD + 34} y={footY + 47} fontSize={30} fontWeight="800" fill="#FFFFFF" textAnchor="middle">DL</SvgText>
      <SvgText x={PAD + 92} y={footY + 30} fontSize={38} fontWeight="800" fill={TEXT}>Deen</SvgText>
      <SvgText x={PAD + 206} y={footY + 30} fontSize={38} fontWeight="800" fill={GOLD}>Link</SvgText>
      <SvgText x={PAD + 92} y={footY + 68} fontSize={26} fontWeight="600" fill={SUB}>your deen, connected — scan to join</SvgText>
      {qr ? (
        <G>
          <Rect x={qrX - 8} y={qrY - 8} width={144} height={144} rx={12} fill="#FFFFFF" stroke={LINE} strokeWidth={2} />
          {Array.from({ length: qr.size }, (_, y) =>
            Array.from({ length: qr.size }, (_, x) =>
              qr.get(x, y) ? <Rect key={`${x}-${y}`} x={qrX + (x * 128) / qr.size} y={qrY + (y * 128) / qr.size} width={128 / qr.size + 0.6} height={128 / qr.size + 0.6} fill="#14251B" /> : null,
            ),
          )}
        </G>
      ) : null}
    </Svg>
  );
}
