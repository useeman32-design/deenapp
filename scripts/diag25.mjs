/* pass-25 diag: mushaf multi-surah pages, loop custom + active icon, recite v2
   (blind, surah mode, wasl), prominent recite-search (quran+hadith), AI redesign
   (drawer, bold refs, NAV, slim suggestions) */
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
const vpTap = async (el) => {
  await page.evaluate((x) => { const e = [...document.querySelectorAll(x.sel)].filter((y) => { const r = y.getBoundingClientRect(); return r.width > 8 && r.y > 60 && r.y < 800; }).pop(); if (e) e.scrollIntoView({ block: 'center' }); }, { sel: el.sel });
  await page.waitForTimeout(250);
  return page.evaluate((x) => { const e = [...document.querySelectorAll(x.sel)].filter((y) => { const r = y.getBoundingClientRect(); return r.width > 8 && r.y > 50 && r.y < 820; }).pop(); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 70), 815) }; }, { sel: el.sel });
};

/* ── 1. mushaf: multi-surah page lays out stacked, not overlapped ── */
await page.goto('http://localhost:3996/deenapp/read/109', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/read/109', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const mushBtn = await vpTap({ sel: 'div,span' }).catch(() => null);
const mush = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Mushaf');
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (mush) { await page.touchscreen.tap(mush.x, mush.y); await page.waitForTimeout(6500); }
let t = await bodyText();
const surahHeads = (t.match(/سُورَةُ/g) || []).length;
const layout = await page.evaluate(() => {
  /* every surah-name pill must sit at a DIFFERENT y (old bug: all stacked at ~85px) */
  const pills = [...document.querySelectorAll('div')].filter((e) => (e.textContent || '').startsWith('سُورَةُ') && (e.textContent || '').length < 42);
  const ys = pills.map((p) => Math.round(p.getBoundingClientRect().y)).filter((y) => y > 0);
  const unique = [...new Set(ys)];
  return { pills: unique.length, ys: unique.slice(0, 8), spread: unique.length > 1 ? Math.max(...unique) - Math.min(...unique) : 0 };
});
ok('mushaf: page 603 has 3 surah headers', surahHeads >= 3, `سُورَةُ x${surahHeads}`);
ok('mushaf: headers STACK vertically (no overlap merge)', layout.pills >= 3 && layout.spread > 200, JSON.stringify(layout.ys));
const basm = (t.match(/بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ/g) || []).length;
ok('mushaf: basmallah on each new surah of the page', basm >= 3, `x${basm}`);
/* recite-page mic exists */
ok('mushaf: RECITE page button present', t.includes('RECITE'));

/* ── 2. loop: custom input + no ∞ on per-ayah, active gold icon ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const loopBtn = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="repeat loop"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
if (loopBtn) {
  await page.touchscreen.tap(loopBtn.x, loopBtn.y);
  await page.waitForTimeout(900);
  t = await bodyText();
  ok('loop: sheet with custom entry', t.includes('REPEAT EACH AYAH') && (await page.locator('[placeholder="custom"]').count()) >= 1);
  const hasInfPerAyah = (t.split('TIMES THROUGH')[0].match(/∞/g) || []).length > 0;
  ok('loop: per-ayah ∞ removed (range keeps it)', !hasInfPerAyah && t.includes('∞'));
  const custom = await page.evaluate(() => { const el = [...document.querySelectorAll('[placeholder="custom"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (custom) { await page.touchscreen.tap(custom.x, custom.y); await page.waitForTimeout(300); await page.keyboard.type('7'); await page.waitForTimeout(400); }
  const start = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span,button')].filter((e) => /^Start loop at/.test((e.textContent || '').trim())); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (start) {
    await page.touchscreen.tap(start.x, start.y);
    await page.waitForTimeout(1200);
    const badge = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="repeat loop"]')].pop(); return el ? el.textContent : ''; });
    ok('loop: active icon shows 7× badge (gold state)', /7×/.test(badge), JSON.stringify(badge));
  } else ok('loop: active icon shows 7× badge (gold state)', false, 'no start btn');
} else ok('loop: sheet with custom entry', false, 'no loop btn');

/* ── 3. recite v2: blind toggle + surah mode from player mic ── */
const micBar = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="recite whole surah"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
if (micBar) {
  await page.touchscreen.tap(micBar.x, micBar.y);
  await page.waitForTimeout(1400);
  t = await bodyText();
  ok('recite: surah-follow mode opens (following N ayahs)', t.includes('Recite Mode') && /following \d+ ayahs/.test(t));
  ok('recite: blind mode toggle present', (await page.locator('[aria-label="toggle blind mode"]').count()) >= 1);
  const eye = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="toggle blind mode"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (eye) { await page.touchscreen.tap(eye.x, eye.y); await page.waitForTimeout(600); t = await bodyText(); ok('recite: BLIND banner shows', t.includes('BLIND MODE')); }
  const closeX = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="close recite mode"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (closeX) { await page.touchscreen.tap(closeX.x, closeX.y); await page.waitForTimeout(800); }
} else ok('recite: surah-follow mode opens (following N ayahs)', false, 'no player mic');

/* ── 4. prominent recite-search on quran + hadith ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 8; i++) { await page.waitForTimeout(1500); t = await bodyText(); if (t.includes('Search or recite a verse')) break; }
ok('quran: prominent search-or-recite button', t.includes('Search or recite a verse'));
const srow2 = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="search or recite"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
if (srow2) {
  await page.touchscreen.tap(srow2.x, srow2.y);
  await page.waitForTimeout(1200);
  t = await bodyText();
  ok('quran: overlay opens with mic + live panel', (await page.locator('[aria-label="recite to search"]').count()) >= 1);
  await page.keyboard.type('الرحمن الرحيم ملك يوم الدين').catch(() => {});
  const inp = page.locator('input').last();
  await inp.fill('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ مَالِكِ يَوْمِ الدِّينِ').catch(() => {});
  await page.waitForTimeout(6000);
  t = await bodyText();
  ok('quran: fuzzy results still work in new overlay', /match/.test(t) || /1:\d/.test(t));
}
await page.goto('http://localhost:3996/deenapp/tools/hadith', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2800);
t = await bodyText();
ok('hadith: prominent search-or-recite button', t.includes('Search or recite a hadith'));

/* ── 5. AI redesign: drawer, slim suggestions, bold refs, NAV ── */
await page.goto('http://localhost:3996/deenapp/tools/ai', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3200);
t = await bodyText();
ok('ai: hamburger present (history top-left)', (await page.locator('[aria-label="Chat history"]').count()) >= 1);
const sugCount = (t.match(/What is Surah Al-Fatiha about\?|dua for guidance|qibla compass\?/g) || []).length;
ok('ai: 3 clean suggestions (not the old 12)', sugCount === 3, `${sugCount} suggestions`);
/* on-device nav answer */
const inp2 = page.locator('[placeholder="Ask anything…"]');
await inp2.fill('Where can I find the qibla compass?');
const sb = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="Send"]')].pop(); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(sb.x, sb.y);
await page.waitForTimeout(2600);
t = await bodyText();
ok('ai: nav answer + OPEN button (on-device)', t.includes('Open Qibla compass'), t.includes('Qibla') ? '' : 'no btn');
/* bold refs: ask on-device fatiha → chips + [Quran …] brackets in text */
await inp2.fill('What is Surah Al-Fatiha about?').catch(() => {});
const sb2 = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="Send"]')].pop(); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(sb2.x, sb2.y);
await page.waitForTimeout(9000);
const refTappable = await page.evaluate(() => [...document.querySelectorAll('div,span')].filter((e) => /^\[Quran \d+ · /.test((e.textContent || '').trim()) || /\[Quran 1 · /.test(e.textContent || '')).length);
ok('ai: bold [Quran …] references render', refTappable >= 1, `${refTappable} ref node(s)`);
/* drawer opens with history */
const burger = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="Chat history"]')].pop(); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(burger.x, burger.y);
await page.waitForTimeout(800);
t = await bodyText();
ok('ai: history drawer slides in with saved chats', t.includes('History') && /qibla compass|Al-Fatiha/.test(t));

/* summary */
console.log('\n===== PASS-25 DIAG =====');
results.forEach((r) => console.log(r));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} passed`);
await browser.close();
srv.kill();
process.exit(fails ? 1 : 0);
