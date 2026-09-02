import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { create as createQR } from 'qrcode';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FontAwesome5 } from '@expo/vector-icons';
import { haptic } from '@/lib/haptics';
import { saveSvgRefAsJpg, shareSvgRef, svgWebDownload, type SvgRefHandle } from '@/lib/svgExport';
import { ShareWithFriends } from '@/components/ShareWithFriends';

/**
 * pass 38/40 — SQUARE share cards (1080×1080) for quiz results, dhikr counts,
 * riddles, names of Allah… pass 40 rework:
 *  · 5 backgrounds that are genuinely DIFFERENT (colour scheme + motif):
 *    emerald khatim, midnight sunburst, royal tiles, cream scallop, maroon
 *    crescents — shuffling on tap, still pure SVG (no image files)
 *  · QR moved to its own corner with its label — no more collisions
 *  · the DeenLink logo mark (crescent + star medallion) in the header
 *  · primary action = SAVE PHOTO (native: gallery · web: download prompt)
 */

export type ScoreCard = {
  kind: string;
  metric: string;
  title: string;
  subtitle: string;
  link: string;
};

const W = 1080;
const GOLD = '#D4AF37';

/* ── the 5 designs, each with its OWN palette ── */
const DESIGNS = ['star', 'rays', 'tiles', 'scallop', 'crescent'] as const;
export type ScoreDesign = (typeof DESIGNS)[number];

type Palette = {
  label: string;
  bg: [string, string, string];
  accent: string;   /* metric + frame */
  motif: string;    /* motif stroke */
  motif2: string;
  ink: string;      /* headline text */
  sub: string;      /* subtitle text */
  onBg: string;     /* small captions */
};

export const SCORE_PALETTES: Record<ScoreDesign, Palette> = {
  star:    { label: 'Emerald',  bg: ['#14301F', '#0B1811', '#060D09'], accent: GOLD, motif: GOLD, motif2: '#F5E6B8', ink: '#F5F8F5', sub: 'rgba(245,248,245,0.75)', onBg: '#F5E6B8' },
  rays:    { label: 'Midnight', bg: ['#10263E', '#0A1728', '#050D18'], accent: '#5BC8F5', motif: '#5BC8F5', motif2: '#BFEAFF', ink: '#F2F8FD', sub: 'rgba(242,248,253,0.75)', onBg: '#BFEAFF' },
  tiles:   { label: 'Royal',    bg: ['#241636', '#150C21', '#0A0612'], accent: '#E8C96A', motif: '#C9A6E8', motif2: '#E8C96A', ink: '#F7F3FB', sub: 'rgba(247,243,251,0.75)', onBg: '#D9C4F0' },
  scallop: { label: 'Cream',    bg: ['#F4EBD9', '#EFE3CB', '#E7DAC0'], accent: '#0E7A46', motif: '#0E7A46', motif2: '#B8860B', ink: '#14241C', sub: 'rgba(20,36,28,0.72)', onBg: '#1D6F42' },
  crescent:{ label: 'Maroon',   bg: ['#3A1220', '#250A14', '#140509'], accent: '#E8C96A', motif: '#E8C96A', motif2: '#F0CFA0', ink: '#FBF4EC', sub: 'rgba(251,244,236,0.75)', onBg: '#F0CFA0' },
};

/* crude but effective wrap (no canvas measure in SVG) */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
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

function Background({ design, P }: { design: ScoreDesign; P: Palette }) {
  switch (design) {
    case 'star':
      return (
        <G opacity="0.16">
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((c) => (
              <G key={`${r}-${c}`} transform={`translate(${135 + c * 405} ${135 + r * 405}) rotate(22.5)`}>
                <Rect x={-95} y={-95} width={190} height={190} fill="none" stroke={P.motif} strokeWidth={3} />
                <Rect x={-95} y={-95} width={190} height={190} fill="none" stroke={P.motif2} strokeWidth={1.4} transform="rotate(45)" />
              </G>
            )),
          )}
        </G>
      );
    case 'rays':
      return (
        <G opacity="0.13">
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i * Math.PI * 2) / 36;
            const r1 = 150; const r2 = i % 3 === 0 ? 900 : 560;
            return <Path key={i} d={`M ${540 + Math.cos(a) * r1} ${560 + Math.sin(a) * r1} L ${540 + Math.cos(a - 0.035) * r1} ${560 + Math.sin(a - 0.035) * r1} L ${540 + Math.cos(a) * r2} ${560 + Math.sin(a) * r2} Z`} fill={i % 3 === 0 ? P.motif : P.motif2} />;
          })}
        </G>
      );
    case 'tiles':
      return (
        <G opacity="0.15">
          {Array.from({ length: 36 }, (_, i) => {
            const col = i % 6; const row = Math.floor(i / 6);
            return (
              <G key={i} transform={`translate(${90 + col * 180} ${90 + row * 180}) rotate(45)`}>
                <Rect x={-62} y={-62} width={124} height={124} fill="none" stroke={P.motif} strokeWidth={2.6} />
                <Circle r={20} fill="none" stroke={P.motif2} strokeWidth={1.6} />
              </G>
            );
          })}
        </G>
      );
    case 'scallop':
      return (
        <G opacity="0.18">
          {[0, 1, 2, 3, 4, 5, 6].map((row) =>
            Array.from({ length: 7 }, (_, col) => (
              <Path key={`${row}-${col}`} d={`M ${col * 180 - 90 + (row % 2) * 90} ${row * 180 + 180} a 90 90 0 0 1 180 0`} fill="none" stroke={row % 2 ? P.motif2 : P.motif} strokeWidth={2.4} />
            )),
          )}
        </G>
      );
    case 'crescent':
      return (
        <G opacity="0.2">
          {[[150, 190, 62], [880, 140, 40], [930, 880, 74], [120, 900, 48], [500, 90, 30], [760, 460, 26], [300, 620, 34]].map(([x, y, r], i) => (
            <G key={i} transform={`translate(${x} ${y}) rotate(${i * 41})`}>
              <Circle r={r} fill="none" stroke={i % 2 ? P.motif2 : P.motif} strokeWidth={3} />
              <Circle cx={r * 0.38} cy={-r * 0.1} r={r * 0.92} fill={P.bg[1]} stroke="none" />
            </G>
          ))}
          {[[420, 320], [690, 760], [230, 760], [830, 330]].map(([x, y], i) => (
            <Path key={`s${i}`} d={`M ${x} ${y - 26} L ${x + 8} ${y - 8} L ${x + 26} ${y} L ${x + 8} ${y + 8} L ${x} ${y + 26} L ${x - 8} ${y + 8} L ${x - 26} ${y} L ${x - 8} ${y - 8} Z`} fill={P.motif} opacity="0.5" />
          ))}
        </G>
      );
  }
}

/* the DeenLink mark: ring + crescent (evenodd punch) + star, all parametric on r */
function LogoMark({ x, y, r, accent }: { x: number; y: number; r: number; accent: string }) {
  const R1 = 0.78;  /* crescent outer */
  const C2 = 0.10;  /* cut-circle centre x */
  const R2 = 0.56;  /* cut-circle radius (fits inside: C2+R2 < R1) */
  return (
    <G transform={`translate(${x} ${y})`}>
      <Circle r={r} fill="none" stroke={accent} strokeWidth={Math.max(2, r * 0.07)} />
      <Path
        fillRule="evenodd"
        d={`M 0 ${-r * R1} A ${r * R1} ${r * R1} 0 0 1 0 ${r * R1} A ${r * R1} ${r * R1} 0 0 1 0 ${-r * R1} Z M ${r * C2} ${-r * R2} A ${r * R2} ${r * R2} 0 0 1 ${r * C2} ${r * R2} A ${r * R2} ${r * R2} 0 0 1 ${r * C2} ${-r * R2} Z`}
        fill={accent}
      />
      <G transform={`translate(${r * 0.52} ${r * 0.02}) scale(${r * 0.36})`}>
        <Path d="M 0.400 -0.460 L 0.518 -0.162 L 0.837 -0.142 L 0.590 0.062 L 0.670 0.372 L 0.400 0.200 L 0.130 0.372 L 0.210 0.062 L -0.037 -0.142 L 0.282 -0.162 Z" fill={accent} />
      </G>
    </G>
  );
}

function qrSquares(url: string): Array<{ x: number; y: number; s: number }> {
  try {
    const qr = createQR(url, { margin: 0 });
    const m = qr.modules as unknown as { size: number; data: Uint8Array };
    const cells: Array<{ x: number; y: number; s: number }> = [];
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.data[y * m.size + x]) cells.push({ x, y, s: m.size });
    return cells;
  } catch { return []; }
}

export function ScoreShareSvg({ card, design, ref }: { card: ScoreCard; design: ScoreDesign; ref?: React.RefObject<any> }) {
  const P = SCORE_PALETTES[design];
  const qr = qrSquares(card.link);
  const qrSize = 120;
  const qrCell = qr.length ? qrSize / qr[0].s : 0;
  const subLines = wrap(card.subtitle, 30, 2);
  return (
    <Svg ref={ref} width="100%" height="100%" viewBox={`0 0 ${W} ${W}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="scBg" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0%" stopColor={P.bg[0]} />
          <Stop offset="60%" stopColor={P.bg[1]} />
          <Stop offset="100%" stopColor={P.bg[2]} />
        </LinearGradient>
        <RadialGradient id="scHalo" cx="50%" cy="46%" r="55%">
          <Stop offset="0%" stopColor={`${P.accent}38`} />
          <Stop offset="100%" stopColor={`${P.accent}00`} />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={W} fill="url(#scBg)" />
      <Background design={design} P={P} />
      <Rect width={W} height={W} fill="url(#scHalo)" />
      {/* frame */}
      <Rect x={34} y={34} width={W - 68} height={W - 68} rx={26} fill="none" stroke={P.accent} strokeWidth={2.5} opacity="0.85" />
      <Rect x={48} y={48} width={W - 96} height={W - 96} rx={20} fill="none" stroke={P.motif2} strokeWidth={1} opacity="0.35" />

      {/* brand row: LOGO MARK + wordmark */}
      <LogoMark x={122} y={112} r={38} accent={P.accent} />
      <SvgText x={190} y={98} fill={P.ink} fontSize={32} fontWeight="800" letterSpacing={4} fontFamily="Poppins-SemiBold">DEENLINK</SvgText>
      <SvgText x={190} y={132} fill={P.onBg} fontSize={19} fontWeight="600" fontFamily="Poppins-Medium" opacity="0.85">Islamic super-app</SvgText>
      <Path d={`M 92 162 H ${W - 92}`} stroke={P.accent} strokeWidth={1.4} opacity="0.5" />

      {/* metric */}
      {(() => {
        const m = card.metric;
        const fs = m.length > 14 ? 120 : m.length > 9 ? 165 : m.length > 6 ? 210 : 250;
        const fam = /[؀-ۿ]/.test(m) ? 'Amiri-Bold' : 'Poppins-Bold';
        return <SvgText x={W / 2} y={470} fill={P.accent} fontSize={fs} fontWeight="900" textAnchor="middle" fontFamily={fam}>{m}</SvgText>;
      })()}
      <SvgText x={W / 2} y={568} fill={P.ink} fontSize={56} fontWeight="800" textAnchor="middle" fontFamily="Poppins-SemiBold">{card.title}</SvgText>
      <Path d={`M ${W / 2 - 120} 612 H ${W / 2 + 120}`} stroke={P.accent} strokeWidth={2} opacity="0.7" />
      {subLines.map((ln, i) => (
        <SvgText key={i} x={W / 2} y={678 + i * 50} fill={P.sub} fontSize={34} fontWeight="600" textAnchor="middle" fontFamily="Poppins-Medium">{ln}</SvgText>
      ))}

      {/* QR — bottom LEFT, own corner, label UNDER it (no collisions) */}
      <G transform="translate(92 800)">
        <Rect x={-12} y={-12} width={qrSize + 24} height={qrSize + 24} rx={14} fill={design === 'scallop' ? '#FFFFFF' : '#F5F8F5'} />
        {qr.map((c, i) => (
          <Rect key={i} x={c.x * qrCell} y={c.y * qrCell} width={qrCell} height={qrCell} fill="#0B1811" />
        ))}
        <SvgText x={qrSize / 2} y={qrSize + 42} fill={P.onBg} fontSize={22} fontWeight="700" textAnchor="middle" fontFamily="Poppins-Medium" opacity="0.85">SCAN TO OPEN</SvgText>
      </G>

      {/* footer — bottom RIGHT, clear of the QR */}
      <SvgText x={W - 92} y={880} fill={P.onBg} fontSize={34} fontWeight="800" textAnchor="end" fontFamily="Amiri-Bold" opacity="0.9">بِسْمِ اللَّه</SvgText>
      <SvgText x={W - 92} y={924} fill={P.sub} fontSize={24} fontWeight="600" textAnchor="end" fontFamily="Poppins-Medium">deenlink.org</SvgText>
      <LogoMark x={W - 116} y={990} r={26} accent={P.accent} />
    </Svg>
  );
}

export function ScoreShareSheet({
  visible,
  onClose,
  card,
  friends,
}: {
  visible: boolean;
  onClose: () => void;
  card: ScoreCard | null;
  /* pass 40 — optional "send to friends" action (multi-select picker) */
  friends?: { title: string; preview?: string };
}) {
  const { theme, isDark } = useTheme();
  const [design, setDesign] = useState<ScoreDesign>('star');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const exportRef = useRef<SvgRefHandle>(null);

  useEffect(() => {
    if (visible) {
      setDesign(DESIGNS[Math.floor(Math.random() * DESIGNS.length)]);
      setToast(null);
    }
  }, [visible]);

  if (!card) return null;

  const savePhoto = async () => {
    if (busy) return;
    haptic.light();
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const ok = await svgWebDownload(exportRef, `deenlink-${card.kind}`);
        setToast(ok ? 'Photo downloaded ✓' : 'Could not save — try Share');
      } else {
        const ok = await saveSvgRefAsJpg(exportRef, `deenlink-${card.kind}`);
        setToast(ok ? 'Saved to your gallery ✓' : 'Allow photo permission to save');
      }
    } catch {
      setToast('Could not save — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, padding: 18, paddingBottom: 30, maxHeight: '88%' }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
          </View>
          <View nativeID="dl-score-preview" style={{ width: 216, height: 216, alignSelf: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
            <ScoreShareSvg card={card} design={design} ref={exportRef} />
          </View>
          {toast ? (
            <T v="caption" style={{ textAlign: 'center', fontSize: 10.5, fontWeight: '700', color: isDark ? '#4AE38F' : '#1D6F42', marginTop: 8 }}>{toast}</T>
          ) : null}
          {/* shuffle designs */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
            {DESIGNS.map((dn) => {
              const P = SCORE_PALETTES[dn];
              const on = design === dn;
              return (
                <Pressable
                  key={dn}
                  accessibilityLabel={`background ${P.label}`}
                  onPress={() => { haptic.selection(); setDesign(dn); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1.5, borderColor: on ? P.accent : theme.border, backgroundColor: on ? `${P.accent}22` : 'transparent', paddingHorizontal: 9, paddingVertical: 5 }}
                >
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: P.bg[0], borderWidth: 1.5, borderColor: P.accent }} />
                  <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: on ? P.accent : theme.subtext }}>{P.label}</T>
                </Pressable>
              );
            })}
          </View>
          {/* actions — SAVE PHOTO leads */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              accessibilityLabel="save photo"
              onPress={savePhoto}
              disabled={busy}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#1F8F5C', borderRadius: 12, paddingVertical: 11 }}
            >
              <FontAwesome5 name={busy ? 'spinner' : 'download'} size={12} color="#fff" />
              <T v="button" style={{ fontSize: 12.5 }}>Save photo</T>
            </Pressable>
            <Pressable
              onPress={() => { haptic.light(); shareSvgRef(exportRef, `deenlink-${card.kind}`, `${card.title} — ${card.metric}`).catch(() => {}); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 11 }}
            >
              <FontAwesome5 name="share" size={12} color={theme.text} />
              <T v="bodyS" style={{ fontSize: 12.5, color: theme.text }}>Share</T>
            </Pressable>
            {friends ? (
              <Pressable
                onPress={() => { haptic.light(); setFriendsOpen(true); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 11 }}
              >
                <FontAwesome5 name="user-friends" size={12} color={theme.text} />
                <T v="bodyS" style={{ fontSize: 12.5, color: theme.text }}>Friends</T>
              </Pressable>
            ) : null}
          </View>
          <ShareWithFriends visible={friendsOpen} onClose={() => setFriendsOpen(false)} title={friends?.title ?? card.title} preview={friends?.preview} />
          <T v="caption" style={{ textAlign: 'center', fontSize: 9, color: theme.subtext, marginTop: 8 }}>Tap a colour to shuffle the background · QR opens this screen in DeenLink</T>
        </View>
      </View>
    </Modal>
  );
}
