import { chromium } from 'playwright-core';
import http from 'node:http';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = '/tmp/serve';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.ttf':'font/ttf', '.json':'application/json' };
const server = createServer(async (req, res) => {
  try {
    const p = normalize(join(ROOT, new URL(req.url, 'http://x').pathname));
    try { const d = await readFile(p); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d); }
    catch { const d = await readFile(join(ROOT, 'deenapp', 'index.html')); res.writeHead(200, {'Content-Type':'text/html'}); res.end(d); }
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(8128, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
await ctx.addInitScript((u) => {
  try {
    localStorage.setItem('dl.session', 'demo-session-token');
    localStorage.setItem('dl.csrf', 'demo-csrf');
    localStorage.setItem('dl.user', JSON.stringify(u));
    localStorage.setItem('dl.onboarded', '1');
  } catch {}
}, user);
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }), headers: { 'Set-Cookie': 'deenlink_session=demo-session-token; Path=/' } });
    }
    return route.abort();
  }
  return route.continue();
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8128/deenapp/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);

// 1) video modal iframe
const v = page.locator('text=Surah Yasin').first();
await v.scrollIntoViewIfNeeded();
await v.click();
await page.waitForTimeout(1200);
const iframe = await page.evaluate(() => {
  const f = Array.from(document.querySelectorAll('iframe'));
  return f.map(x => x.src).filter(s => s.includes('youtube.com/embed'));
});
console.log('VIDEO IFRAME:', JSON.stringify(iframe));
await page.screenshot({ path: '/tmp/smoke-video-iframe.png' });
await page.mouse.click(30, 30);
await page.waitForTimeout(600);

// 2) youtube post iframe in feed
const ytPost = await page.evaluate(() => {
  const f = Array.from(document.querySelectorAll('iframe'));
  return f.map(x => x.src).filter(s => s.includes('hwWpWoOtsBY'));
});
console.log('YOUTUBE POST IFRAME:', JSON.stringify(ytPost));

// 3) ••• menu
const dots = page.locator('text=•••').first();
await dots.scrollIntoViewIfNeeded();
await dots.click();
await page.waitForTimeout(500);
let txt = await page.evaluate(() => document.body.innerText);
console.log('MENU report:', txt.includes('Report post'), '| dismiss:', txt.includes('Don’t want to see this') || txt.includes("Don't want to see this"));
await page.screenshot({ path: '/tmp/smoke-menu.png' });
await page.mouse.click(30, 700);
await page.waitForTimeout(400);

// 4) double tap like on image post
const imgPost = page.locator('text=sometimes the masjid speaks louder').first();
const found = await imgPost.count();
console.log('image post found:', found > 0);
if (found) {
  await imgPost.scrollIntoViewIfNeeded();
  const box = await imgPost.boundingBox();
  // the image is above the text in the card
  const before = await page.evaluate((y) => {
    const els = Array.from(document.querySelectorAll('div'));
    return els.find(e => e.textContent?.startsWith('128') && e.childElementCount === 0)?.textContent;
  }, 0);
  const x = box.x + 40, y = box.y - 150;
  await page.mouse.click(x, y, { delay: 0 });
  await page.mouse.click(x, y, { delay: 0 });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const t = els.find(e => e.textContent === '129' && e.childElementCount === 0);
    return !!t;
  });
  console.log('DOUBLE-TAP LIKE 128->129:', after);
}
await browser.close(); server.close();
