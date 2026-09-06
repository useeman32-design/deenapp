import { chromium } from 'playwright-core';
const BASE = process.argv[2] ?? 'http://127.0.0.1:8400/deenapp';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const errs = [];
const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const nav = async (h, w = 5000) => { await page.evaluate((x) => { window.history.pushState({}, '', x); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, BASE + h); await page.waitForTimeout(w); return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)); };
console.log('/videos ::', await nav('/videos'));
console.log('/tools/suggestions ::', await nav('/tools/suggestions'));
console.log('/tools/search ::', await nav('/tools/search'));
const box = page.locator('input').first();
if (await box.count()) { await box.fill('ali'); await page.waitForTimeout(3000); }
const usersTab = page.locator('text=Users').first();
if (await usersTab.count()) { await usersTab.click(); await page.waitForTimeout(3000); }
console.log('search users tab ::', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)));
console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
await browser.close();
