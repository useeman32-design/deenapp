/* pass-21 diag: splash every cold load, login real logo, hadith fix + hero, community inbox */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const srv = spawn('node', ['scripts/pages-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const results = [];
const ok = (name, pass, extra = '') => { results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

/* ── 1. splash: fresh load AND reload must both show the video ── */
await page.goto('http://localhost:3996/deenapp/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
let v = await page.evaluate(() => [...document.querySelectorAll('video')].some((x) => x.readyState >= 2 && !x.paused && (x.currentSrc || '').includes('splash-anim')));
ok('splash fresh load plays video', v);
await page.waitForTimeout(3200); // let it fade
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
v = await page.evaluate(() => [...document.querySelectorAll('video')].some((x) => x.readyState >= 2 && !x.paused && (x.currentSrc || '').includes('splash-anim')));
ok('splash RELOAD plays video (was the bug)', v);
await page.waitForTimeout(3200);

/* ── 2. login: real logo + slogan ── */
await page.goto('http://localhost:3996/deenapp/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
const login = await page.evaluate(() => ({
  badge: [...document.querySelectorAll('img')].some((i) => (i.src || '').includes('logo-badge')),
  slogan: document.body.innerText.includes('All-in-one islamic app'),
  old: [...document.querySelectorAll('img')].filter((i) => /images\/logo\./.test(i.src)).length,
}));
ok('login real logo', login.badge, JSON.stringify(login));
ok('login slogan', login.slogan);

/* ── 3. hadith: bukhari chapter (white-screen fix) ── */
await page.goto('http://localhost:3996/deenapp/tools/hadith/buhari?chapter=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
let bodyLen = await page.evaluate(() => document.body.innerText.length);
ok('bukhari ch1 no white screen', bodyLen > 500, `bodyLen=${bodyLen}`);

/* ── 4. hadith continue-reading hero (pointer written by ch1 visit) ── */
await page.goto('http://localhost:3996/deenapp/tools/hadith', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const hero = await page.evaluate(() => {
  const t = document.body.innerText;
  return { has: t.includes('CONTINUE READING'), book: t.includes('Sahih al-Bukhari') };
});
ok('hadith continue-reading hero', hero.has && hero.book, JSON.stringify(hero));
const heroBtn = page.locator('text=CONTINUE READING').first();
await heroBtn.click().catch(() => {});
await page.waitForTimeout(2500);
bodyLen = await page.evaluate(() => document.body.innerText.length);
ok('hero deep-links back into chapter', bodyLen > 500, `bodyLen=${bodyLen}`);

/* ── 5. community inbox: bell → friend → thread → react ── */
await page.goto('http://localhost:3996/deenapp/community', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
/* auth gate → demo sign-in (empty fields default to demo creds) */
if ((await page.evaluate(() => document.body.innerText)).includes('Welcome back!')) {
  await page.locator('text=Sign In').last().click().catch(() => {});
  await page.waitForTimeout(3000);
}
ok('signed in for community test', !(await page.evaluate(() => document.body.innerText)).includes('Welcome back!'));
await page.goto('http://localhost:3996/deenapp/community', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/d21-community.png' });
/* tap the bell at header right: paddingTop 8 + 40px circle → center ≈ (354, 28) */
await page.touchscreen.tap(354, 28);
await page.waitForTimeout(1200);
let txt = await page.evaluate(() => document.body.innerText);
ok('inbox opens (friends list)', txt.includes('Inbox') && txt.includes('NO CHAT'), txt.slice(0, 80).replace(/\n/g, ' '));
await page.screenshot({ path: '/tmp/d21-inbox.png' });
// open Aisha's thread
await page.locator('text=shared 3 items with you').first().click().catch(async () => { await page.touchscreen.tap(195, 210); });
await page.waitForTimeout(1000);
txt = await page.evaluate(() => document.body.innerText);
const low = txt.toLowerCase();
ok('thread shows shared items', low.includes('ayah clip') && low.includes('post'), txt.slice(0, 90).replace(/\n/g, ' '));
// react via the React label
const reactBtn = page.locator('text=React').first();
if (await reactBtn.count()) { await reactBtn.click({ force: true }).catch(() => {}); await page.waitForTimeout(500); }
const emojiShown = await page.evaluate(() => ['🤍','😂','😮','🤲','🔥','🕌'].filter((e) => document.body.innerText.includes(e)).length >= 2);
ok('emoji panel opens', emojiShown);
await page.screenshot({ path: '/tmp/d21-react.png' });

console.log(results.join('\n'));
await browser.close(); srv.kill();
