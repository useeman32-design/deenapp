import { chromium } from 'playwright-core';
const BASE = 'https://app.deenlink.org';
const RUN = Date.now();
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--host-resolver-rules=MAP app.deenlink.org 102.209.117.119'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept().catch(() => {}));
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 150)));
page.on('response', async (r) => { if (r.url().includes('start_username')) { console.log('RESP start_username:', r.status(), (await r.text().catch(() => '')).slice(0, 140)); } });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const uA = 'livA' + RUN, uB = 'livB' + RUN;
const seeded = await page.evaluate(async ([a, b]) => {
  const reg = async (u, disp) => {
    const r0 = await fetch('/api/auth/csrf.php'); const tok = (await r0.json()).csrf_token;
    const rr = await fetch('/api/auth/register.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tok }, body: JSON.stringify({ full_name: disp, username: u, email: u + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }) });
    return (await rr.json()).status;
  };
  return [await reg(a, 'Live Alpha'), await reg(b, 'Live Bravo')];
}, [uA, uB]);
console.log('registered on LIVE:', JSON.stringify(seeded));

const inputs = await page.$$('input');
await inputs[0].fill(uA + '@t.co');
await inputs[1].fill('Str0ngPass!23');
await page.getByText('Sign In', { exact: true }).first().click();
await page.waitForTimeout(6000);
await page.goto(BASE + '/profile/' + uB, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5500);
const tapped = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div,span')).filter((e) => /^Message/.test((e.textContent || '').trim()) && e.children.length <= 2);
  const el = els[els.length - 1];
  if (!el) return null;
  const o = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('click', o));
  return el.textContent.trim().slice(0, 30);
});
console.log('tapped:', tapped);
await page.waitForTimeout(6000);
const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
console.log('URL:', page.url());
console.log('thread open (peer header/banner):', txt.includes('Live Bravo'), '| request banner:', /Message request/.test(txt), '| list mode:', /Message requests\b.*Search/i.test(txt));
console.log('bundle:', await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.src).find((s) => s.includes('entry')) || 'n/a'));
console.log('slice:', txt.slice(0, 260));
await browser.close();
