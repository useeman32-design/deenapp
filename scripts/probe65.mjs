/* pass 65 — verify slide-to-reply works with a MOUSE drag on web (the path that
 * was broken) and with touch. */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = '/tmp/serve';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try { const d = await readFile(p); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d); }
    catch { const d = await readFile(join(ROOT, 'deenapp', 'index.html')); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d); }
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(8123, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', hasTouch: true });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', deenpoints_balance: 1, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) { if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }) }); return route.abort(); }
  return route.continue();
});
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); } catch {} }, user);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8123/deenapp/tools/inbox', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
await page.getByText('Aisha Yusuf').first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1200);

const THEIR = 'This dua changed my nights, try it tonight inshaAllah';
await page.evaluate((t) => { const all = [...document.querySelectorAll('div,span')]; const el = all.reverse().find((e) => (e.textContent || '').trim() === t); if (el) el.scrollIntoView({ block: 'center' }); }, THEIR);
await page.waitForTimeout(600);
const box = await page.getByText(THEIR).first().boundingBox().catch(() => null);
console.log('bubble box:', JSON.stringify(box));
if (box) {
  const cx = box.x + 20, cy = box.y + box.height / 2;
  /* MOUSE drag right */
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 9; i++) { await page.mouse.move(cx + i * 9, cy); await page.waitForTimeout(16); }
  await page.screenshot({ path: '/tmp/r1-mid-drag.png' });
  await page.mouse.up();
  await page.waitForTimeout(900);
  const replied = await page.evaluate(() => /Replying to/.test(document.body.innerText));
  console.log('MOUSE swipe -> reply bar:', replied);
  await page.screenshot({ path: '/tmp/r2-after-mouse.png' });
}
console.log('JS errors:', errors.length ? errors.slice(0, 4) : 'none');
await browser.close(); server.close();
