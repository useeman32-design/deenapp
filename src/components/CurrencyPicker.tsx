import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * pass 83-30 — ONE currency picker for every donation screen.
 *
 * A field + searchable bottom sheet. USD / NGN / EUR / GBP are pinned at the
 * top; the full list is exactly the currencies Flutterwave can CHARGE cards in
 * (per Flutterwave's accepted-currencies list: USD, GBP, CAD, XAF, CLP, COP,
 * EGP, EUR, GHS, GNF, KES, MWK, MAD, NGN, RWF, SLL, STD, ZAR, TZS, UGX, XOF,
 * ZMW). Payout-only codes (SAR, AED…) are deliberately NOT offered — picking
 * one would make Flutterwave reject the charge.
 */

export type Currency = { code: string; symbol: string; name: string; pinned?: boolean };

export const DONATION_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', pinned: true },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', pinned: true },
  { code: 'EUR', symbol: '€', name: 'Euro', pinned: true },
  { code: 'GBP', symbol: '£', name: 'British Pound', pinned: true },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' },
  { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha' },
  { code: 'GNF', symbol: 'FG', name: 'Guinean Franc' },
  { code: 'SLL', symbol: 'Le', name: 'Sierra Leonean Leone' },
  { code: 'STD', symbol: 'Db', name: 'São Tomé & Príncipe Dobra' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
];

export const currencyByCode = (code: string): Currency =>
  DONATION_CURRENCIES.find((c) => c.code === code) ?? DONATION_CURRENCIES[1];

export function CurrencyPicker({ value, onChange, tint }: { value: string; onChange: (code: string) => void; tint?: string }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const accent = tint ?? (isDark ? '#4AE38F' : '#1D6F42');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const sel = currencyByCode(value);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DONATION_CURRENCIES;
    return DONATION_CURRENCIES.filter((c) => `${c.code} ${c.name} ${c.symbol}`.toLowerCase().includes(s));
  }, [q]);

  const row = (c: Currency) => {
    const on = c.code === value;
    return (
      <Pressable
        key={c.code}
        accessibilityLabel={`currency ${c.code}`}
        onPress={() => { haptic.selection(); onChange(c.code); setOpen(false); setQ(''); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 13, borderWidth: 1, borderColor: on ? `${accent}99` : 'transparent', backgroundColor: on ? `${accent}1A` : 'transparent', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 3, opacity: pressed ? 0.8 : 1 })}
      >
        <View style={{ minWidth: 46, alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingVertical: 5, paddingHorizontal: 7 }}>
          <T v="caption" style={{ fontSize: 11, fontWeight: '900', color: on ? accent : d.subtext }}>{c.code}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="bodyS" numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: d.text }}>{c.name}</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{c.symbol}</T>
        </View>
        {c.pinned && !q ? <FontAwesome5 name="thumbtack" size={9} color={d.faint} /> : null}
        {on ? <FontAwesome5 name="check-circle" size={14} color={accent} /> : null}
      </Pressable>
    );
  };

  return (
    <View>
      <Pressable
        accessibilityLabel="choose currency"
        onPress={() => { haptic.selection(); setOpen(true); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13, paddingVertical: 12, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ minWidth: 46, alignItems: 'center', borderRadius: 9, backgroundColor: `${accent}1A`, paddingVertical: 5, paddingHorizontal: 7 }}>
          <T v="caption" style={{ fontSize: 11, fontWeight: '900', color: accent }}>{sel.code}</T>
        </View>
        <T v="bodyS" numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: d.text }}>{sel.name} · {sel.symbol}</T>
        <FontAwesome5 name="chevron-down" size={11} color={d.faint} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '78%' }}>
            <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 }}>
              <T v="h3" style={{ fontSize: 15, fontWeight: '900', color: d.text }}>Choose currency</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2 }}>All supported by Flutterwave checkout</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 11, paddingVertical: 9, marginTop: 12 }}>
                <FontAwesome5 name="search" size={11} color={d.faint} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search currency — naira, dollar, cedi…"
                  placeholderTextColor={d.faint}
                  style={{ flex: 1, fontSize: 16, fontFamily: 'Poppins-Regular', color: d.text, paddingVertical: 0 }}
                />
                {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><FontAwesome5 name="times-circle" size={13} color={d.faint} /></Pressable> : null}
              </View>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {!q ? <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, color: d.faint, paddingHorizontal: 2, marginBottom: 6 }}>MOST USED</T> : null}
              {(!q ? list.filter((c) => c.pinned) : list).map(row)}
              {!q ? <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, color: d.faint, paddingHorizontal: 2, marginVertical: 6 }}>ALL CURRENCIES</T> : null}
              {(!q ? list.filter((c) => !c.pinned) : []).map(row)}
              {q && list.length === 0 ? (
                <T v="caption" style={{ fontSize: 11, color: d.faint, textAlign: 'center', paddingVertical: 18 }}>No currency matches “{q}”.</T>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
