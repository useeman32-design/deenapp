import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
await page.goto('http://127.0.0.1:8152/deenapp/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const url = page.url();
console.log('URL', url);
const txt = await page.evaluate(() => document.body.innerText);
console.log('HAS Community:', /Community/.test(txt));
console.log('--- first 400 chars of body text ---');
console.log(txt.replace(/\n+/g, ' | ').slice(0, 400));
// dump the tab bar area
const tabs = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && /Community|Home|Profile/.test(d.textContent || ''));
  return els.slice(0, 10).map((e) => ({ txt: e.textContent, cls: (e.className || '').toString().slice(0, 40) }));
});
console.log('tab-ish els:', JSON.stringify(tabs));
await browser.close();
