import { chromium } from 'playwright-core';
const BASE = 'http://app.deenlink.org';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 140)));
page.on('request', (r) => { const u = r.url(); if (u.includes('8201')) console.log('REQ:', r.method(), u.slice(22, 110)); });
page.on('response', async (r) => { const u = r.url(); if (u.includes('search_accounts')) { console.log('SEARCH RESP:', r.status(), (await r.text().catch(() => '')).slice(0, 150)); } });
page.on('requestfailed', (r) => { const u = r.url(); if (u.includes('8201')) console.log('REQ FAILED:', u.slice(22, 110), r.failure()?.errorText); });

// 1. login through the APP UI (so the bundle's own live flag flips)
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const inputs = await page.$$('input');
console.log('login inputs:', inputs.length);
await inputs[0].fill('av73a1788719849@t.co');
await inputs[1].fill('Str0ngPass!23');
const signin = page.getByText('Sign In', { exact: true }).first();
if (await signin.count()) await signin.click(); else await inputs[1].press('Enter');
await page.waitForTimeout(7000);
console.log('after login URL:', page.url());
if (page.url().includes('/login')) {
  console.log('LOGIN PAGE TEXT:', (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 220));
}

// 2. reload app → search
await page.goto(BASE + '/tools/search', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const si = await page.$$('input');
if (si.length) await si[0].fill('carol71');
await page.waitForTimeout(3500);
console.log('TOP TAB:', (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 260));

// click Users tab
const usersTab = page.getByText('Users', { exact: true }).first();
if (await usersTab.count()) { await usersTab.click(); await page.waitForTimeout(3000); }
const usersTxt = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 300);
console.log('USERS TAB:', usersTxt);

// 3. tap account row
const row = page.getByText(/@carol71/).first();
if (await row.count()) {
  await row.click();
  await page.waitForTimeout(5000);
  const body2 = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 300);
  console.log('PROFILE URL:', page.url());
  console.log('PROFILE PAGE:', body2);
  console.log(body2.includes('couldn') ? '>>> BUG REPRODUCED' : '>>> profile loaded OK');
} else {
  console.log('>>> no account row');
}
await browser.close();
