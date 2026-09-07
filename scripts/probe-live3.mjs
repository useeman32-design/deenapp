import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto('https://app.deenlink.org/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const msgs = await page.evaluate(() => {
  const out = {};
  for (const u of ['//', '//tabs', 'https:', '/https:/x']) {
    try { history.replaceState({}, '', u); out[u] = 'OK -> ' + location.href; history.replaceState({}, '', '/'); }
    catch (e) { out[u] = 'ERR: ' + e.message.slice(0, 130); }
  }
  return out;
});
console.log(JSON.stringify(msgs, null, 2));
await browser.close();
