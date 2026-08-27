import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT = '/tmp/serve';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.ttf':'font/ttf' };
const server = http.createServer(async (req, res) => {
  try {
    const p = normalize(join(ROOT, new URL(req.url, 'http://x').pathname));
    try { const d = await readFile(p); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d); }
    catch { const d = await readFile(join(ROOT, 'deenapp', 'index.html')); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d); }
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(8150, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const log = (k, v) => console.log(k, '=', v);

async function newPage(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2 });
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
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto('http://127.0.0.1:8150/deenapp/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('div')).filter(d => d.scrollHeight > d.clientHeight + 200 && d.clientHeight > 500);
    cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
    window.__sc = cands[0];
  });
  return { ctx, page };
}

/* A: share design picker (dark) */
{
  const { ctx, page } = await newPage('dark');
  await page.evaluate(() => window.__sc.scrollTop = 99999);
  await page.waitForTimeout(600);
  const shareBtn = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(e => (e.textContent || '').trim() === 'Share as image' && e.childElementCount <= 2);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    return true;
  });
  log('SHARE BTN found', !!shareBtn);
  if (shareBtn) {
    const clickText = (txt) => page.evaluate((t) => {
      const el = Array.from(document.querySelectorAll('div')).find(e => (e.textContent || '').trim() === t && e.childElementCount <= 2);
      if (el) { el.scrollIntoView({ block: 'center' }); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
      return false;
    }, txt);
    log('step1 Share as image', await clickText('Share as image'));
    await page.waitForTimeout(1200);
    log('step2 Share Image', await clickText('Share Image'));
    await page.waitForTimeout(4500); // generation
    const t = await page.evaluate(() => document.body.innerText);
    log('DESIGN ROW', t.includes('CHOOSE A DESIGN') && t.includes('Emerald') && t.includes('Midnight') && t.includes('Cream'));
    const url1 = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(i => (i.src || '').startsWith('data:image'));
      return imgs.length ? imgs[imgs.length - 1].src.slice(0, 80) : null;
    });
    await page.screenshot({ path: '/tmp/p10-share-classic.png' });
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).filter(e => (e.textContent || '').trim() === 'Emerald' && e.childElementCount === 0)[0]; if (!el) return;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(4500);
    const url2 = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(i => (i.src || '').startsWith('data:image'));
      return imgs.length ? imgs[imgs.length - 1].src.slice(0, 80) : null;
    });
    log('EMERALD REGENERATED', url1 !== null && url2 !== null && url1 !== url2);
    await page.screenshot({ path: '/tmp/p10-share-emerald.png' });
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).filter(e => (e.textContent || '').trim() === 'Cream' && e.childElementCount === 0)[0]; if (!el) return;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: '/tmp/p10-share-cream.png' });
  }
  await ctx.close();
}

/* B: light hero + light comments */
{
  const { ctx, page } = await newPage('light');
  await page.screenshot({ path: '/tmp/p10-light-hero.png' });
  await page.evaluate(() => {
    const leafs = Array.from(document.querySelectorAll('div')).filter(e => e.textContent === '17' && e.childElementCount === 0);
    leafs[0].scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).filter(e => e.textContent === '17' && e.childElementCount === 0)[0];
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  log('LIGHT COMMENTS', (await page.evaluate(() => document.body.innerText)).includes('COMMENTS'));
  await page.screenshot({ path: '/tmp/p10-comments-light.png' });
  await ctx.close();
}

/* C: community — post from composer + feed shot */
{
  const { ctx, page } = await newPage('dark');
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('div')).filter(d => d.scrollHeight > d.clientHeight + 200 && d.clientHeight > 500);
    cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
    window.__sc = cands[0];
    window.__sc.scrollTop = 99999;
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(e => (e.textContent || '').startsWith('View more on community') && e.childElementCount <= 3);
    el.scrollIntoView({ block: 'center' });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(4500);
  const composer = page.locator('[placeholder*="Share a thought"]').first();
  await composer.waitFor({ state: 'attached', timeout: 10000 });
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[placeholder*="Share a thought"]')).find(e => e.getBoundingClientRect().width > 50);
    el.scrollIntoView({ block: 'center' });
    el.focus && el.focus();
    el.click();
  });
  await page.keyboard.type('Just finished my daily surah, Alhamdulillah');
  await page.locator('text=Post').last().click();
  await page.waitForTimeout(1500);
  log('COMMUNITY POST ADDED', await page.evaluate(() => Array.from(document.querySelectorAll('div')).some(e => (e.textContent || '').includes('Just finished my daily surah') && e.offsetParent !== null)));
  await page.screenshot({ path: '/tmp/p10-community-posted.png' });
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('div')).filter(d => d.scrollHeight > d.clientHeight + 200 && d.clientHeight > 500);
    cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
    window.__sc = cands[0];
    window.__sc.scrollTop = 1400;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/p10-community-feed.png' });
  await ctx.close();
}

await browser.close(); server.close();
console.log('SMOKE10 DONE');
