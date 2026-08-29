import { chromium } from 'playwright-core';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession', '1'); sessionStorage.clear(); } catch {} });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));

await page.goto('http://localhost:3996/deenapp/read/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(5000);
const t = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('READER-TEXT:', JSON.stringify(t.slice(0, 500)));
await page.screenshot({ path: '/tmp/p20-reader.png' });
console.log('ERRORS:', errs.slice(0, 6));
await browser.close();
