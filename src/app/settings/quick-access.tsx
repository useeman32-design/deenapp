import { useEffect, useMemo, useState } from 'react';
import { goBack } from '@/lib/navigation';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { BeadsIcon } from '@/components/Icons';
import { storage } from '@/lib/storage';
import {
  DEFAULT_QUICK,
  QUICK_CATALOG,
  QUICK_STORAGE_KEY,
  parseQuickPrefs,
  resolveQuick,
  type QuickItem,
  type QuickPrefs,
} from '@/lib/quick-access';

/**
 * pass 79 — the home rail lists EVERY shortcut; this screen only REMOVES
 * (hides) or REARRANGES them. Order + hidden set persist as v5 prefs; the
 * home tab re-reads on focus.
 */
export default function QuickAccessEditor() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<QuickPrefs>({ order: [...DEFAULT_QUICK], hidden: [] });

  useEffect(() => {
    storage.getItem(QUICK_STORAGE_KEY).then((raw) => {
      const p = parseQuickPrefs(raw);
      if (p) setPrefs(p);
    });
  }, []);

  /* the full catalog in display order: saved order first, then the rest */
  const fullOrder = useMemo(() => {
    const byKey = new Map(QUICK_CATALOG.map((c) => [c.key, c] as const));
    const out: QuickItem[] = [];
    const seen = new Set<string>();
    for (const k of [...prefs.order, ...DEFAULT_QUICK]) {
      const it = byKey.get(k);
      if (it && !seen.has(k)) { out.push(it); seen.add(k); }
    }
    for (const it of QUICK_CATALOG) {
      if (!seen.has(it.key)) { out.push(it); seen.add(it.key); }
    }
    return out;
  }, [prefs.order]);

  const hiddenSet = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);
  const visible = fullOrder.filter((it) => !hiddenSet.has(it.key));
  const hiddenItems = fullOrder.filter((it) => hiddenSet.has(it.key));

  const save = (next: QuickPrefs) => {
    setPrefs(next);
    storage.setItem(QUICK_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const move = (key: string, dir: -1 | 1) => {
    const keys = fullOrder.map((i) => i.key);
    const i = keys.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    save({ ...prefs, order: keys });
  };
  const toggleHidden = (key: string) => {
    const hidden = hiddenSet.has(key) ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key];
    save({ ...prefs, hidden });
  };

  const Row = ({ it, i, count }: { it: QuickItem; i: number; count: number }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: d.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: d.cardBorder,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 10,
        opacity: hiddenSet.has(it.key) ? 0.55 : 1,
      }}
    >
      <Chip item={it} />
      <View style={{ flex: 1 }}>
        <T v="bodyS" style={{ color: d.text, fontWeight: '600', fontSize: 13 }}>
          {it.label}
        </T>
      </View>
      {hiddenSet.has(it.key) ? null : (
        <>
          <RoundBtn disabled={i === 0} onPress={() => move(it.key, -1)}>
            <FontAwesome5 name="chevron-up" size={11} color={i === 0 ? d.faint : d.text} />
          </RoundBtn>
          <RoundBtn disabled={i === count - 1} onPress={() => move(it.key, 1)}>
            <FontAwesome5 name="chevron-down" size={11} color={i === count - 1 ? d.faint : d.text} />
          </RoundBtn>
        </>
      )}
      <RoundBtn onPress={() => toggleHidden(it.key)} danger={hiddenSet.has(it.key)}>
        <FontAwesome5 name={hiddenSet.has(it.key) ? 'eye-slash' : 'eye'} size={11} color={hiddenSet.has(it.key) ? d.faint : (isDark ? '#FF7B7B' : '#C0392B')} />
      </RoundBtn>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg, paddingTop: insets.top }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
        <Pressable
          onPress={() => goBack(router)}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: d.card,
            borderWidth: 1,
            borderColor: d.cardBorder,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <FontAwesome5 name="chevron-left" size={14} color={d.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h1" style={{ color: d.text, fontSize: 18 }}>
            Quick Access
          </T>
          <T v="caption" style={{ color: d.subtext, fontSize: 11 }}>
            All shortcuts live on your home rail — hide or rearrange them here
          </T>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 }}>
          <T v="caption" style={{ color: d.subtext, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 }}>
            SHOWN ON HOME ({visible.length})
          </T>
          <T v="caption" style={{ color: d.faint, fontSize: 10.5 }}>
            eye = hide · arrows = order
          </T>
        </View>
        <View style={{ gap: 10 }}>
          {visible.map((it, i) => <Row key={it.key} it={it} i={i} count={visible.length} />)}
        </View>

        {hiddenItems.length > 0 ? (
          <>
            <View style={{ marginTop: 26, marginBottom: 10 }}>
              <T v="caption" style={{ color: d.subtext, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 }}>
                HIDDEN ({hiddenItems.length}) — tap the eye to bring back
              </T>
            </View>
            <View style={{ gap: 10 }}>
              {hiddenItems.map((it, i) => <Row key={it.key} it={it} i={i} count={hiddenItems.length} />)}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Chip({ item }: { item: QuickItem }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const accent = item.accent === 'gold' ? d.gold : d.emerald;
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: isDark ? `${accent}29` : `${accent}1A`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {item.icon.beads ? (
        <BeadsIcon size={18} color={accent} />
      ) : (
        <FontAwesome5 name={item.icon.fa as never} size={16} color={accent} />
      )}
    </View>
  );
}

function RoundBtn({
  children,
  onPress,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { theme } = useTheme();
  const d = theme.dash;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: danger ? 'transparent' : d.bgSoft,
        borderWidth: 1,
        borderColor: d.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
