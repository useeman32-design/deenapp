import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const url of ['https://app.deenlink.org/', 'https://useeman32-design.github.io/deenapp/']) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) { errs.push('NAV: ' + String(e).slice(0, 150)); }
  await page.waitForTimeout(9000);
  const rootHtmlLen = await page.evaluate(() => (document.getElementById('root')?.innerHTML ?? '').length);
  console.log('=== ' + url);
  console.log('root innerHTML length:', rootHtmlLen);
  errs.slice(0, 6).forEach((e) => console.log(e));
  await ctx.close();
}
await browser.close();
