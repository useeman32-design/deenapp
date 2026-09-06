/* ── DeenLink Shop shared kit (pass 78) ──
 * image_key → bundled art, demo catalog (same 13 rows the server seeds, so
 * the demo works offline — one codebase for demo + live), price + network
 * presentation helpers. */
import type { ShopProduct } from '@/api/client';

/* Bundled product art — every product has its dedicated render. */
export const SHOP_IMAGES: Record<string, number> = {
  banner_hero: require('@/assets/shop/banner_hero.jpg'),
  banner_promo: require('@/assets/shop/banner_promo.jpg'),
  prayer_mat: require('@/assets/shop/prayer_mat.jpg'),
  misbaha: require('@/assets/shop/misbaha.jpg'),
  tasbih_counter: require('@/assets/shop/tasbih_counter.jpg'),
  jalabiya: require('@/assets/shop/jalabiya.jpg'),
  niqab: require('@/assets/shop/niqab.jpg'),
  abaya: require('@/assets/shop/abaya.jpg'),
  kufi_cap: require('@/assets/shop/kufi_cap.jpg'),
  attar_set: require('@/assets/shop/attar_set.jpg'),
  rehal: require('@/assets/shop/rehal.jpg'),
  aff_quran_pen: require('@/assets/shop/aff_quran_pen.jpg'),
  aff_led_misbaha: require('@/assets/shop/aff_led_misbaha.jpg'),
  aff_travel_set: require('@/assets/shop/aff_travel_set.jpg'),
  aff_thobe: require('@/assets/shop/aff_thobe.jpg'),
};

export function shopImage(key: string | null | undefined): number | null {
  return (key && SHOP_IMAGES[key]) || null;
}

export const SHOP_CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'dhikr', label: 'Dhikr' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'fragrance', label: 'Fragrance' },
  { key: 'quran', label: 'Quran' },
];

export const SHOP_NETWORKS: Record<string, { label: string; color: string }> = {
  amazon: { label: 'Amazon', color: '#FF9900' },
  aliexpress: { label: 'AliExpress', color: '#E62E04' },
  jumia: { label: 'Jumia', color: '#F68B1E' },
  ebay: { label: 'eBay', color: '#3665F3' },
};

export function shopPrice(v: number, currency = 'USD'): string {
  const sym = currency === 'USD' ? '$' : currency + ' ';
  return sym + v.toFixed(2).replace(/\\.00$/, '.00');
}

/** Demo/offline catalog — mirrors api/shop/common.php shop_seed(). */
const row = (id: number, slug: string, title: string, description: string, price: number, compare: number | null, category: string, image_key: string, source: 'own' | 'affiliate', network: string | null, affiliate_url: string | null): ShopProduct => ({
  id, slug, title, description, price, compare_at: compare, currency: 'USD', category, image_key, source, network, affiliate_url, in_stock: true,
});

export const DEMO_PRODUCTS: ShopProduct[] = [
  row(1, 'prayer-mat', 'Premium Sajjadah Prayer Mat', 'Plush velvet sajjadah with a woven gold mihrab arch and non-slip backing. Folds compact for travel — 110 × 70 cm.', 24.99, 34.99, 'prayer', 'prayer_mat', 'own', null, null),
  row(2, 'misbaha-99', '99-Bead Amber Misbaha', 'Hand-knotted 99-bead misbaha in warm amber resin with gold-tone spacers and a braided tassel.', 14.99, 19.99, 'dhikr', 'misbaha', 'own', null, null),
  row(3, 'tasbih-counter', 'Digital Tasbih Finger Counter', 'LED finger counter with scroll wheel, tally memory and wrist strap. Counts to 9999 — battery included.', 7.99, 11.99, 'dhikr', 'tasbih_counter', 'own', null, null),
  row(4, 'jalabiya-thobe', 'Classic Jalabiyya Thobe', 'Breathable cotton-blend jalabiyya with embroidered collar. Machine washable; sizes S–XXL.', 39.99, 54.99, 'clothing', 'jalabiya', 'own', null, null),
  row(5, 'niqab-chiffon', 'Two-Layer Chiffon Niqab', 'Lightweight two-layer chiffon niqab with adjustable tie. Opaque, breathable, all-day comfort.', 18.99, 24.99, 'clothing', 'niqab', 'own', null, null),
  row(6, 'abaya-gold', 'Gold-Embroidered Abaya', 'Flowing black abaya with delicate gold embroidery on sleeves and hem. Comes with matching belt.', 49.99, 69.99, 'clothing', 'abaya', 'own', null, null),
  row(7, 'kufi-cap', 'Embroidered Kufi Cap', 'Hand-embroidered cotton kufi with geometric gold thread. One size with stretch fit.', 9.99, 13.99, 'clothing', 'kufi_cap', 'own', null, null),
  row(8, 'attar-set', 'Oud Attar Gift Set (3 × 6 ml)', 'Alcohol-free attar oils — Oud Mubakhar, Rose Musk, White Amber — in ornate glass with gift box.', 21.99, 29.99, 'fragrance', 'attar_set', 'own', null, null),
  row(9, 'rehal-stand', 'Carved Wooden Rehal Stand', 'Hand-carved brown-wood rehal with mother-of-pearl star inlay. Folds flat for storage.', 27.99, 35.99, 'quran', 'rehal', 'own', null, null),
  row(10, 'aff-quran-pen', 'Smart Quran Speaker Pen', 'Touch-to-read recitation pen with full Quran, 20+ languages and rechargeable battery.', 45.0, null, 'quran', 'aff_quran_pen', 'affiliate', 'amazon', 'https://www.amazon.com/s?k=quran+speaker+pen'),
  row(11, 'aff-led-misbaha', 'LED Digital Misbaha Ring', 'Fingerprint LED misbaha ring — 5-digit display, silent scroll, USB rechargeable.', 12.5, null, 'dhikr', 'aff_led_misbaha', 'affiliate', 'aliexpress', 'https://www.aliexpress.com/w/wholesale-digital-misbaha.html'),
  row(12, 'aff-travel-set', 'Travel Prayer Mat Set', 'Pocket-size waterproof prayer mat with built-in pouch and mini qibla compass.', 16.99, null, 'prayer', 'aff_travel_set', 'affiliate', 'jumia', 'https://www.jumia.com.ng/catalog/?q=travel%20prayer%20mat'),
  row(13, 'aff-turkish-thobe', 'Premium Turkish Thobe', 'Ottoman-cut Turkish thobe in premium linen blend with mandarin collar.', 59.0, null, 'clothing', 'aff_thobe', 'affiliate', 'ebay', 'https://www.ebay.com/sch/i.html?_nkw=turkish+thobe'),
];
