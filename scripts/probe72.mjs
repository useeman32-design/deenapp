import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:8400/deenapp';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
let bad = 0;
for (const route of ['/login', '/videos', '/tools/courses', '/tools/charity', '/read/1']) {
  const errs = [];
  const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
  page.on('pageerror', (e) => { const s = String(e); if (s.includes('NotAllowedError')) return; errs.push(s.slice(0, 160)); });
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const r = await page.evaluate(() => {
    const root = document.querySelector('#root') || document.body;
    return { text: (root.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90), nodes: root.querySelectorAll('*').length };
  });
  const ok = r.nodes > 40 && errs.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${route} nodes=${r.nodes} :: ${r.text}`);
  if (errs.length) console.log('   ERRORS: ' + errs.join(' | '));
  await page.context().close();
}
await browser.close();
console.log(bad ? `PROBE FAILED (${bad})` : 'PROBE ALL OK');
process.exit(bad ? 1 : 0);
