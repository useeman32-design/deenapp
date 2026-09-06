import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200)));
await page.addInitScript(() => {
  const orig = window.history.replaceState.bind(window.history);
  window.history.replaceState = function (state, title, url) {
    const u = String(url);
    if (!u.startsWith('/') && !u.startsWith('http')) (window.__bad = window.__bad || []).push(u);
    return orig(state, title, url);
  };
});
await page.goto('http://127.0.0.1:8399/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);
const rootLen = await page.evaluate(() => (document.getElementById('root')?.innerHTML ?? '').length);
const bad = await page.evaluate(() => window.__bad || []);
console.log('BOOT root innerHTML length:', rootLen);
console.log('bad replaceState urls:', JSON.stringify(bad));
console.log('pageerrors:', errs.length ? errs.join(' ; ') : 'none');
// navigate client-side through expo-router
for (const href of ['/onboarding', '/tools/search', '/community']) {
  try {
    await page.evaluate((h) => { window.history.pushState({}, '', h); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, href);
    await page.waitForTimeout(4500);
    const info = await page.evaluate(() => ({ len: document.getElementById('root').innerHTML.length, txt: document.body.innerText.slice(0, 90).replace(/\n+/g, ' | ') }));
    console.log(`NAV ${href} -> len ${info.len} :: ${info.txt}`);
  } catch (e) { console.log(`NAV ${href} ERR ${String(e).slice(0, 120)}`); }
}
console.log('final pageerrors:', errs.length ? errs.join(' ; ') : 'none');
await browser.close();
