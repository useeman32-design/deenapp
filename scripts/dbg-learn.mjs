import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// 1. cold-load the learning URL directly (deep link)
await page.goto('https://useeman32-design.github.io/deenapp/tools/learning', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const t1 = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '));
console.log('DEEP LINK:', t1.slice(0, 220));

// 2. from root: dismiss splash → find a Learning entry
await page.goto('https://useeman32-design.github.io/deenapp/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const t2 = await page.evaluate(() => document.body.innerText.slice(0, 600).replace(/\n+/g, ' | '));
console.log('ROOT:', t2.slice(0, 300));
await browser.close();
