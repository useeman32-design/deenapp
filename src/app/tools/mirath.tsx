import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';

/**
 * Mirath — Islamic inheritance calculator (pass 29).
 * Implements the classical order for the common heir set:
 *   1. deduct funeral costs, debts and bequests (max ⅓)
 *   2. fixed shares (fara'id) — spouse, father, mother, daughters, sisters
 *   3. residue (`r`) to sons : daughters 2 : 1 (or brothers : sisters when
 *      there are no children and no father)
 *   4. remainder returns to the sharers (radd)
 * A scholar should always review real estates — this is a study aid.
 */

type HeirKey = 'husband' | 'wife' | 'son' | 'daughter' | 'father' | 'mother' | 'brother' | 'sister';

const HEIRS: Array<{ key: HeirKey; label: string; icon: string }> = [
  { key: 'husband', label: 'Husband', icon: 'user-tie' },
  { key: 'wife', label: 'Wife', icon: 'user-alt' },
  { key: 'son', label: 'Sons', icon: 'male' },
  { key: 'daughter', label: 'Daughters', icon: 'female' },
  { key: 'father', label: 'Father', icon: 'user-friends' },
  { key: 'mother', label: 'Mother', icon: 'user-friends' },
  { key: 'brother', label: 'Brothers', icon: 'users' },
  { key: 'sister', label: 'Sisters', icon: 'users' },
];

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function Mirath() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  
  const [estate, setEstate] = useState('1000000');
  const [debts, setDebts] = useState('0');
  const [bequestPct, setBequestPct] = useState('0');
  const [on, setOn] = useState<Record<HeirKey, boolean>>({
    husband: false, wife: false, son: false, daughter: false,
    father: false, mother: false, brother: false, sister: false,
  });
  const [counts, setCounts] = useState<Record<HeirKey, number>>({
    husband: 1, wife: 1, son: 2, daughter: 2, father: 1, mother: 1, brother: 1, sister: 1,
  });

  const result = useMemo(() => compute(+estate || 0, +debts || 0, Math.min(33, +bequestPct || 0), on, counts), [estate, debts, bequestPct, on, counts]);

  const card = { backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 16 } as const;
  const input = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)',
    borderWidth: 1,
    borderColor: d.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: d.text,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="Mirath — Inheritance" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* estate inputs */}
        <View style={{ ...card, padding: 14 }}>
          <T v="h3" style={{ fontWeight: '800', fontSize: 14, marginBottom: 10 }}>The estate</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 4 }}>Total estate left (money + assets, any currency)</T>
          <TextInput
            style={{ ...(input as object), width: '100%' } as never}
            keyboardType="numeric"
            value={estate}
            onChangeText={setEstate}
            placeholder="e.g. 1000000"
            placeholderTextColor={d.faint}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 4 }}>Funeral & debts</T>
              <TextInput
                style={{ ...(input as object), width: '100%' } as never}
                keyboardType="numeric"
                value={debts}
                onChangeText={setDebts}
                placeholder="0"
                placeholderTextColor={d.faint}
              />
            </View>
            <View style={{ flex: 1 }}>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 4 }}>Bequest (max ⅓ = 33%)</T>
              <TextInput
                style={{ ...(input as object), width: '100%' } as never}
                keyboardType="numeric"
                value={bequestPct}
                onChangeText={setBequestPct}
                placeholder="0"
                placeholderTextColor={d.faint}
              />
            </View>
          </View>
        </View>

        {/* heirs */}
        <View style={{ ...card, padding: 14, marginTop: 12 }}>
          <T v="h3" style={{ fontWeight: '800', fontSize: 14, marginBottom: 4 }}>Who is left behind?</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 10 }}>Tap to include; use +/− for several sons, daughters…</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {HEIRS.map((h) => {
              const active = on[h.key];
              const many = h.key === 'son' || h.key === 'daughter' || h.key === 'brother' || h.key === 'sister';
              return (
                <View key={h.key} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: active ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: active ? (isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)') : 'transparent', paddingHorizontal: 8, paddingVertical: 6, gap: 6 }}>
                  <Pressable onPress={() => { haptic.selection(); setOn((o) => ({ ...o, [h.key]: !o[h.key] })); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name={h.icon as never} size={11} color={active ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext} />
                    <T v="caption" style={{ fontSize: 11, fontWeight: '700', color: active ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{h.label}</T>
                  </Pressable>
                  {active && many ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Pressable onPress={() => { haptic.selection(); setCounts((c) => ({ ...c, [h.key]: Math.max(0, c[h.key] - 1) })); }} style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: 'rgba(140,150,145,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="minus" size={8} color={d.subtext} />
                      </Pressable>
                      <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: d.text, minWidth: 10, textAlign: 'center' }}>{counts[h.key]}</T>
                      <Pressable onPress={() => { haptic.selection(); setCounts((c) => ({ ...c, [h.key]: Math.min(12, c[h.key] + 1) })); }} style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: 'rgba(46,204,113,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="plus" size={8} color={isDark ? '#4AE38F' : '#1D6F42'} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* results */}
        <View style={{ ...card, padding: 14, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <T v="h3" style={{ fontWeight: '800', fontSize: 14 }}>Division</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Net estate: {fmt(result.net)}</T>
          </View>
          {result.rows.length === 0 ? (
            <T v="caption" style={{ fontSize: 11.5, color: d.faint }}>Select at least one heir to see the shares.</T>
          ) : (
            result.rows.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: d.cardBorder }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={r.icon as never} size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700' }}>{r.label}</T>
                  <T v="caption" style={{ fontSize: 10, color: d.faint }}>{r.note}</T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{fmt(r.amount)}</T>
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{r.frac}</T>
                </View>
              </View>
            ))
          )}
          {result.note ? (
            <View style={{ marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(212,175,55,0.08)', padding: 10 }}>
              <T v="caption" style={{ fontSize: 10.5, color: '#B8870B', lineHeight: 15 }}>{result.note}</T>
            </View>
          ) : null}
        </View>

        <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 12, lineHeight: 15, textAlign: 'center' }}>
          Classical fara'id for common cases. Complex estates (grandchildren, half-siblings, waqf…) need a qualified scholar — verify before distribution.
        </T>
      </ScrollView>
    </View>
  );
}

/* ── the computation ── */
type Row = { label: string; icon: string; frac: string; amount: number; note: string };

function compute(estate: number, debts: number, bequestPct: number, on: Record<HeirKey, boolean>, counts: Record<HeirKey, number>): { net: number; rows: Row[]; note: string } {
  const net = Math.max(0, estate - debts - (estate * bequestPct) / 100);
  const hasChild = on.son || on.daughter;
  const rows: Row[] = [];
  const notes: string[] = [];
  const nSons = on.son ? counts.son : 0;
  const nDaus = on.daughter ? counts.daughter : 0;
  const nBros = on.brother ? counts.brother : 0;
  const nSis = on.sister ? counts.sister : 0;

  /* fixed shares */
  let used = 0;
  const share = (frac: number, label: string, icon: string, note: string, splitAmong = 1) => {
    const amt = (net * frac);
    used += amt;
    rows.push({ label, icon, frac: frac === Math.round(frac) ? `${frac} (residue)` : fracToStr(frac), amount: amt, note: splitAmong > 1 ? `${note} · ${splitAmong} heirs, ${fmt(amt / splitAmong)} each` : note });
  };

  if (on.husband) share(hasChild ? 1 / 8 : 1 / 4, 'Husband', 'user-tie', hasChild ? '⅛ — children exist' : '¼ — no children');
  if (on.wife) share(hasChild ? 1 / 16 : 1 / 8, 'Wife', 'user-alt', hasChild ? '⅟₁₆ — children exist' : '⅛ — no children');
  if (on.mother) {
    const oneOrTwoDau = !on.son && (nDaus === 1 || nDaus === 2);
    share(1 / 6, 'Mother', 'user-friends', '⅙ — descendants or siblings exist');
    if (!hasChild && !on.brother && !on.sister) {
      /* no descendants & no siblings → mother takes ⅓ of what remains after spouse */
      rows.pop(); used -= (net * 1) / 6;
      share(1 / 3, 'Mother', 'user-friends', '⅓ — no descendants or siblings');
    }
    void oneOrTwoDau;
  }
  if (on.father) share(1 / 6, 'Father', 'user-friends', hasChild ? '⅙ — children exist' : '⅙ + residue');
  if (on.daughter && !on.son) {
    if (nDaus === 1) share(1 / 2, 'Daughter', 'female', '½ — only daughter, no sons');
    else share(2 / 3, `${nDaus} Daughters`, 'female', '⅔ shared — two or more daughters', nDaus);
  }
  if (on.sister && !on.brother && !hasChild && !on.father) {
    if (nSis === 1 && !on.son) share(nDaus ? 1 / 6 : 1 / 2, 'Sister', 'users', nDaus ? '⅙ residual share with daughters' : '½ — no children, no father');
    else if (nSis >= 2) share(nDaus ? 1 / 3 : 2 / 3, `${nSis} Sisters`, 'users', nDaus ? '⅓ with daughters present' : '⅔ shared', nSis);
  }

  /* residue: sons:daughters 2:1 — else brothers:sisters 2:1 */
  let res = net - used;
  if (nSons > 0 || (nDaus > 0 && nSons === 0 && used < net)) {
    const parts = nSons * 2 + nDaus * 1;
    if (nSons) {
      const per = res / parts;
      if (nSons) rows.push({ label: nSons === 1 ? 'Son' : `${nSons} Sons`, icon: 'male', frac: 'residue ×2', amount: per * 2 * nSons, note: `${nSons === 1 ? 'shares' : 'share'} 2 parts each (${fmt(per * 2)} per son)` });
      if (nDaus) rows.push({ label: nDaus === 1 ? 'Daughter' : `${nDaus} Daughters`, icon: 'female', frac: 'residue ×1', amount: per * nDaus, note: `1 part each (${fmt(per)} per daughter)` });
      used = net;
    } else if (res > 0 && nDaus > 0 && rows.length) {
      /* daughters took ½ or ⅔; the remainder returns (radd) proportionally */
      const totalFrac = rows.reduce((a, r) => a + parseFrac(r.frac), 0) || 1;
      const radd = res;
      for (const r of rows) r.amount += (radd * parseFrac(r.frac)) / totalFrac;
      notes.push(`Remaining ${fmt(res)} returned proportionally to the fixed-share heirs (radd).`);
      used = net;
    }
  } else if ((nBros > 0 || nSis > 0) && !hasChild && !on.father && res > 0) {
    const parts = nBros * 2 + nSis * 1;
    const per = res / parts;
    if (nBros) rows.push({ label: nBros === 1 ? 'Brother' : `${nBros} Brothers`, icon: 'users', frac: 'residue ×2', amount: per * 2 * nBros, note: `${fmt(per * 2)} per brother` });
    if (nSis) rows.push({ label: nSis === 1 ? 'Sister' : `${nSis} Sisters`, icon: 'users', frac: 'residue ×1', amount: per * nSis, note: `${fmt(per)} per sister` });
    used = net;
  } else if (res > 0.01 && rows.length === 0) {
    notes.push('No eligible heir selected — the residue goes to the public treasury / closer family per a scholar’s ruling.');
  } else if (res > 0.01) {
    notes.push(`Remaining ${fmt(res)} is distributed to the residuary heirs or charity per a scholar’s advice.`);
  }

  if (on.husband && on.wife) notes.unshift('Both spouses selected — check this estate (a person is normally survived by one spouse).');
  return { net, rows, note: notes.join(' ') };
}

const fracToStr = (f: number) => {
  const table: Array<[number, string]> = [
    [1 / 8, '⅛'], [1 / 6, '⅙'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1 / 16, '⅟₁₆'],
  ];
  for (const [v, s] of table) if (Math.abs(f - v) < 1e-6) return s;
  return `${(f * 100).toFixed(1)}%`;
};
const parseFrac = (s: string) => {
  const map: Record<string, number> = { '⅛': 1 / 8, '⅙': 1 / 6, '¼': 1 / 4, '⅓': 1 / 3, '½': 1 / 2, '⅔': 2 / 3, '¾': 3 / 4, '⅟₁₆': 1 / 16 };
  if (map[s]) return map[s];
  const pct = parseFloat(s);
  return Number.isFinite(pct) ? pct / 100 : 0;
};

