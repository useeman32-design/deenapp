/* pass 101 — the owner's ask, executed end to end in a real browser:
 *   "make sure the daily videos is wired in the admin so that i can be
 *    uploading my videos or youtube videos as daily videos in the app"
 *
 * Part A — the ADMIN UI: log in, open Videos Management, add a daily from a
 *          YouTube link and a daily from an uploaded file (real multipart).
 * Part B — the APP: the home Daily Videos strip shows both, the YouTube one
 *          opens a player that embeds it, the uploaded one opens the video.
 *
 *   node scripts/verify101-daily.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const APP = process.env.APP || 'http://127.0.0.1:8099';
const CHROME = process.env.CHROME_BIN || '/home/user/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const results = [];
const check = (label, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${label}${cond ? '' : '  << ' + String(extra).slice(0, 400)}`);
  console.log(results[results.length - 1]);
};
const OUT = '/tmp/pwtest/out';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

// ═══════════════ PART A — ADMIN ═══════════════
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ap = await actx.newPage();
const aerr = [];
ap.on('pageerror', (e) => aerr.push('PAGEERROR ' + (e.message || '').slice(0, 200)));
ap.on('console', (m) => { if (m.type() === 'error') aerr.push('CONSOLE ' + m.text().slice(0, 200)); });
const aposts = [];
ap.on('response', (r) => { if (r.url().includes('/api/admin/videos/')) aposts.push(`${r.status()} ${r.request().method()} ${r.url().split('/api/')[1]}`); });

console.log('\n=== PART A — admin UI ===');
await ap.goto(APP + '/admin/login.html', { waitUntil: 'domcontentloaded' });
await ap.waitForTimeout(2500);
// the real form: #identifier / #password / button[type=submit]
await ap.fill('#identifier', 'useeman31@gmail.com');
await ap.fill('#password', 'AdminPass123!');
await ap.click('#loginForm button[type="submit"], form button[type="submit"]');
await ap.waitForTimeout(5000);
const loggedIn = await ap.evaluate(async () => {
  const r = await fetch('../api/admin/auth/me.php', { credentials: 'include' });
  return { status: r.status, body: (await r.text()).slice(0, 160) };
});
console.log('admin me.php after form login:', JSON.stringify(loggedIn));
check('A0 admin form login works', loggedIn.status === 200, JSON.stringify(loggedIn));
console.log('after login url:', ap.url());

await ap.goto(APP + '/admin/video-management.html', { waitUntil: 'domcontentloaded' });
await ap.waitForTimeout(6000);
let atext = await ap.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
check('A1 Videos Management page loads (no login wall)', !/sign in to|login required/i.test(atext), atext.slice(0, 160));
check('A2 Daily Videos tab + Add button present', /Daily Videos/i.test(atext) && /Add Daily Video|Add Daily/i.test(atext), atext.slice(0, 300));
console.log('   admin text:', JSON.stringify(atext.slice(0, 220)));
await ap.screenshot({ path: `${OUT}/a1-video-management.png` });

// open the Add Daily Video modal (real click on the real button)
await ap.click('#addDailyVideoBtn');
await ap.waitForTimeout(1200);
const modalUp = await ap.evaluate(() => document.querySelector('#dailyVideoModal')?.classList.contains('active'));
check('A3 Add Daily Video modal opens', !!modalUp);

const selects = await ap.evaluate(() => ({
  accounts: document.querySelector('#dailyAccountSelect')?.options.length || 0,
  categories: document.querySelector('#dailyCategorySelect')?.options.length || 0,
}));
console.log('   dropdown options:', JSON.stringify(selects));
check('A4 Account + Category dropdowns are POPULATED (they were empty before the fix)', selects.accounts > 0 && selects.categories > 0, JSON.stringify(selects));

// ── add a daily from a YouTube link through the page's own form ──
await ap.selectOption('#dailySourceType', 'youtube');
await ap.fill('#dailySourceUrl', YT);
await ap.fill('#dailyTitle', 'Admin UI daily (YouTube)');
await ap.waitForTimeout(400);
await ap.evaluate(() => { const s = document.querySelector('#dailyAccountSelect'); s.selectedIndex = 0; s.dispatchEvent(new Event('change', { bubbles: true })); });
await ap.evaluate(() => { const s = document.querySelector('#dailyCategorySelect'); s.selectedIndex = s.options.length > 1 ? 1 : 0; s.dispatchEvent(new Event('change', { bubbles: true })); });
const submitYt = await ap.evaluate(() => {
  const btn = document.querySelector('#dailyVideoForm button[type="submit"]');
  if (!btn) return null;
  btn.click();
  return true;
});
await ap.waitForTimeout(7000);
let gridYt = await ap.evaluate(() => document.querySelector('#dailyVideosGrid')?.innerText || '');
check('A5 YouTube daily added through the admin form', !!submitYt && /Admin UI daily \(YouTube\)/.test(gridYt), `submit=${submitYt} grid=${JSON.stringify(gridYt.slice(0, 220))}`);
await ap.screenshot({ path: `${OUT}/a2-after-youtube-daily.png` });

/* pass 101b — the previous fixture (/tmp/test_daily.mp4) is 40 KB of junk: Chromium
 * rejects it (DEMUXER_ERROR), so playback could never be proven. Upload a REAL file
 * through the page's own form; VP8/WebM because this Chromium build ships no H.264. */
await ap.click('#addDailyVideoBtn');
await ap.waitForTimeout(1000);
await ap.selectOption('#dailySourceType', 'local');
await ap.fill('#dailyTitle', 'Admin UI daily (real file)');
await ap.setInputFiles('#dailyVideoFile', '/tmp/real_daily.webm');
await ap.setInputFiles('#dailyPosterFile', '/tmp/test_poster.jpg');
await ap.waitForTimeout(400);
await ap.evaluate(() => { const s = document.querySelector('#dailyAccountSelect'); s.selectedIndex = 0; s.dispatchEvent(new Event('change', { bubbles: true })); });
await ap.evaluate(() => { const s = document.querySelector('#dailyCategorySelect'); s.selectedIndex = s.options.length > 1 ? 1 : 0; s.dispatchEvent(new Event('change', { bubbles: true })); });
const submitReal = await ap.evaluate(() => {
  const btn = document.querySelector('#dailyVideoForm button[type="submit"]');
  if (!btn) return null;
  btn.click();
  return true;
});
await ap.waitForTimeout(9000);
const gridReal = await ap.evaluate(() => document.querySelector('#dailyVideosGrid')?.innerText || '');
check('A6b a REAL (playable) uploaded daily is saved through the admin form', !!submitReal && /Admin UI daily \(real file\)/.test(gridReal), `submit=${submitReal} grid=${JSON.stringify(gridReal.slice(0, 220))}`);
await ap.screenshot({ path: `${OUT}/a2b-after-real-daily.png` });

// ── add a daily from an uploaded file ──
await ap.click('#addDailyVideoBtn');
await ap.waitForTimeout(1000);
await ap.selectOption('#dailySourceType', 'local');
await ap.fill('#dailyTitle', 'Admin UI daily (uploaded file)');
await ap.setInputFiles('#dailyVideoFile', '/tmp/test_daily.mp4');
await ap.setInputFiles('#dailyPosterFile', '/tmp/test_poster.jpg');
await ap.waitForTimeout(400);
await ap.evaluate(() => { const s = document.querySelector('#dailyAccountSelect'); s.selectedIndex = 0; s.dispatchEvent(new Event('change', { bubbles: true })); });
await ap.evaluate(() => { const s = document.querySelector('#dailyCategorySelect'); s.selectedIndex = s.options.length > 1 ? 1 : 0; s.dispatchEvent(new Event('change', { bubbles: true })); });
const submitUp = await ap.evaluate(() => {
  const btn = document.querySelector('#dailyVideoForm button[type="submit"]');
  if (!btn) return null;
  btn.click();
  return true;
});
await ap.waitForTimeout(9000);
const gridBoth = await ap.evaluate(() => document.querySelector('#dailyVideosGrid')?.innerText || '');
check('A6 Uploaded daily added through the admin form', !!submitUp && /Admin UI daily \(uploaded file\)/.test(gridBoth), JSON.stringify(gridBoth.slice(0, 220)));
check('A7 both new dailies are listed in the admin Daily grid', /Admin UI daily \(YouTube\)/.test(gridBoth) && /Admin UI daily \(uploaded file\)/.test(gridBoth), JSON.stringify(gridBoth.slice(0, 260)));
const queueUi = await ap.evaluate(() => {
  const stats = document.querySelector('#dailyQueueStats');
  return { statsText: stats ? stats.innerText.replace(/\s+/g, ' ').trim().slice(0, 90) : null, cards: document.querySelectorAll('#dailyVideosGrid .video-card, #dailyVideosGrid [class*=card]').length };
});
console.log('   queue stats:', JSON.stringify(queueUi));
check('A8 admin shows the daily queue counters', !!queueUi.statsText && /(pending|active|expired)/i.test(queueUi.statsText), JSON.stringify(queueUi));
console.log('   admin api calls:', JSON.stringify([...new Set(aposts)]));
await ap.screenshot({ path: `${OUT}/a3-daily-list.png`, fullPage: false });

// ═══════════════ PART B — APP ═══════════════
console.log('\n=== PART B — the app ===');
const uctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const up = await uctx.newPage();
const uerr = [];
up.on('pageerror', (e) => uerr.push('PAGEERROR ' + (e.message || '').slice(0, 200)));
up.on('console', (m) => { if (m.type() === 'error') uerr.push('CONSOLE ' + m.text().slice(0, 200)); });
const umedia = new Map(); /* pass 101b — /uploads statuses, for the playback proof */
up.on('response', (r) => { const u = r.url(); if (u.includes('/uploads/')) umedia.set(u.split('?')[0].replace(APP, ''), r.status()); });
await up.goto(APP + '/login', { waitUntil: 'domcontentloaded' });
await up.waitForTimeout(3500);
const ufields = await up.$$('input');
await ufields[0].fill('usman_ahmad');
await ufields[1].fill('Str0ngPass!23');
await up.getByText('Sign In', { exact: true }).first().click().catch(() => {});
await up.waitForTimeout(6000);

await up.goto(APP + '/', { waitUntil: 'domcontentloaded' });
await up.waitForTimeout(9000);
const homeText = await up.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const strip = await up.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf('Daily Videos');
  return i < 0 ? null : t.slice(i, i + 260).replace(/\s+/g, ' ');
});
console.log('   daily strip:', JSON.stringify(strip));
check('B1 home shows the Daily Videos strip', /Daily Videos/.test(homeText), homeText.slice(0, 200));
const titles = await up.evaluate(() => [...document.querySelectorAll('img')].length);
// tap the YouTube daily card with a REAL mouse click (RNW Pressable)
const cardPoint = async (title) => {
  // scroll the card into view first (the strip is below the fold on Home)
  await up.evaluate((t) => {
    const el = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === t && e.children.length === 0)[0];
    if (el) el.scrollIntoView({ block: 'center' });
  }, title);
  await up.waitForTimeout(800);
  return up.evaluate((t) => {
    const el = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === t && e.children.length === 0)[0];
    if (!el) return null;
    // walk up to the pressable card (RNW renders role=button / tabindex on it)
    let card = el;
    for (let i = 0; i < 6 && card; i++) {
      if (card.getAttribute && (card.getAttribute('role') === 'button' || card.getAttribute('tabindex') !== null)) break;
      card = card.parentElement;
    }
    const r = (card || el).getBoundingClientRect();
    if (r.width === 0) return null;
    return { x: Math.round(r.x + Math.min(r.width, 150) / 2), y: Math.round(r.y + 50), w: Math.round(r.width), h: Math.round(r.height), scrolled: true };
  }, title);
};
const p1 = await cardPoint('Admin UI daily (YouTube)');
console.log('   YT card point:', JSON.stringify(p1));
if (p1) await up.mouse.click(p1.x, p1.y);
await up.waitForTimeout(5000);
const modal = await up.evaluate(() => {
  const ifr = document.querySelector('iframe');
  const vid = document.querySelector('video');
  return {
    iframe: ifr ? ifr.getAttribute('src') : null,
    videoSrc: vid ? (vid.currentSrc || vid.src || '').slice(-50) : null,
    ytNote: /Now playing on YouTube/i.test(document.body.innerText),
    titleShown: /Admin UI daily \(YouTube\)/.test(document.body.innerText),
  };
});
console.log('   modal:', JSON.stringify(modal));
check('B2 YouTube daily opens the embedded player', !!(modal.iframe && /youtube\.com\/embed\//.test(modal.iframe)), JSON.stringify(modal));
await up.screenshot({ path: `${OUT}/b1-yt-daily-open.png` });

// close the viewer
await up.mouse.click(10, 450).catch(() => {});
await up.waitForTimeout(2000);

/* pass 101b — B3 was unprovable as written: `document.querySelector('video')` finds the
 * app's hidden 2x2 AUDIO engine, and the old fixture was not a decodable file. Target the
 * viewer's own player (the big one), assert it carries the uploaded file, that the file
 * came back 200, and that the clock actually ADVANCES. */
const p3 = await cardPoint('Admin UI daily (real file)');
console.log('   real-file card point:', JSON.stringify(p3));
if (p3) await up.mouse.click(p3.x, p3.y);
await up.waitForTimeout(4000);
const viewer = await up.evaluate(() => {
  const v = [...document.querySelectorAll('video')].find((e) => e.getBoundingClientRect().width > 100) || null;
  return v
    ? { srcAttr: v.getAttribute('src'), currentSrc: v.currentSrc, controls: v.controls, readyState: v.readyState, err: v.error ? v.error.code + ':' + v.error.message : null, w: Math.round(v.getBoundingClientRect().width) }
    : null;
});
console.log('   uploaded-daily viewer:', JSON.stringify(viewer));
const vSrc = (viewer && (viewer.srcAttr || viewer.currentSrc)) || '';
check('B3 uploaded daily opens the real inline player on its own file', !!(viewer && /\/uploads\/videos\//.test(vSrc)), JSON.stringify(viewer));
const fileUrl = vSrc.split('?')[0];
console.log('   media request for that file:', umedia.get(fileUrl));
check('B3b the app fetched that file from the server (200)', umedia.get(fileUrl) === 200, `${fileUrl} -> ${umedia.get(fileUrl)}`);
const played = await up.evaluate(async () => {
  const v = [...document.querySelectorAll('video')].find((e) => e.getBoundingClientRect().width > 100);
  if (!v) return { err: 'no player' };
  try { await v.play(); } catch (e) { return { err: 'play() ' + e.message }; }
  await new Promise((r) => setTimeout(r, 1500));
  return { currentTime: v.currentTime, paused: v.paused, readyState: v.readyState, w: v.videoWidth, h: v.videoHeight, err: v.error ? v.error.code : null };
});
console.log('   playback:', JSON.stringify(played));
check('B3c the uploaded daily really plays (clock advances)', played.currentTime > 0.2 && !played.err, JSON.stringify(played));
await up.screenshot({ path: `${OUT}/b3-upload-daily-playing.png` });

// playback must stop when the viewer is dismissed (strict stop rule)
await up.mouse.click(10, 450).catch(() => {});
await up.waitForTimeout(1800);
const after = await up.evaluate(() => [...document.querySelectorAll('video')].filter((v) => v.getBoundingClientRect().width > 100).map((v) => ({ paused: v.paused, t: Math.round(v.currentTime * 100) / 100 })));
console.log('   after close:', JSON.stringify(after));
check('B3d closing the viewer stops the video', after.length === 0 || after.every((v) => v.paused), JSON.stringify(after));

const pageErrs = [...new Set(uerr)].filter((e) => e.startsWith('PAGEERROR'));
console.log('   app errors:', JSON.stringify([...new Set(uerr)].slice(0, 6)));
check('B4 no page errors on the app side', pageErrs.length === 0, pageErrs.join(' | '));

await browser.close();
fs.writeFileSync(`${OUT}/verify101.txt`, results.join('\n'));
console.log('\n' + results.join('\n'));
