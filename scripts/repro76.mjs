/* Tier 3 E2E — profile block button, search hiding, blocked-accounts settings
 * screen, unblock. Client+API same-origin on port 80. */
import { chromium } from 'playwright-core';
const BASE = 'http://app.deenlink.org';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const results = [];
const check = (label, cond, extra = '') => { results.push(!!cond); console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  << ' + extra)); };

const RUN = Date.now();
const mergeCookies = (prev, resp) => {
  const m = new Map();
  for (const c of (prev || '').split('; ')) { if (c.includes('=')) m.set(c.split('=')[0], c); }
  for (const c of (resp.headers.getSetCookie?.() ?? [])) { const kv = c.split(';')[0]; m.set(kv.split('=')[0], kv); }
  return Array.from(m.values()).join('; ');
};
const reg = async (tag, disp) => {
  const r0 = await fetch(BASE + '/api/auth/csrf.php');
  const token = (await r0.json()).csrf_token;
  let cookie = mergeCookies('', r0);
  const rr = await fetch(BASE + '/api/auth/register.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, Cookie: cookie },
    body: JSON.stringify({ full_name: disp, username: tag + RUN, email: tag + RUN + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }),
  });
  const j = await rr.json();
  if (j.status !== 'success') throw new Error('register ' + tag + ': ' + JSON.stringify(j).slice(0, 140));
  return { uname: tag + RUN, email: tag + RUN + '@t.co' };
};
const one = await reg('t3one', 'Blocker One');
const two = await reg('t3two', 'Blocked Two');

const login = async (ctx, email) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 130)));
  page.on('dialog', (dlg) => dlg.accept().catch(() => {}));
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const inputs = await page.$$('input');
  await inputs[0].fill(email);
  await inputs[1].fill('Str0ngPass!23');
  await page.getByText('Sign In', { exact: true }).first().click();
  await page.waitForTimeout(6000);
  return page;
};

// ── ONE blocks TWO from the profile ──
const ctx1 = await browser.newContext({ viewport: { width: 420, height: 860 } });
const p1 = await login(ctx1, one.email);
await p1.goto(BASE + '/profile/' + two.uname, { waitUntil: 'domcontentloaded' });
await p1.waitForTimeout(5000);
const blockBtn = p1.locator('[aria-label="Block account"]').first();
check('profile has block button', await blockBtn.count() > 0);
if (await blockBtn.count()) await blockBtn.click();
await p1.waitForTimeout(2500);
const unblockBtn = p1.locator('[aria-label="Unblock account"]').first();
check('button flips to unblocked state', await unblockBtn.count() > 0);

// ── TWO cannot find ONE in search ──
const ctx2 = await browser.newContext({ viewport: { width: 420, height: 860 } });
const p2 = await login(ctx2, two.email);
await p2.goto(BASE + '/tools/search', { waitUntil: 'domcontentloaded' });
await p2.waitForSelector('input', { timeout: 30000 });
await p2.waitForTimeout(1200);
const si = await p2.$$('input');
await si[0].fill(one.uname);
await p2.waitForTimeout(4000);
let txt = await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('blocked user hidden from search', !txt.includes('@' + one.uname), txt.slice(0, 160));

// ── ONE manages blocked accounts in settings ──
await p1.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
await p1.waitForTimeout(5000);
const priv = p1.getByText('Privacy & Safety').first();
if (await priv.count()) await priv.click();
await p1.waitForTimeout(1500);
const ba = p1.getByText('Blocked accounts').first();
check('privacy sheet has Blocked accounts', await ba.count() > 0);
if (await ba.count()) await ba.click();
await p1.waitForTimeout(4000);
check('blocked-accounts route opened', p1.url().includes('/settings/blocked-accounts'), p1.url());
txt = await p1.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('blocked list shows TWO', txt.includes(two.uname), txt.slice(0, 180));
const un = p1.getByText('Unblock', { exact: true }).first();
if (await un.count()) await un.click();
await p1.waitForTimeout(3000);
txt = await p1.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('unblock removes the row', !txt.includes(two.uname), txt.slice(0, 180));

// ── TWO can find ONE again ──
await p2.goto(BASE + '/tools/search', { waitUntil: 'domcontentloaded' });
await p2.waitForSelector('input', { timeout: 30000 });
await p2.waitForTimeout(1200);
const si2 = await p2.$$('input');
await si2[0].fill(one.uname);
await p2.waitForTimeout(4000);
txt = await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('search finds ONE after unblock', txt.includes('@' + one.uname), txt.slice(0, 160));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
