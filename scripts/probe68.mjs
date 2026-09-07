import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const errs = [];
async function probe(name, base) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`[${name}] PAGEERROR: ${String(e).slice(0, 160)}`));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(9000);
  const boot = await page.evaluate(() => document.getElementById('root').innerHTML.length);
  console.log(`${name} BOOT root len: ${boot}`);
  const nav = async (href) => {
    await page.evaluate((h) => { window.history.pushState({}, '', h); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, href);
    await page.waitForTimeout(4200);
    return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 110));
  };
  console.log(`${name} /tools/search idle ::`, await nav('/tools/search'));
  // type into the search box → tabs appear
  const box = page.locator('input').first();
  if (await box.count()) { await box.fill('a'); await page.waitForTimeout(3500); }
  const tabs = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 130));
  console.log(`${name} /tools/search q=a ::`, tabs);
  // click Users tab
  const usersTab = page.locator('text=Users').first();
  if (await usersTab.count()) { await usersTab.click(); await page.waitForTimeout(3000); }
  console.log(`${name} Users tab ::`, await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 130)));
  console.log(`${name} /tools/notifications ::`, await nav('/tools/notifications'));
  console.log(`${name} /tools/inbox ::`, await nav('/tools/inbox'));
  await ctx.close();
}
await probe('ROOT', 'http://127.0.0.1:8399/');
await probe('GH', 'http://127.0.0.1:8400/deenapp/');
console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
await browser.close();
