import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };

async function makePage(scheme) {
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
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return page;
}

/* DARK: profile via direct in-app nav (community → search → row) */
const page = await makePage('dark');
const cl = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Community' && d.getBoundingClientRect().y > 640);
  const r = els[0].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(cl.x, cl.y);
await page.waitForTimeout(900);
await page.evaluate(() => {
  const el = document.querySelector('[placeholder*="Search posts or accounts"]');
  el.focus();
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc.set.call(el, 'kunfai');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(700);
const row = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim().startsWith('@kunfai'));
  for (const h of els) {
    const r = h.getBoundingClientRect();
    if (r.y < 0 || r.y > 844) continue;
    const x = r.x + 30, y = r.y + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (top && (h === top || h.contains(top))) return { x, y };
  }
  return null;
});
if (row) {
  await page.mouse.click(row.x, row.y);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: '/tmp/final-profile-kunfai.png' });
  // About tab
  const about = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'About');
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.y > 0 && r.y < 844) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
  if (about) {
    await page.mouse.click(about.x, about.y);
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/final-profile-about.png' });
  }
}

/* DARK: comments with mention (open first visible card's comments, reply + emoji + mention) */
await page.goBack();
await page.waitForTimeout(900);
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
if (chatBtn) {
  await page.mouse.click(chatBtn.x, chatBtn.y);
  await page.waitForTimeout(900);
  const replyBtn = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Reply');
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.y > 200 && r.y < 800) {
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (top && (el === top || el.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  });
  if (replyBtn) {
    await page.mouse.click(replyBtn.x, replyBtn.y);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const el = document.querySelector('input[placeholder^="Reply to"]');
      el.focus();
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc.set.call(el, 'Ameen 🤲 @alameen jazakAllah');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const postBtn = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Post');
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.y > 600 && r.y < 844) {
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          if (top && (el === top || el.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
    if (postBtn) {
      await page.mouse.click(postBtn.x, postBtn.y);
      await page.waitForTimeout(700);
      await page.screenshot({ path: '/tmp/final-comments-mention.png' });
    }
  }
}

/* DARK: video modal */
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const home = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Home' && d.getBoundingClientRect().y > 640);
  const r = els[0].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(home.x, home.y);
await page.waitForTimeout(900);
await page.evaluate(() => {
  const el = document.elementFromPoint(195, 300);
  let sc = el;
  while (sc) { const st = getComputedStyle(sc); if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 100) break; sc = sc.parentElement; }
  if (sc) sc.scrollTop = 1050;
});
await page.waitForTimeout(600);
const vid = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  const list = imgs.filter((im) => /vid-|thumbnail/i.test(im.getAttribute('src') || '')).length ? imgs.filter((im) => /vid-|thumbnail/i.test(im.getAttribute('src') || '')) : imgs;
  for (const im of list) {
    const r = im.getBoundingClientRect();
    if (r.y > 844 || r.y < 0) continue;
    for (const [px, py] of [[r.x + 14, r.y + 14], [r.x + r.width / 2, r.y + r.height / 2]]) {
      const top = document.elementFromPoint(px, py);
      let e = top;
      const inCard = () => { for (let k = 0; k < 6 && e; k++) { if (/Surah|27:32|Yasin|Masani/.test((e.textContent || '')) && (e.textContent || '').length < 120) return true; e = e.parentElement; } return false; };
      if (top && (im === top || im.contains(top) || inCard())) return { x: px, y: py };
    }
  }
  return null;
});
if (vid) {
  await page.mouse.click(vid.x, vid.y);
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/tmp/final-videomodal.png' });
}

await browser.close();
console.log('shots done');
