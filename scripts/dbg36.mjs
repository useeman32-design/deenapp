import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-features=VaapiVideoDecoder,VaapiVideoEncodeLinuxGL', '--js-flags=--max-old-space-size=1024'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); localStorage.setItem('dl.demoSession', '1'); } catch {} }, user);
await ctx.route('**/*', async (route) => { const u = route.request().url(); if (u.includes('deenlink.org')) { if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }), headers: { 'Set-Cookie': 'deenlink_session=demo-session-token; Path=/' } }); return route.abort(); } return route.continue(); });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
page.on('crash', () => console.log('PAGE CRASH'));
try {
  const resp = await page.goto(BASE + '/', { waitUntil: 'commit', timeout: 15000 });
  console.log('status', resp.status());
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 700));
    let alive = true;
    try { await page.evaluate(() => document.readyState); } catch (e) { alive = false; console.log(e.message.slice(0, 4000)); break; }
    const txt = await page.evaluate(() => (document.body && document.body.innerText ? document.body.innerText.slice(0, 60) : '(empty body)')).catch(() => 'eval-fail');
    console.log(i, JSON.stringify(txt));
  }
} catch (e) { console.log('GOTO ERR', e.message.slice(0, 200)); }
await browser.close();
