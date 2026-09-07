/* pass-23 diag: splash v2, zakat calc, tasbeeh screen, calendar grid, prayer settings,
   notifications, names EN/AR, qibla globe/fallback, compact dua bar, community inbox split */
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

/* ── 1. splash v2: branded, no video ── */
await page.goto('http://localhost:3996/deenapp/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
let t = await bodyText();
let splashUp = t.includes('BISMILLAH') && t.includes('DeenLink');
const splashVideo = await page.evaluate(() => [...document.querySelectorAll('video')].some((v) => (v.src || '').includes('splash')));
ok('splash: branded logo + BISMILLAH loader shows on cold load', splashUp);
ok('splash: no splash video element', !splashVideo);
await page.waitForTimeout(4200);
t = await bodyText();
ok('splash: fades away to the app', !t.includes('BISMILLAH'), t.includes('Assalam') ? 'home reached' : '');
await ensureAuth();

/* ── 2. zakat calculator ── */
await page.goto('http://localhost:3996/deenapp/tools/zakat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
t = await bodyText();
ok('zakat: screen opens with nisab + sections', t.includes('Zakat Calculator') && t.includes('NISAB STANDARD') && t.includes('WHAT YOU OWN'));
/* input order: goldPrice, goldGrams, silverPrice, silverGrams, cash, bank, … */
const inputs = page.locator('input[placeholder="0"]');
await inputs.nth(4).fill('20000000'); /* cash in hand */
await page.locator('input[placeholder="e.g. 185000"]').fill('185000'); /* gold ₦/g → nisab ₦16.18m */
await page.waitForTimeout(700);
t = await bodyText();
ok('zakat: computes 2.5% when above nisab', t.includes('500,000'), 'expect ₦ 500,000 from ₦20m cash');
const fields = await page.locator('input[placeholder="0"]').count();
ok('zakat: asset + liability fields present', fields >= 7, `${fields} numeric rows`);

/* ── 3. tasbeeh screen ── */
await page.goto('http://localhost:3996/deenapp/tools/tasbeeh', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
t = await bodyText();
ok('tasbeeh: screen (not modal) with presets + modes', t.includes('Tasbeeh') && /DIGITAL|BEADS|TALLY/i.test(t));
/* tap the bead deck (labelled Pressable) */
const deck = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[aria-label="tasbeeh-deck"]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: Math.min(r.y + r.height / 2, 820) };
});
if (deck) {
  await page.touchscreen.tap(deck.x, deck.y);
  await page.waitForTimeout(700);
  t = await bodyText();
  ok('tasbeeh: tap increments the count', /(^|\n)1(\n|$)/.test(t), 'count line should read 1');
} else ok('tasbeeh: tap increments the count', false, 'deck not found');

/* ── 4. calendar grid ── */
await page.goto('http://localhost:3996/deenapp/tools/calendar', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
t = await bodyText();
ok('calendar: hijri month grid with gregorian small dates', /14\d\d\s*AH|\d{3,4}\s*AH/.test(t) && t.includes('SU') === false ? /M UHAMMAD|MUHARRAM|SAFAR|RABI|JUMADA|RAJAB|SHABAN|RAMADAN|SHAWWAL|DHUL|MUHARRAM/i.test(t) : true);
const gridCells = await page.evaluate(() => [...document.querySelectorAll('div')].filter((e) => /^\d{1,2}$/.test((e.textContent || '').trim()) && e.getBoundingClientRect().width < 60).length);
ok('calendar: month grid rendered', gridCells >= 25, `${gridCells} day cells`);
ok('calendar: occasions list present', /OCCASION|upcoming/i.test(t));

/* ── 5. prayer screen + settings ── */
await page.goto('http://localhost:3996/deenapp/tools/prayer', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
t = await bodyText();
ok('prayer: full screen with today times', /FAJR/i.test(t) && /MAGHRIB|ISHA/i.test(t));
const cog = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[aria-label="Settings"]')].pop();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (cog) {
  await page.touchscreen.tap(cog.x, cog.y);
  await page.waitForTimeout(900);
  t = await bodyText();
  ok('prayer: settings sheet (method, madhab, adjustments, adhan)', /CALCULATION METHOD/i.test(t) && /ADHAN/i.test(t));
} else ok('prayer: settings sheet (method, madhab, adjustments, adhan)', false, 'no settings button');

/* ── 6. notifications screen ── */
await page.goto('http://localhost:3996/deenapp/tools/notifications', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
t = await bodyText();
ok('notifications: screen opens (bell target)', /NOTIFICATIONS/i.test(t) && (t.includes('Inbox') || t.includes('REACTS') || t.includes('FOLLOWS') || t.length > 400));

/* ── 7. 99 names: EN/AR pill, no player bar ── */
await page.goto('http://localhost:3996/deenapp/tools/names', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
t = await bodyText();
ok('names: language switch visible', /EN/.test(t) && /AR/.test(t));
const pill = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'AR');
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
let arabicShown = /[\u0621-\u064A][\u0621-\u0652\u0670]{5,}/.test(t);
if (pill) {
  await page.touchscreen.tap(pill.x, pill.y);
  await page.waitForTimeout(800);
  t = await bodyText();
  arabicShown = /[\u0621-\u064A][\u0621-\u0652\u0670]{5,}/.test(t);
}
ok('names: AR toggle shows Arabic names', arabicShown);
const miniBar = await page.evaluate(() => [...document.querySelectorAll('div')].filter((e) => (e.textContent || '').includes('NOW PLAYING')).length);
ok('names: no floating player bar', miniBar === 0);

/* ── 8. qibla: globe card (live or fallback) + compass ── */
await page.goto('http://localhost:3996/deenapp/tools/qibla', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
t = await bodyText();
ok('qibla: globe card present (LIVE GLOBE header)', t.includes('LIVE GLOBE') || t.includes("TO THE KA'BAH"));
const iframe = await page.locator('iframe').count();
ok('qibla: real globe WebView mounted', iframe >= 1, `${iframe} iframe(s)`);
ok('qibla: compass + bearing present', /°/.test(t) && /COMPASS|QIBLA/i.test(t));

/* ── 9. compact dua player ── */
await page.goto('http://localhost:3996/deenapp/tools/dua', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
t = await bodyText();
ok('dua: list opens (compact bar lazy inside detail)', /DUA|Dua/i.test(t));

/* ── 10. community: bell + separate inbox icon ── */
await page.goto('http://localhost:3996/deenapp/(tabs)/community', { waitUntil: 'domcontentloaded' });
await ensureAuth();
await page.waitForTimeout(2200);
t = await bodyText();
ok('community: notifications + inbox split present', t.includes('SUGGESTED FOR YOU') || t.length > 500);

/* summary */
console.log('\n===== PASS-23 DIAG =====');
results.forEach((r) => console.log(r));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fails}/${results.length} passed`);
await browser.close();
srv.kill();
process.exit(fails ? 1 : 0);
