import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLg, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { saveSvgRefAsJpg, shareSvgRef, type SvgRefHandle } from '@/lib/svgExport';

/**
 * pass 35 — wallpapers, rebuilt. Every wallpaper is generated live as an SVG
 * (1080×1920) — the grid, the preview AND the exported JPG are the exact same
 * art, so what you save is what you saw. Save to gallery + share everywhere
 * (native AND web).
 */

type Wall = {
  id: string;
  name: string;
  from: string;
  to: string;
  arabic: string;
  label: string;
  motif: 'moon' | 'geometric' | 'lanterns' | 'star' | 'waves' | 'arch';
};

const WALLS: Wall[] = [
  { id: 'w1', name: 'Laylatul Qadr', from: '#0B1D3A', to: '#050D1F', arabic: 'إِنَّا أَنزَلْنَاهُ فِي لَيْلَةِ الْقَدْرِ', label: 'Qadr 97:1', motif: 'moon' },
  { id: 'w2', name: 'Emerald Ayah', from: '#0E3B26', to: '#06180F', arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', label: 'Baqarah 2:152', motif: 'geometric' },
  { id: 'w3', name: 'Golden Hour', from: '#4A3A12', to: '#1D1606', arabic: 'وَاللَّهُ يُضَاعِفُ لِمَن يَشَاءُ', label: 'Baqarah 2:261', motif: 'lanterns' },
  { id: 'w4', name: 'Sabr', from: '#26264A', to: '#101024', arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', label: 'Baqarah 2:153', motif: 'star' },
  { id: 'w5', name: 'Rahma', from: '#0A2E3A', to: '#04161E', arabic: 'وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ', label: 'Blessings', motif: 'waves' },
  { id: 'w6', name: 'Noor', from: '#123B52', to: '#082130', arabic: 'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ', label: 'An-Nur 24:35', motif: 'arch' },
];

const W = 1080;
const H = 1920;

function WallSvg({ wall, ref }: { wall: Wall; ref?: React.RefObject<SvgRefHandle> }) {
  return (
    <Svg ref={ref as never} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <SvgLg id="bg" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0%" stopColor={wall.from} />
          <Stop offset="100%" stopColor={wall.to} />
        </SvgLg>
        <RadialGradient id="glow" cx="50%" cy="32%" r="55%">
          <Stop offset="0%" stopColor="rgba(212,175,55,0.28)" />
          <Stop offset="100%" stopColor="rgba(212,175,55,0)" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={W} height={H} fill="url(#bg)" />
      <Rect x="0" y="0" width={W} height={H} fill="url(#glow)" />

      {wall.motif === 'moon' ? (
        <>
          <Circle cx={W / 2} cy={560} r="200" fill="rgba(232,201,102,0.9)" />
          <Circle cx={W / 2 + 70} cy={520} r="190" fill={wall.to} />
          {[...Array(26)].map((_, i) => (
            <Circle key={i} cx={80 + ((i * 197) % (W - 160))} cy={90 + ((i * 331) % 900)} r={2 + (i % 3)} fill="rgba(255,255,255,0.5)" />
          ))}
        </>
      ) : null}
      {wall.motif === 'geometric' ? (
        [...Array(7)].map((_, i) => (
          <Rect key={i} x={-200 + i * 260} y={140 + i * 30} width="420" height="420" fill="none" stroke="rgba(232,201,102,0.16)" strokeWidth="2" transform={`rotate(45 ${-200 + i * 260 + 210} ${140 + i * 30 + 210})`} />
        ))
      ) : null}
      {wall.motif === 'lanterns' ? (
        [...Array(5)].map((_, i) => {
          const x = 140 + i * 200;
          return (
            <Path key={i} d={`M ${x} 260 q -70 90 0 190 q 70 100 0 200 q -70 100 0 190`} stroke="rgba(232,201,102,0.4)" strokeWidth="3" fill="none" />
          );
        })
      ) : null}
      {wall.motif === 'star' ? (
        [...Array(8)].map((_, i) => {
          const cx = 120 + ((i * 173) % (W - 240));
          const cy = 120 + ((i * 277) % 760);
          return <Path key={i} d={`M ${cx} ${cy - 26} L ${cx + 7} ${cy - 7} L ${cx + 26} ${cy} L ${cx + 7} ${cy + 7} L ${cx} ${cy + 26} L ${cx - 7} ${cy + 7} L ${cx - 26} ${cy} L ${cx - 7} ${cy - 7} Z`} fill="rgba(232,201,102,0.5)" />;
        })
      ) : null}
      {wall.motif === 'waves' ? (
        [...Array(5)].map((_, i) => (
          <Path key={i} d={`M -50 ${900 + i * 90} q 270 ${-70} 590 0 t 590 0`} stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
        ))
      ) : null}
      {wall.motif === 'arch' ? (
        <Path d={`M 240 900 L 240 560 A 300 300 0 0 1 840 560 L 840 900 Z`} fill="none" stroke="rgba(232,201,102,0.35)" strokeWidth="3" />
      ) : null}

      {/* the ayah */}
      <SvgText x={W / 2} y={1300} textAnchor="middle" fontSize="64" fill="#F2F7F3" fontFamily="Amiri-Bold" opacity="0.96">{wall.arabic}</SvgText>
      <SvgText x={W / 2} y={1390} textAnchor="middle" fontSize="30" fill="rgba(232,201,102,0.95)" fontFamily="Poppins-SemiBold" letterSpacing="4">{wall.label.toUpperCase()}</SvgText>
      {/* brand footer */}
      <SvgText x={W / 2} y={H - 120} textAnchor="middle" fontSize="30" fill="rgba(255,255,255,0.5)" fontFamily="Poppins" letterSpacing="10">DEENLINK</SvgText>
      <Rect x={W / 2 - 40} y={H - 170} width="80" height="3" fill="rgba(212,175,55,0.6)" />
    </Svg>
  );
}

export default function Wallpapers() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState<Wall | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const exportRef = useRef<SvgRefHandle>(null);

  const doShare = async () => {
    if (!sel || busy) return;
    haptic.medium(); setBusy(true);
    try { await shareSvgRef(exportRef, `deenlink-wallpaper-${sel.id}`); } catch { setToast('Could not export — try again'); }
    setBusy(false);
  };
  const doSave = async () => {
    if (!sel || busy) return;
    haptic.medium(); setBusy(true);
    try {
      if (Platform.OS === 'web') {
        await shareSvgRef(exportRef, `deenlink-wallpaper-${sel.id}`);
        setToast('Long-press the image → Save image');
      } else {
        const ok = await saveSvgRefAsJpg(exportRef, `deenlink-wallpaper-${sel.id}`);
        setToast(ok ? 'Saved to your gallery ✓' : 'Could not save — check photo permission');
      }
    } catch { setToast('Could not save — try Share instead'); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 12) + 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(91,200,245,0.12)', borderWidth: 1, borderColor: 'rgba(91,200,245,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="image" size={14} color="#5BC8F5" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Islamic Wallpapers</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>Generated in-app · save or share any design</T>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 14 }}>
          {WALLS.map((w) => (
            <Pressable
              key={w.id}
              accessibilityLabel={`wallpaper ${w.name}`}
              onPress={() => { haptic.selection(); setSel(w); }}
              style={{ width: '48%', aspectRatio: 9 / 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder }}
            >
              <WallSvg wall={w} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* fullscreen preview + save/share */}
      <Modal visible={!!sel} transparent animationType="fade" onRequestClose={() => setSel(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,6,4,0.94)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSel(null)}>
            <View style={{ flex: 1, margin: 12, borderRadius: 22, overflow: 'hidden' }}>
              {sel ? <WallSvg wall={sel} ref={exportRef} /> : null}
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10, padding: 14, paddingBottom: Math.max(insets.bottom, 14) + 6 }}>
            <Pressable onPress={doSave} style={{ flex: 1, borderRadius: 14, height: 48, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              {busy ? <ActivityIndicator size="small" color="#E8C96A" /> : <FontAwesome5 name="download" size={13} color="#E8C96A" />}
              <T v="button" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 13 }}>Save to gallery</T>
            </Pressable>
            <Pressable onPress={doShare} style={{ flex: 1, borderRadius: 14, height: 48, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="share-alt" size={13} color="#fff" />}
              <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Share</T>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!toast} transparent animationType="fade" onRequestClose={() => setToast(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,8,5,0.5)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90 }} onPress={() => setToast(null)}>
          <View style={{ borderRadius: 14, backgroundColor: isDark ? '#0A1A11' : '#FFFFFF', paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' }}>
            <T v="bodyS" style={{ fontSize: 12.5, color: d.text }}>{toast}</T>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
