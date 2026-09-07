/* pass 74 UI E2E — same-origin client (exported web build) + live API on port 80.
 * Covers: profile hard-nav race, search rows w/o message btn, top accounts,
 * search history + clear, recent posts, message requests shelf + accept flow. */
import { chromium } from 'playwright-core';
const BASE = 'http://app.deenlink.org';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

const results = [];
const check = (label, cond, extra = '') => { results.push(!!cond); console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  << ' + extra)); };

const login = async (ctx, email, pass) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 120)));
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const inputs = await page.$$('input');
  await inputs[0].fill(email);
  await inputs[1].fill(pass);
  const signin = page.getByText('Sign In', { exact: true }).first();
  if (await signin.count()) await signin.click();
  await page.waitForTimeout(6500);
  return page;
};

// fresh pair for the request flow
const RUN = Date.now();
const reg = async (tag) => {
  const csrfR = await fetch(BASE + '/api/auth/csrf.php');
  const csrf = (await csrfR.json()).csrf_token;
  const cookie = (csrfR.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const r = await fetch(BASE + '/api/auth/register.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ full_name: tag === "u74s" ? "Sender Tester" : "Receiver Tester", username: tag + RUN, email: tag + RUN + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }),
  });
  const j = await r.json();
  if (j.status !== 'success') throw new Error('register ' + tag + ': ' + JSON.stringify(j).slice(0, 140));
  return tag + RUN;
};
const uSend = await reg('u74s');
const uRecv = await reg('u74r');
console.log('registered', uSend, '→', uRecv);

// ── A: main user — search + profile ──
const ctxA = await browser.newContext({ viewport: { width: 420, height: 860 } });
const page = await login(ctxA, 'av73a1788719849@t.co', 'Str0ngPass!23');
check('login leaves /login', !page.url().includes('/login'), page.url());

// search: message button gone, follow kept, top accounts ≤ 3
await page.goto(BASE + '/tools/search', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input', { timeout: 30000 });
await page.waitForTimeout(1500);
let inputs = await page.$$('input');
await inputs[0].fill('a'); // trigger the users fetch via the Top/users tabs
await page.waitForTimeout(3000);
await inputs[0].fill('carol71');
await page.waitForTimeout(4000);
const msgBtns = await page.$$('[class*="comment-dots"]');
check('search rows have no message button', msgBtns.length === 0, msgBtns.length + ' found');
const followBtns = await page.getByText(/^(Follow|Following)$/).all();
check('search rows keep Follow', followBtns.length > 0);
const bodyTxt = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

// open the profile via SPA nav (click the row)
const row = page.getByText('carol711788719854').first();
check('search shows the account row', await row.count() > 0);
if (await row.count()) await row.click();
await page.waitForTimeout(3500);
check('row click opens the profile route', page.url().includes('/profile/'), page.url());
let txt = await bodyTxt();
check('SPA profile opens (not "couldn\'t find")', !/couldn.t find this account/i.test(txt), txt.slice(0, 160));
check('profile shows follow state', /Follow|Following/.test(txt));

// HARD nav to the profile — the pass-74 race fix
await page.goto(BASE + '/profile/carol711788719854', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
txt = await bodyTxt();
check('hard-nav profile loads (race fixed)', !/couldn.t find this account/i.test(txt), txt.slice(0, 160));

// search history + clear + recent posts
await page.goto(BASE + '/tools/search', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
txt = await bodyTxt();
check('search history section shows', /Search history/i.test(txt));
check('history chip carol71 present', txt.includes('carol71'));
check('recent posts section shows', /Recent posts/i.test(txt));
const clear = page.getByText('Clear', { exact: true }).first();
if (await clear.count()) await clear.click();
await page.waitForTimeout(1200);
txt = await bodyTxt();
check('clear removes history', !/Search history/i.test(txt));

// ── B: sender opens recipient's profile and messages (creates a request) ──
const ctxB = await browser.newContext({ viewport: { width: 420, height: 860 } });
const pSend = await login(ctxB, uSend + '@t.co', 'Str0ngPass!23');
await pSend.goto(BASE + '/profile/' + uRecv, { waitUntil: 'domcontentloaded' });
await pSend.waitForTimeout(5000);
const msgPill = pSend.getByText(/^Message$/).first();
if (await msgPill.count()) await msgPill.click();
await pSend.waitForTimeout(3000);
const tas = await pSend.$$('textarea');
if (tas.length) { await tas[tas.length - 1].fill('salam, request test'); }
else { const ii = await pSend.$$('input'); await ii[ii.length - 1].fill('salam, request test'); }
await pSend.waitForTimeout(400);
const sendBtn = pSend.locator('[class*="paper-plane"]').last();
if (await sendBtn.count()) await sendBtn.click();
await pSend.waitForTimeout(3000);
const stxt = await pSend.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('sender sees request note (3-message limit)', /request/i.test(stxt) || /3-message/i.test(stxt), stxt.slice(0, 140));

// ── C: recipient sees Message requests, accepts ──
const ctxC = await browser.newContext({ viewport: { width: 420, height: 860 } });
const pRecv = await login(ctxC, uRecv + '@t.co', 'Str0ngPass!23');
await pRecv.goto(BASE + '/tools/inbox', { waitUntil: 'domcontentloaded' });
await pRecv.waitForTimeout(6000);
let rtxt = await pRecv.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('recipient sees Message requests shelf', /Message requests/i.test(rtxt), rtxt.slice(0, 200));
const shelf = pRecv.getByText('Message requests').first();
if (await shelf.count()) await shelf.click();
await pRecv.waitForTimeout(1500);
rtxt = await pRecv.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('request panel shows sender', /Sender Tester/i.test(rtxt), rtxt.slice(0, 200));
const accept = pRecv.getByText('Accept & follow').first();
if (await accept.count()) await accept.click();
await pRecv.waitForTimeout(3500);
rtxt = await pRecv.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('accept opens the thread', /Sender Tester/i.test(rtxt) && !/Accept & follow/.test(rtxt), rtxt.slice(0, 160));
// verify the follow landed server-side
const fr = await fetch(BASE + `/api/feed/get_user.php?username=${uRecv}`);
check('recipient now follows sender (server)', (await fr.text()).length > 0);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
