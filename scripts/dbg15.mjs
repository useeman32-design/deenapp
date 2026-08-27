import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = '/tmp/serve';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg' };
const server = http.createServer(async (req, res) => {
  try {
    const p = normalize(join(ROOT, new URL(req.url, 'http://x').pathname));
    try { const d = await readFile(p); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d); }
    catch { const d = await readFile(join(ROOT, 'deenapp', 'index.html')); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d); }
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(8152, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session','demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded','1'); } catch {} }, user);
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }), headers: { 'Set-Cookie': 'deenlink_session=demo-session-token; Path=/' } });
    return route.abort();
  }
  return route.continue();
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8152/deenapp/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
// single tap mosque image -> preview
const box = await page.evaluate(() => {
  const img = Array.from(document.querySelectorAll('img')).find(i => (i.src || '').includes('post-mosque'));
  img.scrollIntoView({ block: 'center' });
  const r = img.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.waitForTimeout(400);
await page.mouse.click(box.x, box.y);
await page.waitForTimeout(900); // > 310ms grace
const preview = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img')).filter(i => (i.src || '').includes('post-mosque'));
  return imgs.map(i => { const r = i.getBoundingClientRect(); const st = getComputedStyle(i); return { w: r.width, h: r.height, vis: st.visibility, disp: st.display, opacity: st.opacity }; });
});
console.log('preview imgs:', JSON.stringify(preview));
await page.screenshot({ path: '/tmp/dbg15-preview.png' });
await page.mouse.click(300, 400);
await page.waitForTimeout(500);
// double tap -> heart shade check
const box2 = await page.evaluate(() => {
  const img = Array.from(document.querySelectorAll('img')).find(i => (i.src || '').includes('post-mosque'));
  img.scrollIntoView({ block: 'center' });
  const r = img.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.waitForTimeout(300);
await page.mouse.click(box2.x, box2.y);
await page.waitForTimeout(120);
await page.mouse.click(box2.x, box2.y);
await page.waitForTimeout(2600); // full burst done
const heart = await page.evaluate(() => {
  // burst overlay = animated view with pointerEvents none containing the big heart
  const svgs = Array.from(document.querySelectorAll('svg')).filter(s => { const r = s.getBoundingClientRect(); return r.width >= 60 && r.width <= 100; });
  return svgs.map(s => {
    const ov = s.closest('[style*="pointer-events"]') || s.parentElement;
    const st = getComputedStyle(ov);
    return { heartW: s.getBoundingClientRect().width, overlayOpacity: st.opacity };
  });
});
console.log('heart overlays after burst:', JSON.stringify(heart));
await page.screenshot({ path: '/tmp/dbg15-heart.png' });
await browser.close(); server.close();
