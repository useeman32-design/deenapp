import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { isLive, shopSearch, type ShopProduct } from '@/api/client';
import { DEMO_PRODUCTS, SHOP_CATEGORIES, SHOP_NETWORKS, shopImage } from '@/lib/shop';

/* pass 78 — shop search: debounced server query (local filter in demo),
 * suggestion chips, same card language as the shop grid. */
export default function ShopSearchScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const gold = isDark ? '#D4AF37' : '#B8860B';
  const live = isLive();
  const inputRef = useRef<TextInput | null>(null);

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ShopProduct[] | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 350); }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows(null); setSearched(false); return; }
    setRows(null);
    const t = setTimeout(() => {
      if (!live) {
        const low = term.toLowerCase();
        setRows(DEMO_PRODUCTS.filter((p) => p.title.toLowerCase().includes(low) || p.description.toLowerCase().includes(low) || p.category.includes(low)));
        setSearched(true);
        return;
      }
      shopSearch(term).then((r) => { setRows(r ?? []); setSearched(true); }).catch(() => { setRows([]); setSearched(true); });
    }, 300);
    return () => clearTimeout(t);
  }, [q, live]);

  const suggestions = useMemo(() => SHOP_CATEGORIES.filter((c) => c.key !== 'all'), []);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* search bar */}
      <View style={{ paddingTop: 54, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: d.card }}>
          <FontAwesome5 name="arrow-left" size={13} color={d.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13, paddingVertical: 10 }}>
          <FontAwesome5 name="search" size={12} color={d.faint} />
          <TextInput ref={inputRef} value={q} onChangeText={setQ} placeholder="Search prayer mats, misbaha, abaya…" placeholderTextColor={d.faint}
            style={{ flex: 1, fontSize: 13, color: d.text, fontFamily: 'Poppins-Regular' }} />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}><FontAwesome5 name="times-circle" size={13} color={d.faint} /></Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {q.trim().length < 2 ? (
          <View style={{ marginTop: 10 }}>
            <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.text, marginBottom: 10 }}>Browse by category</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((c) => (
                <Pressable key={c.key} onPress={() => { haptic.selection(); setQ(c.label); }}
                  style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <T v="bodyS" style={{ fontSize: 12, fontWeight: '700', color: d.subtext }}>{c.label}</T>
                </Pressable>
              ))}
            </View>
            <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.text, marginTop: 22, marginBottom: 10 }}>Trending now</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {DEMO_PRODUCTS.slice(0, 4).map((p) => {
                const img = shopImage(p.image_key);
                return (
                  <Pressable key={p.id} onPress={() => { haptic.light(); router.push(`/shop/product/${p.id}`); }}
                    style={{ width: '48.4%', marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, overflow: 'hidden' }}>
                    {img ? <Image source={img} style={{ width: '100%', height: 120 }} resizeMode="cover" /> : null}
                    <View style={{ padding: 9 }}>
                      <T v="caption" numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: d.text }}>{p.title}</T>
                      <T v="caption" style={{ fontSize: 12, fontWeight: '900', color: gold, marginTop: 2 }}>${p.price.toFixed(2)}</T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : !rows ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}><ActivityIndicator color={gold} /></View>
        ) : rows.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 70, gap: 8 }}>
            <FontAwesome5 name="box-open" size={24} color={d.faint} />
            <T v="bodyS" style={{ color: d.subtext, fontSize: 13, fontWeight: '700' }}>
              {searched ? `No products for “${q.trim()}”` : 'Keep typing…'}
            </T>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 }}>
            {rows.map((p) => {
              const img = shopImage(p.image_key);
              const net = p.network ? SHOP_NETWORKS[p.network] : null;
              return (
                <Pressable key={p.id} onPress={() => { haptic.light(); router.push(`/shop/product/${p.id}`); }}
                  style={({ pressed }) => ({ width: '48.4%', marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, overflow: 'hidden', opacity: pressed ? 0.85 : 1 })}>
                  <View style={{ position: 'relative' }}>
                    {img ? <Image source={img} style={{ width: '100%', height: 130 }} resizeMode="cover" /> : <View style={{ width: '100%', height: 130, backgroundColor: d.bgSoft }} />}
                    <View style={{ position: 'absolute', top: 8, right: 8, borderRadius: 8, backgroundColor: net ? net.color : (isDark ? '#4AE38F' : '#0E7A46'), paddingHorizontal: 7, paddingVertical: 3 }}>
                      <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: '#fff' }}>{net ? net.label : 'DeenLink'}</T>
                    </View>
                  </View>
                  <View style={{ padding: 10 }}>
                    <T v="caption" numberOfLines={2} style={{ fontSize: 11.5, fontWeight: '700', color: d.text, minHeight: 30, lineHeight: 15 }}>{p.title}</T>
                    <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '900', color: gold, marginTop: 4 }}>${p.price.toFixed(2)}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
