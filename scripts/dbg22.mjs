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
console.log('URL after community click:', page.url());

const dump = await page.evaluate(() => {
  const out = [];
  const alameens = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '@alameen');
  out.push({ nAlameen: alameens.length, ys: alameens.map((e) => Math.round(e.getBoundingClientRect().y)) });
  // top-level app structure
  const root = document.getElementById('root') || document.body.firstElementChild;
  const walk = (el, depth) => {
    if (!el || depth > 3) return;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.height > 100) {
      out.push({ d: depth, tag: el.tagName, id: el.id || '', disp: st.display, pos: st.position, tf: st.transform === 'none' ? '' : st.transform.slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), vis: st.visibility, op: st.opacity, txt: (el.textContent || '').slice(0, 24).replace(/\n/g, ' ') });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(root, 0);
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();
