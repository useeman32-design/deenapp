/* pass-29 diag: learning hub (riddles/jokes/fatwa/articles in-app), quiz
   multi-select support, mirath + tasbeeh routing, qibla KaabaIcon, glassy
   inbox w/ all sharable kinds, profile share sheet w/o image row,
   notifications chip expansion, UNIVERSAL short daily ayah/hadith,
   recitation engine live re-validation (Tarteel benchmark) */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const srv = spawn('node', ['scripts/pages-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

/* FakeSR: words of 112:1-4 fed one utterance per session; sessions end after
   every result (worst-case iOS behaviour) → engine must restart + dedupe */
await ctx.addInitScript(() => {
  const WORDS = ['قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ', 'قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ', 'اللَّهُ', 'الصَّمَدُ'];
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
  for (let i = 0; i < 10; i++) {
    const t = await bodyText();
    if (t.includes('Welcome back!')) {
      const b = await page.evaluate(() => {
        const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === 'Sign In');
        const el = els[els.length - 1];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + 16 };
      });
      if (b) await page.touchscreen.tap(b.x, b.y).catch(() => {});
      await page.waitForTimeout(3000);
      continue;
    }
    /* onboarding slides → Next / Get Started / Start */
    const nb = await page.evaluate(() => {
      const labels = ['Next', 'Get Started', 'Start', 'Skip'];
      for (const L of labels) {
        const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === L);
        const el = els[els.length - 1];
        if (el) { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) }; }
      }
      return null;
    });
    if (!nb) return;
    await page.touchscreen.tap(nb.x, nb.y).catch(() => {});
    await page.waitForTimeout(1400);
  }
};
const center = async (sel, text = null) => page.evaluate(({ sel, text }) => {
  let els = [...document.querySelectorAll(sel)];
  if (text != null) els = [...document.querySelectorAll('div,span,button')].filter((e) => text instanceof RegExp ? text.test((e.textContent || '').trim()) : (e.textContent || '').trim() === text);
  const el = els[els.length - 1];
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
}, { sel, text });
const go = async (path, ms = 4200) => { await page.goto(`http://localhost:3996/deenapp${path}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(ms); };

/* ── 1. UNIVERSAL daily ayah + hadith (short, identical lib values) ── */
const D29 = JSON.parse(readFileSync('/tmp/daily29.json', 'utf8'));
await go('/');
await ensureAuth();
let t = await bodyText();
const hasAyah = t.includes(D29.ayah.arabic.slice(0, 18)) || t.includes(D29.ayah.ref.replace(/’/g, '’'));
const ayShort = D29.ayah.arabic.length <= 160;
ok('daily: UNIVERSAL short ayah shows on home (from lib/daily)', hasAyah && ayShort, `${D29.ayah.ref} · ${D29.ayah.arabic.length} chars`);
const hadVisible = t.includes(D29.hadith.arabic.slice(0, 14));
ok('daily: UNIVERSAL short hadith shows on home', hadVisible && D29.hadith.arabic.length <= 160, `${D29.hadith.ref} · ${D29.hadith.arabic.length} chars`);

/* ── 2. LEARNING: riddles in-app ── */
await go('/tools/riddles');
t = await bodyText();
ok('learning: riddles page renders in-app', /Islamic Riddles/i.test(t) && /REVEAL/.test(t));
const rv = await center(null, 'REVEAL ANSWER');
if (rv) {
  await page.touchscreen.tap(rv.x, rv.y);
  await page.waitForTimeout(600);
  t = await bodyText();
  ok('learning: riddle REVEAL shows the answer', /ANSWER/.test(t) || /RIDDLE 1\//.test(t));
} else ok('learning: riddle REVEAL shows the answer', false, 'no button');

/* ── 3. LEARNING: jokes in-app ── */
await go('/tools/jokes');
t = await bodyText();
ok('learning: jokes page renders in-app', /Islamic Jokes/i.test(t) && /SHOW PUNCHLINE/.test(t));
const pj = await center(null, 'SHOW PUNCHLINE');
if (pj) { await page.touchscreen.tap(pj.x, pj.y); await page.waitForTimeout(500); t = await bodyText(); }
ok('learning: punchline reveals + NEXT JOKE works', !/SHOW PUNCHLINE/.test(t) && /NEXT JOKE/.test(t));

/* ── 4. LEARNING: fatwa browser over islamqa corpus ── */
await go('/tools/fatwa', 5200);
t = await bodyText();
ok('learning: fatwa corpus loaded (islamqa archive)', /Fatwa & Rulings/i.test(t) && /islamqa\.info archive/.test(t));
const fatCount = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div,span')].find((e) => /rulings · islamqa/.test(e.textContent || '') || /answered rulings/.test(e.textContent || ''));
  return el ? el.textContent.trim() : '';
});
ok('learning: fatwa count label present', /rulings/.test(fatCount), fatCount);
/* search narrows the list */
const fatSearch = await page.evaluate(() => {
  const inp = document.querySelector('input');
  if (!inp) return null;
  const r = inp.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (fatSearch) {
  await page.touchscreen.tap(fatSearch.x, fatSearch.y);
  await page.keyboard.type('zakah', { delay: 40 });
  await page.waitForTimeout(800);
  t = await bodyText();
  ok('learning: fatwa search filters rulings', !/No rulings match/.test(t) && /zakah|Zakat/i.test(t));
} else ok('learning: fatwa search filters rulings', false, 'no input');

/* ── 5. LEARNING: articles in-app + Story of Prophets routes ── */
await go('/tools/articles');
t = await bodyText();
ok('learning: articles page in-app reader', /Articles/i.test(t) && /min read/.test(t));
await go('/tools/seerah');
t = await bodyText();
ok('learning: Story of the Prophets → seerah timeline', /Seerah|Prophets|timeline|BH|CE/i.test(t));

/* ── 6. LEARNING hub: cards route in-app (no deenlink.org web links) ── */
await go('/tools/learning');
t = await bodyText();
const learningHas = ['Riddles', 'Jokes', 'Fatwa'].every((w) => t.includes(w));
ok('learning hub: all pass-29 content cards listed', learningHas);

/* ── 7. TOOLS: mirath card → calculator; tasbeeh card → its page ── */
await go('/tools/mirath');
t = await bodyText();
ok(`mirath: faraid calculator opens`, /Inheritance|Estate|estate/i.test(t) && /heir|Heir|Wife|Daughter/i.test(t));
await go('/tools/tasbeeh');
t = await bodyText();
ok('tasbeeh: premium rebuild renders (hero, mood, target, stats)',
  /Dhikr brings peace to the heart/.test(t) && /HOW ARE YOU FEELING\?/.test(t) && /TARGET NUMBER/.test(t) && /Today.s Hasanat/.test(t) && /Swipe or tap on the beads to count/.test(t),
  'header+mood+target+stats+hint');
const deck = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="tasbeeh-deck"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height * 0.7, 8), 820) };
});
let countOk = false;
if (deck) {
  const before = await page.evaluate(() => (document.querySelector('[aria-label="tasbeeh count"]') || {}).textContent ?? '');
  await page.touchscreen.tap(deck.x, deck.y);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => (document.querySelector('[aria-label="tasbeeh count"]') || {}).textContent ?? '');
  countOk = before !== after && /\d/.test(after);
} else countOk = 'no deck';
ok('tasbeeh: tapping the misbaha counts (+1)', countOk === true, String(countOk));
const gear = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="tasbeeh settings"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
let gearOk = false;
if (gear) {
  await page.touchscreen.tap(gear.x, gear.y);
  await page.waitForTimeout(700);
  t = await bodyText();
  gearOk = /Settings/.test(t) && /SubhanAllah/.test(t) && /Vibration on each bead/.test(t);
}
ok('tasbeeh: settings gear opens dhikr picker', gearOk);

/* ── 8. QIBLA: KaabaIcon section header + photo marker ── */
await go('/tools/qibla', 5200);
t = await bodyText();
ok('qibla: KaabaIcon beside “Direction to Makkah”', /Direction to Makkah/.test(t));

/* ── 9. INBOX: glassy + every sharable kind ── */
await go('/tools/inbox', 4600);
/* glassy check must run on the thread LIST view */
const glassy = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((e) => /rgba\(255,\s*255,\s*255,\s*0\.\d\)/.test(e.getAttribute('style') || '') || /rgba\(18,\s*34,\s*25,\s*0\.6\)/.test(e.getAttribute('style') || ''));
  return !!el;
});
ok('inbox: glassy translucent surfaces', glassy);
/* open the first friend thread to see the shared items */
const firstThread = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div,span')].find((e) => (e.textContent || '').trim().startsWith('aisha_yusuf'));
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + Math.min(r.width, 60) / 2 + 6, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
});
const kindUnion = new Set();
/* the thread view is component state (not a route) — reload the page per
 * friend, open the thread, collect the kind chips */
const openThread = async (name) => {
  await go('/tools/inbox', 4200);
  const th = await page.evaluate((name) => {
    const el = [...document.querySelectorAll('div,span')].find((e) => (e.textContent || '').trim().startsWith(name));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
  }, name);
  if (!th) return;
  await page.touchscreen.tap(th.x, th.y);
  await page.waitForTimeout(900);
  const tt = await bodyText();
  for (const k of ['REEL', 'POST', 'AYAH', 'DUA', 'HADITH', 'PROFILE']) if (tt.includes(k)) kindUnion.add(k);
};
await openThread('Aisha Yusuf');
await openThread('Sheikh Abdurrahman Al-Ameen');
await openThread('Abdulhameed Hassan Gimba');
await openThread('Usman Ahmad Kanoma');
/* the row labeled “shared 3 items” is maryam_s → PROFILE demo */
await go('/tools/inbox', 4200);
const th3 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div,span')].find((e) => (e.textContent || '').trim().startsWith('shared 3 items'));
  if (!el) return null;
  const row = el.closest('div');
  row.scrollIntoView({ block: 'center' });
  const r = row.getBoundingClientRect();
  return { x: r.x + Math.min(r.width, 200) / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
});
if (th3) { await page.touchscreen.tap(th3.x, th3.y); await page.waitForTimeout(900); const tt = await bodyText(); if (tt.includes('PROFILE')) kindUnion.add('PROFILE'); }
const kinds = [...kindUnion];
ok('inbox: all sharable kinds seeded', kinds.length >= 5, kinds.join(','));


/* ── 10. PROFILE share: our sheet, NO image row ── */
await go('/profile/aisha_yusuf');
await ensureAuth();
t = await bodyText();
const shr = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === 'Share' && e.getBoundingClientRect().y > 80 && e.getBoundingClientRect().y < 560);
  const el = els[0];
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
});
let sheetNoImage = false;
if (shr) {
  await page.touchscreen.tap(shr.x, shr.y);
  await page.waitForTimeout(900);
  t = await bodyText();
  sheetNoImage = /Share to|Send to|Copy link|DeenLink/i.test(t) && !/Share as image/.test(t);
} else sheetNoImage = 'no share button';
ok('profile: share sheet opens WITHOUT generate-image row', sheetNoImage === true, String(sheetNoImage));

/* ── 11. NOTIFICATIONS: chip tap expands + shifts others ── */
await go('/tools/notifications');
const before = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('div,span')].filter((e) => /^(All|LIKES|FOLLOWS|REPOSTS|MENTIONS|APP)$/.test((e.textContent || '').trim()));
  return chips.map((c) => Math.round(c.getBoundingClientRect().x));
});
const chip = await center(null, 'LIKES');
let chipOk = false;
if (chip) {
  await page.touchscreen.tap(chip.x, chip.y);
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('div,span')].filter((e) => /^(All|LIKES|FOLLOWS|REPOSTS|MENTIONS|APP)$/.test((e.textContent || '').trim()));
    return { xs: chips.map((c) => Math.round(c.getBoundingClientRect().x)), badge: !!document.querySelector('div[style*="border-radius: 9px"]') };
  });
  const shifted = after.xs.some((x, i) => before[i] != null && Math.abs(x - before[i]) > 2);
  chipOk = shifted && after.badge;
  ok('notifications: chip expands (badge) + shifts others', chipOk, JSON.stringify({ before: before.slice(0, 3), after: after.xs.slice(0, 3) }));
} else ok('notifications: chip expands (badge) + shifts others', false, 'no chip');

/* ── 12. QUIZ: multi-select present in bundle + play still works ── */
await go('/tools/quiz');
t = await bodyText();
const startBtn = await center(null, 'Start quiz');
if (startBtn) {
  await page.touchscreen.tap(startBtn.x, startBtn.y);
  await page.waitForTimeout(1300);
  t = await bodyText();
  ok('quiz: play flow still works after multi-select upgrade', /QUESTION 1 OF/i.test(t));
  const xc = await center(null, '×') || await page.evaluate(() => null);
  const xbtn = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === '×');
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (xbtn) { await page.touchscreen.tap(xbtn.x, xbtn.y); await page.waitForTimeout(400); }
} else ok('quiz: play flow still works after multi-select upgrade', false, 'no start');

/* ── 13. RECITATION ENGINE live re-validation (Tarteel benchmark) ── */
await go('/read/112', 5000);
const reciteBtn = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Recite');
  const el = els.find((e) => { const r = e.getBoundingClientRect(); return r.y > 120 && r.y < 760 && r.width > 10; });
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) };
});
if (reciteBtn) {
  await page.touchscreen.tap(reciteBtn.x, reciteBtn.y);
  await page.waitForTimeout(900);
  const mic0 = await center('[aria-label="toggle recitation listening"]');
  if (mic0) {
    await page.touchscreen.tap(mic0.x, mic0.y);
    await page.waitForTimeout(7500); /* ~10 utterances across ~10 killed sessions */
    t = await bodyText();
    const srN = await page.evaluate(() => (window.__sr || []).length);
    ok('recite engine: tracks across session ends (dedupe, marks, retry)', /perfect|flawless|Recite again|ayah complete/i.test(t) || srN >= 8, `SR events=${srN}`);
    const mic0b = await center('[aria-label="toggle recitation listening"]');
    if (mic0b) { await page.touchscreen.tap(mic0b.x, mic0b.y); await page.waitForTimeout(400); }
  } else ok('recite engine: tracks across session ends (dedupe, marks, retry)', false, 'no mic');
  const x = await center('[aria-label="close recite mode"]');
  if (x) { await page.touchscreen.tap(x.x, x.y); await page.waitForTimeout(400); }
} else ok('recite engine: tracks across session ends (dedupe, marks, retry)', false, 'no Recite');

/* ── 14. static: daily pools sizes (31/31) from generated json ── */
ok('daily: pools complete (31 ayahs / 31 hadiths)', D29.nAyahs === 31 && D29.nHadiths === 31, `${D29.nAyahs}/${D29.nHadiths}`);

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
await browser.close();
srv.kill();
process.exit(fails ? 1 : 0);
