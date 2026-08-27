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

// HOME: daily videos imgs
const vids = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  return imgs.slice(0, 25).map((i) => {
    const r = i.getBoundingClientRect();
    return { src: (i.getAttribute('src') || '').slice(-40), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
  });
});
console.log('HOME imgs:', JSON.stringify(vids, null, 1).slice(0, 1800));

// find the Daily Videos section precisely
const dv = await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('div')).find((e) => (e.textContent || '').trim() === 'Daily Videos');
  if (!t) return { found: false };
  // ancestors: find one containing >=2 imgs
  let sec = t;
  for (let i = 0; i < 8 && sec; i++) {
    const n = sec.querySelectorAll('img').length;
    if (n >= 2) break;
    sec = sec.parentElement;
  }
  if (!sec) return { found: true, imgs: 0 };
  const imgs = Array.from(sec.querySelectorAll('img'));
  return {
    found: true,
    imgs: imgs.map((i) => {
      const r = i.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { src: (i.getAttribute('src') || '').slice(-30), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), hit: top ? top.tagName + '|' + (top === i ? 'self' : top.textContent.slice(0, 10)) : 'null', contains: top ? i.contains(top) : false };
    }),
  };
});
console.log('DV section:', JSON.stringify(dv, null, 1));
await browser.close();
