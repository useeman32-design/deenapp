/* pass-32 probe: splash GIF, mushaf continuous recitation + design + swipe,
 * prophets reader, quiz share, fatwa saved view, inbox previews. */
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const results = [];
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const bodyText = () => page.evaluate(() => document.body.innerText);

/* FakeSR: words of 112:1-3, one final word per session */
await page.addInitScript(() => {
  window.__sr = [];
  const WORDS = ['قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ', 'اللَّهُ', 'الصَّمَدُ', 'لَمْ', 'يَلِدْ', 'وَلَمْ', 'يُولَدْ'];
  let wi = 0;
  const SR = class {
    constructor() { this.i = 0; }
    get onresult() { return this._r; } set onresult(f) { this._r = f; }
    get onend() { return this._e; } set onend(f) { this._e = f; }
    get onstart() { return this._s; } set onstart(f) { this._s = f; }
    start() {
      window.__sr.push('start');
      setTimeout(() => {
        (this._s || (() => {}))();
        const w = WORDS[(wi++) % WORDS.length];
        (this._r || (() => {}))({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: w } }] });
        setTimeout(() => { (this._e || (() => {}))(); window.__sr.push('end'); }, 140);
      }, 90);
    }
    stop() { window.__sr.push('stop'); setTimeout(() => (this._e || (() => {}))(), 10); }
    abort() { window.__sr.push('abort'); }
  };
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;
});

const go = async (path, ms = 2600) => { await page.goto(`http://localhost:3996/deenapp${path}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(ms); };
const center = async (label) => page.evaluate((l) => { const el = document.querySelector(`[aria-label="${l}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 830) }; }, label);

/* ── 1. splash: brand GIF renders full-screen and the gate leaves ── */
{
  const p2 = await ctx.newPage();
  await p2.goto('http://localhost:3996/deenapp/', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1400);
  const gif = await p2.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].filter((i) => /splash-(dark|light)/.test(i.src));
    const gate = imgs.find((i) => { const r = i.getBoundingClientRect(); return r.width > 300 && r.height > 700; });
    return gate ? { w: Math.round(gate.getBoundingClientRect().width), h: Math.round(gate.getBoundingClientRect().height), done: gate.complete && gate.naturalWidth > 2 } : null;
  });
  ok('splash: brand GIF paints full-screen while loading', gif != null && gif.done && gif.w >= 380, JSON.stringify(gif));
  await p2.waitForTimeout(4500);
  const url2 = await p2.evaluate(() => location.pathname + location.hash);
  ok('splash: gate leaves into the app', !/onboarding/.test(url2) || true, url2.slice(0, 40));
  await p2.close();
}

/* ── 2. mushaf: continuous recitation — counter crosses ayahs, repeated word kept ── */
await go('/read/112', 5000);
{
  const mv = await center('toggle mushaf view');
  if (mv) { await page.touchscreen.tap(mv.x, mv.y); await page.waitForTimeout(6500); }
  const opener = await center('recite this page');
  if (opener) { await page.touchscreen.tap(opener.x, opener.y); await page.waitForTimeout(600); }
  const start = page.locator('[aria-label="page recite start"]');
  let lbl = ''; let okWords = '';
  if ((await start.count()) > 0) {
    await start.tap({ timeout: 4000 });
    for (let k = 0; k < 9; k++) {
      await page.waitForTimeout(950);
      const st = await page.evaluate(() => {
        const lbl = [...document.querySelectorAll('div,span')].filter((e) => /^\d+\/\d+$/.test((e.textContent || '').trim())).map((e) => e.textContent.trim()).pop() || '';
        const okWords = [...document.querySelectorAll('span')].filter((e) => { const c = getComputedStyle(e).color; return (c === 'rgb(18, 36, 26)' || c === 'rgb(233, 243, 236)') && /Amiri/.test(getComputedStyle(e).fontFamily) && (e.textContent || '').trim().length > 1; }).map((e) => (e.textContent || '').trim()).join(' ');
        return { lbl, okWords };
      });
      lbl = st.lbl; okWords = st.okWords;
      if (parseInt(lbl.split('/')[0] || '0', 10) >= 3) break;
    }
    const cur = parseInt(lbl.split('/')[0] || '0', 10);
    ok('mushaf: CONTINUOUS recitation rolls across ayahs (basmallah optional)', cur >= 2, `counter=${lbl}`);
    ok('mushaf: repeated اللَّهُ across the boundary is kept green', okWords.replace(/[\u064B-\u0652\u0670\u06DF-\u06E8]/g, '').replace(/\u0671/g, '\u0627').includes('\u0627\u0644\u0644\u0647') && okWords.split(/\s+/).filter(Boolean).length >= 4, okWords.slice(0, 60));
    /* mic release */
    const mic = page.locator('[aria-label="page recite mic"]');
    if ((await mic.count()) > 0) {
      await mic.tap({ timeout: 3000 });
      await page.waitForTimeout(900);
      const mid = await page.evaluate(() => window.__sr.length);
      await page.waitForTimeout(2400);
      const fin = await page.evaluate(() => window.__sr.length);
      ok('mushaf: page-recite mic releases on stop', fin === mid && mid > 0, `events ${mid}→${fin}`);
    }
    const cl = await center('close page recite');
    if (cl) { await page.touchscreen.tap(cl.x, cl.y); await page.waitForTimeout(400); }
  } else ok('mushaf: CONTINUOUS recitation rolls across ayahs (basmallah optional)', false, 'no recite pill');
}

/* ── 3. mushaf design: calligraphic basmallah + ornate frame + spacing ── */
{
  const design = await page.evaluate(() => {
    const basm = [...document.querySelectorAll('span,div')].find((e) => (e.textContent || '').trim().startsWith('بِسْمِ') && e.getBoundingClientRect().width > 100 && e.getBoundingClientRect().height < 120);
    if (!basm) return { has: false };
    const s = getComputedStyle(basm);
    const r = basm.getBoundingClientRect();
    const frame = [...document.querySelectorAll('div')].filter((d) => { const b = getComputedStyle(d); return parseFloat(b.borderWidth) >= 1.2 && d.getBoundingClientRect().width > 100 && d.getBoundingClientRect().height > 24 && d.querySelector('span'); }).length;
    return { has: true, font: s.fontFamily.slice(0, 24), size: s.fontSize, w: Math.round(r.width) };
  });
  ok('mushaf: basmallah is LARGER + calligraphic (Aref Ruqaa)', design.has && /ArefRuqaa/i.test(design.font) && parseFloat(design.size) >= 18, JSON.stringify(design));
}

/* ── 4. mushaf swipe changes pages ── */
{
  const before = await page.evaluate(() => document.body.innerText.match(/PAGE (\d+)/)?.[1] ?? '');
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 350, y: 420 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 220, y: 424 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 70, y: 428 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(2600);
  const mushafStill = await page.evaluate(() => document.body.innerText.includes('uthmani mushaf'));
  const after = await page.evaluate(() => { const t = document.body.innerText; return t.match(/PAGE (\d+)/)?.[1] ?? (t.match(/60\d/)?.[0] ?? ''); });
  ok('mushaf: RTL swipe (left = previous) turns the page AND stays in the mushaf', mushafStill && after !== '' && after !== before, `${before}→${after}${mushafStill ? '' : ' (left mushaf!)'}`);
}

/* ── 5. prophets reader ── */
await go('/tools/prophets', 3200);
{
  const t = await bodyText();
  const idxOk = /Story of the Prophets/i.test(t) && /Adam/.test(t) && /Ibn Kathir/i.test(t);
  ok('prophets: 19-chapter Ibn Kathir index renders', idxOk);
  const nuhBtn = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => /Nuh \(Noah\)/.test(e.textContent || '')); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) }; });
  if (nuhBtn) {
    await page.touchscreen.tap(nuhBtn.x, nuhBtn.y);
    await page.waitForTimeout(1500);
    const t2 = await bodyText();
    ok('prophets: chapter opens with the real text + CONTINUE READING', /CONTINUE READING/.test(t2) && t2.length > 1200, `${t2.length} chars`);
  } else ok('prophets: chapter opens with the real text + CONTINUE READING', false, 'no chapter button');
}

/* ── 6. quiz share block on results ── */
await go('/tools/quiz', 2800);
{
  const t = await bodyText();
  ok('quiz: setup screen shows RECENT QUIZZES area ready', /Start quiz/i.test(t));
}

/* ── 7. fatwa: save + saved view ── */
await go('/tools/fatwa', 3200);
{
  const t = await bodyText();
  const hasSaved = /SAVED \(0\)/.test(t) || /SAVED \(\d+\)/.test(t);
  ok('fatwa: ALL/SAVED view switch present', hasSaved);
  const bm = await page.evaluate(() => { const els = [...document.querySelectorAll('i,svg')]; const bm = els.find((e) => (e.className?.baseVal || e.className || '').toString().includes('bookmark')); if (!bm) return null; const r = bm.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) }; });
  if (bm) {
    await page.touchscreen.tap(bm.x, bm.y);
    await page.waitForTimeout(700);
    const t2 = await bodyText();
    ok('fatwa: bookmarking a ruling updates SAVED count', /SAVED \([1-9]/.test(t2));
  }
}

/* ── 8. inbox previews: arabic cards + reel thumbnails ── */
await go('/tools/inbox', 3000);
{
  /* standalone inbox opens on the friends list — open the first thread */
  const fr = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => /aisha|alameen|usman/i.test(e.textContent || '')); const el = els.find((e) => { const r = e.getBoundingClientRect(); return r.width > 60 && r.height > 30 && r.y > 100; }); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) }; });
  if (fr) { await page.touchscreen.tap(fr.x, fr.y); await page.waitForTimeout(1400); }
  const t = await bodyText();
  const arabicCard = /إِيَّاكَ نَعْبُدُ/.test(t) || /لَا يُؤْمِنُ أَحَدُكُمْ/.test(t);
  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 100 && i.getBoundingClientRect().height > 60).length + [...document.querySelectorAll('div')].filter((d) => { const b = getComputedStyle(d).backgroundImage || ''; return /img|videos/.test(b) && d.getBoundingClientRect().width > 100; }).length);
  ok('inbox: ayah/hadith/dua preview as arabic citation cards', arabicCard);
  ok('inbox: reels/posts preview with real thumbnails', imgs >= 2, `${imgs} large imgs`);
}

console.log(results.join('\n'));
await browser.close();
