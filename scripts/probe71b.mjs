import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:8400/deenapp';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const errs = [];
const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const r = await page.evaluate(() => {
  const svg = document.querySelector('svg');
  const paths = svg ? svg.querySelectorAll('path').length : 0;
  const imgs = [...document.querySelectorAll('img')].map((i) => { const b = i.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }).filter((b) => b.w === b.h && b.w > 40 && b.w < 200);
  return { svgPaths: paths, logoBoxes: imgs.slice(0, 2) };
});
console.log('google G svg paths:', r.svgPaths, r.svgPaths >= 4 ? 'OK (4-colour)' : 'CHECK');
console.log('logo box:', JSON.stringify(r.logoBoxes));
console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
await browser.close();
