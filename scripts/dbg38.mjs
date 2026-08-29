import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); localStorage.setItem('dl.demoSession', '1'); sessionStorage.setItem('dl.splash.seen', '1'); } catch {} }, user);
await ctx.route('**/*', async (route) => { const u = route.request().url(); if (u.includes('deenlink.org')) { if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) }); return route.abort(); } return route.continue(); });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const clickTab = async (label) => {
  const p = await page.evaluate((l) => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === l);
    const vis = el.filter((d) => d.getBoundingClientRect().y > 700);
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (p) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(2200); }
  const t = await page.evaluate(() => document.body.innerText.slice(0, 60));
  console.log(label, '→', JSON.stringify(t).slice(0, 70), '| url', page.url().slice(-22));
};
await clickTab('Quran &');
const dom = await page.evaluate(() => ({
  text: document.body.innerText.length,
  hasQuran: document.body.innerText.includes('Holy Qur'),
  hasDailyAyah: document.body.innerText.includes('DAILY AYAH'),
  divs: document.querySelectorAll('div').length,
}));
console.log('DOM probe:', JSON.stringify(dom));
await page.screenshot({ path: '/tmp/dbg-quran.png' });
await clickTab('Profile');
const dom2 = await page.evaluate(() => ({
  htmlHasProfile: (document.body.innerHTML || '').includes('My Posts'),
  hasCheckIn: document.body.innerText.includes('Check In'),
  hasSettingsTab: document.body.innerText.includes('Sign out') || document.body.innerText.includes('Appearance'),
  textHasProfile: document.body.innerText.includes('abdalrahman'),
  textLen: document.body.innerText.length,
  first120: document.body.innerText.slice(0, 120),
}));
console.log('after profile:', JSON.stringify(dom2));
await browser.close();
