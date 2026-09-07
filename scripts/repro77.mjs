/* pass 77 E2E — nested comment replies name the DIRECT parent.
 * API seeds: A posts + comments; B replies to A's comment.
 * Browser (as C): opens comments → replies to B's reply → chip + row must say
 * "Bravo" (B), not "Alpha" (A) → survives a modal reopen (server reload). */
import { chromium } from 'playwright-core';
const BASE = 'http://app.deenlink.org';
const results = [];
const check = (label, cond, extra = '') => { results.push(!!cond); console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  << ' + extra)); };

const RUN = Date.now();
const mergeCookies = (prev, resp) => {
  const m = new Map();
  for (const c of (prev || '').split('; ')) { if (c.includes('=')) m.set(c.split('=')[0], c); }
  for (const c of (resp.headers.getSetCookie?.() ?? [])) { const kv = c.split(';')[0]; m.set(kv.split('=')[0], kv); }
  return Array.from(m.values()).join('; ');
};
const api = async (cookie, path, body, token) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-CSRF-Token': token } : {}), Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: r.status, j: await r.json().catch(() => ({})), cookie: mergeCookies(cookie, r) };
};
const reg = async (tag, disp) => {
  const r0 = await fetch(BASE + '/api/auth/csrf.php');
  const token = (await r0.json()).csrf_token;
  let cookie = mergeCookies('', r0);
  const uname = tag + RUN;
  const rr = await api(cookie, '/api/auth/register.php', { full_name: disp, username: uname, email: uname + '@t.co', password: 'Str0ngPass!23', confirm_password: 'Str0ngPass!23', agree_terms: true, aqeedah: 'Sunni' }, token);
  if (rr.j.status !== 'success') throw new Error('register ' + tag + ': ' + JSON.stringify(rr.j).slice(0, 140));
  cookie = rr.cookie; // logged-in session
  const r1 = await fetch(BASE + '/api/auth/csrf.php', { headers: { Cookie: cookie } });
  const token2 = (await r1.json()).csrf_token;
  cookie = mergeCookies(cookie, r1);
  return { uname, email: uname + '@t.co', cookie, token: token2 };
};

const A = await reg('r77a', 'Alpha Tester');
const B = await reg('r77b', 'Bravo Tester');
const C = await reg('r77c', 'Charlie Tester');

// seed: A posts, A comments, B replies to A's comment — with real sessions
const rp = await fetch(BASE + '/api/feed/create_post.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': A.token, Cookie: A.cookie },
  body: new URLSearchParams({ content_text: 'E2E nested chain ' + RUN, visibility: 'public' }),
});
const pj = await rp.json();
const pid = pj.post_id || 0;
const cm = await api(A.cookie, '/api/feed/add_comment.php', { post_id: pid, text: 'root comment by A' }, A.token);
const cAid = cm.j.comment_id || 0;
const rb = await api(B.cookie, '/api/feed/add_reply.php', { post_id: pid, comment_id: cAid, parent_reply_id: 0, text: 'B reply to A' }, B.token);
check('seed: A posts, A comments, B replies', pid > 0 && cAid > 0 && (rb.j.reply_id || 0) > 0, JSON.stringify({ pid, cAid, rb: rb.j }).slice(0, 140));

const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept().catch(() => {}));
const tapByText = (re) => page.evaluate((src) => {
  const re2 = new RegExp(src);
  const els = Array.from(document.querySelectorAll('div,span')).filter((e) => re2.test((e.textContent || '').trim()) && e.children.length <= 3);
  const el = els[els.length - 1];
  if (!el) return null;
  const o = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', o));
  el.dispatchEvent(new PointerEvent('pointerup', o));
  el.dispatchEvent(new MouseEvent('click', o));
  return (el.textContent || '').trim().slice(0, 40);
}, re.source);
const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const inputs = await page.$$('input');
await inputs[0].fill(C.email);
await inputs[1].fill('Str0ngPass!23');
await page.getByText('Sign In', { exact: true }).first().click();
await page.waitForTimeout(5500);
await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const openComments = async () => {
  for (let i = 0; i < 5; i++) {
    await page.evaluate((tag) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n, node = null;
      while ((n = walker.nextNode())) { if ((n.textContent || '').includes(tag)) { node = n; break; } }
      if (!node) return;
      let el = node.parentElement;
      for (let k = 0; k < 14 && el; k++) {
        const btn = el.querySelector('[aria-label="open comments"]');
        if (btn) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
        el = el.parentElement;
      }
    }, 'E2E nested chain');
    await page.waitForTimeout(2500);
    if ((await bodyText()).includes('root comment by A')) return true;
  }
  return false;
};
check('comments modal opens on the probe post', await openComments());
await tapByText(/^View \d+ repl/i);
await page.waitForTimeout(1200);
let txt = await bodyText();
check('B’s reply names Alpha (A, the comment author)', /replying to › Alpha Tester/.test(txt), txt.slice(txt.indexOf('root comment'), txt.indexOf('root comment') + 220));

// C taps Reply on B's reply row
const replyTapped = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n, node = null;
  while ((n = walker.nextNode())) { if ((n.textContent || '').trim() === 'B reply to A') { node = n; break; } }
  if (!node) return false;
  let el = node.parentElement;
  for (let k = 0; k < 8 && el; k++) {
    const btn = Array.from(el.querySelectorAll('div,span')).find((e) => (e.textContent || '').trim() === 'Reply' && e.children.length === 0);
    if (btn) {
      const o = { bubbles: true, composed: true, cancelable: true, view: window };
      btn.dispatchEvent(new PointerEvent('pointerdown', o));
      btn.dispatchEvent(new PointerEvent('pointerup', o));
      btn.dispatchEvent(new MouseEvent('click', o));
      return true;
    }
    el = el.parentElement;
  }
  return false;
});
check('tapped Reply on B’s reply row', replyTapped);
await page.waitForTimeout(800);
txt = await bodyText();
check('composer chip says "Replying to › Bravo" (NOT Alpha)', /Replying to › Bravo Tester/.test(txt) && !/Replying to › Alpha/.test(txt), txt.slice(0, 200));

// type + post
const boxes = await page.$$('input, textarea');
await boxes[boxes.length - 1].fill('C reply to B via UI');
await tapByText(/^Post$/);
await page.waitForTimeout(2500);
txt = await bodyText();
check('posted row immediately shows "replying to › Bravo"', /replying to › Bravo Tester[\s\S]{0,120}C reply to B via UI/.test(txt), txt.slice(txt.indexOf('root comment'), txt.indexOf('root comment') + 400));

// reopen → server truth
await tapByText(/^(Close|✕|×)$/).catch(() => {});
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
check('modal reopens with server data', await openComments());
await tapByText(/^View \d+ repl/i);
await page.waitForTimeout(1200);
txt = await bodyText();
check('after reload: C’s reply still shows "replying to › Bravo"', /replying to › Bravo Tester[\s\S]{0,120}C reply to B via UI/.test(txt), txt.slice(txt.indexOf('root comment'), txt.indexOf('root comment') + 400));
check('thread counts 2 replies (expanded or collapsed)', (/View 2 replies/.test(txt) || /Hide replies/.test(txt)) && (txt.match(/replying to ›/g) || []).length === 2, txt.slice(txt.indexOf('root comment'), txt.indexOf('root comment') + 120));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
