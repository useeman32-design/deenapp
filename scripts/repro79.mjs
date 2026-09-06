/* pass 79 E2E — Quick Access lists ALL shortcuts (hide/reorder only in the
 * editor); shop order offers Flutterwave payment gracefully; profile Message
 * still lands in the chat (pass 74 regression guard). */
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
const r0 = await fetch(BASE + '/api/auth/csrf.php');
let cookie = mergeCookies('', r0);
const tok = (await r0.json()).csrf_token;
const reg = async (tag, disp) => {
  const u = tag + RUN;
  const rr = await fetch(BASE + '/api/auth/register.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tok, Cookie: cookie }, body: JSON.stringify({ full_name: disp, username: u, email: u + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }) });
  const j = await rr.json();
  if (j.status !== 'success') throw new Error('register: ' + JSON.stringify(j).slice(0, 120));
  return u;
};
const uA = await reg('q79a', 'Quick Alpha');
const uB = await reg('q79b', 'Quick Bravo');

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept().catch(() => {}));
const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const tapByText = (re, first = false) => page.evaluate(([src, f]) => {
  const re2 = new RegExp(src);
  const els = Array.from(document.querySelectorAll('div,span')).filter((e) => re2.test((e.textContent || '').trim()) && e.children.length <= 3);
  const el = f ? els[0] : els[els.length - 1];
  if (!el) return null;
  const o = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('click', o));
  return (el.textContent || '').trim().slice(0, 40);
}, [re.source, first]);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const inputs = await page.$$('input');
await inputs[0].fill(uA + '@t.co');
await inputs[1].fill('Str0ngPass!23');
await page.getByText('Sign In', { exact: true }).first().click();
await page.waitForTimeout(5500);
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5500);

// ── all shortcuts on the home rail ──
const ALL = ['Shop', 'Videos', 'Quran', 'Hadith', 'Dua', 'Prayer Times', 'Dhikr', 'Qibla', 'Calendar', 'Names of Allah', 'Zakat', 'Zakat Calc', 'Wallpapers', 'Courses', 'Learning Hub', 'Quiz', 'Scholars', 'Inbox', 'DeenLink AI', 'Ruqyah'];
let txt = await bodyText();
const missing = ALL.filter((l) => !txt.includes(l));
check(`home rail lists all ${ALL.length} shortcuts`, missing.length === 0, 'missing: ' + JSON.stringify(missing));

// ── editor: hide Ruqyah, it disappears from home, then bring it back ──
await page.goto(BASE + '/settings/quick-access', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
txt = await bodyText();
check('editor shows SHOWN ON HOME count (20)', /SHOWN ON HOME \(20\)/.test(txt), txt.slice(txt.indexOf('SHOWN'), txt.indexOf('SHOWN') + 40));
const clickRowButton = (labelText, btnIndexFromEnd) => page.evaluate(([label, fromEnd]) => {
  // innermost element whose full text is the label
  const labels = Array.from(document.querySelectorAll('div,span')).filter((e) => (e.textContent || '').trim() === label && e.children.length === 0);
  if (!labels.length) return 'no label';
  let el = labels[0];
  for (let k = 0; k < 8 && el; k++) {
    const btns = Array.from(el.querySelectorAll('div')).filter((b) => (b.style.borderRadius || '') === '15px');
    if (btns.length >= 1) {
      const btn = btns[btns.length - fromEnd];
      if (!btn) return 'no btn';
      const o = { bubbles: true, composed: true, cancelable: true, view: window };
      btn.dispatchEvent(new PointerEvent('pointerdown', o)); btn.dispatchEvent(new PointerEvent('pointerup', o)); btn.dispatchEvent(new MouseEvent('click', o));
      return 'clicked';
    }
    el = el.parentElement;
  }
  return 'no row';
}, [labelText, btnIndexFromEnd]);
const hid = await clickRowButton('Ruqyah', 1);
check('tapped hide (eye) on Ruqyah row', hid === 'clicked');
await page.waitForTimeout(1200);
txt = await bodyText();
check('Ruqyah moved to HIDDEN section', /HIDDEN \(1\)/.test(txt), txt.slice(txt.indexOf('HIDDEN'), txt.indexOf('HIDDEN') + 30));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
txt = await bodyText();
check('hidden shortcut gone from home rail', !txt.includes('Ruqyah') && txt.includes('Shop'));
// restore
await page.goto(BASE + '/settings/quick-access', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await clickRowButton('Ruqyah', 1);
await page.waitForTimeout(800);

// ── shop: order + Flutterwave pay button (graceful in sandbox) ──
await page.goto(BASE + '/shop', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await tapByText(/99-Bead Amber Misbaha/);
await page.waitForTimeout(2800);
await tapByText(/Add to cart/);
await page.waitForTimeout(1200);
await page.goBack().catch(() => {});
await page.waitForTimeout(2000);
await tapByText(/^Cart$/);
await page.waitForTimeout(2200);
await tapByText(/Proceed to checkout/);
await page.waitForTimeout(1200);
const fillNth = async (idx, val) => { const ii = await page.$$('input, textarea'); if (ii[idx]) await ii[idx].fill(val); };
await fillNth(0, 'Quick Alpha');
await fillNth(1, uA + '@t.co');
await fillNth(3, 'Nigeria');
await fillNth(4, 'Abuja');
await fillNth(5, '9 Test Close');
await tapByText(/Place order/);
await page.waitForTimeout(3000);
txt = await bodyText();
check('order placed', /Order #\d+ placed/.test(txt), txt.slice(0, 140));
check('Flutterwave pay button offered', /Pay \$\d+\.\d{2} with Flutterwave/.test(txt), txt.slice(0, 200));
await tapByText(/with Flutterwave/);
await page.waitForTimeout(6000);
txt = await bodyText();
check('pay attempt stays graceful (no crash; sheet intact)', /Order #\d+ placed|Payment|payment|Flutterwave/.test(txt), txt.slice(0, 200));

// ── profile Message regression guard ──
await page.goto(BASE + '/profile/' + uB, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await tapByText(/^Message/);
await page.waitForTimeout(5000);
txt = await bodyText();
check('profile Message opens the chat (not the list)', page.url().includes('/tools/inbox?u=') && txt.includes('Quick Bravo') && /Message request|Type a message|Write a message/i.test(txt), page.url() + ' | ' + txt.slice(0, 120));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
