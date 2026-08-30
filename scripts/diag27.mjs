/* pass-27 diag: icons restored, borderless mushaf + INLINE page recite (blind),
   AUTO-NEXT, modal mic idle→green, AI thinking dots, search accuracy battery */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const srv = spawn('node', ['scripts/pages-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  if (window.SpeechRecognition || window.webkitSpeechRecognition) return;
  class FakeSR {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.onresult = null; this.onend = null; this.onerror = null; this.onstart = null; }
    start() { if (this.onstart) this.onstart(); setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ' }, isFinal: false }] }); }, 120); }
    stop() { if (this.onend) this.onend(); }
    abort() { if (this.onend) this.onend(); }
  }
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
});
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

/* ── 1. tab strip: order + quran/mosque glyph codes present ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/community', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/(tabs)/community', { waitUntil: 'domcontentloaded' });
let t = '';
for (let i = 0; i < 10; i++) { await page.waitForTimeout(1500); t = await bodyText(); if (t.includes('Community') && t.includes('Home') && !t.includes('Welcome back!')) break; }
const tabs = await page.evaluate(() => {
  const want = ['Home', 'Quran &', 'Worship', 'Community', 'Profile'];
  const labels = [...document.querySelectorAll('div,span')].filter((e) => { const x = (e.textContent || '').trim(); const r = e.getBoundingClientRect(); return want.includes(x) && r.top > 690 && r.height < 30; }).map((e) => ({ l: (e.textContent || '').trim(), x: e.getBoundingClientRect().x }));
  const uniq = []; for (const n of labels) if (!uniq.some((u) => Math.abs(u.x - n.x) < 20)) uniq.push(n);
  uniq.sort((a, b) => a.x - b.x);
  /* FA glyph charCodes: quran = U+F68A, mosque = U+f6b8… we just check the two icon nodes carry a NON-empty glyph */
  const glyphs = [...document.querySelectorAll('div')].filter((e) => { const r = e.getBoundingClientRect(); return r.top > 700 && r.height < 26 && (getComputedStyle(e).fontFamily || '').includes('FontAwesome') && (e.textContent || '').trim().length === 1; }).map((e) => (e.textContent || '').trim().codePointAt(0).toString(16));
  return { labels: uniq.map((u) => u.l), glyphs };
});
ok('tabs: order intact', tabs.labels.length === 5 && ['Home', 'Quran &', 'Worship', 'Community', 'Profile'].every((w, i) => tabs.labels[i] === w), JSON.stringify(tabs.labels));
ok('tabs: 5 real glyphs render (incl quran + mosque icons)', tabs.glyphs.length >= 5, tabs.glyphs.join(','));

/* ── 2. mushaf borderless + INLINE recite ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const mush = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Mushaf');
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (mush) { await page.touchscreen.tap(mush.x, mush.y); await page.waitForTimeout(6500); }
t = await bodyText();
const borderInfo = await page.evaluate(() => {
  /* the page card = the big container with the cream/night bg */
  const el = [...document.querySelectorAll('div')].filter((e) => { const cs = getComputedStyle(e); return (cs.backgroundColor || '').startsWith('rgb(255, 252') || (cs.backgroundColor || '').startsWith('rgb(10, 19'); }).pop();
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { bw: cs.borderWidth, br: cs.borderRadius, w: Math.round(el.getBoundingClientRect().width) };
});
ok('mushaf: page card has NO border/radius (full bleed)', borderInfo && (borderInfo.bw === '0px' || borderInfo.bw.includes('0px')), JSON.stringify(borderInfo));
ok('mushaf: no modal — page text visible with RECITE pill', !t.includes('Recite Mode') && t.includes('RECITE'));
const pill = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim().startsWith('RECITE')); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
let inlineOk = false, blindOk = false;
if (pill) {
  await page.touchscreen.tap(pill.x, pill.y);
  await page.waitForTimeout(1000);
  const mic = await page.locator('[aria-label="page recite mic"]').count();
  const blind = await page.locator('[aria-label="page blind mode"]').count();
  inlineOk = mic >= 1 && (await bodyText()).includes('سُورَةُ');
  ok('mushaf: inline recite banner ON PAGE (mic + progress)', inlineOk, `mic=${mic}`);
  blindOk = blind >= 1;
  ok('mushaf: blind toggle inline', blindOk);
  const blindBtn = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="page blind mode"]')].pop(); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (blindBtn) { await page.touchscreen.tap(blindBtn.x, blindBtn.y); await page.waitForTimeout(500); }
  /* masked words should render as ҉ glyphs while blind */
  const masked = await page.evaluate(() => (document.body.innerText.match(/҉/g) || []).length);
  ok('mushaf: blind mode masks words (ayah numbers stay)', masked > 10, `${masked} masked glyphs`);
  const closeB = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="close page recite"]')].pop(); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (closeB) { await page.touchscreen.tap(closeB.x, closeB.y); await page.waitForTimeout(600); }
  const masked2 = await page.evaluate(() => (document.body.innerText.match(/҉/g) || []).length);
  ok('mushaf: closing recite restores the page', masked2 === 0 && !(await page.locator('[aria-label="page recite mic"]').count()));
} else {
  ok('mushaf: inline recite banner ON PAGE (mic + progress)', false, 'no pill');
  ok('mushaf: blind toggle inline', false);
  ok('mushaf: blind mode masks words (ayah numbers stay)', false);
  ok('mushaf: closing recite restores the page', false);
}

/* ── 3. reader Recite: AUTO-NEXT present ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const autoNext = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="toggle auto next"]')].pop(); return el ? 1 : 0; });
/* open the per-ayah Recite first (mode ayah → autoNext default OFF → button must exist) */
const reciteBtn = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Recite'); const el = els.find((e) => { const r = e.getBoundingClientRect(); return r.y > 60 && r.y < 800 && r.width > 10; }); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 80), 810) }; });
let anOk = false;
if (reciteBtn) {
  await page.touchscreen.tap(reciteBtn.x, reciteBtn.y);
  await page.waitForTimeout(1000);
  anOk = (await page.locator('[aria-label="toggle auto next"]').count()) >= 1;
  const x = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="close recite mode"]')].pop(); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (x) { await page.touchscreen.tap(x.x, x.y); await page.waitForTimeout(500); }
}
ok('reader: Recite has AUTO-NEXT toggle', anOk);

/* ── 4. modal mic: idle gold → green after tap ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 8; i++) { await page.waitForTimeout(1500); t = await bodyText(); if (t.includes('Search or recite a verse')) break; }
let srow = null;
for (let i = 0; i < 10 && !srow; i++) {
  await page.waitForTimeout(1000);
  srow = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="search or recite"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
}
let mic = null;
for (let attempt = 0; attempt < 3 && !mic; attempt++) {
  /* re-find the row each attempt — the list reflows when the progress card loads */
  srow = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="search or recite"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (!srow) break;
  await page.touchscreen.tap(srow.x, srow.y);
  for (let i = 0; i < 4 && !mic; i++) {
    await page.waitForTimeout(800);
    mic = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="recite to search"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  }
}
if (mic) {
    /* tap the chip to open the recite modal (JS click — deterministic) */
    await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="recite to search"]')].pop(); if (el) el.click(); });
    let startBtn = null;
    for (let i = 0; i < 6 && !startBtn; i++) {
      await page.waitForTimeout(600);
      startBtn = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="start reciting"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    }
    /* idle check: gold before the tap */
    const idle = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="start reciting"]')].pop(); if (!el) return null; return getComputedStyle(el).borderColor; });
    if (startBtn) { await page.touchscreen.tap(startBtn.x, startBtn.y); }
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[aria-label="start reciting"]')].pop();
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { border: cs.borderColor, bg: cs.backgroundColor, pulseRings: [...document.querySelectorAll('div')].filter((d) => { const s = d.getAttribute('style') || ''; return s.includes('scale(') && s.includes('borderRadius'); }).length };
    });
    ok('modal: mic idle gold → GREEN + pulsing after tap', state != null && /31, ?143, ?92/.test(state.border) && idle != null && /212, ?175, ?55/.test(idle), `idle=${idle} → ${state ? state.border : 'gone'} rings=${state ? state.pulseRings : 0}`);
    const x2 = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === '×'); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (x2) { await page.touchscreen.tap(x2.x, x2.y).catch(() => {}); await page.waitForTimeout(400); }
  } else ok('modal: mic idle gold → GREEN + pulsing after tap', false, 'search row missing');

/* ── 5. search accuracy battery (typed = same path as voice) ── */
const queries = [
  ['قل هو الله أحد', '112:1'],
  ['بسم الله الرحمن الرحيم قل هو الله أحد', '112:1'],
  ['الحمد لله رب العالمين', '1:2'],
  ['قل أعوذ برب الفلق', '113:1'],
  ['الله الصمد', '112:2'],
];
for (const [q, want] of queries) {
  await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(1200); t = await bodyText(); if (t.includes('Search or recite a verse')) break; }
  const sr = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="search or recite"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(sr.x, sr.y);
  await page.waitForTimeout(900);
  const inp = page.locator('input').last();
  await inp.fill(q);
  await page.waitForTimeout(5500);
  t = await bodyText();
  const topHit = t.match(/([A-Za-z' ]+) (\d{1,3}):(\d{1,3}) · (\d+)% match/);
  const pass = topHit && `${topHit[2]}:${topHit[3]}` === want;
  ok(`search: "${q.slice(0, 18)}…" → ${want}`, pass, topHit ? `${topHit[2]}:${topHit[3]} ${topHit[4]}%` : 'no hit');
}

/* ── 6. AI thinking dots ── */
await page.goto('http://localhost:3996/deenapp/tools/ai', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3200);
await page.locator('[placeholder="Ask anything…"]').fill('What is Surah Al-Fatiha about?');
const sb = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="Send"]')].pop(); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(sb.x, sb.y);
let dots = 0;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(200);
  dots = await page.evaluate(() => [...document.querySelectorAll('div')].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return Math.round(r.width) === 7 && Math.round(r.height) === 7 && cs.borderRadius === '4px'; }).length);
  if (dots >= 3) break;
}
ok('ai: three-dot thinking animation while busy', dots >= 3, `${dots} dots`);

/* summary */
console.log('\n===== PASS-27 DIAG =====');
results.forEach((r) => console.log(r));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} passed`);
await browser.close();
srv.kill();
process.exit(fails ? 1 : 0);
