import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox','--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu' } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession','1'); sessionStorage.clear(); } catch {} });
await page.goto('http://localhost:3996/deenapp/read/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const faces = [...document.fonts].map(f => `${f.family}|${f.weight}|${f.status}`);
  // find the arabic verse block
  const ar = [...document.querySelectorAll('div')].find(d => d.textContent?.includes('ٱلْحَمْدُ') && d.textContent.length < 800);
  const cs = ar ? getComputedStyle(ar.querySelector('div,span') || ar) : null;
  return { faces, arabicFont: cs?.fontFamily?.slice(0,80), arabicSize: cs?.fontSize };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: '/tmp/diag-reader2.png' });
await browser.close();
