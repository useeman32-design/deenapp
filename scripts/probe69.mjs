import { chromium } from 'playwright-core';
/* pass 69 gate — boot + the new/rewired screens on the gh-pages build.
 * usage: node scripts/probe69.mjs [base]   (default GH pages-server) */
const BASE = process.argv[2] ?? 'http://127.0.0.1:8400/deenapp';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(`PAGEERROR: ${String(e).slice(0, 160)}`));

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);
const boot = await page.evaluate(() => document.getElementById('root').innerHTML.length);
console.log('BOOT root len:', boot, boot > 2000 ? 'OK' : 'FAIL');

const nav = async (href, wait = 4200) => {
  await page.evaluate((h) => { window.history.pushState({}, '', h); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, BASE + href);
  await page.waitForTimeout(wait);
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 150));
};

const dp = await nav('/tools/deenpoints');
console.log('/tools/deenpoints ::', dp);
console.log('deenpoints has 500 preset + ledger:', /500/.test(dp) && /LEDGER|Ledger|history|History/i.test(dp) ? 'OK' : 'CHECK');

const fw = await nav('/tools/fatwa');
console.log('/tools/fatwa ::', fw);
console.log('fatwa chips visible:', /Ask|ASK/.test(fw) && /islamqa|Rulings|RULINGS/i.test(fw) ? 'OK' : 'CHECK');

const pr = await nav('/tools/prophets');
console.log('/tools/prophets ::', pr);
const sr = await nav('/tools/seerah');
console.log('/tools/seerah ::', sr);
const hd = await nav('/tools/hadith');
console.log('/tools/hadith ::', hd);

console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
await browser.close();
