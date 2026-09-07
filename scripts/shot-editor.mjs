import { chromium } from 'playwright-core';
import http from 'node:http';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = '/tmp/serve';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.map': 'application/json',
};

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
      // SPA fallback
      const data = await readFile(join(ROOT, 'deenapp', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});
await new Promise((r) => server.listen(8123, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: process.env.SCHEME || 'dark',
});
const user = {
  id: 1,
  username: 'abdalrahman',
  full_name: 'Abdulrahman Al-Harbi',
  user_type: 'user',
  profile_image_url: null,
  deenpoints_balance: 240,
  is_email_verified: 1,
  account_status: 'active',
  verification_badge: 'verified',
  scholar: null,
};

// Intercept the API: return the user from /me.php so the app is signed in;
// abort everything else (offline).
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', user }),
        headers: { 'Set-Cookie': 'deenlink_session=demo-session-token; Path=/' },
      });
    }
    return route.abort();
  }
  return route.continue();
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// Seed localStorage BEFORE the app boots (init script), so first paint is already signed in.
await ctx.addInitScript((u) => {
  try {
    localStorage.setItem('dl.session', 'demo-session-token');
    localStorage.setItem('dl.csrf', 'demo-csrf');
    localStorage.setItem('dl.user', JSON.stringify(u));
    localStorage.setItem('dl.onboarded', '1');
    const days = [];
    for (let i = 0; i < 7; i++) days.push(new Date(Date.now() - i * 864e5).toDateString());
    localStorage.setItem('dl.streak.days', JSON.stringify(days));
    localStorage.setItem(`dl.goal.${new Date().toDateString()}`, JSON.stringify({ surah: true, checkin: true }));
    localStorage.setItem('dl.quran.recent', JSON.stringify([1, 2, 181]));
  } catch {}
}, user);

await page.goto('http://127.0.0.1:8123/deenapp/settings/quick-access', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const diag = await page.evaluate(async () => {
  let me = null;
  try {
    const r = await fetch('https://deenlink.org/api/auth/me.php', { headers: { Cookie: 'deenlink_session=demo-session-token' } });
    me = { status: r.status, body: (await r.text()).slice(0, 120) };
  } catch (e) { me = { err: String(e) }; }
  let me2 = null;
  try {
    const r2 = await fetch('https://deenlink.org/api/api/auth/me.php');
    me2 = { status: r2.status, body: (await r2.text()).slice(0, 120) };
  } catch (e) { me2 = { err: String(e) }; }
  return {
    url: window.location.href,
    onboarded: localStorage.getItem('dl.onboarded'),
    hasSession: !!localStorage.getItem('dl.session'),
    hasUser: !!localStorage.getItem('dl.user'),
    meClean: me,
    meDouble: me2,
  };
});
console.log('DIAG:', JSON.stringify(diag));
await page.screenshot({ path: process.argv[2] || '/tmp/shot-home.png', fullPage: true });

console.log('JS errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
server.close();
