import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { markActive, markGoal } from '@/lib/routine';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { DeenPointsPill } from '@/components/DeenPoints';
import {
  CalculatorIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  CompassIcon,
  KaabaIcon,
  HandHeartIcon,
  MosqueIcon,
  PrayingHandsIcon,
  StarCrescentIcon,
  XIcon,
  type IconProps,
} from '@/components/Icons';

/**
 * Web tools hub (tools/index.html), 1:1 — page hero + vertical list of tool
 * cards (4px left bar, 50px gradient icon tile, title, badge, description,
 * chevron), plus the built-in Digital Tasbeeh modal (beads + modern styles).
 */
interface ToolCard {
  key: string;
  title: string;
  desc: string;
  badge?: string;
  badgeTint?: boolean; // uses teal tint instead of the green tint
  icon: (p: IconProps) => React.ReactNode;
  bar: string;
  grad: [string, string];
  action: { type: 'route'; href: Href } | { type: 'web'; url: string } | { type: 'tasbeeh' };
}

const TOOLS: ToolCard[] = [
  {
    key: 'prayer',
    title: 'Prayer Times',
    desc: 'Accurate prayer times for your location with notifications',
    badge: 'Live',
    icon: ClockIcon,
    bar: '#1976D2',
    grad: ['#1976D2', '#64B5F6'],
    action: { type: 'route', href: '/tools/prayer' },
  },
  {
    key: 'qibla',
    title: 'Qibla Direction',
    desc: 'Find the direction to Kaaba from anywhere in the world',
    icon: CompassIcon,
    bar: '#1D6F42',
    grad: ['#1D6F42', '#4CAF50'],
    action: { type: 'route', href: '/tools/qibla' },
  },
  {
    key: 'calendar',
    title: 'Hijri Calendar',
    desc: 'Islamic calendar with important dates & events',
    badge: 'Updated',
    icon: CalendarIcon,
    bar: '#7B1FA2',
    grad: ['#7B1FA2', '#BA68C8'],
    action: { type: 'route', href: '/tools/calendar' },
  },
  {
    key: 'names',
    title: '99 Names of Allah',
    desc: 'Learn and memorize the beautiful names of Allah with meanings',
    badge: 'Complete',
    badgeTint: true,
    icon: StarCrescentIcon,
    bar: '#00838F',
    grad: ['#00838F', '#26C6DA'],
    action: { type: 'route', href: '/tools/names' },
  },
  {
    key: 'dua',
    title: 'Daily Duas & Adhkar',
    desc: 'Morning & evening remembrances with audio',
    badge: 'Complete',
    icon: (p: IconProps) => <FontAwesome5 name="hands-helping" size={(p.size ?? 22) * 0.92} color={p.color} />,
    bar: '#00796B',
    grad: ['#00796B', '#26A69A'],
    action: { type: 'route', href: '/tools/dua' },
  },
  {
    key: 'tasbeeh',
    title: 'Digital Tasbeeh',
    desc: 'Digital prayer counter with multiple styles',
    badge: 'Counter',
    icon: KaabaIcon,
    bar: '#D4AF37',
    grad: ['#D4AF37', '#FFD54F'],
    action: { type: 'route', href: '/tools/tasbeeh' },
  },
  {
    key: 'mirath',
    title: 'Mirath — Inheritance',
    desc: 'Divide an estate islamically (faraaid)',
    badge: 'New',
    icon: (p: IconProps) => <FontAwesome5 name="balance-scale" size={(p.size ?? 22) * 0.9} color={p.color} />,
    bar: '#4527A0',
    grad: ['#4527A0', '#7E57C2'],
    action: { type: 'route', href: '/tools/mirath' },
  },
  {
    key: 'zakat',
    title: 'Zakat Calculator',
    desc: 'Calculate your Zakat based on wealth & assets',
    icon: CalculatorIcon,
    bar: '#E65100',
    grad: ['#E65100', '#FF9800'],
    action: { type: 'route', href: '/tools/zakat' },
  },
  {
    key: 'seerah',
    title: 'Seerah Timeline',
    desc: 'The life of the Prophet ﷺ, year by year',
    badge: 'New',
    icon: StarCrescentIcon,
    bar: '#8C6D1F',
    grad: ['#8C6D1F', '#D4AF37'],
    action: { type: 'route', href: '/tools/seerah' },
  },
  {
    key: 'donation',
    title: 'Donations',
    desc: 'Give Zakat, Sadaqah, or support DeenLink',
    badge: 'New',
    icon: HandHeartIcon,
    bar: '#C62828',
    grad: ['#C62828', '#D4AF37'],
    action: { type: 'route', href: '/tools/charity' },
  },
];

export default function Tools() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const [tasbeehOpen, setTasbeehOpen] = useState(false);

  const open = (t: ToolCard) => {
    if (t.action.type === 'route') router.push(t.action.href);
    else if (t.action.type === 'web') Linking.openURL(t.action.url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <PageHero title="Worship Tools" heading="Daily Spiritual Tools" sub="Everything you need for your daily ibadah" icon={MosqueIcon}><DeenPointsPill /></PageHero>
        <View style={{ paddingTop: 20, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => open(t)}
                  style={({ pressed }) => ({
                    width: '48%',
                    flexGrow: 1,
                    backgroundColor: d.card,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: d.cardBorder,
                    padding: 14,
                    gap: 10,
                    opacity: pressed ? 0.82 : 1,
                    shadowColor: '#000',
                    shadowOpacity: isDark ? 0.2 : 0.05,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 3,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 13, overflow: 'hidden' }}>
                      <LinearGradient colors={t.grad as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={19} color="#fff" />
                      </LinearGradient>
                    </View>
                    {t.badge ? (
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <View style={{ backgroundColor: t.badgeTint ? 'rgba(0,131,143,0.12)' : isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2.5, borderWidth: 1, borderColor: t.badgeTint ? 'rgba(0,131,143,0.35)' : isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)' }}>
                          <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: t.badgeTint ? '#00838F' : isDark ? '#4AE38F' : '#1D6F42' }}>
                            {t.badge.toUpperCase()}
                          </T>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13, lineHeight: 17 }}>
                    {t.title}
                  </T>
                  <T v="caption" style={{ color: d.faint, fontSize: 10, lineHeight: 14 }}>
                    {t.desc}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <TasbeehModal visible={tasbeehOpen} onClose={() => setTasbeehOpen(false)} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Digital Tasbeeh — faithful to the web modal (beads + modern).      */
/* ------------------------------------------------------------------ */

const DHIKRS = ['Subhanallah', 'Alhamdulillah', 'Allahu Akbar'];

function TasbeehModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [style, setStyle] = useState<'beads' | 'modern'>('beads');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', padding: 16 }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.card,
            borderRadius: 20,
            width: '100%',
            maxWidth: 450,
            alignSelf: 'center',
            overflow: 'hidden',
            maxHeight: '88%',
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden' }}>
                <LinearGradient colors={['#D4AF37', '#FFD54F'] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <KaabaIcon size={18} color="#fff" />
                </LinearGradient>
              </View>
              <T v="h2" style={{ fontWeight: '700' }}>
                Digital Tasbeeh
              </T>
            </View>
            <Pressable onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.cardSoft, alignItems: 'center', justifyContent: 'center' }} hitSlop={8}>
              <XIcon size={15} color={theme.subtext} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
            {/* Style selector */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
              <StyleBtn active={style === 'beads'} icon={<KaabaIcon size={16} color={style === 'beads' ? '#fff' : theme.primary} />} label="Tasbeeh Beads" onPress={() => setStyle('beads')} />
              <StyleBtn active={style === 'modern'} icon={<TargetGlyph active={style === 'modern'} />} label="Modern Counter" onPress={() => setStyle('modern')} />
            </View>

            {style === 'beads' ? <BeadsStyle /> : <ModernStyle />}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StyleBtn({ active, icon, label, onPress }: { active: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: active ? theme.primary : theme.cardSoft,
        borderWidth: 1,
        borderColor: active ? theme.primary : theme.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <T v="caption" color={active ? 'onPrimary' : 'text'} style={{ fontWeight: '600' }}>
        {label}
      </T>
    </Pressable>
  );
}

function TargetGlyph({ active }: { active: boolean }) {
  const c = active ? '#fff' : '#1D6F42';
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16}>
      <Circle cx="12" cy="12" r="8" stroke={c} strokeWidth={1.8} fill="none" />
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={1.8} fill="none" />
      <Path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/* ---------------------------- Beads style ---------------------------- */

function BeadsStyle() {
  const { theme } = useTheme();
  const [dhikr, setDhikr] = useState(0);
  const [count, setCount] = useState(0);
  const BEADS = 33;
  const R = 92;
  const C = 110;
  const beads = Array.from({ length: BEADS }, (_, i) => {
    const a = (i / BEADS) * Math.PI * 2 - Math.PI / 2;
    return { x: C + R * Math.cos(a), y: C + R * Math.sin(a), filled: i < count };
  });

  const tap = () => {
    const n = count + 1;
    if (n >= BEADS) {
      setCount(0);
      setDhikr((d) => (d + 1) % DHIKRS.length);
      markGoal('dhikr');
      markActive();
    } else setCount(n);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <T v="bodyS" color="primary" style={{ fontWeight: '600' }}>
          Traditional Tasbeeh
        </T>
        <T v="caption">
          Beads: {count}/{BEADS}
        </T>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Svg viewBox="0 0 220 220" width={220} height={220} style={{ marginBottom: 8 }}>
          <Circle cx={C} cy={C} r={R} stroke={theme.border} strokeWidth={1} fill="none" />
          {beads.map((b, i) => (
            <Circle key={i} cx={b.x} cy={b.y} r={7} fill={b.filled ? '#D4AF37' : theme.cardSoft} stroke={b.filled ? '#B8860B' : theme.border} strokeWidth={1} />
          ))}
          <Circle cx={C} cy={C} r={46} fill={theme.card} stroke={theme.border} strokeWidth={1} />
        </Svg>
      </View>

      <View style={{ alignItems: 'center', marginTop: -78, marginBottom: 26 }}>
        <T v="stat" style={{ fontSize: 34, fontWeight: '700', color: theme.primary }}>
          {count}
        </T>
        <T v="caption" style={{ marginTop: 2 }}>
          {DHIKRS[dhikr]}
        </T>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
        <BeadBtn label="‹" onPress={() => setDhikr((d) => (d + DHIKRS.length - 1) % DHIKRS.length)} />
        <Pressable
          onPress={tap}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.primary,
            borderRadius: 12,
            paddingHorizontal: 22,
            paddingVertical: 13,
            opacity: pressed ? 0.85 : 1,
            shadowColor: theme.primary,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          })}
        >
          <T v="button" color="onPrimary" style={{ fontWeight: '600' }}>
            Tap Bead
          </T>
        </Pressable>
        <BeadBtn label="›" onPress={() => setDhikr((d) => (d + 1) % DHIKRS.length)} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        {DHIKRS.map((d, i) => (
          <Pressable
            key={d}
            onPress={() => {
              setDhikr(i);
              setCount(0);
            }}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 16,
              backgroundColor: dhikr === i ? theme.primary : theme.cardSoft,
              borderWidth: 1,
              borderColor: dhikr === i ? theme.primary : theme.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <T v="caption" color={dhikr === i ? 'onPrimary' : 'text'} style={{ fontWeight: '600' }}>
              {d}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BeadBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: theme.cardSoft,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <T v="body" style={{ fontWeight: '700', fontSize: 18 }}>
        {label}
      </T>
    </Pressable>
  );
}

/* ---------------------------- Modern style ---------------------------- */

function ModernStyle() {
  const { theme } = useTheme();
  const [target, setTarget] = useState(33);
  const [count, setCount] = useState(0);
  const done = target > 0 && count >= target;

  const tap = () => {
    if (done) {
      setCount(0);
      return;
    }
    const n = count + 1;
    setCount(n);
    if (target > 0 && n >= target) {
      markGoal('dhikr');
      markActive();
    }
  };

  const R = 80;
  const C = 100;
  const circ = 2 * Math.PI * R;
  const frac = target > 0 ? Math.min(count / target, 1) : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <T v="bodyS" color="primary" style={{ fontWeight: '600' }}>
          Count Your Dhikr
        </T>
      </View>

      {/* Target selector */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { v: 33, l: '33 · Dhikr' },
          { v: 100, l: '100 · Astaghfirullah' },
          { v: 11, l: '11 · Salawat' },
          { v: 0, l: 'Unlimited' },
        ].map((o) => (
          <Pressable
            key={o.l}
            onPress={() => {
              setTarget(o.v);
              setCount(0);
            }}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 16,
              backgroundColor: target === o.v ? theme.primary : theme.cardSoft,
              borderWidth: 1,
              borderColor: target === o.v ? theme.primary : theme.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <T v="caption" color={target === o.v ? 'onPrimary' : 'text'} style={{ fontWeight: '600' }}>
              {o.l}
            </T>
          </Pressable>
        ))}
      </View>

      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Svg viewBox="0 0 200 200" width={200} height={200}>
            <Circle cx={C} cy={C} r={R} stroke={theme.cardSoft} strokeWidth={10} fill="none" />
            <Circle
              cx={C}
              cy={C}
              r={R}
              stroke="#D4AF37"
              strokeWidth={10}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circ * frac} ${circ}`}
              transform={`rotate(-90 ${C} ${C})`}
            />
          </Svg>
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <T v="stat" style={{ fontSize: 44, fontWeight: '700', color: done ? '#D4AF37' : theme.primary }}>
              {count}
            </T>
            {target > 0 ? (
              <T v="caption">/ {target}</T>
            ) : null}
          </View>
        </View>
        <T v="bodyS" style={{ marginTop: 10, fontWeight: '600', color: done ? '#D4AF37' : theme.subtext }}>
          {done ? 'Masha’Allah — target reached!' : 'Start your dhikr'}
        </T>
      </View>

      <Pressable
        onPress={tap}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor: theme.primary,
          borderRadius: 14,
          padding: 16,
          marginTop: 18,
          opacity: pressed ? 0.85 : 1,
          shadowColor: theme.primary,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 6,
        })}
      >
        <PlusGlyph />
        <T v="button" color="onPrimary" style={{ fontWeight: '600', fontSize: 16 }}>
          Tap to Count
        </T>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable
          onPress={() => setCount(0)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.cardSoft,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 13,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <T v="caption" style={{ fontWeight: '600' }}>
            Reset
          </T>
        </Pressable>
      </View>
    </View>
  );
}

function PlusGlyph() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth={1.8} fill="none" />
      <Path d="M12 8 V16 M8 12 H16" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
