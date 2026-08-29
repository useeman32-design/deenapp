/* final: dense mushaf page 2 (Baqarah start) — fit + single basmallah; audio clean console */
import { chromium } from 'playwright-core';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession', '1'); sessionStorage.clear(); } catch {} });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });

await page.goto('http://localhost:3996/deenapp/read/2', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Mushaf$/.test((e.textContent || '').trim()));
  if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(7000); // fit loop iterates via layout passes
const mush = await page.evaluate(() => {
  const block = [...document.querySelectorAll('div')].find((d) => (d.getAttribute('style') || '').includes('Amiri') && d.scrollHeight > 100);
  if (!block) return { found: false };
  const cs = getComputedStyle(block);
  const pageLabel = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /\/ 604/.test(e.textContent || ''));
  // count basmallah occurrences roughly (first verse + rendered header line)
  const body = document.body.innerText;
  const count = body.split('ٱلرَّحِيمِ').length - 1;
  return { found: true, fontSize: cs.fontSize, lineHeight: cs.lineHeight, scrollH: block.scrollHeight, clientH: block.clientHeight, overflow: cs.overflow, pageLabel: pageLabel?.textContent, rahimCount: count };
});
console.log('PAGE2:', JSON.stringify(mush));
await page.screenshot({ path: '/tmp/fix-mushaf-p2.png' });

// audio again (clean source)
await page.goto('http://localhost:3996/deenapp/read/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((e) => e.textContent?.includes('ٱلْحَمْدُ') && e.textContent.length < 900);
  if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(5000);
const audio = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ src: (v.currentSrc || '').slice(-30), paused: v.paused, t: +v.currentTime.toFixed(1) })));
console.log('AUDIO:', JSON.stringify(audio));
console.log('CONSOLE-ERRORS:', errors.slice(0, 6));
await browser.close();
