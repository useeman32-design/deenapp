/* pass 100 — reproduce the owner's four reports on the LOCAL build (current
 * source) against the rig DB (his own dump). Logs in as a real account instead
 * of registering (live signup is rate-limited + needs email OTP).
 *
 *   APP=http://127.0.0.1:8081  node scripts/repro100-rig.mjs
 */
import { chromium } from 'playwright-core';

const APP = process.env.APP || 'http://127.0.0.1:8099';
const CHROME = process.env.CHROME_BIN || '/home/user/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const USER = process.env.RIG_USER || 'usman_ahmad';
const PASS = process.env.RIG_PASS || 'Str0ngPass!23';
const API = APP;
const out = [];
const line = (s) => { out.push(s); console.log(s); };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
let errors = [], bad = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack || e.message || '').slice(0, 1000)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 500)); });
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '').slice(0, 130)}`); });
page.on('dialog', (d) => d.accept().catch(() => {}));

const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const hasCrash = async () => /hit a problem/i.test(await bodyText());
const crashDetail = async () => {
  const t = await page.evaluate(() => document.body.innerText);
  const i = t.search(/hit a problem/i);
  return i >= 0 ? t.slice(Math.max(0, i - 120), i + 1200).replace(/\s+/g, ' ') : null;
};
const tapText = (text) => page.evaluate((t) => {
  const els = Array.from(document.querySelectorAll('div,span,a,button'))
    .filter((e) => (e.textContent || '').trim() === t && e.children.length <= 3);
  const el = els[els.length - 1];
  if (!el) return null;
  const o = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', o));
  el.dispatchEvent(new PointerEvent('pointerup', o));
  el.dispatchEvent(new MouseEvent('click', o));
  return true;
}, text);

// ── login through the real UI ───────────────────────────────────────────────
await page.goto(APP + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
const inputs = await page.$$('input');
line(`login inputs: ${inputs.length}`);
if (inputs.length < 2) { line('LOGIN FORM NOT FOUND — aborting'); line(await bodyText()); await browser.close(); process.exit(1); }
await inputs[0].fill(USER);
await inputs[1].fill(PASS);
await tapText('Sign In');
await page.waitForTimeout(6000);
line(`after sign-in text: ${JSON.stringify((await bodyText()).slice(0, 200))}`);
const me = await page.evaluate(async (api) => {
  const r = await fetch(api + '/api/auth/me.php', { credentials: 'include' });
  return { status: r.status, body: (await r.text()).slice(0, 300) };
}, API);
line(`me.php via browser: ${JSON.stringify(me)}`);
await page.screenshot({ path: '/tmp/pwtest/out/r100rig-00-login.png' });

// ── HOME first (fresh account feed) ────────────────────────────────────────
errors = []; bad = [];
await page.goto(APP + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
line(`\nHOME text: ${JSON.stringify((await bodyText()).slice(0, 400))}`);
line(`HOME crash: ${await hasCrash()}`);
if (await hasCrash()) line('HOME CRASH DETAIL: ' + JSON.stringify(await crashDetail()));
line(`HOME errors: ${JSON.stringify([...new Set(errors)].slice(0, 5))}`);
line(`HOME api>=400: ${JSON.stringify([...new Set(bad)].slice(0, 8))}`);
await page.screenshot({ path: '/tmp/pwtest/out/r100rig-01-home.png' });

// ── REPORT 1: VIDEOS ───────────────────────────────────────────────────────
errors = []; bad = [];
line('\n=== REPORT 1: VIDEOS PAGE ===');
const t0 = Date.now();
const t1 = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
await page.goto(APP + '/videos', { waitUntil: 'domcontentloaded' });
let vidAt = null;
try { await page.waitForFunction(() => !!document.querySelector('video'), { timeout: 40000 }); vidAt = t1(); } catch { line('no <video> in 40s'); }
line(`first <video> at ${vidAt ?? 'n/a'} (nav start t0)`);
await page.waitForTimeout(9000);
line(`t=${t1()} videos text: ${JSON.stringify((await bodyText()).slice(0, 400))}`);
line(`crash: ${await hasCrash()}`);
if (await hasCrash()) line('CRASH DETAIL: ' + JSON.stringify(await crashDetail()));
const vs = await page.evaluate(async () => {
  const els = Array.from(document.querySelectorAll('video'));
  const first = els[0];
  const before = first ? first.currentTime : null;
  await new Promise((r) => setTimeout(r, 3000));
  return els.map((v, i) => ({
    i, src: (v.currentSrc || v.src || '').split('/').pop().slice(0, 55), rs: v.readyState, ns: v.networkState,
    paused: v.paused, dur: v.duration, t: [i === 0 ? before : null, v.currentTime], err: v.error ? v.error.code : null,
    w: v.clientWidth, h: v.clientHeight,
  }));
});
line(`t=${t1()} video elements: ${JSON.stringify(vs)}`);
line(`videos errors: ${JSON.stringify([...new Set(errors)].slice(0, 8))}`);
line(`videos api>=400: ${JSON.stringify([...new Set(bad)].slice(0, 8))}`);
await page.screenshot({ path: '/tmp/pwtest/out/r100rig-02-videos.png' });

// ── REPORT 2: COMMENT TAP ──────────────────────────────────────────────────
errors = []; bad = [];
line('\n=== REPORT 2: COMMENT TAP (community feed) ===');
await page.goto(APP + '/community', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const ctext = await bodyText();
line(`community text: ${JSON.stringify(ctext.slice(0, 500))}`);
line(`crash: ${await hasCrash()}`);
if (await hasCrash()) line('CRASH DETAIL: ' + JSON.stringify(await crashDetail()));
const affordance = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div,span'));
  const hits = els.filter((e) => /^(Comment|Comments|\d+ ?Comments?)$/i.test((e.textContent || '').trim()) && e.children.length <= 2);
  const el = hits[hits.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { label: (el.textContent || '').trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
line(`comment affordance: ${JSON.stringify(affordance)}`);
if (affordance) {
  await page.mouse.click(affordance.x, affordance.y);
  await page.waitForTimeout(6000);
  const t = await bodyText();
  line(`after Comment tap: ${JSON.stringify(t.slice(0, 400))}`);
  line(`crash: ${await hasCrash()}`);
  if (await hasCrash()) line('CRASH DETAIL: ' + JSON.stringify(await crashDetail()));
  line(`errors: ${JSON.stringify([...new Set(errors)].slice(0, 8))}`);
  line(`api>=400: ${JSON.stringify([...new Set(bad)].slice(0, 8))}`);
  await page.screenshot({ path: '/tmp/pwtest/out/r100rig-03-comments.png' });
}

// ── REPORT 4: BROWSE SCHOLARS ──────────────────────────────────────────────
errors = []; bad = [];
line('\n=== REPORT 4: BROWSE SCHOLARS ===');
await page.goto(APP + '/tools/scholars', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);
line(`scholars text: ${JSON.stringify((await bodyText()).slice(0, 700))}`);
line(`crash: ${await hasCrash()}`);
if (await hasCrash()) line('CRASH DETAIL: ' + JSON.stringify(await crashDetail()));
line(`errors: ${JSON.stringify([...new Set(errors)].slice(0, 6))}`);
line(`api>=400: ${JSON.stringify([...new Set(bad)].slice(0, 6))}`);
await page.screenshot({ path: '/tmp/pwtest/out/r100rig-04-scholars.png' });
const rosterCount = await page.evaluate(async (api) => {
  const r = await fetch(api + '/api/questions/scholars.php', { credentials: 'include' });
  const j = await r.json().catch(() => null);
  return { status: r.status, n: (j?.scholars ?? j?.data ?? []).length, sample: (j?.scholars ?? j?.data ?? [])[0] ?? null, keys: j ? Object.keys(j) : null };
}, API);
line(`scholars.php via browser: ${JSON.stringify(rosterCount).slice(0, 700)}`);

line(`\nALL ERRORS SEEN: ${JSON.stringify([...new Set(errors)].slice(0, 10))}`);
await browser.close();
import fs from 'node:fs';
fs.writeFileSync('/tmp/pwtest/out/repro100-rig.txt', out.join('\n'));
console.log('\n→ /tmp/pwtest/out/repro100-rig.txt');
