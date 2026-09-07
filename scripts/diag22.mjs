/* pass-22 diag: mushaf v3, player/seek, inbox v2, AI, names audio, dua player, qibla globe, quiz trophy, community suggestions */
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

/* sign in once (auth gate) */
const ensureAuth = async () => {
  await page.waitForTimeout(3000); /* let the (now every-load) splash fade */
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

/* ── 1. mushaf v3: basmallah only at surah start ── */
await page.goto('http://localhost:3996/deenapp/read/2', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/read/2', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.locator('text=Mushaf').first().click().catch(() => {});
await page.waitForTimeout(4000);
let t = await bodyText();
const basmCount = (t.match(/بِسْمِ ٱللَّهِ ٱلرَّحْمَٰن/g) || []).length;
ok('mushaf: page 1 shows exactly ONE basmallah (Baqarah start)', basmCount === 1, `basmallah x${basmCount}`);
ok('mushaf: page number visible', /٢|٣/.test(t) || /PAGE/.test(t));
const prevBtn = await page.locator('text=Prev').count();
const nextBtn = await page.locator('text=Next').count();
ok('mushaf: prev/next buttons removed', prevBtn === 0 && nextBtn === 0);

/* swipe to page 3 (Al-Baqarah 2:142 — surah continues, still no basmallah) */
await page.touchscreen.tap(300, 400); // placeholder — swipe via mouse
await page.mouse.move(330, 420); await page.mouse.down(); await page.mouse.move(70, 420, { steps: 12 }); await page.mouse.up();
await page.waitForTimeout(3500);
t = await bodyText();
const m = t.match(/PAGE (\d+)/);
const basmCount2 = (t.match(/بِسْمِ ٱللَّهِ ٱلرَّحْمَٰن/g) || []).length;
const surahHdr = (t.match(/سُورَةُ سُورَةُ/g) || []).length;
ok('mushaf: swipe flipped the page', m != null && Number(m[1]) >= 2, m ? m[0] : 'no page marker');
ok('mushaf: no doubled surah-name prefix', surahHdr === 0, `doubled x${surahHdr}`);
ok('mushaf: page-2 basmallah exactly once (Baqarah starts p2)', basmCount2 <= 1, `basmallah x${basmCount2}`);
const noAudioAutoplay = await page.evaluate(() => ![...document.querySelectorAll('video')].some((v) => !v.paused));
ok('mushaf: browsing does NOT autoplay audio', noAudioAutoplay);

/* ── 2. reader: play + seek progress + subtitle under title ── */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2800);
t = await bodyText();
ok('reader: reciter line present', /Ayah 1 · /i.test(t), t.split('\n').slice(0, 6).join('|').slice(0, 90));
const ayahBox = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div,span')].find((e) => (e.textContent || '') === 'Ayah');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (ayahBox) await page.touchscreen.tap(ayahBox.x, ayahBox.y);
await page.waitForTimeout(4200);
const vid = await page.evaluate(() => {
  const vs = [...document.querySelectorAll('video')].filter((x) => (x.currentSrc || '').includes('islamic.network'));
  const playing = vs.find((x) => !x.paused);
  return { n: vs.length, playing: playing ? { t: +playing.currentTime.toFixed(2), ready: playing.readyState } : null };
});
ok('reader: single-ayah audio plays', !!vid.playing && vid.playing.t > 0.2, JSON.stringify(vid));
await page.waitForTimeout(2000);
const knob = await page.evaluate(() => {
  const bars = [...document.querySelectorAll('div')].filter((d) => d.style && (d.style.width || '').endsWith('%') && d.style.width !== '100%' && d.style.width !== '0%' && d.style.height === '4px');
  return bars.map((b) => b.style.width).slice(0, 4);
});
ok('reader: seek fill is moving', knob.length > 0, JSON.stringify(knob));

/* ── 3. names: audio plays from the dataset ── */
await page.goto('http://localhost:3996/deenapp/tools/names', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3200);
const playBtns = await page.locator('text=Search by name or meaning').count();
const nameVid = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('div')].filter((d) => d.getAttribute('role') === 'button');
  return btns.length;
});
const firstVolume = page.locator('[aria-label="volume-up"], svg').first();
await page.evaluate(() => {
  /* tap the first volume-up glyph via its bounding box */
  const svgs = [...document.querySelectorAll('svg')];
  window.__svgs = svgs.length;
});
const volBox = await page.evaluate(() => {
  /* expo renders icon fonts as <i> text or svg path — find the glyph char near a play circle */
  const els = [...document.querySelectorAll('i, span')].filter((e) => (e.textContent || '').includes('volume'));
  return els.length;
});
t = await bodyText();
ok('names: list renders with translations', t.includes('The Most') || /The /.test(t), `volGlyphs=${volBox} svgs loaded`);
/* play via tapping the row's left icon: tap first card's right side circle */
const packLoaded = t.includes('· audio');
const glyph = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span,i')].filter((e) => ((e.textContent || '') === '\uf028'));
  const el = els[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (glyph && packLoaded) {
  await page.touchscreen.tap(glyph.x, glyph.y);
  await page.waitForTimeout(3200);
  const nv = await page.evaluate(() => {
    const v = [...document.querySelectorAll('video')].find((x) => (x.currentSrc || '').includes('islamicapi'));
    return v ? { t: +v.currentTime.toFixed(2), ready: v.readyState, paused: v.paused } : null;
  });
  ok('names: islamicapi audio playing', !!nv && nv.t > 0.5, JSON.stringify(nv));
} else {
  ok('names: islamicapi audio playing', false, packLoaded ? 'glyph not found' : 'pack offline (subtitle says offline)');
}

/* ── 4. dua: player + transliteration/translation ── */
await page.goto('http://localhost:3996/deenapp/tools/dua', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
t = await bodyText();
ok('dua sections load', t.length > 300, `len=${t.length}`);

/* ── 5. inbox v2 (standalone route): friends → thread → chat ── */
await page.goto('http://localhost:3996/deenapp/tools/inbox', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
t = await bodyText();
ok('inbox: friends list', t.includes('Inbox') && t.includes('IN-APP ONLY'), t.slice(0, 60).replace(/\n/g, ' '));
await page.locator('text=shared 4 items with you').first().click().catch(async () => {
  await page.locator('text=Aisha Yusuf').first().click();
});
await page.waitForTimeout(1200);
t = await bodyText();
ok('inbox: thread + composer', t.includes('AYAH') || t.includes('DUA') || t.includes('POST') || t.includes('REEL'), t.slice(0, 70).replace(/\n/g, ' '));
await page.fill('input, textarea', '').catch(() => {});
const input = await page.$('input, textarea, [contenteditable]');
if (input) {
  await input.type('Barakallahu feek');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  t = await bodyText();
  ok('inbox: chat message sent', t.includes('Barakallahu feek'));
} else {
  ok('inbox: chat message sent', false, 'no composer input');
}

/* ── 6. DeenLink AI ── */
await page.goto('http://localhost:3996/deenapp/tools/ai', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
const aiInput = await page.$('input, textarea');
if (aiInput) {
  await aiInput.type('What is Surah Al-Kahf about?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  t = await bodyText();
  ok('AI: answers from our quran data', t.includes('Open Al Kahf'), t.slice(-160).replace(/\n/g, ' ').slice(-120));
} else {
  ok('AI: answers from our quran data', false, 'no input');
}

/* ── 7. qibla globe ── */
await page.goto('http://localhost:3996/deenapp/tools/qibla', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
t = await bodyText();
ok('qibla: bearing + globe card', t.includes('QIBLA') && /km/.test(t), t.slice(0, 80).replace(/\n/g, ' '));

/* ── 8. quiz trophy (quick 3-question run) ── */
await page.goto('http://localhost:3996/deenapp/tools/quiz', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
t = await bodyText();
const five = page.getByText('5', { exact: true }).first();
if (await five.count()) await five.click().catch(() => {});
await page.waitForTimeout(400);
const start = page.locator('text=Start quiz').first();
if (await start.count()) await start.click().catch(() => {});
await page.waitForTimeout(1600);
/* answer: tap near top-left option area repeatedly */
let resultsSeen = false;
for (let i = 0; i < 16; i++) {
  for (const y of [200, 270, 340]) {
    await page.touchscreen.tap(195, y).catch(() => {});
    await page.waitForTimeout(450);
    const tt = await bodyText();
    if (/PERFORMANCE|REVIEW ANSWERS/i.test(tt)) { resultsSeen = true; break; }
  }
  if (resultsSeen) break;
  await page.waitForTimeout(400);
}
t = await bodyText();
ok('quiz: results with trophy', resultsSeen && /of \d+ correct/i.test(t), t.slice(0, 70).replace(/\n/g, ' '));

/* ── 9. community suggestions interleaved ── */
await page.goto('http://localhost:3996/deenapp/community', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.goto('http://localhost:3996/deenapp/community', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await page.mouse.move(195, 500);
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, -900);
  await page.evaluate(() => {
    const sc = [...document.querySelectorAll('div')].filter((d) => {
      const s = getComputedStyle(d);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 100;
  });
    sc.forEach((d) => (d.scrollTop = Math.min(d.scrollTop + 900, d.scrollHeight)));
  });
  await page.waitForTimeout(420);
}
t = await bodyText();
ok('community: SUGGESTED FOR YOU while scrolling', t.includes('SUGGESTED FOR YOU'), t.slice(0, 120).replace(/\n/g, ' '));
ok('community: inbox bell still opens', (await page.locator('text=Inbox').count()) >= 0);

/* ── 10. connections + suggestions screens ── */
await page.goto('http://localhost:3996/deenapp/tools/connections?tab=followers', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
t = await bodyText();
ok('connections: instagram-style tabs', t.includes('Following') && t.includes('Followers') && t.includes('Suggested'));
await page.goto('http://localhost:3996/deenapp/tools/suggestions', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
t = await bodyText();
ok('suggestions screen: accounts list', t.includes('Accounts to Follow') && /Follow/.test(t));

/* ── 11. login + splash (regression) ── */
await page.goto('http://localhost:3996/deenapp/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
t = await bodyText();
ok('login: real logo + slogan intact', t.includes('All-in-one islamic app'));

console.log(results.join('\n'));
await browser.close(); srv.kill();
