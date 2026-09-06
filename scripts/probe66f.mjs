/* light-theme canvas must be theme-matched, and desktop letterbox seamless */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = '/tmp/serve';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  try { const d = await readFile(p); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch { const d = await readFile(join(ROOT, 'deenapp', 'index.html')); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d); }
});
await new Promise((r) => server.listen(8123, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });

for (const mode of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, colorScheme: mode, hasTouch: true });
  const user = { id: 1, username: 'abdalrahman' };
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.includes('deenlink.org')) { if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }) }); return route.abort(); }
    return route.continue();
  });
  await ctx.addInitScript((m, u) => { try { localStorage.setItem('dl.session', 'demo'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); localStorage.setItem('dl.theme', m); } catch {} }, mode, user);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8123/deenapp/tools/inbox', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  console.log(mode, JSON.stringify(await page.evaluate(() => ({
    cssVar: getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  }))));
  await page.screenshot({ path: `/tmp/p66-desktop-${mode}.png` });
  await ctx.close();
}
await browser.close(); server.close();
