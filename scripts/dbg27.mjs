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
await page.mouse.click(chatBtn.x, chatBtn.y);
await page.waitForTimeout(1000);

const items = await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder^="Add a comment"]');
  let row = inp;
  // climb to the emoji row container: the sibling above the input row
  for (let i = 0; i < 4 && row; i++) row = row.parentElement;
  // find the horizontal scroller: a div with overflow-x auto/scroll containing emoji text
  const all = Array.from(document.querySelectorAll('div'));
  const hov = all.filter((d) => {
    const st = getComputedStyle(d);
    return (st.overflowX === 'auto' || st.overflowX === 'scroll') && /😄/.test(d.textContent || '') && d.getBoundingClientRect().height > 40;
  });
  return hov.map((d) => {
    const st = getComputedStyle(d);
    const r = d.getBoundingClientRect();
    const kids = Array.from(d.children).map((c) => {
      const cr = c.getBoundingClientRect();
      const cst = getComputedStyle(c);
      return { w: Math.round(cr.width), h: Math.round(cr.height), x: Math.round(cr.x), y: Math.round(cr.y), fd: cst.flexDirection, disp: cst.display, txt: (c.textContent || '').slice(0, 12), nkids: c.children.length };
    });
    const grand = [];
    for (const c of d.children) {
      for (const gc of c.children) {
        const cr = gc.getBoundingClientRect();
        const gst = getComputedStyle(gc);
        grand.push({ ch: (gc.textContent || '').slice(0, 3), w: Math.round(cr.width), h: Math.round(cr.height), x: Math.round(cr.x), y: Math.round(cr.y), pad: gst.padding, ai: gst.alignItems, h2: gc.children.length ? Array.from(gc.children).map((g2) => { const r2 = g2.getBoundingClientRect(); return (g2.textContent || '').slice(0,2) + ':' + Math.round(r2.width) + 'x' + Math.round(r2.height); }).join(',') : '' });
      }
    }
    return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), fd: st.flexDirection, disp: st.display, grand };
  });
});
console.log(JSON.stringify(items, null, 1));
await browser.close();
