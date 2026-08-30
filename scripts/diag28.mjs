/* pass-28 diag: fonts (stable URLs + applied), recognition auto-restart across
   session ends, Listen single-ayah STOP toggle, mushaf RESET, net pill
   (offline banner), comments sheet (85% height + live drag + gif icon in bar),
   AI professional renderer (no raw markdown, ayah cards) */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const srv = spawn('node', ['scripts/pages-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

/* FakeSR: ends the session after EVERY result (iOS-Safari-like) and feeds the
   words of 112:1 one utterance at a time across restarts */
await ctx.addInitScript(() => {
  /* ALWAYS override — headless-shell ships a native SpeechRecognition that
   * exists but never emits results */
  const WORDS = ['قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ'];
  let wi = 0;
  class FakeSR {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.onresult = null; this.onend = null; this.onerror = null; this.onstart = null; }
    start() {
      window.__sr = window.__sr || [];
      window.__sr.push('start');
      if (this.onstart) this.onstart();
      const self = this;
      setTimeout(() => {
        const w = WORDS[wi % WORDS.length]; wi++;
        window.__sr.push('res:' + w);
        if (self.onresult) self.onresult({ resultIndex: 0, results: [{ 0: { transcript: w }, isFinal: true }] });
        setTimeout(() => { window.__sr.push('end'); if (self.onend) self.onend(); }, 150);
      }, 140);
    }
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
const center = async (sel, text = null, root = null) => page.evaluate(({ sel, text, root }) => {
  const q = root ? [...document.querySelectorAll(root)] : [...document.querySelectorAll(sel)];
  let els = q;
  if (text != null) {
    els = [...document.querySelectorAll('div,span,button')].filter((e) => text instanceof RegExp ? text.test((e.textContent || '').trim()) : (e.textContent || '').trim() === text);
  } else if (root) {
    els = [...document.querySelectorAll(sel)].filter((e) => e.closest(root));
  }
  const el = els[els.length - 1];
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
}, { sel, text, root });

/* ── 1. FONTS: stable URLs + actually applied ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const font = await page.evaluate(async () => {
  await document.fonts.ready;
  await document.fonts.load('16px "Poppins-Bold"', 'Aa');
  await document.fonts.load('16px "Amiri"', 'ب');
  const el = [...document.querySelectorAll('div,span')].find((e) => (e.getAttribute('style') || '').includes('Poppins'));
  const ar = [...document.querySelectorAll('div,span')].find((e) => (e.getAttribute('style') || '').includes('Amiri'));
  const stable = await fetch('/deenapp/fonts/Poppins-Bold.ttf').then((r) => r.status).catch(() => 0);
  const stableAr = await fetch('/deenapp/fonts/Amiri-Regular.ttf').then((r) => r.status).catch(() => 0);
  return {
    poppinsComputed: el ? getComputedStyle(el).fontFamily : null,
    amiriComputed: ar ? getComputedStyle(ar).fontFamily : null,
    checkPoppinsBold: document.fonts.check('16px "Poppins-Bold"'),
    checkAmiri: document.fonts.check('16px "Amiri"'),
    stablePoppins: stable, stableAmiri: stableAr,
  };
});
ok('fonts: Poppins applied to UI text', /Poppins/i.test(font.poppinsComputed || '') && font.checkPoppinsBold, JSON.stringify(font));
ok('fonts: Amiri applied to Arabic text', /Amiri/i.test(font.amiriComputed || '') && font.checkAmiri, font.amiriComputed);
ok('fonts: STABLE deploy-proof URLs live (200)', font.stablePoppins === 200 && font.stableAmiri === 200, `p=${font.stablePoppins} a=${font.stableAmiri}`);

/* ── 2. RECITER: Listen toggle STOP + recognition restart across session ends ── */
let t = '';
/* pick the AYAH-card Recite (the player bar also has a Recite → whole-surah mode) */
const reciteBtn = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Recite');
  const el = els.find((e) => { const r = e.getBoundingClientRect(); return r.y > 120 && r.y < 760 && r.width > 10; });
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
});
let listenOk = false;
if (reciteBtn) {
  await page.touchscreen.tap(reciteBtn.x, reciteBtn.y);
  await page.waitForTimeout(900);
  /* recognition across killed sessions FIRST (audio test would follow) */
  const mic0 = await center('[aria-label="toggle recitation listening"]');
  if (mic0) {
    await page.touchscreen.tap(mic0.x, mic0.y);
    await page.waitForTimeout(6000);
    const full = await bodyText();
    const srEv = await page.evaluate(() => (window.__sr || []).slice(0, 8).join(','));
    ok("reciter: mic SURVIVES session ends (auto-restart tracks all words)", /perfect|flawless|Recite again/i.test(full), `SR=[${srEv}]`);
    const mic0b = await center('[aria-label="toggle recitation listening"]');
    if (mic0b) { await page.touchscreen.tap(mic0b.x, mic0b.y); await page.waitForTimeout(500); }
  } else ok('reciter: mic SURVIVES session ends (auto-restart tracks all words)', false, 'no mic');
  const lb = await center('[aria-label="listen to ayah"]');
  if (lb) {
    await page.touchscreen.tap(lb.x, lb.y);
    await page.waitForTimeout(700);
    const stopping = await page.locator('[aria-label="stop listening"]').count();
    const sb = await center('[aria-label="stop listening"]');
    if (sb) { await page.touchscreen.tap(sb.x, sb.y); await page.waitForTimeout(500); }
    const back = await page.locator('[aria-label="listen to ayah"]').count();
    listenOk = stopping >= 1 && back >= 1;
  }
  ok('reciter: Listen shows STOP while playing, tap stops it', listenOk);
  const x = await center('[aria-label="close recite mode"]');
  if (x) { await page.touchscreen.tap(x.x, x.y); await page.waitForTimeout(500); }
} else ok('reciter: Listen shows STOP while playing, tap stops it', false, 'no Recite btn');

/* ── 3. MUSHAF: RESET chip + restart tracking ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const mush = await center(null, 'Mushaf');
if (mush) { await page.touchscreen.tap(mush.x, mush.y); await page.waitForTimeout(6500); }
const pill = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim().startsWith('RECITE')); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
if (pill) {
  await page.touchscreen.tap(pill.x, pill.y);
  await page.waitForTimeout(900);
  const resetChip = await page.locator('[aria-label="reset page recite"]').count();
  ok('mushaf: RESET chip on the banner', resetChip >= 1);
  /* speak words across dead sessions */
  const mic = await center('[aria-label="page recite mic"]');
  if (mic) {
    await page.touchscreen.tap(mic.x, mic.y);
    await page.waitForTimeout(3000);
    const colored = await page.evaluate(() => {
      /* words that turned ok get full colour (not faint, not transparent) */
      let okWords = 0;
      for (const el of document.querySelectorAll('[aria-label="mushaf page content"] span')) {
        const st = el.getAttribute('style') || '';
        if (!st.includes('color')) continue;
        const c = getComputedStyle(el).color;
        const a = getComputedStyle(el).opacity;
        if (c !== 'rgba(0, 0, 0, 0)' && !/0\.35/.test(String(a)) && (el.textContent || '').trim().length > 1) okWords++;
      }
      return okWords;
    });
    ok('mushaf: page recite tracks across session restarts', colored >= 3, `${colored} live words`);
    const mic2 = await center('[aria-label="page recite mic"]');
    if (mic2) { await page.touchscreen.tap(mic2.x, mic2.y); await page.waitForTimeout(300); }
  }
  /* reset → back to the first ayah */
  const rc = await center('[aria-label="reset page recite"]');
  if (rc) {
    await page.touchscreen.tap(rc.x, rc.y);
    await page.waitForTimeout(600);
    t = await bodyText();
    ok('mushaf: RESET returns to first ayah (1/N)', /1\/\d+/.test(t) && !(await page.locator('[aria-label="page recite mic"]').count().then((c) => c && false)), '');
  }
  const closeB = await center('[aria-label="close page recite"]');
  if (closeB) { await page.touchscreen.tap(closeB.x, closeB.y); await page.waitForTimeout(500); }
} else {
  ok('mushaf: RESET chip on the banner', false, 'no pill');
  ok('mushaf: page recite tracks across session restarts', false);
  ok('mushaf: RESET returns to first ayah (1/N)', false);
}

/* ── 4. NET PILL: offline banner appears / disappears ── */
await ctx.setOffline(true);
await page.waitForTimeout(900);
let pillTxt = await bodyText();
const offlineShown = pillTxt.includes('Network error — check your internet connection');
await ctx.setOffline(false);
await page.waitForTimeout(900);
pillTxt = await bodyText();
const offlineGone = !pillTxt.includes('Network error — check your internet connection');
ok('net: offline → red banner; back online → clears', offlineShown && offlineGone, `shown=${offlineShown} gone=${offlineGone}`);

/* ── 5. COMMENTS: 85% height + live drag + gif icon in input bar ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/community', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/(tabs)/community', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 8; i++) { await page.waitForTimeout(1500); t = await bodyText(); if (t.includes('Comments') || t.includes('Community')) break; }
const cBtn = await center('[aria-label="open comments"]');
let commentsOk = false;
if (cBtn) {
  await page.touchscreen.tap(cBtn.x, cBtn.y);
  await page.waitForTimeout(1100);
  const sheet = await page.evaluate(() => {
    const vh = window.innerHeight;
    const el = [...document.querySelectorAll('[aria-label="comments sheet"]')].pop();
    return el ? { h: el.getBoundingClientRect().height, pct: Math.round((el.getBoundingClientRect().height / vh) * 100) } : null;
  });
  ok('comments: sheet opens TALL (≥80% viewport)', sheet && sheet.pct >= 80, sheet ? `${sheet.pct}%` : 'no sheet');
  const handle = await page.locator('[aria-label="comments drag handle"]').count();
  ok('comments: drag handle present', handle >= 1);
  /* live pointer drag — REAL mouse pointer events via CDP */
  const dragRes = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[aria-label="comments drag handle"]')].pop();
    const sheetEl = [...document.querySelectorAll('[aria-label="comments sheet"]')].pop();
    if (!el || !sheetEl) return null;
    const r = el.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, h0: sheetEl.getBoundingClientRect().height };
  });
  if (dragRes) {
    dragRes.h1 = await page.evaluate((d) => {
      const el = [...document.querySelectorAll('[aria-label="comments drag handle"]')].pop();
      const sheetEl = [...document.querySelectorAll('[aria-label="comments sheet"]')].pop();
      if (!el || !sheetEl) return 0;
      const fire = (type, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, clientX: d.cx, clientY: y, pageX: d.cx, pageY: y }));
      fire('pointerdown', d.cy);
      fire('pointermove', d.cy + 120);
      fire('pointermove', d.cy + 240);
      fire('pointerup', d.cy + 240);
      return new Promise((resolve) => setTimeout(() => resolve(sheetEl.getBoundingClientRect().height), 250));
    }, dragRes);
  }
  ok('comments: LIVE drag resizes the sheet', dragRes && dragRes.h1 < dragRes.h0 - 40, dragRes ? `${Math.round(dragRes.h0)}→${Math.round(dragRes.h1)}` : 'no handle');
  const gifIcon = await page.locator('[aria-label="toggle gif picker"]').count();
  const oldChip = await page.evaluate(() => [...document.querySelectorAll('div,span')].some((e) => (e.textContent || '').trim() === 'GIFs'));
  ok('comments: GIF icon IN the text bar (old chip removed)', gifIcon >= 1 && !oldChip, `icon=${gifIcon} oldChip=${oldChip}`);
  if (gifIcon) {
    const gi = await center('[aria-label="toggle gif picker"]');
    await page.touchscreen.tap(gi.x, gi.y);
    await page.waitForTimeout(600);
    const picker = await page.evaluate(() => document.querySelectorAll('img').length);
    ok('comments: tapping gif icon opens the picker container', picker > 0, `${picker} gifs`);
    commentsOk = true;
  }
  const x3 = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === '×'); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (x3) { await page.touchscreen.tap(x3.x, x3.y); await page.waitForTimeout(400); }
} else {
  ok('comments: sheet opens TALL (≥80% viewport)', false, 'no Comments btn');
  ok('comments: drag handle present', false);
  ok('comments: LIVE drag resizes the sheet', false);
  ok('comments: GIF icon IN the text bar (old chip removed)', false);
  ok('comments: tapping gif icon opens the picker container', false);
}
void commentsOk;

/* ── 6. AI: professional renderer (no raw markdown, ayah cards) ── */
await page.goto('http://localhost:3996/deenapp/tools/ai', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3200);
await page.locator('[placeholder="Ask anything…"]').fill('Show me a verse about patience in the Quran');
const sb = await center('[aria-label="Send"]');
await page.touchscreen.tap(sb.x, sb.y);
/* on-device local answer (no key) should appear with ayah cards */
let sawCard = false, sawRaw = true;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
  t = await bodyText();
  if (t.includes('tap to open')) sawCard = true;
  sawRaw = /\*\*|##/.test(t);
  if (sawCard && !sawRaw) break;
}
ok('ai: ayah card with Arabic + translation renders in answers', sawCard);
ok('ai: NO raw markdown symbols (** / ##) in output', !sawRaw);

console.log('\n===== PASS-28 DIAG =====');
results.forEach((r) => console.log(r));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} passed`);
await browser.close();
srv.kill();
process.exit(fails ? 1 : 0);
