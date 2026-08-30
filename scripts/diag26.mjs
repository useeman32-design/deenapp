/* pass-26 diag: tab order/icons, mushaf not hijacked by recite (tap-gated),
   ReciteSearchModal (glassy live transcript), AI input (16px, no zoom font) */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const srv = spawn('node', ['scripts/pages-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const results = [];
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const bodyText = () => page.evaluate(() => document.body.innerText);

const ensureAuth = async () => {
  await page.waitForTimeout(3000);
  for (let i = 0; i < 3; i++) {
    const t = await bodyText();
    if (!t.includes('Welcome back!')) return;
    const b = await page.evaluate(() => {
      const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === 'Sign In');
      const el = els[els.length - 1];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + 16 };
    });
    if (b) await page.touchscreen.tap(b.x, b.y).catch(() => {});
    await page.waitForTimeout(3000);
  }
};

/* ── 1. tab bar: order restored + free icons (no '?' glyph swapping) ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/community', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/(tabs)/community', { waitUntil: 'domcontentloaded' });
let t = '';
for (let i = 0; i < 10; i++) { await page.waitForTimeout(1500); t = await bodyText(); if (t.includes('Community') && t.includes('Home') && !t.includes('Welcome back!')) break; }
/* read the actual tab strip (bottom of screen) in DOM order */
const stripLabels = await page.evaluate(() => {
  const want = ['Home', 'Quran &', 'Worship', 'Community', 'Profile'];
  const nodes = [...document.querySelectorAll('div,span')].filter((e) => { const r0 = e.getBoundingClientRect(); const x = (e.textContent || '').trim(); return want.includes(x) && r0.top > 690 && r0.height < 30 && ! [...(e.childNodes ?? [])].some((c) => c.nodeType === 1 && want.includes((c.textContent || '').trim())); });
  const uniq = [];
  for (const n of nodes) { const r = n.getBoundingClientRect(); if (!uniq.some((u) => Math.abs(u.x - r.x) < 20)) uniq.push({ x: r.x, label: (n.textContent || '').trim() }); }
  uniq.sort((a, b) => a.x - b.x);
  return uniq.map((u) => u.label);
});
const want = ['Home', 'Quran &', 'Worship', 'Community', 'Profile'];
const seqOk = stripLabels.length === 5 && want.every((w, i) => stripLabels[i] === w);
ok('tabs: order Home→Quran&Hadith→Worship→Community→Profile intact', seqOk, JSON.stringify(stripLabels));
const tabIcons = await page.evaluate(() => {
  const strip = [...document.querySelectorAll('div')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 770 && r.height < 34; });
  const glyphs = strip.filter((e) => { const cs = getComputedStyle(e); return (cs.fontFamily || '').includes('FontAwesome') && (e.textContent || '').trim().length === 1; }).length;
  return glyphs;
});
ok('tabs: 5 tab icons render as real glyphs (no ?)', tabIcons >= 5, `${tabIcons} glyphs`);

/* ── 2. mushaf: opens clean (NO auto recite overlay) ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const mush = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Mushaf');
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (mush) { await page.touchscreen.tap(mush.x, mush.y); await page.waitForTimeout(7000); }
t = await bodyText();
ok('mushaf: page opens WITHOUT the recite overlay', !t.includes('Recite Mode'), t.includes('PAGE 604') ? 'page 604 visible' : '');
ok('mushaf: page content readable', t.includes('سُورَةُ') && t.includes('﴿'));
const recitePill = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim().startsWith('RECITE'));
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
let reciteOpened = false;
if (recitePill) {
  await page.touchscreen.tap(recitePill.x, recitePill.y);
  await page.waitForTimeout(1300);
  t = await bodyText();
  reciteOpened = t.includes('Recite Mode') && /following \d+ ayahs/.test(t);
  const closeX = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="close recite mode"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (closeX) { await page.touchscreen.tap(closeX.x, closeX.y); await page.waitForTimeout(700); }
  t = await bodyText();
  ok('mushaf: closing recite returns to the page', !t.includes('Recite Mode') && t.includes('سُورَةُ'));
}
ok('mushaf: RECITE pill opens page-follow recite only on tap', reciteOpened, recitePill ? '' : 'pill not found');

/* ── 3. glassy recite-search modal ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 8; i++) { await page.waitForTimeout(1500); t = await bodyText(); if (t.includes('Search or recite a verse')) break; }
const srow = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="search or recite"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
let modalOk = false;
if (srow) {
  await page.touchscreen.tap(srow.x, srow.y);
  await page.waitForTimeout(1200);
  const mic = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="recite to search"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, visible: r.y > 0 && r.y < 800 && r.width > 20 }; });
  ok('search: mic visible immediately (no tilt needed)', mic != null && mic.visible, mic ? `at y=${Math.round(mic.y)}` : 'missing');
  if (mic) {
    await page.touchscreen.tap(mic.x, mic.y);
    await page.waitForTimeout(900);
    t = await bodyText();
    modalOk = t.includes('RECITE THE VERSE') && t.includes('your recitation appears here');
    ok('search: glassy recite modal (live transcript card)', modalOk);
    const close = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === '×'); return null; });
    await page.keyboard.press('Escape').catch(() => {});
  }
} else ok('search: mic visible immediately (no tilt needed)', false, 'search row missing');

/* hadith variant */
await page.goto('http://localhost:3996/deenapp/tools/hadith', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
t = await bodyText();
ok('hadith: search-or-recite present', t.includes('Search or recite a hadith'));

/* ── 4. AI input: 16px (no iOS zoom) + clean container ── */
await page.goto('http://localhost:3996/deenapp/tools/ai', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const inp = await page.evaluate(() => {
  const el = [...document.querySelectorAll('textarea,input')].find((x) => (x.placeholder || '') === 'Ask anything…');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { fs: cs.fontSize, font: cs.fontFamily.slice(0, 40) };
});
ok('ai: input is 16px (no iOS focus-zoom)', inp != null && parseFloat(inp.fs) >= 16, inp ? `${inp.fs} ${inp.font}` : 'input missing');
ok('ai: input uses the system font', inp != null && !/Poppins/i.test(inp.font), inp ? inp.font : '');

/* summary */
console.log('\n===== PASS-26 DIAG =====');
results.forEach((r) => console.log(r));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} passed`);
await browser.close();
srv.kill();
process.exit(fails ? 1 : 0);
