import { useEffect, useState } from 'react';
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
  QUICK_MAX,
  QUICK_STORAGE_KEY,
  quickItems,
  type QuickItem,
} from '@/lib/quick-access';

/**
 * Manage the home-screen Quick Access shortcuts:
 * pick which of the 14 features appear (max 5) and in which order.
 * Saved to localStorage / AsyncStorage instantly; the home tab re-reads it on focus.
 */
export default function QuickAccessEditor() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [keys, setKeys] = useState<string[]>(DEFAULT_QUICK);

  useEffect(() => {
    storage.getItem(QUICK_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const arr = JSON.parse(raw) as string[];
        const items = quickItems(arr);
        if (items.length) setKeys(items.map((i) => i.key));
      } catch {
        /* corrupt data → keep defaults */
      }
    });
  }, []);

  const save = (next: string[]) => {
    setKeys(next);
    storage.setItem(QUICK_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const items = quickItems(keys);
  const available = QUICK_CATALOG.filter((c) => !keys.includes(c.key));
  const atMax = keys.length >= QUICK_MAX;

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    const next = [...keys];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const remove = (i: number) => save(keys.filter((_, k) => k !== i));
  const add = (key: string) => !atMax && save([...keys, key]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg, paddingTop: insets.top }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
        <Pressable
          onPress={() => router.back()}
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
            Choose up to {QUICK_MAX} shortcuts and their order
          </T>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* selected */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 }}>
          <T v="caption" style={{ color: d.subtext, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 }}>
            YOUR SHORTCUTS
          </T>
          <T v="caption" style={{ color: d.faint, fontSize: 10.5 }}>
            {keys.length}/{QUICK_MAX}
          </T>
        </View>

        {items.length === 0 ? (
          <View style={{ backgroundColor: d.card, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, padding: 22, alignItems: 'center' }}>
            <T v="bodyS" style={{ color: d.subtext, textAlign: 'center' }}>
              No shortcuts yet — add some below.
            </T>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((it, i) => (
              <View
                key={it.key}
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
                }}
              >
                <FontAwesome5 name="grip-vertical" size={13} color={d.faint} style={{ marginHorizontal: 2 }} />
                <Chip item={it} />
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ color: d.text, fontWeight: '600', fontSize: 13 }}>
                    {it.label}
                  </T>
                </View>
                <RoundBtn disabled={i === 0} onPress={() => move(i, -1)}>
                  <FontAwesome5 name="chevron-up" size={11} color={i === 0 ? d.faint : d.text} />
                </RoundBtn>
                <RoundBtn disabled={i === keys.length - 1} onPress={() => move(i, 1)}>
                  <FontAwesome5 name="chevron-down" size={11} color={i === keys.length - 1 ? d.faint : d.text} />
                </RoundBtn>
                <RoundBtn onPress={() => remove(i)} danger>
                  <FontAwesome5 name="times" size={11} color={isDark ? '#FF7B7B' : '#C0392B'} />
                </RoundBtn>
              </View>
            ))}
          </View>
        )}

        {/* available */}
        <View style={{ marginTop: 26, marginBottom: 10 }}>
          <T v="caption" style={{ color: d.subtext, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 }}>
            ADD ANOTHER
          </T>
        </View>
        <View style={{ gap: 10 }}>
          {available.map((it) => (
            <Pressable
              key={it.key}
              onPress={() => add(it.key)}
              disabled={atMax}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: d.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: d.cardBorder,
                paddingVertical: 10,
                paddingHorizontal: 12,
                gap: 10,
                opacity: atMax ? 0.45 : pressed ? 0.85 : 1,
              })}
            >
              <Chip item={it} />
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ color: d.text, fontWeight: '600', fontSize: 13 }}>
                  {it.label}
                </T>
              </View>
              <RoundBtn>
                <FontAwesome5 name="plus" size={12} color={d.emerald} />
              </RoundBtn>
            </Pressable>
          ))}
          {available.length === 0 ? (
            <T v="caption" style={{ color: d.faint, fontSize: 11 }}>
              All features are already shortcuts.
            </T>
          ) : null}
        </View>
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
