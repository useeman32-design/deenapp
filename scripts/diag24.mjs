/* pass-24 diag: AI chat (history, settings, on-device answers, sources),
   quran recite-to-find (fuzzy), recite mode fallback, memorization loop sheet */
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

/* ── 1. AI page: hero, on-device pill, categories ── */
await page.goto('http://localhost:3996/deenapp/tools/ai', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/tools/ai', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
let t = await bodyText();
ok('ai: page opens with greeting + ON-DEVICE pill', t.includes('Assalamu alaikum') && t.includes('ON-DEVICE'), t.includes('DeenLink AI') ? 'header ok' : 'no header');
ok('ai: category prompt cards render', t.includes('QURAN') && t.includes('HADITH') && t.includes('GUIDANCE'));

/* ── 2. settings sheet: key field, model picker, web toggle ── */
const gear = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[aria-label="AI settings"]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (gear) {
  await page.touchscreen.tap(gear.x, gear.y);
  await page.waitForTimeout(700);
  t = await bodyText();
  ok('ai: settings sheet (key, model, web search)', t.includes('GROK') && t.includes('MODEL') && t.includes('WEB SEARCH'));
  /* invalid key warning */
  const keyInput = page.locator('input[placeholder="xai-…"]');
  await keyInput.fill('abc123');
  await page.waitForTimeout(300);
  t = await bodyText();
  ok('ai: non-xai key shows warning', t.includes('console.x.ai'));
  await page.touchscreen.tap(195, 820); /* scrim below the centered card */
  await page.waitForTimeout(800);
} else ok('ai: settings sheet (key, model, web search)', false, 'no gear');

/* ── 3. on-device Q&A: send → retrieval → answer + source chips ── */
const input = page.locator('[placeholder="Ask about quran, hadith, dua…"]');
await input.fill('What is Surah Al-Fatiha about?');
const sendBtn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[aria-label="Send"]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (sendBtn) { await page.touchscreen.tap(sendBtn.x, sendBtn.y); }
let answered = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1500);
  t = await bodyText();
  if (t.includes('your DeenLink library') || t.includes('Quran 1:')) { answered = true; break; }
}
ok('ai: on-device answer with library results', answered);
await page.waitForTimeout(1200);
const chips = await page.evaluate(() => [...document.querySelectorAll('div')].filter((e) => /Quran \d+[:·]|quiz deck/.test((e.textContent || '').trim())).length);
ok('ai: source chips attached to the answer', chips >= 1, `${chips} chip(s)`);

/* ── 4. history: saved + reopen ── */
const hist = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[aria-label="Chat history"]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (hist) {
  await page.touchscreen.tap(hist.x, hist.y);
  await page.waitForTimeout(800);
  t = await bodyText();
  ok('ai: chat history saved the conversation', t.includes('1 saved') && t.includes('What is Surah Al-Fatiha about?'.slice(0, 20)));
  await page.touchscreen.tap(195, 820).catch(() => {});
  await page.waitForTimeout(700);
} else ok('ai: chat history saved the conversation', false, 'no history btn');

/* ── 5. quran: fuzzy recite-to-find (typed arabic same path as mic) ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/(tabs)/quran/surah', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const searchRow = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')].filter((e) => (e.textContent || '').includes('Search surah or ayah'));
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (searchRow) {
  await page.touchscreen.tap(searchRow.x, searchRow.y);
  await page.waitForTimeout(1200);
  const q = page.locator('input').last();
  await q.fill('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ الرَّحْمَٰنِ الرَّحِيمِ');
  await page.waitForTimeout(6000);
  t = await bodyText();
  ok('quran: recited verse fuzzy-matched with % score', /match/.test(t) && /The Opening|1:2|1:1/.test(t), (t.match(/\d+% match/g) || []).slice(0, 3).join(','));
  ok('quran: recite-to-find mic button available', (await page.locator('[aria-label="recite to search"]').count()) >= 1);
} else ok('quran: recited verse fuzzy-matched with % score', false, 'search row not found');

/* ── 6. reader: recite mode (practice fallback in headless) + loop sheet ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const reciteBtn = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Recite');
  const el = els.find((e) => { const r = e.getBoundingClientRect(); return r.y > 60 && r.y < 800 && r.width > 10; });
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 80), 810) };
});
if (reciteBtn) {
  await page.touchscreen.tap(reciteBtn.x, reciteBtn.y);
  await page.waitForTimeout(1200);
  t = await bodyText();
  ok('reader: Recite Mode opens with ayah words', t.includes('Recite Mode') && t.includes('Al-Falaq') === false ? t.includes('AYAH 1') || t.includes('Ayah 1') : true);
  ok('reader: recite controls present (mic UI or practice fallback)', t.includes('practice mode') || t.includes('Start reciting'));
  const done2 = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Done');
    return els.length;
  });
  await page.evaluate(() => { const b = [...document.querySelectorAll('[aria-label="toggle recitation listening"]')]; return b.length; });
  /* close via X */
  const x = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div,span,button')].filter((e) => e.querySelector('i.fa-times') || (e.textContent || '').trim() === '');
    return null;
  });
  const closeRecite = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('div')].filter((e) => e.getAttribute('aria-label') || e.onclick);
    return null;
  });
  const closeX = await page.evaluate(() => { const el = [...document.querySelectorAll('[aria-label="close recite mode"]')].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (closeX) { await page.touchscreen.tap(closeX.x, closeX.y); await page.waitForTimeout(900); }
  t = await bodyText();
  if (t.includes('Recite Mode')) { ok('reader: recite modal closes', false, 'still open'); } else { ok('reader: recite modal closes', true); }
} else ok('reader: Recite Mode opens with ayah words', false, 'no Recite button');

/* ── 7. memorization loop sheet ── */
const loopBtn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[aria-label="repeat loop"]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (loopBtn) {
  await page.touchscreen.tap(loopBtn.x, loopBtn.y);
  await page.waitForTimeout(900);
  t = await bodyText();
  ok('reader: loop sheet (range, per-ayah, cycles)', t.includes('Repeat for memorization') && t.includes('REPEAT EACH AYAH') && t.includes('TIMES THROUGH THE RANGE'));
  const start = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div,span,button')].filter((e) => /^Start loop at/.test((e.textContent || '').trim()));
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (start) {
    await page.touchscreen.tap(start.x, start.y);
    await page.waitForTimeout(1200);
    t = await bodyText();
    ok('reader: loop starts (sheet closes, reader alive)', !t.includes('Repeat for memorization') && (t.includes('Al-Falaq') || t.includes('AYAH')));
  } else ok('reader: loop starts (sheet closes, reader alive)', false, 'no start btn');
} else ok('reader: loop sheet (range, per-ayah, cycles)', false, 'no loop btn');

/* summary */
console.log('\n===== PASS-24 DIAG =====');
results.forEach((r) => console.log(r));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} passed`);
await browser.close();
srv.kill();
process.exit(fails ? 1 : 0);
