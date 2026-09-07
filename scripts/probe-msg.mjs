import { chromium } from 'playwright-core';
const BASE = 'http://app.deenlink.org';
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
  await fetch(BASE + '/api/auth/register.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tok, Cookie: cookie }, body: JSON.stringify({ full_name: disp, username: u, email: u + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }) });
  return u;
};
const uA = await reg('msgA', 'Message Alpha');
const uB = await reg('msgB', 'Message Bravo');
console.log('users:', uA, uB);

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept().catch(() => {}));
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 150)));
page.on('request', (r) => { if (r.url().includes('start_username')) console.log('REQ start_username'); });
page.on('response', async (r) => { if (r.url().includes('start_username')) { console.log('RESP start_username:', r.status(), (await r.text().catch(() => '')).slice(0, 160)); } });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const inputs = await page.$$('input');
await inputs[0].fill(uA + '@t.co');
await inputs[1].fill('Str0ngPass!23');
await page.getByText('Sign In', { exact: true }).first().click();
await page.waitForTimeout(5500);

await page.goto(BASE + '/profile/' + uB, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
console.log('profile loaded:', body.includes(uB));
// click the Message button
const tapped = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div,span')).filter((e) => /^Message/.test((e.textContent || '').trim()) && e.children.length <= 2);
  const el = els[els.length - 1];
  if (!el) return null;
  const o = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('click', o));
  return el.textContent.trim().slice(0, 30);
});
console.log('tapped:', tapped);
await page.waitForTimeout(5000);
const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
console.log('URL:', page.url());
console.log('has thread (message input placeholder / peer name):', /Message @|Type a message|Write a message/i.test(txt), '| peer name shown:', txt.includes(uB));
console.log('looks like conversation LIST:', /Message requests|Search people|No conversations|Start a conversation/i.test(txt));
console.log('slice:', txt.slice(0, 300));
await page.screenshot({ path: '/tmp/msg-probe.png' });
await browser.close();
