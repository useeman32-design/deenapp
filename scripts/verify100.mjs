/* pass 100 verification — the four owner reports, on the FIXED build, rig data. */
import { chromium } from 'playwright-core';
const APP = 'http://127.0.0.1:8099';
const CHROME = '/home/user/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const results = [];
const check = (label, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${label}${cond ? '' : '  << ' + extra}`); console.log(results[results.length - 1]); };
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
const p = await ctx.newPage();
let errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + (e.message || '').slice(0, 220)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 220)); });
const api = [];
p.on('response', (r) => { if (r.url().includes('/api/')) api.push(r.url().replace(APP + '/api/', '').replace(/&cursor=\d+/, '')); });
const txt = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const crash = async () => /hit a problem/i.test(await p.evaluate(() => document.body.innerText));

await p.goto(APP + '/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500);
const ins = await p.$$('input'); await ins[0].fill('usman_ahmad'); await ins[1].fill('Str0ngPass!23');
await p.getByText('Sign In', { exact: true }).first().click().catch(() => {});
await p.waitForTimeout(6000);

// ── #1 videos ──
api.length = 0; errs.length = 0;
const t0 = Date.now();
await p.goto(APP + '/videos', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(15000);
const storm = api.filter((u) => u.includes('videos/list.php')).length;
const feedStorm = api.filter((u) => u.includes('feed/get_posts.php')).length;
check(`#1 videos: no refetch storm (videos/list=${storm}, feed=${feedStorm} in 15s)`, storm <= 6 && feedStorm <= 6, JSON.stringify(api.slice(0, 12)));
const vstate = await p.evaluate(async () => {
  const v = document.querySelector('video');
  if (!v) return null;
  const t = v.currentTime; await new Promise((r) => setTimeout(r, 5000));
  return { src: (v.currentSrc || v.src || '').slice(-42), rs: v.readyState, changed: v.currentTime > t, dur: v.duration, err: v.error ? v.error.code : null, w: v.clientWidth };
});
check('#1 videos: reel media loads (readyState>0 or progressing)', !!vstate && (vstate.rs > 0 || vstate.changed), JSON.stringify(vstate));
check('#1 videos: no crash screen', !(await crash()));
console.log('   video:', JSON.stringify(vstate));
console.log('   text:', JSON.stringify((await txt()).slice(0, 150)));
await p.screenshot({ path: '/tmp/pwtest/out/v100-videos.png' });

// ── #2 comments (feed + reel) ──
errs.length = 0;
await p.goto(APP + '/community', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(8000);
const btn = await p.$('[aria-label="open comments"]');
check('#2 comments: affordance found', !!btn);
if (btn) {
  await btn.click(); await p.waitForTimeout(6000);
  const c = await crash();
  check('#2 comments: no CrashBoundary', !c, [...new Set(errs)].slice(0, 3).join(' | '));
  const t = await txt();
  check('#2 comments: thread UI opened', /comment|write|reply/i.test(t), t.slice(0, 120));
  await p.screenshot({ path: '/tmp/pwtest/out/v100-comments.png' });
}
// reel comments
errs.length = 0;
await p.goto(APP + '/videos', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(8000);
const rbtn = await p.$('[aria-label="open comments"]');
check('#2 reel comments: affordance found', !!rbtn);
if (rbtn) { await rbtn.click(); await p.waitForTimeout(5000); check('#2 reel comments: no crash', !(await crash())); await p.screenshot({ path: '/tmp/pwtest/out/v100-reel-comments.png' }); }

// ── #4 scholars ──
errs.length = 0;
await p.goto(APP + '/tools/scholars', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(9000);
let t = await txt();
if (/Browse scholars/i.test(t)) { await p.evaluate(() => { const el = [...document.querySelectorAll('div,span')].filter(e => (e.textContent || '').trim() === 'Browse scholars').pop(); if (el) { const o = { bubbles: true, composed: true, cancelable: true, view: window }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('click', o)); } }); await p.waitForTimeout(5000); }
t = await txt();
check('#4 scholars: roster renders without a category tap', !/No scholar matches/i.test(t), t.slice(0, 200));
check('#4 scholars: no crash', !(await crash()));
console.log('   roster text:', JSON.stringify(t.slice(0, 260)));
await p.screenshot({ path: '/tmp/pwtest/out/v100-scholars.png' });
console.log('\nERRORS:', JSON.stringify([...new Set(errs)].slice(0, 6)));
await b.close();
import fs from 'node:fs';
fs.writeFileSync('/tmp/pwtest/out/verify100.txt', results.join('\n'));
