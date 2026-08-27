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
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const cl = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Community' && d.getBoundingClientRect().y > 640);
  const r = els[0].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(cl.x, cl.y);
await page.waitForTimeout(1200);

// set search value via REAL keyboard like a user
const searchBox = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('[placeholder*="Search posts or accounts"]'));
  return els.map((e) => {
    const r = e.getBoundingClientRect();
    const st = getComputedStyle(e);
    let vis = true; let el = e;
    while (el) { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') { vis = false; break; } el = el.parentElement; }
    return { y: Math.round(r.y), vis };
  });
});
console.log('search fields:', JSON.stringify(searchBox));

const sb = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('[placeholder*="Search posts or accounts"]'));
  for (const e of els) {
    const r = e.getBoundingClientRect();
    let vis = true; let el = e;
    while (el) { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') { vis = false; break; } el = el.parentElement; }
    if (vis && r.y > 0 && r.y < 844) { e.focus(); return true; }
  }
  return false;
});
console.log('focused visible search field:', sb);
await page.keyboard.type('alameen', { delay: 20 });
await page.waitForTimeout(800);

const dump = await page.evaluate(() => {
  const handles = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '@alameen');
  return handles.map((h) => {
    const r = h.getBoundingClientRect();
    let vis = true, hiddenBy = null, el = h;
    while (el) { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') { vis = false; hiddenBy = el.tagName + '.' + ((el.className || '').toString().slice(0, 20)); break; } el = el.parentElement; }
    const x = Math.min(r.x + 30, r.x + r.width), y = r.y + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { y: Math.round(r.y), vis, hiddenBy, hit: top ? (top === h ? 'self' : top.tagName + ':' + (top.textContent || '').slice(0, 16)) : 'null', hitContains: top ? h.contains(top) : false, topAncestorOfH: top ? h.contains(top) || (top && Array.from(h.ancestors?.() || []).includes(top)) : false };
  });
});
console.log(JSON.stringify(dump, null, 1));
await page.screenshot({ path: '/tmp/p12-search2.png' });

// FAB actual location: find emerald 54px div
const fabPos = await page.evaluate(() => {
  const divs = Array.from(document.querySelectorAll('div'));
  const f = divs.filter((d) => {
    const r = d.getBoundingClientRect();
    const st = getComputedStyle(d);
    return Math.abs(r.width - 54) < 4 && Math.abs(r.height - 54) < 4 && st.borderRadius === '27px';
  });
  return f.map((d) => { const r = d.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), bg: getComputedStyle(d).backgroundColor }; });
});
console.log('FAB 54px divs:', JSON.stringify(fabPos));
// replicate smoke11 FAB probe exactly
const fabProbe = await page.evaluate(() => {
  const px = 390 - 16 - 27, py = 844 - 78 - 27;
  let el = document.elementFromPoint(px, py);
  const trail = [];
  while (el) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    trail.push({ tag: el.tagName, pos: st.position, w: Math.round(r.width), h: Math.round(r.height), hasSvg: !!el.querySelector('svg') });
    if (st.position === 'absolute' && r.width >= 50 && r.width <= 60 && r.height >= 50 && r.height <= 60 && el.querySelector('svg')) {
      return { found: true, at: { x: Math.round(r.x), y: Math.round(r.y) }, trail };
    }
    el = el.parentElement;
  }
  return { found: false, trail };
});
console.log('FAB probe:', JSON.stringify(fabProbe));
await browser.close();
