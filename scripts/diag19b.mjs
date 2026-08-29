/* verify pass-19 fixes: audio element + playback, mushaf fit, fonts */
import { chromium } from 'playwright-core';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  env: { ...process.env, LD_LIBRARY_PATH: D },
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession', '1'); sessionStorage.clear(); } catch {} });

const audioReqs = [];
page.on('request', (r) => { if (r.url().includes('islamic.network')) audioReqs.push(r.url().slice(-40)); });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text().slice(0, 150)); });

await page.goto('http://localhost:3996/deenapp/read/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3500);

// tap ayah 1 card
const tapped = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')];
  const el = els.find((e) => e.textContent?.includes('ٱلْحَمْدُ') && e.textContent.length < 900);
  if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
  return false;
});
await page.waitForTimeout(7000);
const audio = await page.evaluate(() => {
  const vids = [...document.querySelectorAll('video')].map((v) => ({
    src: (v.currentSrc || v.src || '').slice(-45),
    paused: v.paused, t: +v.currentTime.toFixed(2), dur: +(+v.duration || 0).toFixed(1),
    ready: v.readyState, err: v.error ? v.error.code : null, muted: v.muted,
  }));
  return vids;
});
console.log('TAPPED:', tapped);
console.log('VIDEOS:', JSON.stringify(audio));
console.log('AUDIO-REQS:', audioReqs.slice(0, 5));
await page.screenshot({ path: '/tmp/fix-reader-playing.png' });

// mushaf: switch mode, wait for page fetch
await page.evaluate(() => {
  const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Mushaf$/.test((e.textContent || '').trim()));
  if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(6000);
const mush = await page.evaluate(() => {
  const texts = [...document.querySelectorAll('div')].filter((d) => (d.getAttribute('style') || '').includes('Amiri') && d.scrollHeight > 100);
  const clipped = texts.filter((d) => d.scrollHeight > d.clientHeight + 8 && getComputedStyle(d).overflow !== 'visible');
  const fs = texts[0] ? getComputedStyle(texts[0]).fontSize : null;
  const pageLabel = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /\/ 604/.test(e.textContent || ''));
  const doubleBasm = document.body.innerText.split('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ').length - 1;
  return { blocks: texts.length, clipped: clipped.length, fontSize: fs, pageLabel: pageLabel?.textContent, basmallahCount: doubleBasm };
});
console.log('MUSHAF:', JSON.stringify(mush));
await page.screenshot({ path: '/tmp/fix-mushaf.png' });

// fonts: english translation + arabic spans carry proper families now?
const fonts = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span,div')].filter((e) => (e.getAttribute('style') || '').includes('font-family'));
  const fams = {};
  spans.forEach((s) => { const m = (s.getAttribute('style') || '').match(/font-family:\s*'?([^;'\"]+)/); if (m) fams[m[1].trim()] = (fams[m[1].trim()] || 0) + 1; });
  return { fams, amiriLoaded: document.fonts.check('21px Amiri'), poppinsLoaded: document.fonts.check('13.5px Poppins-Medium') };
});
console.log('FONTS:', JSON.stringify(fonts));
await browser.close();
