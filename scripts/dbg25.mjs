import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
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
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const cl = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Community' && d.getBoundingClientRect().y > 640);
  const r = els[0].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(cl.x, cl.y);
await page.waitForTimeout(1000);

// open comments of first visible card
const chatBtn = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll('path')).filter((p) => (p.getAttribute('d') || '').startsWith('M4 5.6 H20'));
  for (const p of paths) {
    const svg = p.closest('svg');
    let el = svg;
    while (el) {
      const r = el.getBoundingClientRect();
      if (r.height > 18 && r.height < 45 && r.width > 10 && r.width < 60 && r.y > 0 && r.y < 844) {
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (top && (el === top || el.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      el = el.parentElement;
    }
  }
  return null;
});
console.log('chatBtn', JSON.stringify(chatBtn));
await page.mouse.click(chatBtn.x, chatBtn.y);
await page.waitForTimeout(1000);

// dump the input element + reply buttons in the sheet
const dump = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input, [contenteditable]'));
  const out = inputs.map((i) => {
    const r = i.getBoundingClientRect();
    return { tag: i.tagName, type: i.type || '', ph: i.placeholder || i.getAttribute('placeholder') || '', dataPh: i.getAttribute('data-*)') || '', x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), val: i.value ?? i.textContent ?? '' };
  });
  const replies = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Reply').map((d) => {
    const r = d.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { y: Math.round(r.y), x: Math.round(r.x), hitOk: top ? (d === top || d.contains(top)) : false };
  });
  return { inputs: out, replies };
});
console.log(JSON.stringify(dump, null, 1));
const top = await page.evaluate(() => {
  const pt = { x: 130, y: 546 };
  const el = document.elementFromPoint(pt.x, pt.y);
  const chain = [];
  let e = el;
  for (let i = 0; i < 10 && e; i++) {
    const st = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    chain.push({ tag: e.tagName, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), pos: st.position, pe: st.pointerEvents, z: st.zIndex, txt: (e.textContent || '').slice(0, 25).replace(/\n/g, ' ') });
    e = e.parentElement;
  }
  return chain;
});
console.log('TOP at (130,546):', JSON.stringify(top, null, 1));
// click first visible Reply leaf and observe
const clicked = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Reply');
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.y > 200 && r.y < 844) {
      let vis = true, a = el;
      while (a) { const st = getComputedStyle(a); if (st.visibility === 'hidden' || st.display === 'none') { vis = false; break; } a = a.parentElement; }
      if (vis) return { x: r.x + r.width / 2, y: r.y + r.height / 2, y0: Math.round(r.y) };
    }
  }
  return null;
});
console.log('reply click target:', JSON.stringify(clicked));
if (clicked) {
  await page.mouse.click(clicked.x, clicked.y);
  await page.waitForTimeout(600);
  const ph = await page.evaluate(() => {
    const i = document.querySelector('input[placeholder^="Add a comment"]') || document.querySelector('input[placeholder^="Reply to"]');
    return i ? i.placeholder : 'NO_INPUT';
  });
  console.log('placeholder after click:', ph);
  const ind = await page.evaluate(() => document.body.innerText.includes('Replying to'));
  console.log('replying indicator:', ind);
}
await browser.close();
