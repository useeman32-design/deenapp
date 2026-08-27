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

/* 1) HOME scroll: find the scroller and test scrollTop */
const homeScroll = await page.evaluate(() => {
  const el = document.elementFromPoint(195, 300);
  let sc = el;
  while (sc) {
    const st = getComputedStyle(sc);
    if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 100) break;
    sc = sc.parentElement;
  }
  if (!sc) return 'no scroller';
  const before = sc.scrollTop;
  sc.scrollTop = 1050;
  return { before, after: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, id: sc.id || '' };
});
console.log('HOME scroller:', JSON.stringify(homeScroll));
await page.waitForTimeout(400);
const vidImgs = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  return imgs.map((i) => {
    const r = i.getBoundingClientRect();
    if (r.width < 100 || r.width > 200) return null;
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { src: (i.getAttribute('src') || '').slice(-25), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), hit: top ? (i === top || i.contains(top)) : false };
  }).filter(Boolean);
});
console.log('video-sized imgs:', JSON.stringify(vidImgs));

/* 2) COMMUNITY: mosque img at various scroll offsets */
const cl = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Community' && d.getBoundingClientRect().y > 640);
  const r = els[0].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(cl.x, cl.y);
await page.waitForTimeout(1000);
const commScroll = await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('div')).find((d) => {
    if (d.children.length !== 0) return false;
    const t = (d.textContent || '').trim();
    if (t !== 'Community') return false;
    const r = d.getBoundingClientRect();
    return r.y > 0 && r.y < 200;
  });
  if (!h) return 'no header';
  let sc = h.parentElement;
  while (sc) {
    const st = getComputedStyle(sc);
    if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 50) break;
    sc = sc.parentElement;
  }
  if (!sc) return 'no scroller';
  const info = { sh: sc.scrollHeight, ch: sc.clientHeight };
  sc.scrollTop = 400;
  info.at400 = sc.scrollTop;
  return info;
});
console.log('COMMUNITY scroller:', JSON.stringify(commScroll));
for (const off of [0, 250, 500, 750, 1000]) {
  await page.evaluate((n) => {
    const h = Array.from(document.querySelectorAll('div')).find((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Community' && d.getBoundingClientRect().y > 0 && d.getBoundingClientRect().y < 200);
    let sc = h && h.parentElement;
    while (sc) { const st = getComputedStyle(sc); if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 50) break; sc = sc.parentElement; }
    if (sc) sc.scrollTop = n;
  }, off);
  await page.waitForTimeout(300);
  const big = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    for (const i of imgs) {
      const r = i.getBoundingClientRect();
      if (r.width > 200 && r.height > 120 && r.y > 60 && r.y < 780) {
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (top && (i === top || i.contains(top))) return { src: (i.getAttribute('src') || '').slice(-25), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
      }
    }
    return null;
  });
  console.log(`offset ${off}:`, JSON.stringify(big));
}
await browser.close();
