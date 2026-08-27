import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session','demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded','1'); } catch {} }, user);
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }), headers: { 'Set-Cookie': 'deenlink_session=demo-session-token; Path=/' } });
    return route.abort();
  }
  return route.continue();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type().toUpperCase(), m.text().slice(0, 300)); });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// go to community (real mouse click)
const cl = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Community' && d.getBoundingClientRect().y > 640);
  if (!els.length) return null;
  const r = els[0].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (!cl) throw new Error('no community tab');
await page.mouse.click(cl.x, cl.y);
await page.waitForTimeout(1200);

// search alameen
await page.evaluate(() => {
  const el = document.querySelector('[placeholder*="Search posts or accounts"]');
  el.focus();
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc.set.call(el, 'alameen');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(600);

// find the account row Pressable: climb from @alameen text to the pressable (row)
const info = await page.evaluate(() => {
  const handles = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '@alameen');
  if (!handles.length) return { step: 'no-handle' };
  const h = handles[0];
  let el = h;
  const chain = [];
  for (let i = 0; i < 8 && el; i++) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    chain.push({ i, tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), pe: st.pointerEvents });
    el = el.parentElement;
  }
  const hr = h.getBoundingClientRect();
  const px = hr.x + 30, py = hr.y + hr.height / 2;
  const top = document.elementFromPoint(px, py);
  return { step: 'ok', chain, point: { px, py }, topEl: top ? { tag: top.tagName, cls: (top.className || '').toString().slice(0, 60), txt: (top.textContent || '').slice(0, 30) } : null };
});
console.log(JSON.stringify(info, null, 1));
if (info.step === 'ok') {
  // scroll the handle into view first, then click the row center via real mouse
  await page.evaluate(() => {
    const handles = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '@alameen');
    handles[0].scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  const rr = await page.evaluate(() => {
    const handles = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '@alameen');
    const r = handles[0].getBoundingClientRect();
    return { x: r.x + 40, y: r.y + r.height / 2 };
  });
  await page.mouse.click(rr.x, rr.y);
  await page.waitForTimeout(1500);
  console.log('URL after row click:', page.url());
  const t = await page.evaluate(() => document.body.innerText.slice(0, 120));
  console.log('BODY after click:', t.replace(/\n/g, ' | '));
}

// FAB: dump absolute-positioned divs with svg in bottom-right
const fabs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('div')).map((d) => {
    const st = getComputedStyle(d);
    const r = d.getBoundingClientRect();
    return { st: st.position, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), hasSvg: !!d.querySelector('svg') };
  }).filter((o) => o.st === 'absolute' && o.hasSvg && o.y > 500 && o.w < 100 && o.w > 20);
});
console.log('FAB candidates:', JSON.stringify(fabs));

await browser.close();
