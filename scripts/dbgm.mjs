import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const srv = spawn('node', ['scripts/pages-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto('http://localhost:3996/deenapp/read/109', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
for (let i = 0; i < 3; i++) { const t = await page.evaluate(() => document.body.innerText); if (!t.includes('Welcome back!')) break; const b = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === 'Sign In'); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 16 }; }); if (b) await page.touchscreen.tap(b.x, b.y); await page.waitForTimeout(3000); }
await page.goto('http://localhost:3996/deenapp/read/109', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const mush = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Mushaf'); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
if (mush) { await page.touchscreen.tap(mush.x, mush.y); await page.waitForTimeout(6000); }
const probe = await page.evaluate(() => {
  const out = { scrolls: 0, segHeights: [], bodyScrollH: document.body.scrollHeight, viewportH: window.innerHeight, pills: 0, basm: 0, overlaps: [] };
  out.scrolls = [...document.querySelectorAll('div')].filter((e) => e.style.overflowY === 'auto' || e.style.overflowY === 'scroll').length;
  const pills = [...document.querySelectorAll('div')].filter((e) => (e.textContent || '').startsWith('سُورَةُ') && e.textContent.length < 40);
  out.pills = pills.length;
  out.basm = (document.body.innerText.match(/بِسْمِ/g) || []).length;
  for (const p of pills) { const r = p.getBoundingClientRect(); out.segHeights.push(Math.round(r.y)); }
  return out;
});
console.log(JSON.stringify(probe, null, 1));
await browser.close(); srv.kill();
