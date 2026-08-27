import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
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
// scroll mosque into view (community copy)
await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().width > 200 && i.getBoundingClientRect().height > 120);
  for (const i of imgs) i.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(400);
const pt = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().width > 200 && i.getBoundingClientRect().height > 120);
  for (const i of imgs) {
    const r = i.getBoundingClientRect();
    if (r.y < 60 || r.y > 780) continue;
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (top && (i === top || i.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }
  return null;
});
// double tap
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(110);
await page.mouse.click(pt.x, pt.y);
// sample the burst overlay at several times
for (const t of [150, 350, 600, 900, 1400]) {
  await page.waitForTimeout(t === 150 ? 150 : t - (t === 350 ? 150 : t === 600 ? 350 : t === 900 ? 600 : 900));
  const st = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div')).filter((d) => {
      const s = getComputedStyle(d);
      return s.pointerEvents === 'none' && s.position === 'absolute' && s.transform.startsWith('matrix') && (d.getAttribute('style') || '').includes('opacity');
    });
    return divs.map((d) => ({ op: getComputedStyle(d).opacity, tf: getComputedStyle(d).transform.slice(7, 16), y: Math.round(d.getBoundingClientRect().y) })).filter((o) => o.op !== '0');
  });
  console.log(`t=${t}ms animated:`, JSON.stringify(st));
  if (t === 350) await page.screenshot({ path: '/tmp/p12-burst-350.png' });
}
await browser.close();
