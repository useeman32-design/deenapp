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
// open comments
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
await page.waitForTimeout(900);
// type in the comment input
await page.evaluate(() => {
  const el = document.querySelector('input[placeholder^="Add a comment"]');
  el.focus();
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc.set.call(el, 'JazakAllah khair @alameen');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(400);
// find ALL 'Post' leaves + their hit status
const posts = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Post');
  return els.map((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { x: Math.round(r.x), y: Math.round(r.y), hit: top ? (el === top || el.contains(top)) : false, topTxt: top ? (top.textContent || '').slice(0, 12) : '' };
  });
});
console.log('Post leaves:', JSON.stringify(posts));
// click the last (sheet) Post via real mouse
const target = posts[posts.length - 1];
if (target) {
  await page.mouse.click(target.x + 8, target.y + 8);
  await page.waitForTimeout(800);
  const txt = await page.evaluate(() => document.body.innerText);
  console.log('comment posted?', txt.includes('JazakAllah khair @alameen'));
  const mention = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('span,div')).filter((e) => e.children.length === 0 && /@alameen/.test((e.textContent || '').trim()) && (e.textContent || '').length < 20);
    return els.map((el) => ({ fw: getComputedStyle(el).fontWeight, color: getComputedStyle(el).color, y: Math.round(el.getBoundingClientRect().y) }));
  });
  console.log('@alameen leaves after post:', JSON.stringify(mention));
}
// video thumb corner cover
await page.evaluate(() => {
  const el = document.elementFromPoint(195, 300);
});
console.log('done');
await browser.close();
