/* pass 66 — verify the four things this pass promised:
 *   1. slide-to-reply works on SHARED app items (not just plain bubbles)
 *   2. sending smooth-scrolls to the bottom even from the TOP of the thread
 *   3. a "Latest" jump chip appears while scrolled up and returns you down
 *   4. the web canvas is full-bleed + theme-matched (no white / wrong-black
 *      overscroll margin) and text is not selectable
 * Serves the built dist/ from /tmp/serve (repo copy under /deenapp/), seeds a
 * demo session, and blocks every live-API call so only bundled data renders. */
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
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); localStorage.setItem('dl.theme', 'dark'); } catch {} }, user);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8123/deenapp/tools/inbox', { waitUntil: 'domcontentloaded' });
await page.getByText('Aisha Yusuf').first().click({ timeout: 30000 }).catch(() => {});
await page.waitForSelector('input', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1000);

const results = {};
const scrollerHandle = () => page.evaluateHandle(() => {
  const all = [...document.querySelectorAll('#root *')];
  return all.filter((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || null;
});

/* ── 4a. canvas + selection ─────────────────────────────────────────────── */
results.canvas = await page.evaluate(() => {
  const html = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  const root = document.getElementById('root');
  const meta = document.querySelector('meta[name="theme-color"]');
  const bubble = [...document.querySelectorAll('div')].find((e) => (e.textContent || '').trim() === 'This dua changed my nights, try it tonight inshaAllah');
  const composerInput = document.querySelector('input');
  return {
    cssVar: html.getPropertyValue('--app-bg').trim(),
    htmlBg: html.backgroundColor,
    bodyBg: body.backgroundColor,
    rootBg: root ? getComputedStyle(root).backgroundColor : null,
    overscroll: html.overscrollBehavior || body.overscrollBehavior,
    metaTheme: meta?.getAttribute('content') ?? null,
    bubbleUserSelect: bubble ? getComputedStyle(bubble).userSelect || getComputedStyle(bubble).webkitUserSelect : 'no bubble',
    inputUserSelect: composerInput ? getComputedStyle(composerInput).userSelect || getComputedStyle(composerInput).webkitUserSelect : 'no input',
  };
});

/* ── 1. slide-to-reply on a SHARED app item ─────────────────────────────── */
const SHARE_TEXT = 'Surah Al-Fatiha · Ayah 5';
await page.evaluate((t) => {
  const all = [...document.querySelectorAll('div,span')];
  const el = all.reverse().find((e) => (e.textContent || '').trim() === t);
  if (el) el.scrollIntoView({ block: 'center' });
}, SHARE_TEXT);
await page.waitForTimeout(700);
const shareBox = await page.getByText(SHARE_TEXT).first().boundingBox().catch(() => null);
results.shareBox = shareBox ? `x=${Math.round(shareBox.x)} y=${Math.round(shareBox.y)} w=${Math.round(shareBox.width)}` : 'not found';
if (shareBox) {
  const cx = shareBox.x + 18, cy = shareBox.y + shareBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 9; i++) { await page.mouse.move(cx + i * 9, cy); await page.waitForTimeout(16); }
  await page.screenshot({ path: '/tmp/p66-share-mid-drag.png' });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  results.shareSwipeReplyBar = await page.evaluate(() => /Replying to/.test(document.body.innerText));
  results.shareReplyQuote = await page.evaluate(() => {
    const m = document.body.innerText.match(/Replying to[^\n]*/);
    return m ? m[0].trim() : null;
  });
  await page.screenshot({ path: '/tmp/p66-share-reply.png' });
  /* cancel the quote so the send test starts clean */
  const cancel = page.locator('text=Replying to').first();
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div,span')].find((e) => /^Replying to/.test((e.textContent || '').trim()));
    const row = el?.closest('div[style*="border"]') || el?.parentElement;
    const x = row?.querySelector('div[role="button"], div[tabindex]');
    if (x) x.click();
  });
  await page.waitForTimeout(400);
  results.replyCancelled = await page.evaluate(() => !/Replying to/.test(document.body.innerText));
  void cancel;
}

/* ── make the thread long enough to scroll ──────────────────────────────── */
for (let i = 0; i < 5; i++) {
  await page.getByText('Share ayah').first().click().catch(() => {});
  await page.waitForTimeout(320);
}
await page.waitForTimeout(800);
let sh = null;
for (let i = 0; i < 20 && !sh; i++) { sh = (await scrollerHandle()).asElement(); if (!sh) await page.waitForTimeout(500); }
results.scrollable = sh ? await page.evaluate((el) => `scrollHeight=${el.scrollHeight} clientHeight=${el.clientHeight}`, sh) : 'no scroller';
if (!sh) { console.log(JSON.stringify(results, null, 1)); console.log('ABORT: no scroller'); await browser.close(); server.close(); process.exit(1); }

/* ── 3. jump chip appears when scrolled up, and returns down ─────────────── */
await page.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll', { bubbles: true })); }, sh);
await page.waitForTimeout(900);
results.chipWhenScrolledUp = await page.evaluate(() => /Latest/.test(document.body.innerText));
await page.screenshot({ path: '/tmp/p66-jump-chip.png' });
await page.getByText('Latest').first().click().catch(() => {});
await page.waitForTimeout(1600);
results.afterChipClick = await page.evaluate((el) => {
  const gap = el.scrollHeight - (el.scrollTop + el.clientHeight);
  return { gap: Math.round(gap), chipGone: !/Latest/.test(document.body.innerText) };
}, sh);

/* ── 2. send from the TOP smooth-scrolls to the newest bubble ────────────── */
await page.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll', { bubbles: true })); }, sh);
await page.waitForTimeout(700);
const beforeTop = await page.evaluate((el) => Math.round(el.scrollTop), sh);
const SENT = 'Sending from the very top of the thread';
await page.locator('input').first().fill(SENT);
await page.keyboard.press('Enter');
await page.waitForTimeout(2200);
results.sendFromTop = await page.evaluate((t) => {
  const el = [...document.querySelectorAll('#root *')].filter((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  const node = [...document.querySelectorAll('div,span')].reverse().find((e) => (e.textContent || '').trim() === t);
  const r = node?.getBoundingClientRect();
  const sr = el?.getBoundingClientRect();
  return {
    scrollTop: el ? Math.round(el.scrollTop) : null,
    bubbleFound: !!node,
    bubbleVisibleInScroller: !!(r && sr && r.top >= sr.top - 2 && r.bottom <= sr.bottom + 2),
    bubbleTop: r ? Math.round(r.top) : null,
    scrollerTop: sr ? Math.round(sr.top) : null,
    scrollerBottom: sr ? Math.round(sr.bottom) : null,
  };
}, SENT);
results.scrolledFromTop = (results.sendFromTop?.scrollTop ?? 0) > beforeTop + 50;
await page.screenshot({ path: '/tmp/p66-after-send.png' });

/* ── 4b. composer font (pass-64 regression) ─────────────────────────────── */
results.inputFont = await page.evaluate(() => {
  const i = document.querySelector('input');
  return i ? getComputedStyle(i).fontFamily : 'no input';
});

/* ── pass-64 regressions: hold menu on MY bubble, info, forward ──────────── */
const longPressAt = async (text) => {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('div,span')].reverse().find((e) => (e.textContent || '').trim() === t);
    if (el) el.scrollIntoView({ block: 'center' });
  }, text);
  await page.waitForTimeout(500);
  const b = await page.getByText(text).first().boundingBox().catch(() => null);
  if (!b) return false;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();
  await page.waitForTimeout(600);
  return true;
};

if (await longPressAt(SENT)) {
  results.ownMenu = await page.evaluate(() => {
    const t = document.body.innerText;
    return { reply: /\nReply\n/.test('\n' + t + '\n') || /Reply/.test(t), forward: /Forward/.test(t), copy: /Copy/.test(t), info: /\nInfo\n/.test('\n' + t + '\n'), del: /Delete/.test(t) };
  });
  await page.screenshot({ path: '/tmp/p66-own-menu.png' });
  /* Info panel */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div,span')].find((e) => (e.textContent || '').trim() === 'Info');
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  results.infoPanel = await page.evaluate(() => {
    const t = document.body.innerText;
    return { header: /Message info/.test(t), delivered: /Delivered/.test(t), seenLine: /Seen|Not seen yet/.test(t) };
  });
  await page.screenshot({ path: '/tmp/p66-info.png' });
  /* close the sheet (backdrop covers everything), re-hold, go Forward */
  await page.mouse.click(20, 210);
  await page.waitForTimeout(500);
  if (await longPressAt(SENT)) {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('div,span')].find((e) => (e.textContent || '').trim() === 'Forward');
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    results.forwardScreen = await page.evaluate(() => /0 selected/.test(document.body.innerText));
    /* pick the first account, the button label must count it */
    await page.evaluate(() => {
      const all = [...document.querySelectorAll('div,span')].filter((e) => /^@/.test((e.textContent || '').trim()) && (e.textContent || '').length < 30);
      const at = all[all.length - 1];
      at?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    results.forwardCount = await page.evaluate(() => {
      const m = document.body.innerText.match(/Forward to (\d+)/);
      return m ? m[0] : null;
    });
    await page.screenshot({ path: '/tmp/p66-forward.png' });
    await page.mouse.click(20, 210);
  }
}

/* their bubble must NOT offer Info/Delete */
if (await longPressAt('This dua changed my nights, try it tonight inshaAllah')) {
  results.theirMenu = await page.evaluate(() => {
    const t = document.body.innerText;
    return { info: /\nInfo\n/.test('\n' + t + '\n'), del: /Delete/.test(t) };
  });
  await page.evaluate(() => {
    const root = document.getElementById('root');
    root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

console.log(JSON.stringify(results, null, 1));
console.log('JS errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
server.close();
