import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { useAuth } from '@/context/AuthContext';
import { isLive, shopCart, shopCartAction, shopCheckout, shopOrders, shopProducts, type ShopCart, type ShopOrder, type ShopProduct } from '@/api/client';
import { DEMO_PRODUCTS, SHOP_CATEGORIES, SHOP_IMAGES, SHOP_NETWORKS, shopImage } from '@/lib/shop';
import { payShopOrder } from '@/lib/flutterwave';
import { useCurrency } from '@/lib/currency';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

/* ── DeenLink Shop (pass 78) — explore · cart · orders, worldwide.
 * Own drop-ship products buy in-app (server cart → checkout → order);
 * affiliate products (AliExpress / Jumia / Amazon / eBay) deep-link out.
 * The module owns its bottom menu: Shop | Cart | Orders. */

type Tab = 'shop' | 'cart' | 'orders';
type DemoLine = { product: ShopProduct; qty: number };

function ShopScreenInner() {
  const { fmt } = useCurrency();
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const live = isLive();
  const gold = isDark ? '#D4AF37' : '#B8860B';
  const emerald = isDark ? '#4AE38F' : '#0E7A46';

  const [tab, setTab] = useState<Tab>('shop');
  const [cat, setCat] = useState('all');
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  /* demo (offline) mirrors of the server state */
  const [demoLines, setDemoLines] = useState<DemoLine[]>([]);
  const [demoOrders, setDemoOrders] = useState<ShopOrder[]>([]);
  /* checkout sheet */
  const [checkout, setCheckout] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const [placedTotal, setPlacedTotal] = useState(0);
  const [payState, setPayState] = useState<'idle' | 'busy' | 'paid' | 'failed'>('idle');
  const [payMsg, setPayMsg] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', city: '', address: '', note: '' });

  /* promo banner carousel */
  const bannerRef = useRef<ScrollView | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerW, setBannerW] = useState(358);
  useEffect(() => {
    const t = setInterval(() => {
      setBannerIdx((i) => {
        const next = (i + 1) % 2;
        bannerRef.current?.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [bannerW]);

  const loadProducts = useCallback(() => {
    if (!live) { setProducts(DEMO_PRODUCTS); return; }
    shopProducts().then((r) => setProducts(r ?? DEMO_PRODUCTS)).catch(() => setProducts(DEMO_PRODUCTS));
  }, [live]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const loadCart = useCallback(() => {
    if (!live) {
      setCart({ items: demoLines.map((l) => ({ ...l.product, qty: l.qty })), count: demoLines.reduce((s, l) => s + l.qty, 0), total: demoLines.reduce((s, l) => s + l.product.price * l.qty, 0) });
      return;
    }
    shopCart().then(setCart).catch(() => {});
  }, [live, demoLines]);
  useEffect(() => { if (tab === 'cart') loadCart(); }, [tab, loadCart]);

  const loadOrders = useCallback(() => {
    if (!live) { setOrders(demoOrders); return; }
    shopOrders().then((r) => setOrders(r ?? [])).catch(() => setOrders([]));
  }, [live, demoOrders]);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [tab, loadOrders]);

  const list = useMemo(() => {
    const rows = products ?? [];
    return cat === 'all' ? rows : rows.filter((p) => p.category === cat);
  }, [products, cat]);

  const changeQty = async (p: ShopProduct, next: number) => {
    haptic.selection();
    if (!live) {
      setDemoLines((prev) => next <= 0 ? prev.filter((l) => l.product.id !== p.id) : prev.some((l) => l.product.id === p.id) ? prev.map((l) => l.product.id === p.id ? { ...l, qty: next } : l) : [...prev, { product: p, qty: next }]);
      return;
    }
    const ok = next <= 0
      ? await shopCartAction('remove', p.id)
      : await shopCartAction((cart?.items ?? []).some((i) => i.id === p.id) ? 'qty' : 'add', p.id, next);
    if (ok) loadCart();
  };

  const placeOrder = async () => {
    if (placing) return;
    if (!form.name.trim() || !form.email.trim() || !form.country.trim() || !form.city.trim() || !form.address.trim()) {
      haptic.medium();
      return;
    }
    setPlacing(true);
    if (!live) {
      const id = 1000 + demoOrders.length + 1;
      setDemoOrders((prev) => [{ id, status: 'pending', total: cart?.total ?? 0, currency: 'USD', created_at: new Date().toISOString().slice(0, 19).replace('T', ' '), ship_to: `${form.city}, ${form.country}`, items: demoLines.map((l) => ({ product_id: l.product.id, title: l.product.title, price: l.product.price, qty: l.qty, image_key: l.product.image_key })) }, ...prev]);
      setDemoLines([]);
      setPlacing(false);
      setPlaced(id);
      setPlacedTotal(cart?.total ?? 0);
      haptic.success();
      return;
    }
    const res = await shopCheckout(form).catch(() => null);
    setPlacing(false);
    if (res) {
      haptic.success();
      setPlaced(res.order_id);
      setPlacedTotal(res.total);
      loadCart();
    } else {
      haptic.medium();
    }
  };

  const openAffiliate = (p: ShopProduct) => {
    if (p.affiliate_url) { haptic.light(); Linking.openURL(p.affiliate_url).catch(() => {}); }
  };

  /* ── product card (grid) ── */
  const Card = ({ p }: { p: ShopProduct }) => {
    const img = shopImage(p.image_key);
    const net = p.network ? SHOP_NETWORKS[p.network] : null;
    const off = p.compare_at && p.compare_at > p.price ? Math.round((1 - p.price / p.compare_at) * 100) : 0;
    return (
      <Pressable onPress={() => { haptic.light(); router.push(`/shop/product/${p.id}`); }}
        style={({ pressed }) => ({ width: '48.4%', marginBottom: 12, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, overflow: 'hidden', opacity: pressed ? 0.85 : 1 })}>
        <View style={{ position: 'relative' }}>
          {img ? <Image source={img} style={{ width: '100%', height: 150 }} resizeMode="cover" /> : <View style={{ width: '100%', height: 150, backgroundColor: d.bgSoft }} />}
          {off > 0 ? (
            <View style={{ position: 'absolute', top: 8, left: 8, borderRadius: 8, backgroundColor: '#E05252', paddingHorizontal: 7, paddingVertical: 3 }}>
              <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>-{off}%</T>
            </View>
          ) : null}
          <View style={{ position: 'absolute', top: 8, right: 8, borderRadius: 8, backgroundColor: net ? net.color : emerald, paddingHorizontal: 7, paddingVertical: 3 }}>
            <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: '#fff' }}>{net ? net.label : 'DeenLink'}</T>
          </View>
        </View>
        <View style={{ padding: 10 }}>
          <T v="bodyS" numberOfLines={2} style={{ fontSize: 12, fontWeight: '700', color: d.text, minHeight: 34, lineHeight: 16 }}>{p.title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <T v="bodyS" style={{ fontSize: 14, fontWeight: '900', color: gold }}>{fmt(p.price)}</T>
            {p.compare_at ? <T v="caption" style={{ fontSize: 10, color: d.faint, textDecorationLine: 'line-through' }}>{fmt(p.compare_at)}</T> : null}
          </View>
          {!net ? (
            <T v="caption" style={{ fontSize: 9, color: emerald, fontWeight: '700', marginTop: 3 }}>Free worldwide shipping</T>
          ) : (
            <T v="caption" style={{ fontSize: 9, color: d.faint, fontWeight: '700', marginTop: 3 }}>Ships via {net.label}</T>
          )}
        </View>
      </Pressable>
    );
  };

  const inputStyle = { borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.bg, color: d.text, fontSize: 13, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 9, fontFamily: 'Poppins-Regular' } as const;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: d.card }}>
          <FontAwesome5 name="arrow-left" size={13} color={d.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <T v="h2" style={{ fontWeight: '900', fontSize: 18, color: d.text }}>DeenLink Shop</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>Halal essentials · shipped worldwide</T>
        </View>
        <Pressable onPress={() => { haptic.selection(); router.push('/shop/search'); }} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: d.card }}>
          <FontAwesome5 name="search" size={13} color={d.text} />
        </Pressable>
      </View>

      {tab === 'shop' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {/* promo banners */}
          <ScrollView ref={bannerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w > 0) setBannerW(w); }}
            onMomentumScrollEnd={(e) => { const w = e.nativeEvent.layoutMeasurement.width; if (w > 0) setBannerIdx(Math.round(e.nativeEvent.contentOffset.x / w)); }}
            style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 14 }}>
            {(['banner_hero', 'banner_promo'] as const).map((k) => (
              <Image key={k} source={SHOP_IMAGES[k]} style={{ width: bannerW, height: 150 }} resizeMode="cover" />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 5, justifyContent: 'center', marginBottom: 14, marginTop: -8 }}>
            {[0, 1].map((i) => (
              <View key={i} style={{ width: i === bannerIdx ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === bannerIdx ? gold : d.cardBorder }} />
            ))}
          </View>

          {/* categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {SHOP_CATEGORIES.map((c) => {
              const on = cat === c.key;
              return (
                <Pressable key={c.key} onPress={() => { haptic.selection(); setCat(c.key); }}
                  style={{ borderRadius: 12, borderWidth: 1.5, borderColor: on ? gold : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(212,175,55,0.14)' : 'rgba(184,134,11,0.1)') : d.card, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 }}>
                  <T v="bodyS" style={{ fontSize: 12, fontWeight: on ? '800' : '600', color: on ? gold : d.subtext }}>{c.label}</T>
                </Pressable>
              );
            })}
          </ScrollView>

          <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text, marginBottom: 10 }}>
            {cat === 'all' ? 'All products' : SHOP_CATEGORIES.find((c) => c.key === cat)?.label}
          </T>
          {!products ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}><ActivityIndicator color={gold} /></View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {list.map((p) => <Card key={p.id} p={p} />)}
            </View>
          )}
        </ScrollView>
      ) : null}

      {tab === 'cart' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
          {!cart ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}><ActivityIndicator color={gold} /></View>
          ) : cart.items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 70, gap: 10 }}>
              <FontAwesome5 name="shopping-cart" size={26} color={d.faint} />
              <T v="bodyS" style={{ color: d.subtext, fontSize: 13, fontWeight: '700' }}>Your cart is empty</T>
              <Pressable onPress={() => setTab('shop')} style={{ borderRadius: 12, backgroundColor: gold, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 }}>
                <T v="bodyS" style={{ color: isDark ? '#14241C' : '#fff', fontWeight: '800', fontSize: 12.5 }}>Browse products</T>
              </Pressable>
            </View>
          ) : (
            <>
              {cart.items.map((it) => {
                const img = shopImage(it.image_key);
                return (
                  <View key={it.id} style={{ flexDirection: 'row', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, marginBottom: 10 }}>
                    {img ? <Image source={img} style={{ width: 62, height: 62, borderRadius: 12 }} resizeMode="cover" /> : null}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyS" numberOfLines={2} style={{ fontSize: 12.5, fontWeight: '700', color: d.text }}>{it.title}</T>
                      <T v="bodyS" style={{ fontSize: 13, fontWeight: '900', color: gold, marginTop: 3 }}>{fmt(it.price)}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <Pressable onPress={() => void changeQty(it, 0)} hitSlop={8}>
                        <FontAwesome5 name="trash-alt" size={12} color="#E05252" />
                      </Pressable>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Pressable onPress={() => void changeQty(it, (it.qty ?? 1) - 1)} hitSlop={8}><FontAwesome5 name="minus" size={10} color={d.text} /></Pressable>
                        <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text, minWidth: 14, textAlign: 'center' }}>{it.qty ?? 1}</T>
                        <Pressable onPress={() => void changeQty(it, (it.qty ?? 1) + 1)} hitSlop={8}><FontAwesome5 name="plus" size={10} color={d.text} /></Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <T v="bodyS" style={{ fontSize: 12.5, color: d.subtext }}>Items ({cart.count})</T>
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>{fmt(cart.total)}</T>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="bodyS" style={{ fontSize: 12.5, color: d.subtext }}>Shipping</T>
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: emerald }}>FREE</T>
                </View>
              </View>
              <Pressable onPress={() => {
                if (!live && !user) { router.push('/login'); return; }
                if (live && !user) { router.push('/login'); return; }
                haptic.light();
                setForm((f) => ({ ...f, name: f.name || (user?.full_name ?? ''), email: f.email || (user?.email ?? '') }));
                setCheckout(true);
              }} style={{ borderRadius: 15, backgroundColor: gold, paddingVertical: 15, alignItems: 'center', marginTop: 14 }}>
                <T v="bodyS" style={{ fontWeight: '900', fontSize: 14, color: isDark ? '#14241C' : '#fff' }}>Proceed to checkout · {fmt(cart.total)}</T>
              </Pressable>
            </>
          )}
        </ScrollView>
      ) : null}

      {tab === 'orders' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
          {!orders ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}><ActivityIndicator color={gold} /></View>
          ) : orders.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 70, gap: 10 }}>
              <FontAwesome5 name="receipt" size={26} color={d.faint} />
              <T v="bodyS" style={{ color: d.subtext, fontSize: 13, fontWeight: '700' }}>No orders yet</T>
              <T v="caption" style={{ color: d.faint, fontSize: 11 }}>Your purchases will appear here</T>
            </View>
          ) : orders.map((o) => (
            <View key={o.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.text }}>Order #{o.id}</T>
                <View style={{ borderRadius: 8, backgroundColor: o.status === 'delivered' ? 'rgba(74,227,143,0.14)' : 'rgba(212,175,55,0.14)', paddingHorizontal: 9, paddingVertical: 4 }}>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: o.status === 'delivered' ? emerald : gold, textTransform: 'capitalize' }}>{o.status}</T>
                </View>
              </View>
              {o.items.map((it, i) => {
                const img = shopImage(it.image_key);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                    {img ? <Image source={img} style={{ width: 38, height: 38, borderRadius: 9 }} resizeMode="cover" /> : null}
                    <T v="bodyS" numberOfLines={1} style={{ flex: 1, fontSize: 12, color: d.text }}>{it.title}</T>
                    <T v="caption" style={{ fontSize: 11, color: d.subtext }}>×{it.qty}</T>
                    <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: d.text }}>{fmt(it.price * it.qty)}</T>
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
                <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>{o.ship_to} · {o.created_at.slice(0, 10)}</T>
                <T v="bodyS" style={{ fontSize: 13, fontWeight: '900', color: gold }}>{fmt(o.total)}</T>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* ── module bottom menu: Shop | Cart | Orders ── */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: isDark ? 'rgba(8,14,10,0.92)' : 'rgba(255,255,255,0.94)', borderTopWidth: 1, borderTopColor: d.cardBorder }}>
        {([
          { k: 'shop' as Tab, icon: 'store', label: 'Shop' },
          { k: 'cart' as Tab, icon: 'shopping-cart', label: 'Cart' },
          { k: 'orders' as Tab, icon: 'receipt', label: 'Orders' },
        ]).map((t, i) => {
          const on = tab === t.k;
          const isCenter = i === 1;
          const badge = t.k === 'cart' ? (cart?.count ?? 0) : 0;
          return (
            <Pressable key={t.k} onPress={() => { haptic.selection(); setTab(t.k); }} style={{ alignItems: 'center', gap: 3, paddingHorizontal: 18 }}>
              <View style={isCenter ? { width: 46, height: 46, borderRadius: 23, backgroundColor: on ? gold : d.bgSoft, borderWidth: 1, borderColor: on ? gold : d.cardBorder, alignItems: 'center', justifyContent: 'center', marginTop: -20 } : undefined}>
                <FontAwesome5 name={t.icon as never} size={isCenter ? 16 : 15} color={on ? (isCenter ? (isDark ? '#14241C' : '#fff') : gold) : d.faint} />
                {badge > 0 ? (
                  <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E05252', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: '#fff' }}>{badge > 9 ? '9+' : badge}</T>
                  </View>
                ) : null}
              </View>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: on ? '800' : '600', color: on ? gold : d.faint, marginTop: isCenter ? 2 : 0 }}>{t.label}</T>
            </Pressable>
          );
        })}
      </View>

      {/* ── checkout sheet ── */}
      <Modal visible={checkout} transparent animationType="slide" onRequestClose={() => { setCheckout(false); setPlaced(null); setPayState('idle'); setPayMsg(''); }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => { if (!placing) { setCheckout(false); setPlaced(null); setPayState('idle'); setPayMsg(''); } }}>
          <Pressable style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 20), maxHeight: '88%' }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: d.cardBorder, alignSelf: 'center', marginBottom: 12 }} />
            {placed ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(74,227,143,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="check" size={20} color={emerald} />
                </View>
                <T v="h2" style={{ fontWeight: '900', fontSize: 17, color: d.text }}>Order #{placed} placed!</T>
                <T v="caption" style={{ color: d.faint, textAlign: 'center', lineHeight: 18 }}>
                  {payState === 'paid'
                    ? 'Payment confirmed ✓ — we will email tracking updates. Free worldwide shipping 🌍'
                    : 'Jazakum Allahu khayran. Pay securely with Flutterwave — card, bank transfer, USSD or mobile money.'}
                </T>
                {payMsg ? <T v="caption" style={{ color: '#E05252', textAlign: 'center', fontSize: 10.5, lineHeight: 15 }}>{payMsg}</T> : null}
                {!live ? null : payState === 'paid' ? null : (
                  <Pressable disabled={payState === 'busy'} onPress={() => {
                    setPayState('busy'); setPayMsg('');
                    void payShopOrder(placed).then((r) => {
                      if (r.verified) { setPayState('paid'); haptic.success(); loadOrders(); }
                      else { setPayState('failed'); setPayMsg(r.message ?? 'Payment not completed — you can retry from Orders.'); }
                    });
                  }} style={{ borderRadius: 13, backgroundColor: '#F5A623', paddingHorizontal: 24, paddingVertical: 13, marginTop: 8, minWidth: 230, alignItems: 'center', opacity: payState === 'busy' ? 0.7 : 1 }}>
                    {payState === 'busy' ? <ActivityIndicator color="#fff" /> : (
                      <T v="bodyS" style={{ fontWeight: '900', fontSize: 13, color: '#fff' }}>
                        Pay {fmt(placedTotal)} with Flutterwave
                      </T>
                    )}
                  </Pressable>
                )}
                <Pressable onPress={() => { setCheckout(false); setPlaced(null); setPayState('idle'); setPayMsg(''); setTab('orders'); }} style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 }}>
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>View my orders</T>
                </Pressable>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text, marginBottom: 3 }}>Shipping details</T>
                <T v="caption" style={{ color: d.faint, marginBottom: 12 }}>We ship worldwide — payment link follows by email.</T>
                <TextInput value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Full name *" placeholderTextColor={d.faint} style={inputStyle} />
                <TextInput value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="Email *" placeholderTextColor={d.faint} autoCapitalize="none" keyboardType="email-address" style={inputStyle} />
                <TextInput value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="Phone (with country code)" placeholderTextColor={d.faint} keyboardType="phone-pad" style={inputStyle} />
                <View style={{ flexDirection: 'row', gap: 9 }}>
                  <TextInput value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} placeholder="Country *" placeholderTextColor={d.faint} style={[inputStyle, { flex: 1 }]} />
                  <TextInput value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} placeholder="City *" placeholderTextColor={d.faint} style={[inputStyle, { flex: 1 }]} />
                </View>
                <TextInput value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="Street address *" placeholderTextColor={d.faint} multiline style={[inputStyle, { minHeight: 64, textAlignVertical: 'top' }]} />
                <TextInput value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} placeholder="Order note (optional)" placeholderTextColor={d.faint} style={inputStyle} />
                <Pressable disabled={placing} onPress={() => void placeOrder()}
                  style={{ borderRadius: 14, backgroundColor: gold, paddingVertical: 14, alignItems: 'center', marginTop: 4, opacity: placing ? 0.7 : 1 }}>
                  {placing ? <ActivityIndicator color={isDark ? '#14241C' : '#fff'} /> : <T v="bodyS" style={{ fontWeight: '900', fontSize: 14, color: isDark ? '#14241C' : '#fff' }}>Place order · {fmt(cart?.total ?? 0)}</T>}
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function ShopScreen() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="DeenLink Shop" />;
  return <ShopScreenInner />;
}
