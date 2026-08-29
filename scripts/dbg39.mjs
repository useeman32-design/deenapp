import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.argv[2] || 'https://useeman32-design.github.io/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); localStorage.setItem('dl.demoSession', '1'); sessionStorage.setItem('dl.splash.seen', '1'); } catch {} }, user);
await ctx.route('**/*', async (route) => { const u = route.request().url(); if (u.includes('deenlink.org')) { if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) }); return route.abort(); } return route.continue(); });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const homeLen = await page.evaluate(() => document.body.innerText.length);
const clickTab = async (label) => {
  const p = await page.evaluate((l) => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === l);
    const vis = el.filter((d) => d.getBoundingClientRect().y > 700);
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (p) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(2400); }
  return await page.evaluate(() => document.body.innerText.length);
};
const quranLen = await clickTab('Quran &');
const profLen = await clickTab('Profile');
console.log(JSON.stringify({ base: BASE.slice(0, 40), homeLen, quranLen, profLen }));
await browser.close();
