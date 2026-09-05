/* pass 63 — look at the chat inbox in a real browser:
 * 1. does a sent/loaded bubble animate (BubbleIn mounted)?
 * 2. is the message text selectable (user-select: text)?
 * 3. does press-and-hold open the WhatsApp-style sheet + dim the rest?
 * 4. does a TOUCH swipe right trigger reply (and a MOUSE drag not)?
 * 5. does double-tap react instantly?
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = '/tmp/serve';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml', '.map': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try {
      const data = await readFile(p);
      res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      const data = await readFile(join(ROOT, 'deenapp', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(8123, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', hasTouch: true });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }), headers: { 'Set-Cookie': 'deenlink_session=demo; Path=/' } });
    }
    return route.abort();
  }
  return route.continue();
});
await ctx.addInitScript((u) => {
  try {
    localStorage.setItem('dl.session', 'demo');
    localStorage.setItem('dl.csrf', 'demo');
    localStorage.setItem('dl.user', JSON.stringify(u));
    localStorage.setItem('dl.onboarded', '1');
  } catch {}
}, user);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://127.0.0.1:8123/deenapp/tools/inbox', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
await page.screenshot({ path: '/tmp/p1-list.png' });
console.log('URL:', page.url());

/* open aisha's thread (demo seed) */
const TEXT = 'This dua changed my nights, try it tonight inshaAllah';
try {
  await page.getByText('Aisha Yusuf').first().click({ timeout: 6000 });
} catch (e) { console.log('row click failed:', e.message.split('\n')[0]); }
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/p2-thread.png' });

/* 2. selectability */
const sel = await page.evaluate((t) => {
  const all = [...document.querySelectorAll('div,span')];
  const el = all.reverse().find((e) => (e.textContent || '').trim() === t);
  if (!el) { return null; }
  const cs = getComputedStyle(el);
  return { tag: el.tagName, userSelect: cs.userSelect || cs.webkitUserSelect, cursor: cs.cursor };
}, TEXT);
console.log('SELECTABLE:', JSON.stringify(sel));

/* bring the message bubble clear of the composer before pressing it */
await page.evaluate((t) => {
  const all = [...document.querySelectorAll('div,span')];
  const el = all.reverse().find((e) => (e.textContent || '').trim() === t);
  if (el) { el.scrollIntoView({ block: 'center' }); }
}, TEXT);
await page.waitForTimeout(700);

const box = await page.getByText(TEXT).first().boundingBox().catch(() => null);
console.log('BUBBLE BOX:', JSON.stringify(box));
if (box) {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  /* 3. press and hold -> action sheet */
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.up();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/p3-sheet.png' });
  const sheet = await page.evaluate(() => {
    const txt = document.body.innerText;
    return { reply: /Reply/.test(txt), forward: /Forward/.test(txt), copy: /Copy/.test(txt), del: /Delete/.test(txt) };
  });
  console.log('SHEET OPTIONS:', JSON.stringify(sheet));
  /* dismiss */
  await page.mouse.click(195, 120);
  await page.waitForTimeout(600);

  /* 4a. MOUSE drag must NOT swipe (it is the text-highlight gesture) */
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + i * 10, cy); await page.waitForTimeout(16); }
  await page.screenshot({ path: '/tmp/p4-mousedrag.png' });
  await page.mouse.up();
  await page.waitForTimeout(400);

  /* 4b. TOUCH swipe right must trigger Reply */
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 10, y: cy }] });
    await page.waitForTimeout(20);
  }
  await page.screenshot({ path: '/tmp/p5-swipe.png' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/tmp/p6-after-swipe.png' });
  const replied = await page.evaluate(() => /Replying to/.test(document.body.innerText));
  console.log('REPLY BAR VISIBLE AFTER TOUCH SWIPE:', replied);

  /* 5. double tap -> instant reaction */
  await page.mouse.dblclick(cx, cy);
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/p7-dbltap.png' });
}

console.log('JS errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
server.close();
