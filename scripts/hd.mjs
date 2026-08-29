import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu' } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession','1'); } catch {} });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 150)); });
// serve dist — server may not be running; spin via fetch check
await page.goto('http://localhost:3996/deenapp/tools/hadith/buhari', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
// click a chapter
await page.evaluate(() => {
  const el = [...document.querySelectorAll('div,span')].filter((e) => e.childElementCount === 0 && /\d+\s*$/.test((e.textContent||'').trim()) && e.textContent.includes('1')).find((e)=>e.textContent.trim()==='1');
  const ch = [...document.querySelectorAll('div')].find((d) => (d.textContent||'').includes('Revelation') && d.childElementCount < 12);
  (ch || el)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const t0 = Date.now();
await page.waitForTimeout(14000);
const state = await page.evaluate(() => ({
  textLen: document.body.innerText.length,
  sample: document.body.innerText.slice(0, 200),
  hasHadith: document.body.innerText.includes('حَدَّثَنَا') || document.body.innerText.length > 800,
}));
console.log('after', Date.now()-t0, 'ms:', JSON.stringify(state));
console.log('ERRORS:', errs.slice(0,6));
await browser.close();
