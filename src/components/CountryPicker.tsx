import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COUNTRIES } from '@/lib/countries';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

export function CountryPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (country: string) => void;
}) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = COUNTRIES.find((country) => country.name === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRIES.filter((country) => country.name.toLowerCase().includes(q)) : COUNTRIES;
  }, [query]);
  const text = isDark ? '#F2F7F3' : '#14241C';
  const muted = isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)';
  const border = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)';

  return (
    <View style={{ marginBottom: 13 }}>
      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: muted, marginBottom: 6 }}>
        COUNTRY
      </T>
      <Pressable
        accessibilityLabel="country picker"
        onPress={() => { haptic.selection(); setOpen(true); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: border, backgroundColor: isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)', paddingHorizontal: 14, height: 50 }}
      >
        <T v="bodyS" style={{ fontSize: 17 }}>{current?.flag ?? '🌍'}</T>
        <T v="bodyS" style={{ flex: 1, fontSize: 15, color: text, fontWeight: '600' }}>{value || 'Select your country'}</T>
        <FontAwesome5 name="chevron-down" size={12} color={muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <Pressable onStartShouldSetResponder={() => true} style={{ maxHeight: '70%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: isDark ? '#07140D' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.2)', padding: 16 }}>
            <T v="h3" style={{ color: text, fontWeight: '800', marginBottom: 10 }}>Select your country</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: border, backgroundColor: isDark ? 'rgba(3,36,24,0.5)' : 'rgba(255,255,255,0.62)', paddingHorizontal: 12, height: 44, marginBottom: 10 }}>
              <FontAwesome5 name="search" size={13} color={muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search countries…"
                placeholderTextColor={muted}
                style={{ flex: 1, fontSize: 14, color: text, padding: 0 }}
              />
              {query ? <Pressable onPress={() => setQuery('')}><FontAwesome5 name="times-circle" size={14} color={muted} /></Pressable> : null}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 4 }}>
              {filtered.length === 0 ? <T v="caption" style={{ textAlign: 'center', marginTop: 20, color: muted }}>No country matches “{query}”</T> : null}
              {filtered.map((country) => {
                const selected = country.name === value;
                return (
                  <Pressable
                    key={country.name}
                    onPress={() => { haptic.selection(); onPick(country.name); setOpen(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: selected ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}
                  >
                    <T v="bodyS" style={{ fontSize: 17 }}>{country.flag}</T>
                    <T numberOfLines={1} ellipsizeMode="tail" v="bodyS" style={{ flex: 1, fontSize: 13.5, fontWeight: selected ? '800' : '600', color: text }}>{country.name}</T>
                    {selected ? <FontAwesome5 name="check" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
