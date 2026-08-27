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
await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  const img = imgs.find((i) => /be9c8240/.test(i.getAttribute('src') || '') && i.getBoundingClientRect().width > 250);
  img && img.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(400);
const cov = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  const img = imgs.find((i) => /be9c8240/.test(i.getAttribute('src') || '') && i.getBoundingClientRect().width > 250);
  const r = img.getBoundingClientRect();
  const pts = [[r.x + r.width/2, r.y + r.height/2], [r.x + 20, r.y + 20], [r.x + r.width - 20, r.y + 20], [r.x + 20, r.y + r.height - 20]];
  return pts.map(([x, y]) => {
    const top = document.elementFromPoint(x, y);
    const chain = [];
    let el = top;
    for (let k = 0; k < 5 && el; k++) {
      const st = getComputedStyle(el);
      chain.push(el.tagName + (el === img ? '=IMG' : '') + ' pe=' + st.pointerEvents + ' ' + (el.getAttribute('style')||'').slice(0, 30));
      el = el.parentElement;
    }
    return { x: Math.round(x), y: Math.round(y), hitImg: top === img || (img.contains && img.contains(top)), chain };
  });
});
console.log(JSON.stringify(cov, null, 1));
await browser.close();
