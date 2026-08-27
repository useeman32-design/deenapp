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

// dump layout before search
const before = await page.evaluate(() => {
  const sc = document.querySelector('div[data-noscroll], [class*="ScrollView"]') || null;
  // find the scrollable content: the big content container
  const all = Array.from(document.querySelectorAll('div'));
  const content = all.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 350 && r.height > 1200; }).sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
  if (!content) return null;
  return Array.from(content.children).map((c) => {
    const r = c.getBoundingClientRect();
    return { tag: c.tagName, txt: (c.textContent || '').slice(0, 40).replace(/\n/g, ' '), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
  });
});
console.log('BEFORE search, children of content container:');
console.log(JSON.stringify(before, null, 1));

// type search
await page.evaluate(() => {
  const el = document.querySelector('[placeholder*="Search posts or accounts"]');
  el.focus();
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc.set.call(el, 'alameen');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(800);
const after = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('div'));
  const content = all.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 350 && r.height > 600; }).sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
  if (!content) return null;
  const cr = content.getBoundingClientRect();
  return { contentH: Math.round(cr.height), children: Array.from(content.children).map((c) => {
    const r = c.getBoundingClientRect();
    return { txt: (c.textContent || '').slice(0, 40).replace(/\n/g, ' '), w: Math.round(r.width), h: Math.round(r.height), yRel: Math.round(r.y - cr.y) };
  }) };
});
console.log('AFTER search:');
console.log(JSON.stringify(after, null, 1));
await page.screenshot({ path: '/tmp/p12-search-layout.png' });
await browser.close();
