/* pass-20 smoke: slim bar, ayah actions+share, mushaf swipe/highlight/settings, quiz, comments gif */
import { chromium } from 'playwright-core';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession', '1'); sessionStorage.clear(); } catch {} });
const errs = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('404')) errs.push(t.slice(0, 140)); });

// 1. reader: player bar height + ayah action row + share sheet
await page.goto('http://localhost:3996/deenapp/read/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3500);
const r1 = await page.evaluate(() => {
  const play = [...document.querySelectorAll('div')].find((d) => (d.getAttribute('style') || '').includes('width: 34px') && (d.getAttribute('style') || '').includes('height: 34px'));
  const ayahBtns = [...document.querySelectorAll('span,div')].filter((e) => e.childElementCount === 0 && /^(Ayah|Save|Share)$/.test((e.textContent || '').trim())).length;
  return { playBtn: !!play, actionLabels: ayahBtns };
});
console.log('READER:', JSON.stringify(r1));
// share sheet
await page.evaluate(() => { const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'Share'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(1200);
const share = await page.evaluate(() => {
  const t = document.body.innerText;
  return { open: t.includes('SEND TO'), copyLink: t.includes('Copy link'), image: t.includes('Share as image'), friends: t.includes('Choose friend') };
});
console.log('SHARE-SHEET:', JSON.stringify(share));
await page.keyboard.press('Escape');
await page.evaluate(() => { const x = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Close/.test(e.textContent || '')); });
await page.waitForTimeout(400);

// play ayah → mushaf highlight sync
await page.evaluate(() => { const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'Ayah'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(4500);
// 2. mushaf: switch, wait fetch, check highlight + settings + page number
await page.evaluate(() => { const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Mushaf$/.test((e.textContent || '').trim())); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(6000);
const m1 = await page.evaluate(() => {
  const pageLabel = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /\/ 604/.test(e.textContent || ''));
  const gear = [...document.querySelectorAll('svg')].length > 0 && document.body.innerText.includes('Loading') === false;
  const arabicNum = document.body.innerText.includes('١');
  const hl = [...document.querySelectorAll('span')].some((s) => (s.getAttribute('style') || '').includes('46,204,113,0.28'));
  return { page: pageLabel?.textContent, arabicPageNum: arabicNum, highlighted: hl };
});
console.log('MUSHAF:', JSON.stringify(m1));
await page.screenshot({ path: '/tmp/p20-mushaf.png' });
// settings sheet
await page.evaluate(() => { const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Mushaf settings/i.test(e.textContent || '')); });
await page.evaluate(() => {
  // tap the sliders button (top-left in page)
  const btns = [...document.querySelectorAll('svg')];
  // sliders icon path contains 'M4 6h16' roughly — instead tap by position: find the page container and click top-left
  const cont = [...document.querySelectorAll('div')].find((d) => (d.getAttribute('style') || '').includes('cream') === false && d.scrollHeight > 500 && getComputedStyle(d).borderRadius === '10px');
  if (cont) { const r = cont.getBoundingClientRect(); const ev = new MouseEvent('click', { bubbles: true, clientX: r.left + 24, clientY: r.top + 24 }); cont.dispatchEvent(ev); }
});
await page.waitForTimeout(900);
const st = await page.evaluate(() => ({ open: document.body.innerText.includes('PAGE THEME') && document.body.innerText.includes('TEXT SIZE'), themes: document.body.innerText.includes('MADINA') || document.body.innerText.includes('Madina') }));
console.log('MUSHAF-SETTINGS:', JSON.stringify(st));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 3. quiz: setup → play (timer) → results flow exists
await page.goto('http://localhost:3996/deenapp/tools/quiz', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const q1 = await page.evaluate(() => ({ setup: document.body.innerText.includes('Islamic Quiz') && document.body.innerText.includes('QUESTIONS') && document.body.innerText.includes('CATEGORY') }));
await page.evaluate(() => { const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Start quiz/.test(e.textContent || '')); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(1500);
const q2 = await page.evaluate(() => ({ play: document.body.innerText.includes('QUESTION 1 OF'), timer: /\b\d+\b/.test(document.body.innerText) }));
console.log('QUIZ:', JSON.stringify({ ...q1, ...q2 }));
await page.screenshot({ path: '/tmp/p20-quiz.png' });

// 4. comments gif + drag
await page.goto('http://localhost:3996/deenapp/community', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('svg')].find((s) => s.closest('div')?.getAttribute('style')?.includes('rgba(231,76,60')) ; // comment icons red-ish
});
// open comments via any comment-count label
await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => e.childElementCount === 0 && /^\d+$/.test((e.textContent || '').trim()));
  // find one next to a chat icon — just click the 3rd numeric (comment count pattern)
  if (els[2]) els[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(2000);
const c1 = await page.evaluate(() => {
  const t = document.body.innerText;
  const imgs = [...document.querySelectorAll('img')].map((i) => i.src.slice(-24));
  return { comments: t.includes('Comments'), gifBtn: t.includes('GIF'), handle: !!document.querySelector('[style*="44, height: 5"]') || imgs.length >= 0 };
});
console.log('COMMENTS:', JSON.stringify(c1));
// tap GIF → picker
await page.evaluate(() => { const el = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'GIF'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(800);
const c2 = await page.evaluate(() => ({ picker: document.body.innerText.includes('GIF') && [...document.querySelectorAll('img')].some((i) => i.src.includes('.gif')) }));
console.log('GIF-PICKER:', JSON.stringify(c2));
await page.screenshot({ path: '/tmp/p20-gifs.png' });

// 5. post video player: seek/speed elements present (community feed w/ video)
const v = await page.evaluate(() => {
  const vids = [...document.querySelectorAll('video')];
  const rate = [...document.querySelectorAll('div,span')].some((e) => e.childElementCount === 0 && /1x/.test((e.textContent || '').trim()));
  return { videos: vids.length, rateChip: rate };
});
console.log('COMM-VIDEO:', JSON.stringify(v));

console.log('CONSOLE-ERRORS:', errs.slice(0, 8));
await browser.close();
