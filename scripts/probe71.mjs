import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:8400/deenapp';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const errs = [];
const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(BASE + '/onboarding', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const r = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].map((i) => { const b = i.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x) }; });
  const over = imgs.filter((b) => b.w > window.innerWidth + 1 || b.x < -1);
  return { count: imgs.length, over, vw: window.innerWidth, first: imgs.slice(0, 4) };
});
console.log('onboarding imgs:', JSON.stringify(r));
console.log('overflow:', r.over.length === 0 ? 'NONE (OK)' : 'FAIL ' + JSON.stringify(r.over));
console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
await browser.close();
