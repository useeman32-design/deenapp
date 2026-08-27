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
await page.waitForTimeout(1000);

// find the mosque img, then walk up listing scrollable ancestors
const info = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  const img = imgs.find((i) => { const r = i.getBoundingClientRect(); return r.width > 250 && r.height > 120; });
  if (!img) return 'no img';
  const chain = [];
  let el = img;
  while (el) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const scrollable = (st.overflowY === 'auto' || st.overflowY === 'scroll') || (st.overflowX === 'auto' || st.overflowX === 'scroll');
    chain.push({
      tag: el.tagName,
      y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width),
      ofY: st.overflowY, ofX: st.overflowX,
      scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      tf: st.transform === 'none' ? '' : st.transform.slice(0, 30),
    });
    if (el.tagName === 'BODY') break;
    el = el.parentElement;
  }
  return { imgY: Math.round(img.getBoundingClientRect().y), chain };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2500));

// HOME: what covers the video thumbnails?
await page.evaluate(() => {
  const el = document.elementFromPoint(195, 300);
  let sc = el;
  while (sc) { const st = getComputedStyle(sc); if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 100) break; sc = sc.parentElement; }
  if (sc) sc.scrollTop = 1050;
});
await page.waitForTimeout(400);
const cover = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img')).filter((i) => { const r = i.getBoundingClientRect(); return r.width > 100 && r.width < 200 && r.y > 0 && r.y < 844; });
  if (!imgs.length) return 'no thumbs in view';
  const i = imgs[0];
  const r = i.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const chain = [];
  let el = top;
  for (let k = 0; k < 8 && el; k++) {
    const st = getComputedStyle(el);
    const rr = el.getBoundingClientRect();
    chain.push({ tag: el.tagName, w: Math.round(rr.width), h: Math.round(rr.height), y: Math.round(rr.y), pos: st.position, z: st.zIndex, pe: st.pointerEvents, txt: (el.textContent || '').slice(0, 20).replace(/\n/g, ' ') });
    el = el.parentElement;
  }
  return chain;
});
console.log('COVER at video thumb:');
console.log(JSON.stringify(cover, null, 1));
await browser.close();
