import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { fetchNisab } from '@/lib/islamicApi';
import { CrescentLoader } from '@/components/CrescentLoader';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Zakat Calculator (pass 39 rebuild):
 *  · metal prices are LIVE (read-only — realtime, not editable);
 *    you enter GRAMS of gold/silver, we value them
 *  · net zakatable wealth = cash + bank + trade goods + gold + silver − debts
 *  · nothing auto-calculates — a big CALCULATE ZAKAT button runs it
 *  · nisab shown in BOLD in the hero (gold 87.48g / silver 612.36g standard)
 *  · Quran 9:103 at the bottom
 */

const GOLD_FALLBACK = 191313; /* ₦/gram — last fetched live price (offline fallback) */
const SILVER_FALLBACK = 2862;

const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
const money = (n: number) =>
  n.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function Zakat() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();

  const [v, setV] = useState<Record<string, string>>({});
  const [goldGrams, setGoldGrams] = useState('');
  const [silverGrams, setSilverGrams] = useState('');
  const [standard, setStandard] = useState<'gold' | 'silver'>('silver');
  /* pass 39 — LIVE, read-only prices (why edit a realtime price?) */
  const [prices, setPrices] = useState<{ gold: number; silver: number } | null>(null);
  const [live, setLive] = useState<'loading' | 'live' | 'off'>('loading');
  /* pass 39 — no auto-calc: the result appears only after CALCULATE */
  const [shown, setShown] = useState<{ due: number; net: number; assets: number; nisab: number; eligible: boolean } | null>(null);
  /* pass 40 — brief loader on Calculate, then auto-scroll up to the result */
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    let dead = false;
    fetchNisab('ngn')
      .then((n) => {
        if (dead) return;
        setPrices({ gold: n.gold.unit_price, silver: n.silver.unit_price });
        setLive('live');
      })
      .catch(() => { if (!dead) setLive('off'); });
    return () => { dead = true; };
  }, []);

  const pg = prices?.gold ?? GOLD_FALLBACK;
  const ps = prices?.silver ?? SILVER_FALLBACK;

  const set = (k: string) => (t: string) => setV((p) => ({ ...p, [k]: t }));

  const draft = useMemo(() => {
    const goldValue = num(goldGrams) * pg;
    const silverValue = num(silverGrams) * ps;
    const assets = num(v.cash ?? '') + num(v.bank ?? '') + goldValue + silverValue + num(v.goods ?? '');
    const net = Math.max(0, assets - num(v.debts ?? ''));
    const goldNisab = 87.48 * pg;
    const silverNisab = 612.36 * ps;
    const nisab = standard === 'gold' ? goldNisab : silverNisab;
    const eligible = net >= nisab && net > 0;
    return { goldValue, silverValue, assets, net, goldNisab, silverNisab, nisab, eligible, due: eligible ? net * 0.025 : 0 };
  }, [v, goldGrams, silverGrams, pg, ps, standard]);

  const calculate = async () => {
    if (busy) return;
    haptic.medium();
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setShown({ due: draft.due, net: draft.net, assets: draft.assets, nisab: draft.nisab, eligible: draft.eligible });
    setBusy(false);
    setTimeout(() => scroller.current?.scrollTo({ y: 0, animated: true }), 60);
  };

  const Field = ({ id, label, icon, hint, value, onChange }: { id: string; label: string; icon: string; hint?: string; value: string; onChange: (t: string) => void }) => (
    <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13, paddingVertical: 6, marginBottom: 8 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name={icon as never} size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 6 }}>
        <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{label}</T>
        {hint ? <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 0.5 }}>{hint}</T> : null}
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
      <ScrollView ref={scroller} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="balance-scale" size={15} color="#E8C96A" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Zakat Calculator</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>2.5% of net wealth held one lunar year</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: live === 'live' ? 'rgba(74,227,143,0.4)' : d.cardBorder, backgroundColor: live === 'live' ? (isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)') : 'transparent', paddingHorizontal: 7, paddingVertical: 3 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: live === 'live' ? '#4AE38F' : d.faint }} />
            <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4, color: live === 'live' ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint }}>
              {live === 'live' ? 'LIVE PRICES' : live === 'loading' ? 'FETCHING…' : 'OFFLINE PRICES'}
            </T>
          </View>
        </View>

        {/* result hero — appears after CALCULATE (pass 39) */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 22, backgroundColor: shown?.eligible ? (isDark ? '#1F8F5C' : '#1D6F42') : d.card, borderWidth: 1, borderColor: shown?.eligible ? 'transparent' : d.cardBorder, padding: 18 }}>
          <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: shown?.eligible ? 'rgba(255,255,255,0.8)' : d.faint }}>ZAKAT DUE THIS YEAR</T>
          <T v="display" style={{ fontSize: 34, fontWeight: '800', color: shown?.eligible ? '#FFFFFF' : d.text, marginTop: 4 }}>
            {shown ? money(shown.due) : '—'}
          </T>
          {/* pass 39 — NISAB in bold */}
          {shown ? (
            <T v="caption" style={{ fontSize: 10.5, color: shown.eligible ? 'rgba(255,255,255,0.85)' : d.faint, marginTop: 4 }}>
              {shown.eligible
                ? `Net wealth ${money(shown.net)} ≥ `
                : `Net wealth ${money(shown.net)} is below `}
              <Text style={{ fontWeight: '900', color: shown.eligible ? '#FFFFFF' : d.text, fontSize: 11.5 }}>nisab {money(shown.nisab)}</Text>
              {shown.eligible ? ' — zakat is due' : ' — no zakat due'}
            </T>
          ) : (
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 4 }}>Fill in your wealth below, then press Calculate</T>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: shown?.eligible ? 'rgba(255,255,255,0.12)' : d.bgSoft, paddingVertical: 8, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: shown?.eligible ? 'rgba(255,255,255,0.7)' : d.faint }}>TOTAL ASSETS</T>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: shown?.eligible ? '#FFFFFF' : d.text, marginTop: 1 }}>{money(draft.assets)}</T>
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: shown?.eligible ? 'rgba(255,255,255,0.12)' : d.bgSoft, paddingVertical: 8, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: shown?.eligible ? 'rgba(255,255,255,0.7)' : d.faint }}>NET WEALTH</T>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: shown?.eligible ? '#FFFFFF' : d.text, marginTop: 1 }}>{money(draft.net)}</T>
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: shown?.eligible ? 'rgba(255,255,255,0.12)' : d.bgSoft, paddingVertical: 8, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: shown?.eligible ? 'rgba(255,255,255,0.7)' : d.faint }}>RATE</T>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: shown?.eligible ? '#FFFFFF' : d.text, marginTop: 1 }}>2.5%</T>
            </View>
          </View>
        </View>

        {/* pass 40 — under the standard: WHICH metal drives the calculation */}
        <T v="caption" style={{ fontSize: 10, color: d.faint, marginHorizontal: 18, marginBottom: 8, lineHeight: 15 }}>
          Your eligibility is measured against the <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: '#B8860B' }}>{standard === 'gold' ? 'GOLD' : 'SILVER'}</T> nisab ({standard === 'gold' ? '87.48 g of gold' : '612.36 g of silver'} = {money(standard === 'gold' ? draft.goldNisab : draft.silverNisab)} today). Many scholars prefer the silver standard — it is more protective of the poor.
        </T>

        {/* nisab standard + live metal prices (READ-ONLY) */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, color: d.faint, marginHorizontal: 18, marginTop: 16, marginBottom: 8 }}>NISAB STANDARD · LIVE METAL PRICES</T>
        {/* assets */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, color: d.faint, marginHorizontal: 18, marginTop: 12, marginBottom: 8 }}>WHAT YOU OWN (₦)</T>
        <View style={{ marginHorizontal: 16 }}>
          <Field id="cash" label="Cash in hand" icon="money-bill-wave" value={v.cash ?? ''} onChange={set('cash')} />
          <Field id="bank" label="Bank savings" icon="university" value={v.bank ?? ''} onChange={set('bank')} />
          <Field id="goods" label="Trade goods & stock" icon="store" hint="Cost or market value, whichever is lower" value={v.goods ?? ''} onChange={set('goods')} />
          {/* pass 40 — gold + silver moved HERE, under trade goods & stocks */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {([
              { k: 'gold', label: 'GOLD', icon: 'coins', price: pg, grams: goldGrams, setGrams: setGoldGrams, value: draft.goldValue },
              { k: 'silver', label: 'SILVER', icon: 'circle-notch', price: ps, grams: silverGrams, setGrams: setSilverGrams, value: draft.silverValue },
            ]).map((m) => (
              <View key={m.k} style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12, paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FontAwesome5 name={m.icon as never} size={10} color="#E8C96A" />
                  <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.faint, flex: 1 }}>{m.label}</T>
                  <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: '#B8860B' }}>{money(m.price)}/g</T>
                </View>
                {/* you enter GRAMS; the realtime price is never editable */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <TextInput
                    accessibilityLabel={`${m.k} grams`}
                    value={m.grams}
                    onChangeText={(t) => { haptic.selection(); m.setGrams(t.replace(/[^0-9.]/g, '')); }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={d.faint}
                    style={{ flex: 1, fontSize: 16, fontWeight: '800', color: d.text, fontFamily: 'Poppins-SemiBold', paddingVertical: 4 }}
                  />
                  <T v="caption" style={{ fontSize: 11, color: d.faint }}>grams</T>
                </View>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 4 }}>= {money(m.value)} live valuation</T>
              </View>
            ))}
          </View>
        </View>

        {/* liabilities */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, color: d.faint, marginHorizontal: 18, marginTop: 12, marginBottom: 8 }}>WHAT YOU OWE (₦)</T>
        <View style={{ marginHorizontal: 16 }}>
          <Field id="debts" label="Debts & bills due" icon="minus-circle" value={v.debts ?? ''} onChange={set('debts')} />
        </View>

        {/* pass 39 — CALCULATE button (nothing auto-runs) */}
        <Pressable
          accessibilityLabel="calculate zakat"
          onPress={calculate}
          style={({ pressed }) => ({ marginHorizontal: 16, marginTop: 16, borderRadius: 15, height: 52, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, opacity: pressed ? 0.85 : 1 })}
        >
          {busy ? <CrescentLoader size={24} /> : <FontAwesome5 name="calculator" size={14} color="#fff" />}
          <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{busy ? 'Calculating…' : 'Calculate zakat'}</T>
        </Pressable>

        {/* pass 39 — the zakat ayah at the bottom */}
        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.04)', padding: 16, alignItems: 'center' }}>
          <FontAwesome5 name="quote-right" size={11} color="#E8C96A" style={{ marginBottom: 8 }} />
          <T v="bodyS" style={{ fontFamily: 'Amiri-Bold', fontSize: 16, lineHeight: 30, color: isDark ? '#E8C96A' : '#8C6D1F', textAlign: 'right' }}>
            خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا
          </T>
          <T v="caption" style={{ fontSize: 10, color: d.subtext, marginTop: 8, lineHeight: 15, textAlign: 'center' }}>
            “Take from their wealth a charity to purify them and to cause them to grow, and invoke blessings upon them.” — Quran 9:103
          </T>
        </View>

        <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 14, marginHorizontal: 34, lineHeight: 15 }}>
          Scholarly note: gold/silver are valued automatically at today's live price. Retirement accounts, personal-use home/car and everyday clothing are not zakatable. When in doubt, ask a trusted scholar.
        </T>
      </ScrollView>
    </View>
  );
}
