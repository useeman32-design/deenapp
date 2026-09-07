import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const orig = window.history.replaceState.bind(window.history);
  window.history.replaceState = function (state, title, url) {
    try {
      const u = String(url);
      if (!u.startsWith('/') && !u.startsWith('http')) {
        window.__rsCalls = window.__rsCalls || [];
        window.__rsCalls.push({ url: u, stack: new Error().stack.split('\n').slice(1, 8).join(' | ') });
      }
    } catch {}
    return orig(state, title, url);
  };
  window.addEventListener('error', (e) => {
    window.__errStack = (e.error && e.error.stack) || e.message;
  });
});
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.goto('https://app.deenlink.org/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(8000);
const calls = await page.evaluate(() => window.__rsCalls || []);
const es = await page.evaluate(() => window.__errStack || '');
console.log('bad replaceState calls:', JSON.stringify(calls, null, 2).slice(0, 1800));
console.log('ERROR STACK:', String(es).slice(0, 1600));
await browser.close();
