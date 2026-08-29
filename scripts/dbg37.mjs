import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); localStorage.setItem('dl.demoSession', '1'); sessionStorage.setItem('dl.splash.seen', '1'); } catch {} }, user);
await ctx.route('**/*', async (route) => { const u = route.request().url(); if (u.includes('deenlink.org')) { if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) }); return route.abort(); } return route.continue(); });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const t0 = await page.evaluate(() => document.body.innerText.slice(0, 120));
console.log('DIRECT /profile:', JSON.stringify(t0));
// find ALL leaf 'Profile' texts + their positions
const probes = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div'));
  return els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Profile').map((d) => { const r = d.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
});
console.log('Profile leaves:', JSON.stringify(probes));
// tab bar slot rects (icons row)
const slots = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div'));
  const row = els.filter((d) => d.children.length >= 5 && d.getBoundingClientRect().y > 700 && d.getBoundingClientRect().height < 90);
  return row.length ? { y: Math.round(row[row.length - 1].getBoundingClientRect().y), h: Math.round(row[row.length - 1].getBoundingClientRect().height), kids: row[row.length - 1].children.length } : null;
});
console.log('tab row:', JSON.stringify(slots));
// click the last Profile leaf
const p = probes[probes.length - 1];
if (p) { await page.mouse.click(p.x + p.w / 2, p.y + p.h / 2); await page.waitForTimeout(2500); }
const t = await page.evaluate(() => document.body.innerText.slice(0, 150));
console.log('AFTER CLICK url:', page.url().slice(-30), 'text:', JSON.stringify(t));
await page.screenshot({ path: '/tmp/dbg-profile.png' });
await browser.close();
