/* probe: do hadith chapter lists load? (live or local) */
import { chromium } from 'playwright-core';
const base = process.argv[2] ?? 'http://localhost:3996/deenapp';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const book of ['buhari', 'muslim', 'nawawi40']) {
  await page.goto(`${base}/tools/hadith/${book}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const info = await page.evaluate(() => {
    const t = document.body.innerText;
    return { len: t.length, sample: t.slice(0, 160).replace(/\n/g, ' | '), revelation: t.includes('Revelation') };
  });
  console.log(book, JSON.stringify(info));
}
await browser.close();
