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
await new Promise(r => server.listen(8127, '127.0.0.1', r));
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
await page.goto('http://127.0.0.1:8127/deenapp/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);

// 1) comments sheet: tap the comment count on the first post (text=12 inside action row)
const firstComment = page.locator('text=Inna ma').first();
await firstComment.scrollIntoViewIfNeeded();
// the comment action is the sibling after the like count; click by position: find the card and click its comment icon
const card = page.locator('div', { hasText: 'Inna ma' }).last();
// fallback: click element containing exact '12' near the chat icon — use evaluate to click the comment Pressable
const clicked = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div'));
  const target = els.find(e => e.textContent === '12' && e.previousElementSibling && e.previousElementSibling.querySelector('[class*="r-"]'));
  // simpler: find all elements whose direct text is '12'
  const all = Array.from(document.querySelectorAll('div,span'));
  const t = all.filter(e => e.childElementCount === 0 && e.textContent.trim() === '12');
  if (t.length) { (t[0].closest('div[role="button"]') || t[0].parentElement).click(); return true; }
  return false;
});
console.log('clicked comment count:', clicked);
await page.waitForTimeout(1500);
let txt = await page.evaluate(() => document.body.innerText);
console.log('COMMENTS SHEET:', txt.includes('COMMENTS') && txt.includes('Reply'));
await page.screenshot({ path: '/tmp/modal-comments.png' });
await page.keyboard.press('Escape');
await page.mouse.click(30, 30);
await page.waitForTimeout(600);

// 2) ayah modal + share image
const a = page.locator('text=DAILY AYAH').first();
await a.scrollIntoViewIfNeeded();
await a.click();
await page.waitForTimeout(1000);
const si = page.locator('text=Share Image').first();
await si.click();
await page.waitForTimeout(4000);
txt = await page.evaluate(() => document.body.innerText);
const hasImg = await page.evaluate(() => !!Array.from(document.images).find(i => i.src.startsWith('data:image/png')));
console.log('SHARE CARD generated:', hasImg, '| loading gone:', !txt.includes('Creating your share card'));
await page.screenshot({ path: '/tmp/modal-sharecard.png' });

// 3) grab the dataURL size
const size = await page.evaluate(() => {
  const i = Array.from(document.images).find(i => i.src.startsWith('data:image/png'));
  return i ? i.src.length : 0;
});
console.log('share card dataURL bytes:', size);
await browser.close(); server.close();
