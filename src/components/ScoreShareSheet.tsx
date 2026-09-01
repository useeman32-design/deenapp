import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { create as createQR } from 'qrcode';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FontAwesome5 } from '@expo/vector-icons';
import { haptic } from '@/lib/haptics';
import { canSaveImages, saveSvgRefAsJpg, shareSvgRef, type SvgRefHandle } from '@/lib/svgExport';

/**
 * pass 38 — SQUARE score share cards (1080×1080) for quiz results and other
 * in-app achievements. Backgrounds are 5 PROCEDURAL SVG designs that shuffle
 * on tap — zero image files, a few KB of geometry. The QR deep-links into
 * the screen the score came from.
 */

export type ScoreCard = {
  kind: string;          /* 'quiz' | 'streak' | … */
  metric: string;        /* big number, e.g. "87%" */
  title: string;         /* e.g. "Islamic Quiz" */
  subtitle: string;      /* e.g. "7 of 8 correct · Fiqh" */
  link: string;          /* deep link the QR resolves to */
};

const W = 1080;
const GOLD = '#D4AF37';
const CREAM = '#F5E6B8';

/* ── the 5 procedural backgrounds (pure SVG geometry) ── */
const DESIGNS = ['star', 'rays', 'tiles', 'scallop', 'crescent'] as const;
export type ScoreDesign = (typeof DESIGNS)[number];

function Background({ design }: { design: ScoreDesign }) {
  switch (design) {
    case 'star':
      /* 8-point khatim lattice */
      return (
        <G opacity="0.16">
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2].map((c) => (
              <G key={`${r}-${c}`} transform={`translate(${135 + c * 405} ${135 + r * 405}) rotate(22.5)`}>
                <Rect x={-95} y={-95} width={190} height={190} fill="none" stroke={GOLD} strokeWidth={3} />
                <Rect x={-95} y={-95} width={190} height={190} fill="none" stroke={CREAM} strokeWidth={1.4} transform="rotate(45)" />
              </G>
            )),
          )}
        </G>
      );
    case 'rays':
      /* radial sunburst from the metric */
      return (
        <G opacity="0.13">
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i * Math.PI * 2) / 36;
            const r1 = 150;
            const r2 = i % 3 === 0 ? 900 : 560;
            return (
              <Path
                key={i}
                d={`M ${540 + Math.cos(a) * r1} ${560 + Math.sin(a) * r1} L ${540 + Math.cos(a - 0.035) * r1} ${560 + Math.sin(a - 0.035) * r1} L ${540 + Math.cos(a) * r2} ${560 + Math.sin(a) * r2} Z`}
                fill={i % 3 === 0 ? GOLD : CREAM}
              />
            );
          })}
        </G>
      );
    case 'tiles':
      /* moroccan tile grid */
      return (
        <G opacity="0.15">
          {Array.from({ length: 36 }, (_, i) => {
            const col = i % 6;
            const row = Math.floor(i / 6);
            return (
              <G key={i} transform={`translate(${90 + col * 180} ${90 + row * 180}) rotate(45)`}>
                <Rect x={-62} y={-62} width={124} height={124} fill="none" stroke={GOLD} strokeWidth={2.6} />
                <Circle r={20} fill="none" stroke={CREAM} strokeWidth={1.6} />
              </G>
            );
          })}
        </G>
      );
    case 'scallop':
      /* arabesque dome scallops */
      return (
        <G opacity="0.16">
          {[0, 1, 2, 3, 4, 5, 6].map((row) =>
            Array.from({ length: 7 }, (_, col) => (
              <Path
                key={`${row}-${col}`}
                d={`M ${col * 180 - 90 + (row % 2) * 90} ${row * 180 + 180} a 90 90 0 0 1 180 0`}
                fill="none"
                stroke={row % 2 ? CREAM : GOLD}
                strokeWidth={2.4}
              />
            )),
          )}
        </G>
      );
    case 'crescent':
      /* scattered crescents + sparks */
      return (
        <G opacity="0.2">
          {[
            [150, 190, 62], [880, 140, 40], [930, 880, 74], [120, 900, 48], [500, 90, 30], [760, 460, 26], [300, 620, 34],
          ].map(([x, y, r], i) => (
            <G key={i} transform={`translate(${x} ${y}) rotate(${i * 41})`}>
              <Circle r={r} fill="none" stroke={i % 2 ? CREAM : GOLD} strokeWidth={3} />
              <Circle cx={r * 0.38} cy={-r * 0.1} r={r * 0.92} fill="#0B1811" stroke="none" />
            </G>
          ))}
          {[[420, 320], [690, 760], [230, 760], [830, 330]].map(([x, y], i) => (
            <Path key={`s${i}`} d={`M ${x} ${y - 26} L ${x + 8} ${y - 8} L ${x + 26} ${y} L ${x + 8} ${y + 8} L ${x} ${y + 26} L ${x - 8} ${y + 8} L ${x - 26} ${y} L ${x - 8} ${y - 8} Z`} fill={GOLD} opacity="0.5" />
          ))}
        </G>
      );
  }
}

function qrSquares(url: string): Array<{ x: number; y: number; s: number }> {
  try {
    const qr = createQR(url, { margin: 0 });
    const m = qr.modules as unknown as { size: number; data: Uint8Array };
    const cells: Array<{ x: number; y: number; s: number }> = [];
    for (let y = 0; y < m.size; y++) {
      for (let x = 0; x < m.size; x++) {
        if (m.data[y * m.size + x]) cells.push({ x, y, s: m.size });
      }
    }
    return cells;
  } catch {
    return [];
  }
}

export function ScoreShareSvg({ card, design, ref }: { card: ScoreCard; design: ScoreDesign; ref?: React.RefObject<any> }) {
  const qr = qrSquares(card.link);
  const qrSize = 128;
  const qrCell = qr.length ? qrSize / qr[0].s : 0;
  return (
    <Svg ref={ref} width="100%" height="100%" viewBox={`0 0 ${W} ${W}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="scBg" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0%" stopColor="#14301F" />
          <Stop offset="60%" stopColor="#0B1811" />
          <Stop offset="100%" stopColor="#060D09" />
        </LinearGradient>
        <RadialGradient id="scHalo" cx="50%" cy="50%" r="55%">
          <Stop offset="0%" stopColor="rgba(212,175,55,0.22)" />
          <Stop offset="100%" stopColor="rgba(212,175,55,0)" />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={W} fill="url(#scBg)" />
      <Background design={design} />
      <Rect width={W} height={W} fill="url(#scHalo)" />
      {/* frame */}
      <Rect x={34} y={34} width={W - 68} height={W - 68} rx={26} fill="none" stroke={GOLD} strokeWidth={2.5} opacity="0.85" />
      <Rect x={48} y={48} width={W - 96} height={W - 96} rx={20} fill="none" stroke={CREAM} strokeWidth={1} opacity="0.35" />

      {/* brand */}
      <SvgText x={92} y={126} fill={CREAM} fontSize={30} fontWeight="800" letterSpacing={4} fontFamily="Poppins-SemiBold">
        DEENLINK
      </SvgText>
      <Path d={`M 92 148 H ${W - 300}`} stroke={GOLD} strokeWidth={1.4} opacity="0.5" />

      {/* metric */}
      <SvgText x={W / 2} y={520} fill={GOLD} fontSize={280} fontWeight="900" textAnchor="middle" fontFamily="Poppins-Bold">
        {card.metric}
      </SvgText>
      <SvgText x={W / 2} y={620} fill="#F5F8F5" fontSize={52} fontWeight="800" textAnchor="middle" fontFamily="Poppins-SemiBold">
        {card.title}
      </SvgText>
      <Path d={`M ${W / 2 - 120} 668 H ${W / 2 + 120}`} stroke={GOLD} strokeWidth={2} opacity="0.7" />
      <SvgText x={W / 2} y={736} fill="rgba(245,248,245,0.72)" fontSize={36} fontWeight="600" textAnchor="middle" fontFamily="Poppins-Medium">
        {card.subtitle}
      </SvgText>

      {/* QR deep link */}
      <G transform={`translate(${W - 92 - qrSize} ${W - 92 - qrSize})`}>
        <Rect x={-14} y={-14} width={qrSize + 28} height={qrSize + 28} rx={14} fill="#F5F8F5" />
        {qr.map((c, i) => (
          <Rect key={i} x={c.x * qrCell} y={c.y * qrCell} width={qrCell} height={qrCell} fill="#0B1811" />
        ))}
      </G>
      <SvgText x={W - 92 - qrSize / 2} y={W - 104} fill="rgba(245,230,184,0.75)" fontSize={24} fontWeight="700" textAnchor="middle" fontFamily="Poppins-Medium">
        SCAN TO PLAY
      </SvgText>

      {/* footer */}
      <SvgText x={92} y={W - 130} fill={CREAM} fontSize={34} fontWeight="800" fontFamily="Poppins-SemiBold">
        بِسْمِ اللَّه
      </SvgText>
      <SvgText x={92} y={W - 92} fill="rgba(245,248,245,0.55)" fontSize={24} fontWeight="600" fontFamily="Poppins-Medium">
        deenlink.org · Islamic super-app
      </SvgText>
    </Svg>
  );
}

export function ScoreShareSheet({ visible, onClose, card }: { visible: boolean; onClose: () => void; card: ScoreCard | null }) {
  const { theme, isDark } = useTheme();
  const [design, setDesign] = useState<ScoreDesign>('star');
  const [canSave, setCanSave] = useState(false);
  const exportRef = useRef<SvgRefHandle>(null);

  useEffect(() => {
    if (visible) {
      /* start on a rotating design so cards feel fresh */
      setDesign(DESIGNS[Math.floor(Math.random() * DESIGNS.length)]);
      canSaveImages().then(setCanSave).catch(() => setCanSave(false));
    }
  }, [visible]);

  if (!card) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, padding: 18, paddingBottom: 30 }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
          </View>
          {/* live square preview */}
          <View style={{ width: 216, height: 216, alignSelf: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
            <ScoreShareSvg card={card} design={design} ref={exportRef} />
          </View>
          {/* shuffle designs */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
            {DESIGNS.map((dn, i) => (
              <Pressable
                key={dn}
                onPress={() => { haptic.selection(); setDesign(dn); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: design === dn ? '#D4AF37' : theme.border, backgroundColor: design === dn ? 'rgba(212,175,55,0.12)' : 'transparent', paddingHorizontal: 9, paddingVertical: 5 }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: design === dn ? '#D4AF37' : theme.subtext }} />
                <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: design === dn ? '#E8C96A' : theme.subtext }}>{String(i + 1)}</T>
              </Pressable>
            ))}
          </View>
          {/* actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              onPress={() => { haptic.light(); shareSvgRef(exportRef, `deenlink-${card.kind}`, `${card.title} — ${card.metric}`).catch(() => {}); }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#1F8F5C', borderRadius: 12, paddingVertical: 11 }}
            >
              <FontAwesome5 name="share" size={12} color="#fff" />
              <T v="button" style={{ fontSize: 12.5 }}>Share image</T>
            </Pressable>
            {canSave ? (
              <Pressable
                onPress={() => { haptic.light(); saveSvgRefAsJpg(exportRef, `deenlink-${card.kind}`).catch(() => {}); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 11 }}
              >
                <FontAwesome5 name="download" size={12} color={theme.text} />
                <T v="bodyS" style={{ fontSize: 12.5, color: theme.text }}>Save</T>
              </Pressable>
            ) : null}
          </View>
          <T v="caption" style={{ textAlign: 'center', fontSize: 9, color: theme.subtext, marginTop: 8 }}>Tap a dot to shuffle the design · QR opens this screen in DeenLink</T>
        </View>
      </View>
    </Modal>
  );
}
