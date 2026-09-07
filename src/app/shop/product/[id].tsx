import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { isLive, shopCartAction, shopProduct, shopProducts, type ShopProduct } from '@/api/client';
import { DEMO_PRODUCTS, SHOP_NETWORKS, shopImage } from '@/lib/shop';
import { useCurrency } from '@/lib/currency';
import { safeOpenUrl } from '@/lib/safeUrl';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

/* pass 78 — product preview: big art, price story, stock/source badges,
 * qty stepper → Add to cart (own) or deep-link out (affiliate partner). */
function ShopProductScreenInner() {
  const { fmt } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const gold = isDark ? '#D4AF37' : '#B8860B';
  const emerald = isDark ? '#4AE38F' : '#0E7A46';
  const live = isLive();

  const [p, setP] = useState<ShopProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [related, setRelated] = useState<ShopProduct[]>([]);

  const load = useCallback(() => {
    if (!live) {
      const found = DEMO_PRODUCTS.find((x) => x.id === pid) ?? null;
      setP(found);
      setRelated(found ? DEMO_PRODUCTS.filter((x) => x.category === found.category && x.id !== found.id).slice(0, 5) : []);
      return;
    }
    shopProduct(pid).then((r) => {
      setP(r ?? DEMO_PRODUCTS.find((x) => x.id === pid) ?? null);
      if (!r) return;
      shopProducts(r.category).then((rows) => setRelated((rows ?? []).filter((x) => x.id !== r.id).slice(0, 5)));
    }).catch(() => setP(null));
  }, [pid, live]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!p || busy) return;
    haptic.light();
    if (!live) { setAdded(true); setTimeout(() => setAdded(false), 1800); return; }
    setBusy(true);
    const ok = await shopCartAction('add', p.id, qty).catch(() => false);
    setBusy(false);
    if (ok) { haptic.success(); setAdded(true); setTimeout(() => setAdded(false), 1800); }
  };

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={gold} />
      </View>
    );
  }

  const img = shopImage(p.image_key);
  const net = p.network ? SHOP_NETWORKS[p.network] : null;
  const off = p.compare_at && p.compare_at > p.price ? Math.round((1 - p.price / p.compare_at) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ position: 'relative' }}>
          {img ? <Image source={img} style={{ width: '100%', height: 340 }} resizeMode="cover" /> : <View style={{ width: '100%', height: 340, backgroundColor: d.bgSoft }} />}
          <Pressable onPress={() => router.back()} hitSlop={10}
            style={{ position: 'absolute', top: 54, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="arrow-left" size={14} color="#fff" />
          </Pressable>
          {off > 0 ? (
            <View style={{ position: 'absolute', top: 58, right: 16, borderRadius: 10, backgroundColor: '#E05252', paddingHorizontal: 10, paddingVertical: 5 }}>
              <T v="caption" style={{ fontSize: 11, fontWeight: '900', color: '#fff' }}>-{off}% TODAY</T>
            </View>
          ) : null}
        </View>

        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ borderRadius: 8, backgroundColor: net ? net.color : emerald, paddingHorizontal: 9, paddingVertical: 4 }}>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#fff' }}>{net ? `Partner · ${net.label}` : 'Sold by DeenLink'}</T>
            </View>
            {net ? null : <T v="caption" style={{ fontSize: 10, color: emerald, fontWeight: '700' }}>✓ In stock · free worldwide shipping</T>}
          </View>
          <T v="h1" style={{ fontWeight: '900', fontSize: 20, color: d.text, lineHeight: 26 }}>{p.title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 }}>
            <T v="h1" style={{ fontWeight: '900', fontSize: 24, color: gold }}>{fmt(p.price)}</T>
            {p.compare_at ? <T v="bodyS" style={{ fontSize: 14, color: d.faint, textDecorationLine: 'line-through' }}>{fmt(p.compare_at)}</T> : null}
          </View>
          <T v="bodyS" style={{ fontSize: 13, color: d.subtext, lineHeight: 21, marginTop: 14 }}>{p.description}</T>

          {net ? (
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginTop: 16, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <FontAwesome5 name="external-link-alt" size={12} color={net.color} />
              <T v="caption" style={{ flex: 1, fontSize: 11.5, color: d.subtext, lineHeight: 16 }}>
                This item is sold by {net.label}. Tapping buy opens the partner site — DeenLink may earn a small commission that supports the app.
              </T>
            </View>
          ) : null}

          {related.length > 0 ? (
            <>
              <T v="h3" style={{ fontWeight: '800', fontSize: 14.5, color: d.text, marginTop: 22, marginBottom: 10 }}>You may also like</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {related.map((r) => {
                  const rimg = shopImage(r.image_key);
                  return (
                    <Pressable key={r.id} onPress={() => { haptic.light(); router.replace(`/shop/product/${r.id}`); }}
                      style={{ width: 118, marginRight: 10, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, overflow: 'hidden' }}>
                      {rimg ? <Image source={rimg} style={{ width: '100%', height: 96 }} resizeMode="cover" /> : null}
                      <View style={{ padding: 8 }}>
                        <T v="caption" numberOfLines={2} style={{ fontSize: 10.5, fontWeight: '700', color: d.text, minHeight: 28 }}>{r.title}</T>
                        <T v="caption" style={{ fontSize: 11.5, fontWeight: '900', color: gold, marginTop: 2 }}>{fmt(r.price)}</T>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* bottom action bar */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: isDark ? 'rgba(8,14,10,0.94)' : 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: d.cardBorder }}>
        {net ? (
          <Pressable onPress={() => { haptic.light(); if (p.affiliate_url) safeOpenUrl(p.affiliate_url); }}
            style={{ flex: 1, borderRadius: 15, backgroundColor: net.color, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <FontAwesome5 name="external-link-alt" size={12} color="#fff" />
            <T v="bodyS" style={{ fontWeight: '900', fontSize: 14, color: '#fff' }}>Buy on {net.label} · {fmt(p.price)}</T>
          </Pressable>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Pressable onPress={() => { haptic.selection(); setQty((q) => Math.max(1, q - 1)); }} hitSlop={8}><FontAwesome5 name="minus" size={11} color={d.text} /></Pressable>
              <T v="bodyS" style={{ fontSize: 14, fontWeight: '800', color: d.text, minWidth: 18, textAlign: 'center' }}>{qty}</T>
              <Pressable onPress={() => { haptic.selection(); setQty((q) => Math.min(20, q + 1)); }} hitSlop={8}><FontAwesome5 name="plus" size={11} color={d.text} /></Pressable>
            </View>
            <Pressable disabled={busy || !p.in_stock} onPress={() => void add()}
              style={{ flex: 1, borderRadius: 15, backgroundColor: added ? emerald : gold, paddingVertical: 15, alignItems: 'center', opacity: busy || !p.in_stock ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color={isDark ? '#14241C' : '#fff'} /> : (
                <T v="bodyS" style={{ fontWeight: '900', fontSize: 14, color: isDark ? '#14241C' : '#fff' }}>
                  {added ? '✓ Added to cart' : p.in_stock ? `Add to cart · ${fmt(p.price * qty)}` : 'Out of stock'}
                </T>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function ShopProductScreen() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="DeenLink Shop" />;
  return <ShopProductScreenInner />;
}
