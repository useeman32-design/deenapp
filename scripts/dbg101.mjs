import { chromium } from 'playwright-core';
const APP = 'http://127.0.0.1:8099';
const b = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell', args: ['--no-sandbox'] });
// ── ADMIN ──
const ac = await b.newContext({ viewport: { width: 1440, height: 900 } });
const ap = await ac.newPage();
const alogs = [];
ap.on('pageerror', (e) => alogs.push('PAGEERROR ' + (e.stack || e.message || '').slice(0, 400)));
ap.on('console', (m) => alogs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 300)));
ap.on('response', (r) => { if (r.status() >= 400) alogs.push(`HTTP ${r.status()} ${r.url().slice(0, 110)}`); });
await ap.goto(APP + '/admin/login.html', { waitUntil: 'domcontentloaded' }); await ap.waitForTimeout(2000);
await ap.fill('#identifier', 'useeman31@gmail.com'); await ap.fill('#password', 'AdminPass123!');
await ap.click('form button[type="submit"]'); await ap.waitForTimeout(5000);
alogs.length = 0;
await ap.goto(APP + '/admin/video-management.html', { waitUntil: 'domcontentloaded' });
await ap.waitForTimeout(7000);
console.log('=== ADMIN page logs ===');
console.log(alogs.slice(0, 20).join('\n') || '(clean)');
console.log('addDailyVideoBtn exists:', await ap.evaluate(() => !!document.querySelector('#addDailyVideoBtn')));
await ap.click('#addDailyVideoBtn');
await ap.waitForTimeout(1500);
console.log('modal class after click:', await ap.evaluate(() => document.querySelector('#dailyVideoModal')?.className));
console.log('selects populated:', await ap.evaluate(() => ({
  accounts: document.querySelector('#dailyAccountSelect')?.options.length,
  categories: document.querySelector('#dailyCategorySelect')?.options.length,
})));
console.log('logs after click:', alogs.filter((l) => l.startsWith('PAGEERROR') || l.startsWith('HTTP')).slice(0, 8).join(' | ') || '(none)');
await ap.screenshot({ path: '/tmp/pwtest/out/dbg-admin-modal.png' });

// ── APP ──
const uc = await b.newContext({ viewport: { width: 420, height: 900 } });
const up = await uc.newPage();
const ulogs = [];
up.on('pageerror', (e) => ulogs.push('PAGEERROR ' + (e.message || '').slice(0, 200)));
up.on('response', (r) => { if (r.status() >= 400) ulogs.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(APP, '').slice(0, 100)}`); });
await up.goto(APP + '/login', { waitUntil: 'domcontentloaded' }); await up.waitForTimeout(3500);
const f = await up.$$('input'); await f[0].fill('usman_ahmad'); await f[1].fill('Str0ngPass!23');
await up.getByText('Sign In', { exact: true }).first().click().catch(() => {}); await up.waitForTimeout(6000);
ulogs.length = 0;
await up.goto(APP + '/', { waitUntil: 'domcontentloaded' }); await up.waitForTimeout(9000);
console.log('\n=== APP page: non-2xx ===');
console.log([...new Set(ulogs)].slice(0, 12).join('\n') || '(clean)');
const imgs = await up.evaluate(() => [...document.querySelectorAll('img')].map((i) => (i.currentSrc || i.src || '').slice(-52)).filter((s) => /ytimg|uploads/.test(s)).slice(0, 6));
console.log('daily thumbs rendered:', JSON.stringify(imgs));
// real Playwright click on the daily card title
const loc = up.getByText('Admin UI daily (YouTube)', { exact: true }).last();
console.log('card found:', await loc.count());
await loc.click({ timeout: 5000 }).catch((e) => console.log('click err:', String(e).slice(0, 120)));
await up.waitForTimeout(5000);
const modal = await up.evaluate(() => {
  const ifr = document.querySelector('iframe');
  const vid = document.querySelector('video');
  return { iframe: ifr ? ifr.getAttribute('src') : null, hasVideo: !!vid, note: /Now playing on YouTube/i.test(document.body.innerText) };
});
console.log('after tap:', JSON.stringify(modal));
await up.screenshot({ path: '/tmp/pwtest/out/dbg-app-modal.png' });
await b.close();
