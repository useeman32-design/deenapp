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
await new Promise(r => server.listen(8142, '127.0.0.1', r));
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
  await page.goto('http://127.0.0.1:8142/deenapp/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('div')).filter(d => d.scrollHeight > d.clientHeight + 200 && d.clientHeight > 500);
    cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
    window.__sc = cands[0];
  });
  return { ctx, page };
}
const setTop = (page, y) => page.evaluate((yy) => { window.__sc.scrollTop = yy; }, y);

/* Phase A: menu + report modal + show more */
{
  const { ctx, page } = await newPage('dark');
  await page.screenshot({ path: '/tmp/p9-dark-hero.png' });
  log('VIDEO THUMB', await page.evaluate(() => Array.from(document.querySelectorAll('img')).some(i => (i.src || '').includes('vid-yasin'))));
  await setTop(page, 1500);
  await page.waitForTimeout(500);
  await page.locator('text=•••').nth(1).click();
  await page.waitForTimeout(400);
  let t = await page.evaluate(() => document.body.innerText);
  log('MENU report+notint', t.includes('Report') && t.includes('Not interested'));
  await page.screenshot({ path: '/tmp/p9-menu.png' });
  await page.locator('text=Report').first().click();
  await page.waitForTimeout(600);
  t = await page.evaluate(() => document.body.innerText);
  log('REPORT MODAL', t.includes('Report this post?') && t.includes('Submit report') && t.includes('Spam or scam'));
  await page.locator('text=Spam or scam').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/p9-report-modal.png' });
  await page.mouse.click(20, 700);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(e => e.textContent === 'Show more' && e.childElementCount === 0);
    el.scrollIntoView({ block: 'center' });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  t = await page.evaluate(() => document.body.innerText);
  log('SHOW MORE -> LESS', t.includes('Show less'));
  await page.screenshot({ path: '/tmp/p9-showmore.png' });
  await ctx.close();
}

/* Phase B: YouTube double-tap like */
{
  const { ctx, page } = await newPage('dark');
  const box = await page.evaluate(() => {
    const f = Array.from(document.querySelectorAll('iframe')).find(i => (i.src || '').includes('hwWpWoOtsBY'));
    if (!f) return null;
    f.scrollIntoView({ block: 'center' });
    const r = f.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  log('YT IFRAME found', !!box);
  if (box) {
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => !!Array.from(document.querySelectorAll('div')).find(e => e.textContent === '89' && e.childElementCount === 0));
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(120);
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => !!Array.from(document.querySelectorAll('div')).find(e => e.textContent === '90' && e.childElementCount === 0));
    log('YOUTUBE DOUBLE-TAP 89->90', before && after);
    await page.screenshot({ path: '/tmp/p9-yt-liked.png' });
  }
  await ctx.close();
}

/* Phase C: comments (like fill, reply, nested post) */
{
  const { ctx, page } = await newPage('dark');
  await page.evaluate(() => {
    const leafs = Array.from(document.querySelectorAll('div')).filter(e => e.textContent === '17' && e.childElementCount === 0);
    leafs[0].scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).filter(e => e.textContent === '17' && e.childElementCount === 0)[0];
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  let t = await page.evaluate(() => document.body.innerText);
  log('COMMENTS SHEET', t.includes('COMMENTS'));
  const sheetHeartFill = () => {
    const cands = Array.from(document.querySelectorAll('div')).filter(d => {
      const tx = d.textContent || '';
      return tx.includes('COMMENTS') && tx.includes('Reply') && d.querySelectorAll('svg').length >= 4;
    });
    cands.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    const sheet = cands[0];
    if (!sheet) return null;
    const p = Array.from(sheet.querySelectorAll('svg path')).find(pp => (pp.getAttribute('d') || '').includes('12 19.6'));
    return p ? p.getAttribute('fill') : 'no-heart';
  };
  const beforeFill = await page.evaluate(sheetHeartFill);
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('div')).filter(d => {
      const tx = d.textContent || '';
      return tx.includes('COMMENTS') && tx.includes('Reply') && d.querySelectorAll('svg').length >= 4;
    });
    cands.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    const p = Array.from(cands[0].querySelectorAll('svg path')).find(pp => (pp.getAttribute('d') || '').includes('12 19.6'));
    p.closest('svg').parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const afterFill = await page.evaluate(sheetHeartFill);
  log('COMMENT LIKE FILL', JSON.stringify({ beforeFill, afterFill }));
  await page.locator('text=Reply').first().click();
  await page.waitForTimeout(500);
  t = await page.evaluate(() => document.body.innerText);
  log('REPLY INDICATOR', t.includes('Replying to'));
  log('REPLY INPUT', await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input,textarea')).find(i => (i.placeholder || '').startsWith('Reply to'));
    return inp ? inp.placeholder : null;
  }));
  await page.screenshot({ path: '/tmp/p9-comments-dark.png' });
  await page.keyboard.type('Great reminder, jazakAllah khair');
  await page.locator('text=Post').last().click();
  await page.waitForTimeout(700);
  t = await page.evaluate(() => document.body.innerText);
  log('REPLY POSTED (nested)', t.includes('Great reminder, jazakAllah khair'));
  await page.screenshot({ path: '/tmp/p9-reply-posted.png' });
  await ctx.close();
}

/* Phase D: community screen */
{
  const { ctx, page } = await newPage('dark');
  await setTop(page, 99999);
  await page.waitForTimeout(500);
  const vm = page.locator('text=View more on community').first();
  log('VIEW MORE BTN', await vm.count() > 0);
  await vm.click();
  await page.waitForTimeout(4500);
  const isVisible = (text) => page.evaluate((tx) => {
    const els = Array.from(document.querySelectorAll('div')).filter(e => (e.textContent || '').includes(tx) && e.childElementCount <= 6);
    return els.some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.offsetParent !== null; });
  }, text);
  log('COMMUNITY SCREEN', (await isVisible('Community Posts')) && (await isVisible('Recent Activity')) && (await isVisible('Share a thought, question')));
  await page.screenshot({ path: '/tmp/p9-community-top.png' });
  const composer = page.locator('input[placeholder*="Share a thought"]').first();
  await composer.waitFor({ state: 'visible', timeout: 8000 });
  await composer.fill('Testing a community post');
  await page.locator('text=Post').last().click();
  await page.waitForTimeout(1200);
  log('COMMUNITY POST ADDED', await isVisible('Testing a community post'));
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('div')).filter(d => d.scrollHeight > d.clientHeight + 200 && d.clientHeight > 500);
    cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
    window.__sc = cands[0];
    window.__sc.scrollTop = 1100;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/p9-community-feed.png' });
  await ctx.close();
}

/* Phase E: light theme — hero crescent + comments sheet */
{
  const { ctx, page } = await newPage('light');
  await page.screenshot({ path: '/tmp/p9-light-hero.png' });
  await page.evaluate(() => {
    const leafs = Array.from(document.querySelectorAll('div')).filter(e => e.textContent === '17' && e.childElementCount === 0);
    leafs[0].scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).filter(e => e.textContent === '17' && e.childElementCount === 0)[0];
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  log('LIGHT COMMENTS OPEN', (await page.evaluate(() => document.body.innerText)).includes('COMMENTS'));
  await page.screenshot({ path: '/tmp/p9-comments-light.png' });
  await ctx.close();
}

await browser.close(); server.close();
console.log('SMOKE DONE');
