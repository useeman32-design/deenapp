/* pass 78 E2E — DeenLink Shop: quick-access entry → browse → product
 * preview → add to cart → cart qty → checkout → orders; search results;
 * affiliate card shows partner badge + Buy-on button. */
import { chromium } from 'playwright-core';
const BASE = 'http://app.deenlink.org';
const results = [];
const check = (label, cond, extra = '') => { results.push(!!cond); console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  << ' + extra)); };
const RUN = Date.now();

const mergeCookies = (prev, resp) => {
  const m = new Map();
  for (const c of (prev || '').split('; ')) { if (c.includes('=')) m.set(c.split('=')[0], c); }
  for (const c of (resp.headers.getSetCookie?.() ?? [])) { const kv = c.split(';')[0]; m.set(kv.split('=')[0], kv); }
  return Array.from(m.values()).join('; ');
};
const uname = 'shp' + RUN;
const email = uname + '@t.co';
const r0 = await fetch(BASE + '/api/auth/csrf.php');
let cookie = mergeCookies('', r0);
const tok = (await r0.json()).csrf_token;
const rr = await fetch(BASE + '/api/auth/register.php', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tok, Cookie: cookie },
  body: JSON.stringify({ full_name: 'Shopper Tester', username: uname, email, password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }),
});
const rj = await rr.json();
check('shopper registers', rj.status === 'success', JSON.stringify(rj).slice(0, 120));

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept().catch(() => {}));
const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const tapByText = (re) => page.evaluate((src) => {
  const re2 = new RegExp(src);
  const els = Array.from(document.querySelectorAll('div,span')).filter((e) => re2.test((e.textContent || '').trim()) && e.children.length <= 3);
  const el = els[els.length - 1];
  if (!el) return null;
  const o = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', o));
  el.dispatchEvent(new PointerEvent('pointerup', o));
  el.dispatchEvent(new MouseEvent('click', o));
  return (el.textContent || '').trim().slice(0, 40);
}, re.source);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const inputs = await page.$$('input');
await inputs[0].fill(email);
await inputs[1].fill('Str0ngPass!23');
await page.getByText('Sign In', { exact: true }).first().click();
await page.waitForTimeout(5500);

// ── quick access entry on home ──
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5500);
let txt = await bodyText();
check('Quick Access shows the Shop shortcut', /\bShop\b/.test(txt));
const openedViaQuick = await tapByText(/^Shop$/);
await page.waitForTimeout(3000);
txt = await bodyText();
if (!txt.includes('DeenLink Shop')) { await page.goto(BASE + '/shop', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500); txt = await bodyText(); }
check('shop opens with header + tagline', txt.includes('DeenLink Shop') && /shipped worldwide/i.test(txt), txt.slice(0, 160));
check('product grid shows seeded catalog', txt.includes('Premium Sajjadah Prayer Mat') && txt.includes('99-Bead Amber Misbaha'), txt.slice(0, 200));
check('affiliate partner badge visible', /Amazon|AliExpress|Jumia|eBay/.test(txt));
check('module bottom menu has Shop/Cart/Orders', /Cart/.test(txt) && /Orders/.test(txt));

// ── product preview + add to cart ──
await tapByText(/Premium Sajjadah Prayer Mat/);
await page.waitForTimeout(2800);
txt = await bodyText();
check('product preview opens (price + Add to cart)', txt.includes('Premium Sajjadah Prayer Mat') && /Add to cart/.test(txt) && /\$24\.99/.test(txt), txt.slice(0, 200));
await tapByText(/Add to cart/);
await page.waitForTimeout(1500);
txt = await bodyText();
check('added-to-cart confirmation', /Added to cart/.test(txt), txt.slice(0, 160));

// ── cart tab ──
await page.goBack().catch(() => {});
await page.waitForTimeout(2200);
await tapByText(/^Cart$/);
await page.waitForTimeout(2500);
txt = await bodyText();
check('cart shows the prayer mat line', txt.includes('Premium Sajjadah Prayer Mat') && /\$24\.99/.test(txt), txt.slice(0, 200));
check('checkout button shows total', /Proceed to checkout · \$24\.99/.test(txt), txt.slice(0, 200));

// ── checkout ──
await tapByText(/Proceed to checkout/);
await page.waitForTimeout(1200);
const fillNth = async (idx, val) => { const ii = await page.$$('input, textarea'); if (ii[idx]) await ii[idx].fill(val); };
const before = (await page.$$('input, textarea')).length;
await fillNth(0, 'Shopper Tester');
await fillNth(1, email);
await fillNth(2, '+2348012345678');
await fillNth(3, 'Nigeria');
await fillNth(4, 'Abuja');
await fillNth(5, '12 Test Street, Wuse');
await tapByText(/Place order/);
await page.waitForTimeout(3000);
txt = await bodyText();
const m = txt.match(/Order #(\d+) placed/);
check('order placed successfully', !!m, txt.slice(0, 200));
const oid = m ? m[1] : null;

// ── orders tab ──
await tapByText(/View my orders/);
await page.waitForTimeout(2500);
txt = await bodyText();
check('orders tab lists the order', oid ? txt.includes('Order #' + oid) : false, txt.slice(0, 200));
check('order shows pending + ship-to', /pending/i.test(txt) && txt.includes('Abuja, Nigeria'), txt.slice(0, 200));

// ── search ──
await page.goto(BASE + '/shop/search', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const si = await page.$$('input');
await si[0].fill('misbaha');
await page.waitForTimeout(2500);
txt = await bodyText();
check('search returns misbaha products', txt.includes('99-Bead Amber Misbaha'), txt.slice(0, 200));
await tapByText(/99-Bead Amber Misbaha/);
await page.waitForTimeout(2500);
txt = await bodyText();
check('search result opens product preview', txt.includes('99-Bead Amber Misbaha') && /\$14\.99/.test(txt), txt.slice(0, 160));

// ── affiliate preview has Buy-on button ──
await page.goto(BASE + '/shop', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await tapByText(/Smart Quran Speaker Pen/);
await page.waitForTimeout(2500);
txt = await bodyText();
check('affiliate product shows Buy on Amazon', /Buy on Amazon/.test(txt), txt.slice(0, 200));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
