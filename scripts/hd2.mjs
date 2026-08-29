import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu' } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession','1'); } catch {} });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 250)));
await page.goto('http://localhost:3996/deenapp/tools/hadith/buhari', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(2500);
const clicked = await page.evaluate(() => {
  // chapter rows: leaf text 'Revelation'
  const leaf = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && (e.textContent||'').trim() === 'Revelation');
  if (!leaf) return 'notfound';
  let t = leaf; for (let i=0;i<4;i++){ t = t.parentElement; if (!t) break; if ((t.getAttribute('style')||'').includes('borderRadius')) { t.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'card'; } }
  leaf.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'leaf';
});
console.log('clicked:', clicked);
const t0 = Date.now();
for (let i=0;i<12;i++){
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ len: document.body.innerText.length, arabic: document.body.innerText.includes('حَدَّثَنَا'), loading: document.body.innerText.includes('Loading') }));
  console.log(`${Date.now()-t0}ms`, JSON.stringify(st));
  if (st.arabic) break;
}
console.log('ERRORS:', errs.slice(0,4));
await page.screenshot({ path: '/tmp/hd-book.png' });
await browser.close();
