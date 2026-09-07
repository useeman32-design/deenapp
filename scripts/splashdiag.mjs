/* pass-21 diag: does the video splash actually render + play? (fresh session + reload) */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const srv = spawn('node', ['scripts/pages-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

const probe = async (label) => {
  const info = await page.evaluate(() => {
    const vids = [...document.querySelectorAll('video')].map((v) => ({
      src: (v.currentSrc || v.src || '').slice(-60),
      ready: v.readyState, t: +v.currentTime.toFixed(2), paused: v.paused, w: v.videoWidth, h: v.videoHeight,
    }));
    return { bg: vids.length ? 'has-video' : 'no-video-element', vids, bodyLen: document.body.innerText.length };
  }).catch((e) => ({ err: String(e) }));
  console.log(label, JSON.stringify(info).slice(0, 400));
};

await page.goto('http://localhost:3996/deenapp/', { waitUntil: 'domcontentloaded' });
await probe('t+0.6s:'); await page.waitForTimeout(900); await probe('t+1.5s:');
await page.screenshot({ path: '/tmp/splash-fresh.png' });
await page.waitForTimeout(2600); await probe('t+4.1s:');
await page.screenshot({ path: '/tmp/splash-after.png' });
/* second load — sessionStorage warm (what the user's iOS tab effectively is) */
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await probe('reload t+1.2s:');
await page.screenshot({ path: '/tmp/splash-reload.png' });

await browser.close(); srv.kill();
console.log('done');
