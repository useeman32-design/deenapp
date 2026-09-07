/* Tier 2 UI E2E — scholar inbox (queue → answer), profile report sheet,
 * wallpaper store section. Client+API same-origin on port 80. */
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
const BASE = 'http://app.deenlink.org';
const sql = (q) => execSync(`mariadb -h 127.0.0.1 -P 3311 -u root -p.. deenlink -N -e "${q}"`, { encoding: 'utf8' }).trim();

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const results = [];
const check = (label, cond, extra = '') => { results.push(!!cond); console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  << ' + extra)); };

const RUN = Date.now();
const reg = async (tag, disp) => {
  const csrfR = await fetch(BASE + '/api/auth/csrf.php');
  const csrf = (await csrfR.json()).csrf_token;
  const cookie = (csrfR.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const r = await fetch(BASE + '/api/auth/register.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Cookie: cookie },
    body: JSON.stringify({ full_name: disp, username: tag + RUN, email: tag + RUN + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }),
  });
  const j = await r.json();
  if (j.status !== 'success') throw new Error('register ' + tag + ': ' + JSON.stringify(j).slice(0, 140));
  return { uname: tag + RUN, email: tag + RUN + '@t.co', id: Number(sql(`SELECT id FROM users WHERE username='${tag + RUN}';`)) };
};

/* register auto-logs-in: keep that jar and submit WITHOUT login.php (which
 * regenerates the session and orphans the csrf token — harness75's pattern) */
const mergeCookies = (prev, resp) => {
  const m = new Map();
  for (const c of (prev || '').split('; ')) { if (c.includes('=')) m.set(c.split('=')[0], c); }
  for (const c of (resp.headers.getSetCookie?.() ?? [])) { const kv = c.split(';')[0]; m.set(kv.split('=')[0], kv); }
  return Array.from(m.values()).join('; ');
};
const mkSession = async (tag, disp) => {
  const r0 = await fetch(BASE + '/api/auth/csrf.php');
  const token = (await r0.json()).csrf_token;
  let cookie = mergeCookies('', r0);
  const rr = await fetch(BASE + '/api/auth/register.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, Cookie: cookie },
    body: JSON.stringify({ full_name: disp, username: tag + RUN, email: tag + RUN + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }),
  });
  const jj = await rr.json();
  if (jj.status !== 'success') throw new Error('register ' + tag + ': ' + JSON.stringify(jj).slice(0, 140));
  cookie = mergeCookies(cookie, rr);
  return { uname: tag + RUN, email: tag + RUN + '@t.co', id: Number(sql(`SELECT id FROM users WHERE username='${tag + RUN}';`)), token, cookie };
};
const askerS = await mkSession('e2a', 'Asker Person');
const asker = askerS;
const scholar = await reg('e2s', 'Scholar Person');
sql(`UPDATE users SET user_type='scholar' WHERE id=${scholar.id};`);
sql(`INSERT INTO scholars (user_id, display_name, aqeedah, institute, years_of_study, approval_status) VALUES (${scholar.id}, 'Scholar Person', 'Sunni', 'E2E Institute', 5, 'approved') ON DUPLICATE KEY UPDATE approval_status='approved';`);

// asker submits a question through the API (UI form was covered by harness75 contract)
{
  const sub = await fetch(BASE + '/api/questions/submit.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': askerS.token, Cookie: askerS.cookie },
    body: JSON.stringify({ scholar_id: scholar.id, title: `E2E question ${RUN}`, details: 'This is the E2E question body for the scholar flow.', privacy: 'public', category: 'fiqh' }),
  });
  const j = await sub.json();
  check('asker submits via API', j.status === 'success', JSON.stringify(j).slice(0, 100));
}

const login = async (ctx, email) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 130)));
  page.on('dialog', (dlg) => dlg.accept().catch(() => {}));
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const inputs = await page.$$('input');
  await inputs[0].fill(email);
  await inputs[1].fill('Str0ngPass!23');
  await page.getByText('Sign In', { exact: true }).first().click();
  await page.waitForTimeout(6000);
  return page;
};

// ── scholar: fatwa screen shows the Scholar Inbox entry ──
const ctxS = await browser.newContext({ viewport: { width: 420, height: 860 } });
const pS = await login(ctxS, scholar.email);
await pS.goto(BASE + '/tools/fatwa', { waitUntil: 'domcontentloaded' });
await pS.waitForTimeout(5000);
let txt = await pS.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('scholar sees Scholar Inbox entry', /Scholar Inbox/i.test(txt), txt.slice(0, 120));
const entry = pS.getByText('Scholar Inbox').first();
if (await entry.count()) await entry.click();
await pS.waitForTimeout(4000);
check('scholar inbox route opened', pS.url().includes('/tools/scholar-inbox'), pS.url());
txt = await pS.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('queue lists the E2E question', txt.includes(`E2E question ${RUN}`), txt.slice(0, 200));

// open the question and answer it
const card = pS.getByText(`E2E question ${RUN}`).first();
if (await card.count()) await card.click();
await pS.waitForTimeout(2500);
const tas = await pS.$$('textarea');
check('answer composer present', tas.length > 0);
if (tas.length) await tas[tas.length - 1].fill('This is the E2E published answer, long enough to pass validation.');
const pub = pS.getByText('Publish answer').first();
if (await pub.count()) await pub.click();
await pS.waitForTimeout(3500);
txt = await pS.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('question left the To-answer queue', !txt.includes(`E2E question ${RUN}`), txt.slice(0, 160));
const st = sql(`SELECT status FROM scholar_questions WHERE asker_user_id=${asker.id} ORDER BY id DESC LIMIT 1;`);
check('server shows answered', st === 'answered', st);
// answered tab
const answeredTab = pS.getByText('Answered', { exact: true }).first();
if (await answeredTab.count()) await answeredTab.click();
await pS.waitForTimeout(2500);
txt = await pS.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('answered tab lists it', txt.includes(`E2E question ${RUN}`), txt.slice(0, 160));

// ── profile report flow ──
await pS.goto(BASE + `/profile/${asker.uname}`, { waitUntil: 'domcontentloaded' });
await pS.waitForTimeout(5000);
const flag = pS.locator('[aria-label="Report account"]').first();
check('report flag button present', await flag.count() > 0);
if (await flag.count()) await flag.click();
await pS.waitForTimeout(1500);
txt = await pS.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('report sheet opened', /Report @/.test(txt), txt.slice(0, 140));
const reason = pS.getByText('Spam or scam').first();
if (await reason.count()) await reason.click();
await pS.waitForTimeout(2500);
const rows = Number(sql(`SELECT COUNT(*) FROM account_reports WHERE reported_user_id=${asker.id} AND reporter_user_id=${scholar.id};`) || 0);
check('report row filed server-side', rows >= 1, `rows=${rows}`);

// ── wallpapers: DeenLink Gallery section ──
await pS.goto(BASE + '/tools/wallpapers', { waitUntil: 'domcontentloaded' });
await pS.waitForTimeout(5000);
txt = await pS.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
check('wallpaper store section shows', /DeenLink Gallery/i.test(txt), txt.slice(0, 140));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
