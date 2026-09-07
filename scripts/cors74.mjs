import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await (await browser.newContext()).newPage();
page.on('console', (m) => console.log('CONSOLE:', m.text().slice(0, 200)));
await page.goto('http://127.0.0.1:8402/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const out = await page.evaluate(async () => {
  try {
    const r = await fetch('http://127.0.0.1:8201/api/users/search_accounts.php?q=carol71&limit=10', { credentials: 'include' });
    const j = await r.json();
    return { ok: true, status: r.status, n: (j.results || []).length };
  } catch (e) { return { ok: false, err: String(e).slice(0, 160) }; }
});
console.log('PAGE FETCH:', JSON.stringify(out));
await browser.close();
