/* pass 64 — verify the chat corrections in a real browser:
 *  1. nothing selectable (user-select none on message text)
 *  2. typing field uses Manrope
 *  3. send smooth-scrolls (own bubble ends visible at bottom)
 *  4. press-and-hold opens an ANCHORED glass menu at the bubble (not bottom)
 *  5. own message menu has Info + Delete; their message does not
 *  6. Info shows Delivered / Seen
 *  7. forward is a multi-select screen with "Forward to N"
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
    if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }) });
    return route.abort();
  }
  return route.continue();
});
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo'); localStorage.setItem('dl.csrf', 'demo'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); } catch {} }, user);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:8123/deenapp/tools/inbox', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);

await page.getByText('Aisha Yusuf').first().click({ timeout: 6000 }).catch(() => console.log('open failed'));
await page.waitForTimeout(1200);

/* 1. selectability must be none now */
const THEIR = 'This dua changed my nights, try it tonight inshaAllah';
const sel = await page.evaluate((t) => {
  const all = [...document.querySelectorAll('div,span')];
  const el = all.reverse().find((e) => (e.textContent || '').trim() === t);
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { userSelect: cs.userSelect || cs.webkitUserSelect };
}, THEIR);
console.log('1 MESSAGE user-select:', JSON.stringify(sel));

/* 2. input font */
const font = await page.evaluate(() => {
  const inp = document.querySelector('input');
  return inp ? getComputedStyle(inp).fontFamily : null;
});
console.log('2 INPUT font-family:', font);

/* 3. send my own message */
const MYTEXT = 'JazakAllah khair, sending test';
await page.locator('input').last().fill(MYTEXT);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
let myBox = await page.getByText(MYTEXT).first().boundingBox().catch(() => null);
console.log('3 OWN BUBBLE visible at bottom:', JSON.stringify(myBox), myBox && myBox.y > 500 ? '(yes, scrolled into view)' : '');
await page.screenshot({ path: '/tmp/q1-sent.png' });

/* 4/5. long-press MY OWN bubble -> anchored menu with Info + Delete */
if (myBox) {
  await page.evaluate((t) => {
    const all = [...document.querySelectorAll('div,span')];
    const el = all.reverse().find((e) => (e.textContent || '').trim() === t);
    if (el) el.scrollIntoView({ block: 'center' });
  }, MYTEXT);
  await page.waitForTimeout(600);
  myBox = await page.getByText(MYTEXT).first().boundingBox().catch(() => null);
  const cx = myBox.x + myBox.width / 2, cy = myBox.y + myBox.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(550); await page.mouse.up();
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() => {
    const txt = document.body.innerText;
    return { reply: /Reply/.test(txt), forward: /Forward/.test(txt), copy: /Copy/.test(txt), info: /Info/.test(txt), del: /Delete/.test(txt) };
  });
  console.log('5 OWN MENU:', JSON.stringify(menu));
  await page.screenshot({ path: '/tmp/q2-own-menu.png' });

  /* 6. Info */
  await page.getByText('Info').first().click().catch(() => console.log('info tap failed'));
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const txt = document.body.innerText;
    return { delivered: /Delivered/.test(txt), seen: /Seen|Not seen yet/.test(txt) };
  });
  console.log('6 INFO:', JSON.stringify(info));
  await page.screenshot({ path: '/tmp/q3-info.png' });
  await page.mouse.click(195, 120); await page.waitForTimeout(400);

  /* 7. forward multi-select */
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(550); await page.mouse.up();
  await page.waitForTimeout(600);
  await page.getByText('Forward').first().click().catch(() => console.log('forward tap failed'));
  await page.waitForTimeout(800);
  // pick two people
  for (const name of ['Aisha Yusuf', 'Sheikh Abdurrahman Al-Ameen']) {
    await page.getByText(name).first().click().catch(() => {});
    await page.waitForTimeout(200);
  }
  const fwd = await page.evaluate(() => {
    const m = document.body.innerText.match(/Forward to \d+|(\d+) selected/);
    return { header: /Forward message/.test(document.body.innerText), count: m ? m[0] : null };
  });
  console.log('7 FORWARD multi:', JSON.stringify(fwd));
  await page.screenshot({ path: '/tmp/q4-forward.png' });
}

/* 5b. their message menu must NOT have Info/Delete */
await page.mouse.click(195, 120).catch(() => {});
await page.waitForTimeout(400);
await page.evaluate((t) => {
  const all = [...document.querySelectorAll('div,span')];
  const el = all.reverse().find((e) => (e.textContent || '').trim() === t);
  if (el) el.scrollIntoView({ block: 'center' });
}, THEIR);
await page.waitForTimeout(600);
const tBox = await page.getByText(THEIR).first().boundingBox().catch(() => null);
if (tBox) {
  const cx = tBox.x + tBox.width / 2, cy = tBox.y + tBox.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(550); await page.mouse.up();
  await page.waitForTimeout(600);
  const menu2 = await page.evaluate(() => {
    const txt = document.body.innerText;
    return { info: /Info/.test(txt), del: /Delete/.test(txt) };
  });
  console.log('5b THEIR MENU (info/del should be false):', JSON.stringify(menu2));
  await page.screenshot({ path: '/tmp/q5-their-menu.png' });
}

console.log('JS errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
server.close();
