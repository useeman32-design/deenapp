/* Pass-19 diagnostics: fonts + audio + mushaf, on the local subpath build. */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3996/deenapp';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  env: { ...process.env, LD_LIBRARY_PATH: D },
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const consoleMsgs = [];
page.on('console', (m) => {
  const t = m.type();
  if (t === 'error' || t === 'warning') consoleMsgs.push(`[${t}] ${m.text().slice(0, 220)}`);
});
const badReqs = [];
page.on('response', (r) => {
  if (r.status() >= 400) badReqs.push(`${r.status()} ${r.url().slice(-90)}`);
});
page.on('requestfailed', (r) => badReqs.push(`FAIL ${r.failure()?.errorText} ${r.url().slice(-90)}`));

const shot = async (name) => page.screenshot({ path: `/tmp/diag-${name}.png` });

// seed demo session
await page.addInitScript(() => {
  try { sessionStorage.clear(); localStorage.setItem('dl.demoSession', '1'); } catch {}
});

// ---------- 1. HOME: fonts ----------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4500); // let splash clear
await shot('home');
const fontInfo = await page.evaluate(() => {
  const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  const probe = (sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).fontFamily.slice(0, 60) : 'n/a';
  };
  return {
    loadedFamilies: [...new Set(loaded)],
    body: getComputedStyle(document.body).fontFamily.slice(0, 60),
    anyText: probe('div[id]'),
    canvasCount: document.querySelectorAll('canvas').length,
  };
});
console.log('FONTS:', JSON.stringify(fontInfo, null, 1));

// ---------- 2. READER /read/1: audio probe ----------
await page.goto(`${BASE}/read/1`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3500);
await shot('reader-initial');
// tap the first ayah card (playSurah) — divs with onPress; find by text of ayah 1 arabic
const tapped = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')];
  const el = els.find((e) => e.textContent?.includes('ٱلْحَمْدُ') && e.textContent.length < 900);
  if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
  return false;
});
console.log('TAPPED AYAH 1:', tapped);
await page.waitForTimeout(6000); // give it time to fetch + play
await shot('reader-after-tap');
const audioProbe = await page.evaluate(() => {
  const vids = [...document.querySelectorAll('video')].map((v) => ({
    src: (v.currentSrc || v.src || '').slice(-70),
    paused: v.paused,
    t: +(v.currentTime.toFixed(2)),
    dur: +(+v.duration || 0).toFixed(2),
    ready: v.readyState,
    err: v.error ? `${v.error.code}/${v.error.message?.slice(0, 60)}` : null,
    muted: v.muted,
    vol: v.volume,
  }));
  const auds = [...document.querySelectorAll('audio')].map((a) => ({ src: (a.currentSrc || a.src).slice(-70), paused: a.paused, t: +a.currentTime.toFixed(2) }));
  return { vids, auds };
});
console.log('AUDIO:', JSON.stringify(audioProbe, null, 1));
console.log('AUDIO-NET:', badReqs.filter((r) => r.includes('islamic.network')).slice(0, 6));
console.log('CONSOLE:', consoleMsgs.slice(0, 12));

// ---------- 3. MUSHAF ----------
await page.goto(`${BASE}/read/2`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
// switch to mushaf mode via the toggle (says 'Mushaf' when in reading mode)
const switched = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')];
  const el = els.find((e) => e.childElementCount === 0 && /Mushaf/.test(e.textContent || ''));
  if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
  return false;
});
await page.waitForTimeout(4000); // page fetch from alquran.cloud
await shot('mushaf-p2');
const mushProbe = await page.evaluate(() => {
  // find the big arabic text block
  const big = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > 600).map((d) => ({ h: d.scrollHeight, clip: getComputedStyle(d).overflow, kids: d.childElementCount }));
  const hasClipped = big.some((b) => b.clip === 'hidden' || b.clip === 'clip');
  return { bigBlocks: big.slice(0, 4), hasClipped };
});
console.log('MUSHAF:', JSON.stringify(mushProbe, null, 1));
console.log('MUSHAF-NET:', badReqs.filter((r) => r.includes('alquran')).slice(0, 5));
console.log('ALL-BAD-REQS:', [...new Set(badReqs)].slice(0, 12));

await browser.close();
console.log('done');
