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
const chatBtn = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll('path')).filter((p) => (p.getAttribute('d') || '').startsWith('M4 5.6 H20'));
  for (const p of paths) {
    const svg = p.closest('svg');
    let el = svg;
    while (el) {
      const r = el.getBoundingClientRect();
      if (r.height > 18 && r.height < 45 && r.width > 10 && r.width < 60 && r.y > 0 && r.y < 844) {
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (top && (el === top || el.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      el = el.parentElement;
    }
  }
  return null;
});
await page.mouse.click(chatBtn.x, chatBtn.y);
await page.waitForTimeout(1000);

const tree = await page.evaluate(() => {
  // find the Comments sheet root: the KAV container (has Comments header + input)
  const inp = document.querySelector('input[placeholder="Add a comment\u2026"]') || document.querySelector('input[placeholder^="Add a comment"]');
  if (!inp) return 'no input';
  let sheet = inp;
  for (let i = 0; i < 6 && sheet; i++) sheet = sheet.parentElement;
  if (!sheet) return 'no sheet';
  const out = [];
  const walk = (el, depth) => {
    if (depth > 14) return;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width > 2 || r.height > 2) {
      out.push(`${'  '.repeat(depth)}${el.tagName}[${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] fd=${st.flexDirection} of=${st.overflowX}/${st.overflowY} :: ${(el.textContent || '').slice(0, 26).replace(/\n/g, ' ')}`);
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(sheet, 0);
  return out.join('\n');
});
console.log(tree);
await browser.close();
