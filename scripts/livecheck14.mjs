import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'https://useeman32-design.github.io/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session','demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded','1'); localStorage.setItem('dl.demoSession','1'); } catch {} }, user);
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }), headers: { 'Set-Cookie': 'deenlink_session=demo-session-token; Path=/' } });
    return route.abort();
  }
  return route.continue();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 150)));
// home
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const home = await page.evaluate(() => document.body.innerText);
console.log('home renders:', home.includes('Assalamu Alaikum'));
// quran hub (redesigned)
await page.goto(BASE + '/quran', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);
const q = await page.evaluate(() => document.body.innerText);
console.log('quran hub:', q.includes("The Holy Qur'an") && q.includes('Hadith Collections'));
// videos deep link (pass-14 UI)
await page.goto(BASE + '/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
const v = await page.evaluate(() => document.body.innerText);
console.log('videos: For-you pill:', v.includes('For you'), '| bottom pill:', v.includes('Saved') && v.includes('Create') && v.includes('Sound'), '| chevron-glyph:', await page.evaluate(() => Array.from(document.querySelectorAll('div')).some((d) => d.children.length === 0 && (d.textContent || '').trim() === '\uf053' && d.getBoundingClientRect().x < 80)));
await page.screenshot({ path: '/home/user/shots-pass14/LIVE-videos.png' });
await browser.close();
