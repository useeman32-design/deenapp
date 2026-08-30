import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Zakat calculator (pass 23). Fiqh basis (standard, e.g. Islamic Relief /
 * Zakat Foundation rules): net zakatable wealth = cash + bank + gold & silver
 * value + trade goods + receivables − short-term debts. If wealth ≥ nisab
 * (87.48g gold OR 612.36g silver — user picks the standard + current price)
 * and held for a lunar year → zakat = 2.5% (rate used across all schools for
 * currency/goods).
 */
type Row = { id: string; label: string; icon: string; hint: string };

const ASSETS: Row[] = [
  { id: 'cash', label: 'Cash in hand', icon: 'money-bill-wave', hint: 'Physical cash you hold' },
  { id: 'bank', label: 'Bank balance', icon: 'university', hint: 'Savings + current accounts' },
  { id: 'gold', label: 'Gold value', icon: 'coins', hint: 'Grams × price below' },
  { id: 'silver', label: 'Silver value', icon: 'coins', hint: 'Grams × price' },
  { id: 'goods', label: 'Business / trade goods', icon: 'store', hint: 'Stock at sale value' },
  { id: 'receivable', label: 'Money owed to you', icon: 'hand-holding-usd', hint: 'Loans you expect back' },
];

const LIABILITIES: Row[] = [
  { id: 'debts', label: 'Debts & bills due', icon: 'file-invoice-dollar', hint: 'What you owe now' },
  { id: 'lost', label: 'Doubtful receivables', icon: 'exclamation-triangle', hint: 'Loans you may not recover' },
];

const num = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(/,/g, '')) || 0);
const money = (n: number) => `₦ ${Math.round(n).toLocaleString()}`;

export default function Zakat() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [v, setV] = useState<Record<string, string>>({});
  const [goldGrams, setGoldGrams] = useState('');
  const [goldPrice, setGoldPrice] = useState(''); // per gram
  const [silverGrams, setSilverGrams] = useState('');
  const [silverPrice, setSilverPrice] = useState('');
  const [standard, setStandard] = useState<'gold' | 'silver'>('gold');

  const set = (k: string) => (t: string) => setV((p) => ({ ...p, [k]: t }));

  const goldValue = num(goldGrams) * num(goldPrice);
  const silverValue = num(silverGrams) * num(silverPrice);

  const calc = useMemo(() => {
    const assets =
      num(v.cash ?? '') + num(v.bank ?? '') + (num(v.gold ?? '') || goldValue) + (num(v.silver ?? '') || silverValue) + num(v.goods ?? '') + num(v.receivable ?? '');
    const deduct = num(v.debts ?? '') + num(v.lost ?? '');
    const net = Math.max(0, assets - deduct);
    /* nisab thresholds */
    const goldNisab = 87.48 * (num(goldPrice) || 0);
    const silverNisab = 612.36 * (num(silverPrice) || 0);
    const nisab = standard === 'gold' ? goldNisab : silverNisab;
    const due = nisab > 0 && net >= nisab ? net * 0.025 : 0;
    return { assets, net, nisab, goldNisab, silverNisab, due, eligible: nisab > 0 && net >= nisab };
  }, [v, goldValue, silverValue, goldPrice, silverPrice, standard]);

  const Field = ({ id, label, icon, hint, value, onChange }: { id: string; label: string; icon: string; hint: string; value: string; onChange: (t: string) => void }) => (
    <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13, paddingVertical: 6, marginBottom: 8 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name={icon as never} size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 6 }}>
        <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{label}</T>
        <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 0.5 }}>{hint}</T>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={d.faint}
        style={{ width: 108, textAlign: 'right', fontSize: 16, fontWeight: '800', color: d.text, fontFamily: 'Poppins-SemiBold', paddingVertical: 8 }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="balance-scale" size={15} color="#E8C96A" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Zakat Calculator</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>2.5% of net wealth held one lunar year</T>
          </View>
        </View>

        {/* result hero */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 22, backgroundColor: calc.eligible ? (isDark ? '#1F8F5C' : '#1D6F42') : d.card, borderWidth: 1, borderColor: calc.eligible ? 'transparent' : d.cardBorder, padding: 18 }}>
          <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: calc.eligible ? 'rgba(255,255,255,0.8)' : d.faint }}>ZAKAT DUE THIS YEAR</T>
          <T v="display" style={{ fontSize: 34, fontWeight: '800', color: calc.eligible ? '#FFFFFF' : d.text, marginTop: 4 }}>
            {calc.nisab > 0 ? money(calc.due) : '—'}
          </T>
          {calc.nisab > 0 ? (
            <T v="caption" style={{ fontSize: 10.5, color: calc.eligible ? 'rgba(255,255,255,0.8)' : d.faint, marginTop: 4 }}>
              {calc.eligible ? `Net wealth ${money(calc.net)} ≥ nisab ${money(calc.nisab)}` : `Net wealth ${money(calc.net)} is below nisab ${money(calc.nisab)} — no zakat due`}
            </T>
          ) : (
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 4 }}>Enter the metal prices below to compute nisab</T>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: calc.eligible ? 'rgba(255,255,255,0.12)' : d.bgSoft, paddingVertical: 8, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: calc.eligible ? 'rgba(255,255,255,0.7)' : d.faint }}>TOTAL ASSETS</T>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: calc.eligible ? '#FFFFFF' : d.text, marginTop: 1 }}>{money(calc.assets)}</T>
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: calc.eligible ? 'rgba(255,255,255,0.12)' : d.bgSoft, paddingVertical: 8, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: calc.eligible ? 'rgba(255,255,255,0.7)' : d.faint }}>NET WEALTH</T>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: calc.eligible ? '#FFFFFF' : d.text, marginTop: 1 }}>{money(calc.net)}</T>
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: calc.eligible ? 'rgba(255,255,255,0.12)' : d.bgSoft, paddingVertical: 8, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: calc.eligible ? 'rgba(255,255,255,0.7)' : d.faint }}>RATE</T>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: calc.eligible ? '#FFFFFF' : d.text, marginTop: 1 }}>2.5%</T>
            </View>
          </View>
        </View>

        {/* nisab standard + metal prices */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, color: d.faint, marginHorizontal: 18, marginTop: 16, marginBottom: 8 }}>NISAB STANDARD & METAL PRICES</T>
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
          {(['gold', 'silver'] as const).map((s) => {
            const on = standard === s;
            return (
              <Pressable key={s} onPress={() => { haptic.selection(); setStandard(s); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(212,175,55,0.55)' : 'rgba(184,134,11,0.5)') : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.1)' : d.card }}>
                <FontAwesome5 name="coins" size={10} color="#E8C96A" />
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? '#E8C96A' : d.subtext }}>{s === 'gold' ? 'Gold (87.48g)' : 'Silver (612.36g)'}</T>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12, paddingVertical: 4 }}>
            <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 4 }}>GOLD PRICE / GRAM (₦)</T>
            <TextInput value={goldPrice} onChangeText={setGoldPrice} keyboardType="numeric" placeholder="e.g. 185000" placeholderTextColor={d.faint} style={{ fontSize: 15, fontWeight: '800', color: d.text, paddingVertical: 6 }} />
            <T v="caption" style={{ fontSize: 9, color: d.faint, marginBottom: 6 }}>grams: </T>
            <TextInput value={goldGrams} onChangeText={setGoldGrams} keyboardType="numeric" placeholder="0" placeholderTextColor={d.faint} style={{ fontSize: 15, fontWeight: '800', color: d.text, paddingVertical: 6 }} />
          </View>
          <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12, paddingVertical: 4 }}>
            <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 4 }}>SILVER PRICE / GRAM (₦)</T>
            <TextInput value={silverPrice} onChangeText={setSilverPrice} keyboardType="numeric" placeholder="e.g. 2300" placeholderTextColor={d.faint} style={{ fontSize: 15, fontWeight: '800', color: d.text, paddingVertical: 6 }} />
            <T v="caption" style={{ fontSize: 9, color: d.faint, marginBottom: 6 }}>grams: </T>
            <TextInput value={silverGrams} onChangeText={setSilverGrams} keyboardType="numeric" placeholder="0" placeholderTextColor={d.faint} style={{ fontSize: 15, fontWeight: '800', color: d.text, paddingVertical: 6 }} />
          </View>
        </View>

        {/* assets */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, color: d.faint, marginHorizontal: 18, marginTop: 12, marginBottom: 8 }}>WHAT YOU OWN (₦)</T>
        <View style={{ marginHorizontal: 16 }}>
          {ASSETS.map((r) => (
            <Field key={r.id} {...r} value={v[r.id] ?? ''} onChange={set(r.id)} />
          ))}
        </View>

        {/* liabilities */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, color: d.faint, marginHorizontal: 18, marginTop: 12, marginBottom: 8 }}>WHAT YOU OWE (₦)</T>
        <View style={{ marginHorizontal: 16 }}>
          {LIABILITIES.map((r) => (
            <Field key={r.id} {...r} value={v[r.id] ?? ''} onChange={set(r.id)} />
          ))}
        </View>

        <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 14, marginHorizontal: 34, lineHeight: 15 }}>
          Scholarly note: gold/silver values can be entered directly in “what you own” if you already know the total. Retirement accounts, personal-use home/car and everyday clothing are not zakatable. When in doubt, ask a trusted scholar.
        </T>
      </ScrollView>
    </View>
  );
}
