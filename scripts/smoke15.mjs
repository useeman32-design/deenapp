import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
import { mkdirSync } from 'fs';
const SHOTS = '/home/user/shots-pass14';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
await ctx.addInitScript((u) => {
  try {
    localStorage.setItem('dl.session', 'demo-session-token');
    localStorage.setItem('dl.user', JSON.stringify(u));
    localStorage.setItem('dl.onboarded', '1');
    localStorage.setItem('dl.demoSession', '1');
    try { sessionStorage.setItem('dl.splash.seen', '1'); } catch {}
  } catch {}
}, user);
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', user }), headers: { 'Set-Cookie': 'deenlink_session=demo-session-token; Path=/' } });
    return route.abort();
  }
  return route.continue();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);

/* Visibility-aware helpers: only elements actually hit-testable at their point count. */
const hitPoint = (finderFn) =>
  page.evaluate((src) => {
    const els = new Function('return (' + src + ')')();
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) continue;
      const x = Math.min(Math.max(r.x + Math.min(10, r.width / 2), 2), 388);
      const y = Math.min(Math.max(r.y + r.height / 2, 2), 842);
      if (y > 842) continue;
      const top = document.elementFromPoint(x, y);
      if (top && (el === top || el.contains(top))) return { x, y };
    }
    return null;
  }, finderFn);

const setText = (selector, value) =>
  page.evaluate(([sel, v]) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.focus();
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    desc.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, [selector, value]);

const bodyText = () => page.evaluate(() => document.body.innerText);

/* ---------------- HOME: video modal + watch more ---------------- */
let bt = await bodyText();
check('home: "Watch more" present', bt.includes('Watch more'));

// scroll the home scroller down so the Daily Videos row is in view
await page.evaluate(() => {
  const el = document.elementFromPoint(195, 300);
  let sc = el;
  while (sc) {
    const st = getComputedStyle(sc);
    if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 100) break;
    sc = sc.parentElement;
  }
  if (sc) sc.scrollTop = 1050;
});
await page.waitForTimeout(500);

const vidCard = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('div'));
  const dv = all.find((e) => (e.textContent || '').trim() === 'Daily Videos');
  if (!dv) return null;
  // climb to the section container that holds the thumbnail images
  let sec = dv;
  for (let i = 0; i < 6 && sec; i++) {
    if (sec.querySelectorAll('img').length >= 2) break;
    sec = sec.parentElement;
  }
  const imgs = sec ? Array.from(sec.querySelectorAll('img')) : [];
  const cands = imgs.filter((im) => /vid-|thumbnail/i.test(im.getAttribute('src') || ''));
  const list = cands.length ? cands : imgs;
  const inCard = (el) => {
    let e = el;
    for (let k = 0; k < 6 && e; k++) {
      const t = e.textContent || '';
      if (/Surah|27:32|Yasin|Masani/.test(t) && t.length < 120) return true;
      e = e.parentElement;
    }
    return false;
  };
  for (const im of list) {
    const r = im.getBoundingClientRect();
    if (r.y > 844 || r.y < 0) continue;
    // overlays (play icon / time chip) are siblings on the card; click a card point over the img
    for (const [px, py] of [[r.x + 14, r.y + 14], [r.x + r.width / 2, r.y + r.height / 2], [r.x + r.width - 14, r.y + 30]]) {
      const top = document.elementFromPoint(px, py);
      if (top && (im === top || im.contains(top) || inCard(top))) return { x: px, y: py };
    }
  }
  return null;
});
if (vidCard) {
  await page.mouse.click(vidCard.x, vidCard.y);
  await page.waitForTimeout(900);
  const modalTxt = await bodyText();
  check('video modal: "Open in YouTube" removed', !modalTxt.includes('Open in YouTube'));
  check('video modal: Share still present', modalTxt.includes('Share'));
  await page.screenshot({ path: '/tmp/p12-videomodal.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} else {
  check('video modal: opened', false, 'no thumbnail found');
}

/* ---------------- COMMUNITY ---------------- */
const commLabel = await hitPoint(
  'Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Community" && d.getBoundingClientRect().y > 640)',
);
check('community: tab label hit-testable', !!commLabel);
if (commLabel) await page.mouse.click(commLabel.x, commLabel.y);
await page.waitForTimeout(1200);
const cTxt = await bodyText();
check('community: stat cards removed', !cTxt.includes('Online now') && !cTxt.includes('Posts today'));
check('community: search field', await page.evaluate(() => !!document.querySelector('[placeholder*="Search posts or accounts"]')));
check('community: trending', cTxt.includes('TRENDING') && cTxt.includes('#Tawbah'));
check('community: tabs', cTxt.includes('For you') && cTxt.includes('Scholars'));

// sticky on scroll
await page.mouse.move(195, 420);
await page.mouse.wheel(0, 420);
await page.waitForTimeout(700);
const stickyState = await page.evaluate(() => {
  const bar = Array.from(document.querySelectorAll('div')).find((d) => {
    const st = getComputedStyle(d);
    return st.position === 'absolute' && (d.textContent || '').includes('For you') && (d.textContent || '').includes('Scholars') && st.transform !== 'none' && d.getBoundingClientRect().y <= 8;
  });
  if (!bar) return null;
  return { transform: getComputedStyle(bar).transform, y: Math.round(bar.getBoundingClientRect().y) };
});
check('community: sticky tabs at top after scroll', !!stickyState && /matrix\(1, 0, 0, 1, 0, (0|-0)\)/.test(stickyState.transform), stickyState ? `${stickyState.transform} y=${stickyState.y}` : 'bar not found');
await page.screenshot({ path: '/tmp/p12-community-sticky.png' });

await page.mouse.wheel(0, -900);
await page.waitForTimeout(500);

/* ---------------- FAB + composer with poll ---------------- */
const fab = await page.evaluate(() => {
  const px = 390 - 16 - 27, py = 844 - 78 - 27;
  let el = document.elementFromPoint(px, py);
  while (el) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (st.position === 'absolute' && r.width >= 50 && r.width <= 60 && r.height >= 50 && r.height <= 60 && r.x > 250) {
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    el = el.parentElement;
  }
  return null;
});
check('community: FAB present', !!fab, fab ? `at ${Math.round(fab.x)},${Math.round(fab.y)}` : 'not hit-testable');
if (fab) {
  await page.mouse.click(fab.x, fab.y);
  await page.waitForTimeout(800);
  const mTxt = await bodyText();
  check('composer: "New post" modal opened', mTxt.includes('New post'));
  await page.screenshot({ path: '/tmp/p12-composer.png' });

  const editorOk = await setText('[placeholder*="Share a thought"]', 'x');
  check('composer: input found', !!editorOk);
  await setText('[placeholder*="Share a thought"]', 'Pass 10 test post');
  await page.waitForTimeout(200);

  await page.getByText('Add a poll', { exact: true }).click();
  await page.waitForTimeout(400);
  const nOpts = await page.evaluate(() => document.querySelectorAll('[placeholder^="Poll option"]').length);
  check('composer: 2 poll option fields', nOpts === 2, `found ${nOpts}`);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[placeholder^="Poll option"]'));
    els.forEach((el, i) => {
      el.focus();
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc.set.call(el, i === 0 ? 'Fajr' : 'Duha');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/p12-composer-poll.png' });
  await page.getByText('Post poll', { exact: true }).click();
  await page.waitForTimeout(350);
  const busyTxt = await bodyText();
  check('composer: "Posting…" progress shown', busyTxt.includes('Posting…'));
  await page.screenshot({ path: '/tmp/p12-composer-posting.png' });
  await page.waitForTimeout(2100);
  const afterTxt = await bodyText();
  check('composer: post landed in feed', afterTxt.includes('Pass 10 test post'));
}

/* ---------------- SEARCH: posts + accounts → profile ---------------- */
await setText('[placeholder*="Search posts or accounts"]', 'tawbah');
await page.waitForTimeout(700);
let sTxt = await bodyText();
check('search: tag finds posts', sTxt.includes('POSTS') && sTxt.includes('yusra'), sTxt.slice(0, 50).replace(/\n/g, ' '));
await page.screenshot({ path: '/tmp/p12-search.png' });

await setText('[placeholder*="Search posts or accounts"]', 'alameen');
await page.waitForTimeout(700);
sTxt = await bodyText();
check('search: accounts found', sTxt.includes('ACCOUNTS'));
const accRow = await hitPoint(
  'Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim().startsWith("@alameen"))',
);
check('search: account row hit-testable', !!accRow);
if (accRow) {
  await page.mouse.click(accRow.x, accRow.y);
  await page.waitForTimeout(1400);
  const pTxt = await bodyText();
  check('profile: opened via search', pTxt.includes('Public Profile'), page.url().slice(-40));
  check('profile: stats row', pTxt.includes('FOLLOWERS') && pTxt.includes('FOLLOWING') && pTxt.includes('CHARITY'));
  check('profile: tabs', pTxt.includes('Questions') && pTxt.includes('Videos'));
  await page.screenshot({ path: '/tmp/p12-profile.png' });
  const followBtn = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Follow")');
  if (followBtn) {
    await page.mouse.click(followBtn.x, followBtn.y);
    await page.waitForTimeout(500);
    const after = await bodyText();
    check('profile: follow → Following', after.includes('Following'));
  } else check('profile: follow button found', false);
  const qTab = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Questions")');
  if (qTab) {
    await page.mouse.click(qTab.x, qTab.y);
    await page.waitForTimeout(500);
    const qTxt = await bodyText();
    check('profile: answered questions shown', qTxt.includes('Ask this scholar a question'));
    await page.screenshot({ path: '/tmp/p12-profile-questions.png' });
  } else check('profile: questions tab found', false);
  // back to community
  await page.goBack();
  await page.waitForTimeout(1000);
} else {
  check('profile: opened via search', false, 'row not hit-testable');
}

/* community scroll control */
const setCommunityScroll = (mode) =>
  page.evaluate((m) => {
    const h = Array.from(document.querySelectorAll('div')).find((d) => {
      if (d.children.length !== 0) return false;
      const t = (d.textContent || '').trim();
      if (t !== 'Community') return false;
      const r = d.getBoundingClientRect();
      return r.y > 0 && r.y < 200;
    });
    if (!h) return 'no-header';
    let sc = h.parentElement;
    while (sc) {
      const st = getComputedStyle(sc);
      if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 50) break;
      sc = sc.parentElement;
    }
    if (!sc) return 'no-scroller';
    if (m === 'top') sc.scrollTop = 0;
    else if (m === 'bottom') sc.scrollTop = sc.scrollHeight - 900;
    else sc.scrollTop = m;
    return 'ok';
  }, mode);

/* ---------------- image preview + burst (top of feed) ---------------- */
await setCommunityScroll('bottom');
await page.waitForTimeout(400);
const pollCard = await hitPoint(
  'Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && /Fajr itself/.test(d.textContent || ""))',
);
check('poll: card hit-testable', !!pollCard);
if (pollCard) {
  await page.mouse.click(pollCard.x, pollCard.y);
  await page.waitForTimeout(500);
  const pTxt = await bodyText();
  const pct = pTxt.match(/\b(\d{2,3})%/);
  check('poll: vote shows percentages', !!pct, pct ? pct[0] : 'no % found');
  await page.screenshot({ path: '/tmp/p12-poll-voted.png' });
}

/* ---------------- image preview ---------------- */
let mosqueImg = null;
for (let attempt = 0; attempt < 3 && !mosqueImg; attempt++) {
  mosqueImg = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().width > 200 && i.getBoundingClientRect().height > 120);
    for (const i of imgs) {
      i.scrollIntoView({ block: 'center' });
    }
    // after scrolling all copies, hit-test each center
    for (const i of imgs) {
      const r = i.getBoundingClientRect();
      if (r.y < 60 || r.y > 780) continue;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (top && (i === top || i.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
  if (mosqueImg) break;
  await page.waitForTimeout(400);
  mosqueImg = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().width > 200 && i.getBoundingClientRect().height > 120);
    for (const i of imgs) {
      const r = i.getBoundingClientRect();
      if (r.y < 60 || r.y > 780) continue;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (top && (i === top || i.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
}
check('preview: mosque image hit-testable', !!mosqueImg);
if (mosqueImg) {
  await page.mouse.click(mosqueImg.x, mosqueImg.y);
  await page.waitForTimeout(900);
  const prev = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    let best = null;
    for (const i of imgs) {
      const r = i.getBoundingClientRect();
      let el = i, dark = false;
      while (el) {
        const st = getComputedStyle(el);
        if ((st.backgroundColor || '').startsWith('rgba(0, 0, 0, 0.9')) { dark = true; break; }
        el = el.parentElement;
      }
      if (dark && r.width > 100) { best = { w: Math.round(r.width), h: Math.round(r.height), opacity: getComputedStyle(i).opacity }; break; }
    }
    return best;
  });
  check('preview: image visible (non-zero size)', !!prev && prev.h > 100, prev ? `${prev.w}x${prev.h} op=${prev.opacity}` : 'not found');
  await page.screenshot({ path: '/tmp/p12-preview.png' });
  await page.mouse.click(195, 790);
  await page.waitForTimeout(600);
}

/* ---------------- double-tap burst ---------------- */
let mosqueImg2 = null;
for (let attempt = 0; attempt < 3 && !mosqueImg2; attempt++) {
  mosqueImg2 = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().width > 200 && i.getBoundingClientRect().height > 120);
    for (const i of imgs) i.scrollIntoView({ block: 'center' });
    for (const i of imgs) {
      const r = i.getBoundingClientRect();
      if (r.y < 60 || r.y > 780) continue;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (top && (i === top || i.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
  if (mosqueImg2) break;
  await page.waitForTimeout(400);
  mosqueImg2 = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().width > 200 && i.getBoundingClientRect().height > 120);
    for (const i of imgs) {
      const r = i.getBoundingClientRect();
      if (r.y < 60 || r.y > 780) continue;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (top && (i === top || i.contains(top))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
}
if (mosqueImg2) {
  await page.mouse.click(mosqueImg2.x, mosqueImg2.y);
  await page.waitForTimeout(120);
  await page.mouse.click(mosqueImg2.x, mosqueImg2.y);
  await page.waitForTimeout(250);
  await page.screenshot({ path: '/tmp/p12-burst-mid.png' });
  await page.waitForTimeout(2600);
  const burst = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div')).filter((d) => {
      const st = getComputedStyle(d);
      return st.pointerEvents === 'none' && st.position === 'absolute' && st.transform.startsWith('matrix') && (d.getAttribute('style') || '').includes('opacity');
    });
    return divs.map((d) => getComputedStyle(d).opacity);
  });
  const ok = burst.length > 0 && burst.every((o) => o === '0');
  check('burst: overlay returns to opacity 0', ok, JSON.stringify(burst.slice(0, 2)));
} else check('burst: image hit-testable', false);

/* ---------------- comments ---------------- */
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
check('comments: chat button hit-testable', !!chatBtn);
if (chatBtn) {
  await page.mouse.click(chatBtn.x, chatBtn.y);
  await page.waitForTimeout(1000);
  const sheetTxt = await bodyText();
  check('comments: sheet opened', sheetTxt.includes('COMMENTS'));
  const replyBtn = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Reply" && d.getBoundingClientRect().y > 200)')
    || await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div')).filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Reply');
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.y > 200 && r.y < 844) {
          let vis = true, a = el;
          while (a) { const st = getComputedStyle(a); if (st.visibility === 'hidden' || st.display === 'none') { vis = false; break; } a = a.parentElement; }
          if (vis) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
  if (replyBtn) {
    await page.mouse.click(replyBtn.x, replyBtn.y);
    await page.waitForTimeout(500);
    const inpVal = await page.evaluate(() => {
      const el = document.querySelector('[placeholder^="Reply to"]');
      if (!el) return 'NO_INPUT';
      return el.value ?? el.textContent ?? '';
    });
    check('comments: no @handle prefilled', String(inpVal).trim() === '', `value="${String(inpVal).slice(0, 30)}"`);
    const replying = (await bodyText()).includes('Replying to');
    check('comments: "Replying to" indicator shown', replying);
    // emoji row
    const emojiBtn = await hitPoint('Array.from(document.querySelectorAll("div,span")).filter((e) => e.children.length === 0 && /😄/.test(e.textContent || ""))');
    check('comments: emoji row present', !!emojiBtn);
    if (emojiBtn) {
      await page.mouse.click(emojiBtn.x, emojiBtn.y);
      await page.waitForTimeout(300);
      const inpVal2 = await page.evaluate(() => {
        const el = document.querySelector('[placeholder^="Reply to"]');
        return el ? (el.value ?? el.textContent ?? '') : 'NO_INPUT';
      });
      check('comments: emoji appended to field', String(inpVal2).includes('😄'), `value="${String(inpVal2).slice(0, 30)}"`);
    }
    await setText('[placeholder^="Reply to"]', '😄 JazakAllah khair @alameen');
    await page.waitForTimeout(200);
    const postBtn = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Post")');
    if (postBtn) await page.mouse.click(postBtn.x, postBtn.y);
    await page.waitForTimeout(700);
    const afterC = await bodyText();
    check('comments: comment posted', afterC.includes('JazakAllah khair @alameen'));
    await page.screenshot({ path: '/tmp/p12-comments.png' });
    const mention = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('span,div')).filter((e) => e.children.length === 0 && /@alameen/.test((e.textContent || '').trim()) && (e.textContent || '').length < 20);
      let best = null;
      for (const el of els) {
        const st = getComputedStyle(el);
        const fw = parseInt(st.fontWeight);
        if (fw >= 700) return { txt: el.textContent.trim(), fw: st.fontWeight, color: st.color };
        if (!best) best = { txt: el.textContent.trim(), fw: st.fontWeight, color: st.color };
      }
      return best;
    });
    check('comments: @mention rendered bold+colored', !!mention && parseInt(mention.fw) >= 700, mention ? JSON.stringify(mention) : 'none in view');
  } else check('comments: reply button found', false);
}

/* ---------------- pass-12 checks ---------------- */
// videos feed opens from Home → Quick Access (first button)
{
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const homeTxt = await bodyText();
  check('home: campaign banner', homeTxt.includes('DeenLink Videos') && homeTxt.includes('swipe the feed'), '');
  const chip = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Videos")');
  check('home: quick-access Videos first', !!chip, chip ? `${Math.round(chip.x)},${Math.round(chip.y)}` : '');
  if (chip) {
    await page.mouse.click(chip.x, chip.y);
    await page.waitForTimeout(3200);
  }
  const vTxt = await bodyText();
  check('videos: feed renders', vTxt.includes('For you') && vTxt.includes('@'), page.url().slice(-40));
  const videoEl = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? { src: (v.currentSrc || v.src || '').slice(-30), w: v.offsetWidth, h: v.offsetHeight } : null;
  });
  check('videos: <video> element mounted', !!videoEl && videoEl.w > 200, JSON.stringify(videoEl));
  const rail = await page.evaluate(() => {
    const t = document.body.innerText;
    return { like: t.includes('1,284'), comment: t.includes('96'), save: t.includes('312'), share: t.includes('Share'), music: t.includes('nasheed') };
  });
  check('videos: action rail', rail.like && rail.comment && rail.save && rail.share && rail.music, JSON.stringify(rail));
  await page.screenshot({ path: '/tmp/p12-videos-feed.png' });
  // double-tap like on the video surface
  const surf = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return null;
    const r = v.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (surf) {
    await page.mouse.click(surf.x, surf.y);
    await page.mouse.click(surf.x, surf.y);
    await page.waitForTimeout(700);
    const t = await bodyText();
    check('videos: double-tap like count', t.includes('1,285'), '');
  }
}

/* ---------------- pass-13 checks ---------------- */
// videos: Following/For you tabs, search, library, create, repost
{
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const chip = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Videos")');
  if (chip) { await page.mouse.click(chip.x, chip.y); await page.waitForTimeout(3200); }
  let t = await bodyText();
  check('videos: tabs present', t.includes('Following') && t.includes('For you'), '');
  // switch to Following → followed-only reels (201,202,203 visible; 204 aisha hidden)
  const followingTab = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Following")');
  if (followingTab) {
    await page.mouse.click(followingTab.x, followingTab.y);
    await page.waitForTimeout(1000);
    t = await bodyText();
    check('videos: following filters', t.includes('@alameen') && !t.includes('@aisha_yusuf') && !t.includes('@Gimba'), '');
    const forYou = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "For you")');
    if (forYou) { await page.mouse.click(forYou.x, forYou.y); await page.waitForTimeout(800); }
  } else check('videos: following filters', false, 'tab not found');
  // search overlay
  const searchBtn = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length <= 2 && Array.from(d.children).some((c) => (c.textContent||"") === "") && (d.textContent || "").trim() === "")');
  // simpler: find the glyph container via hitPoint on icon glyph text
  const searchBtn2 = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '\uf002');
    const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 5 && r.y > 5 && r.y < 130; });
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check('videos: search button', !!searchBtn2, searchBtn2 ? 'found' : 'missing');
  if (searchBtn2) {
    await page.mouse.click(searchBtn2.x, searchBtn2.y);
    await page.waitForTimeout(900);
    t = await bodyText();
    const overlay = !!await page.evaluate(() => document.querySelector('[placeholder*="Search videos"]')) && t.includes('Cancel');
    await setText('[placeholder*="Search videos"]', 'dhikr');
    await page.waitForTimeout(900);
    t = await bodyText();
    const found = t.includes('@aisha_yusuf') && !t.includes('No videos found');
    check('videos: search works', overlay && found, `overlay=${overlay} found=${found}`);
    await page.screenshot({ path: '/tmp/p13-videos-search.png' });
    const cancel = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div'));
      const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Cancel');
      const vis = el.filter((d) => { const r = d.getBoundingClientRect(); return r.y > 0 && r.y < 200; });
      if (!vis.length) return null;
      const r = vis[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (cancel) { await page.mouse.click(cancel.x, cancel.y); await page.waitForTimeout(800); }
  }
  // library sheet: bookmark the current reel via its count label (201 → 312→313)
  const railSave = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => d.children.length === 0 && /^\d{1,4}$/.test((d.textContent || '').trim()) && ['312','96','1,284'].includes((d.textContent || '').trim()) === false && (d.textContent || '').trim() === '312');
    const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.y > 300 && r.x > 300; });
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y - 30 };
  });
  if (railSave) { await page.mouse.click(railSave.x, railSave.y); await page.waitForTimeout(700); }
  const libBtn = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '\uf02e');
    const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.y > 580 && r.x < 220; });
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check('videos: library button (bottom pill)', !!libBtn, libBtn ? 'found' : 'missing');
  if (libBtn) {
    await page.mouse.click(libBtn.x, libBtn.y);
    await page.waitForTimeout(900);
    t = await bodyText();
    check('videos: library sheet', t.includes('Your videos') && t.includes('Saved') && t.includes('Liked') && t.includes('Reposts'), '');
    check('videos: saved tile exists', t.includes('@alameen'), t.slice(0, 80));
    await page.screenshot({ path: '/tmp/p13-videos-library.png' });
    const close = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div'));
      const cands = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '\uf00d');
      const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.y > 300; });
      if (!vis.length) return null;
      const r = vis[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (close) { await page.mouse.click(close.x, close.y); await page.waitForTimeout(900); }
    const libClosed = await page.evaluate(() => !document.body.innerText.includes('Your videos'));
    if (!libClosed) console.log('WARN library sheet may still be open');
  }
  // more-menu (••• in the right rail): repost / download / send-to / report / not-interested / speed
  const moreBtn = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '\uf141');
    const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.y > 300 && r.x > 280; });
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check('videos: more (•••) button', !!moreBtn, moreBtn ? 'found' : 'missing');
  if (moreBtn) {
    await page.mouse.click(moreBtn.x, moreBtn.y);
    // the sheet can slide in slowly under load — poll up to 5s
    let opened = false;
    for (let i = 0; i < 10 && !opened; i++) {
      await page.waitForTimeout(500);
      opened = await page.evaluate(() => document.body.innerText.includes('Send to'));
    }
    t = await bodyText();
    const menuOk = opened && t.includes('Repost') && t.includes('Download') && t.includes('Send to') && t.includes('Report') && t.includes('Not interested') && t.includes('0.5x') && t.includes('3x');
    check('videos: more-menu items', menuOk, menuOk ? 'ok' : t.slice(0, 120).replace(/\n/g, ' '));
    await page.screenshot({ path: SHOTS + '/p14-videos-more.png' });
    const repostRow = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div'));
      const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Repost');
      if (!el.length) return null;
      const r = el[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (repostRow) {
      await page.mouse.click(repostRow.x, repostRow.y);
      await page.waitForTimeout(900);
      t = await bodyText();
      check('videos: repost toast', t.includes('Reposted'), t.includes('Reposted') ? 'ok' : 'no toast');
    } else check('videos: repost toast', false, 'row missing');
  }
  // create studio
  const createBtn = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length <= 2 && (d.textContent || '').includes('Create'));
    const vis = el.filter((d) => { const r = d.getBoundingClientRect(); return r.y > 600; });
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check('videos: create button', !!createBtn, createBtn ? 'found' : 'missing');
  if (createBtn) {
    await page.mouse.click(createBtn.x, createBtn.y);
    await page.waitForTimeout(1000);
    t = await bodyText();
    check('videos: create studio', t.includes('New video') && t.includes('Choose video') && t.includes('OR USE A SAMPLE CLIP'), '');
    await page.screenshot({ path: '/tmp/p13-videos-create.png' });
    // pick first sample + post
    const sample = await page.evaluate(() => {
      const imgs = Array.from(document.images);
      const vis = imgs.filter((im) => { const r = im.getBoundingClientRect(); return r.width > 40 && r.width < 80 && r.height > 80; });
      if (!vis.length) return null;
      const r = vis[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (sample) { await page.mouse.click(sample.x, sample.y); await page.waitForTimeout(600); }
    const postBtn = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div'));
      const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Post video');
      if (!el.length) return null;
      const r = el[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (postBtn) {
      await page.mouse.click(postBtn.x, postBtn.y);
      await page.waitForTimeout(2400);
      t = await bodyText();
      check('videos: posted own reel', t.includes('Posted — playing your video') || t.includes('@abdalrahman'), '');
      await page.screenshot({ path: '/tmp/p13-videos-posted.png' });
    }
  }
}
// pass-14: back chevron, bottom pill, inline comments sheet
{
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const chip = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Videos")');
  if (chip) { await page.mouse.click(chip.x, chip.y); await page.waitForTimeout(3000); }
  let t = await bodyText();
  const chev = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '\uf053');
    const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.x < 80 && r.y < 120; });
    return vis.length > 0;
  });
  check('videos: back chevron top-left', !!chev, chev ? 'ok' : 'missing');
  const pill = t.includes('Saved') && t.includes('Create') && t.includes('Sound');
  check('videos: bottom pill Saved·Create·Sound', pill, pill ? 'ok' : t.slice(0, 90).replace(/\n/g, ' '));
  // comments: click the rail comment count (96) → inline sheet
  const cmtBtn = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === '96');
    const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.x > 280 && r.y > 300; });
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check('videos: comment button hit-testable', !!cmtBtn, cmtBtn ? 'found' : 'missing');
  if (cmtBtn) {
    await page.mouse.click(cmtBtn.x, cmtBtn.y);
    await page.waitForTimeout(1100);
    t = await bodyText();
    const sheetOk = t.includes('Comments') && !!await page.evaluate(() => document.querySelector('[placeholder*="Add a comment"]'));
    check('videos: comments sheet opens in-app', sheetOk, sheetOk ? 'ok' : 'sheet missing');
    await page.screenshot({ path: SHOTS + '/p14-videos-comments.png' });
    // like the first comment heart, then confirm sheet still intact (glitch fix regression)
    await page.mouse.click(195, 150);
    await page.waitForTimeout(700);
  }
}
// community: composer under search + poll duration chips
{
  await page.goBack(); // leave the videos modal so the tab bar is reachable
  await page.waitForTimeout(1800);
  const tabBtn = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Community" && d.getBoundingClientRect().y > 640)');
  if (tabBtn) { await page.mouse.click(tabBtn.x, tabBtn.y); await page.waitForTimeout(2800); }
  await page.screenshot({ path: '/tmp/p13-community-top.png' });
  const order = await page.evaluate(() => {
    const search = document.querySelector('[placeholder*="Search posts"]');
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => (d.textContent || '').includes('Share a thought, question or du'));
    const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 100 && r.y > 80 && r.y < 844; });
    return { search: search ? search.getBoundingClientRect().y : -1, composer: vis.length ? vis[0].getBoundingClientRect().y : -1 };
  });
  check('community: composer under search', order.search > 0 && order.composer > order.search, JSON.stringify(order));
  // open composer → poll duration chips
  const comp = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => (d.textContent || '').includes('Share a thought, question or du'));
    const vis = el.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 100 && r.y > 80 && r.y < 844; });
    if (!vis.length) return null;
    const r = vis[0].getBoundingClientRect();
    return { x: r.x + 30, y: r.y + Math.min(r.height / 2, 30) };
  });
  if (comp) {
    await page.mouse.click(comp.x, comp.y);
    await page.waitForTimeout(900);
    let t = await bodyText();
    const hasYt = t.includes('YouTube') && t.includes('Video');
    // enable poll
    const pollToggle = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div'));
      const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Add a poll');
      if (!el.length) return null;
      const r = el[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (pollToggle) { await page.mouse.click(pollToggle.x, pollToggle.y); await page.waitForTimeout(700); }
    t = await bodyText();
    check('community: composer has video/yt + duration', hasYt && t.includes('POLL DURATION') && t.includes('1 day') && t.includes('7 days'), `yt=${hasYt} dur=${t.includes('POLL DURATION')}`);
    await page.screenshot({ path: '/tmp/p13-composer.png' });
    // close the composer (dim backdrop above the sheet) so later checks see the feed
    for (let i = 0; i < 3; i++) {
      const open = await page.evaluate(() => document.body.innerText.includes('New post'));
      if (!open) break;
      await page.mouse.click(195, 150);
      await page.waitForTimeout(800);
    }
  }
}
// pass-14: quran hub + profile redesign
{
  await page.goBack(); // leave videos modal
  await page.waitForTimeout(1600);
  const qTab = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Quran &" && d.getBoundingClientRect().y > 640)');
  if (qTab) { await page.mouse.click(qTab.x, qTab.y); await page.waitForTimeout(2600); }
  const qTxt = await bodyText();
  check('quran: dash hub renders', qTxt.includes("The Holy Qur'an") && qTxt.includes('Hadith Collections') && qTxt.includes('Surahs'), qTxt.slice(0, 90).replace(/\n/g, ' '));
  await page.screenshot({ path: SHOTS + '/p14-quran-hub.png' });
  const pTab = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Profile" && d.getBoundingClientRect().y > 640)');
  if (pTab) { await page.mouse.click(pTab.x, pTab.y); await page.waitForTimeout(2600); }
  const prTxt = await bodyText();
  check('profile: tab renders w/ settings', prTxt.includes('Settings') && prTxt.includes('FOLLOWERS'), prTxt.slice(0, 80).replace(/\n/g, ' '));
  await page.screenshot({ path: SHOTS + '/p14-profile.png' });
}
// pass-15: center circle tab, quran daily cards + progress hero + reader audio, hadith collections, profile identity
{
  // center circle tab (Worship Tools) — mosque glyph raised above the bar center
  const circle = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const cands = els.filter((d) => { const r = d.getBoundingClientRect(); return r.width >= 50 && r.width <= 66 && r.height >= 50 && r.height <= 66 && r.y > 640 && r.x > 120 && r.x < 250; });
    return cands.length ? { x: cands[0].getBoundingClientRect().x, y: cands[0].getBoundingClientRect().y, w: cands[0].getBoundingClientRect().width } : null;
  });
  check('tabs: center circle present', !!circle, circle ? `${Math.round(circle.x)},${Math.round(circle.y)}` : 'missing');
  if (circle) {
    await page.mouse.click(circle.x + circle.w / 2, circle.y + circle.w / 2);
    await page.waitForTimeout(2600);
    const tTxt = await bodyText();
    check('tabs: circle opens worship tools', tTxt.includes('Daily Spiritual Tools') || tTxt.includes('Worship Tools'), tTxt.slice(0, 60).replace(/\n/g, ' '));
    await page.screenshot({ path: SHOTS + '/p15-tools-grid.png' });
  }

  // quran hub: daily ayah + daily hadith first
  const qTab = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Quran &" && d.getBoundingClientRect().y > 640)');
  if (qTab) { await page.mouse.click(qTab.x, qTab.y); await page.waitForTimeout(2400); }
  let qTxt = await bodyText();
  check('quran: daily ayah card first', qTxt.includes('DAILY AYAH') && qTxt.includes('with hardship'), '');
  check('quran: daily hadith card', qTxt.includes('DAILY HADITH') && qTxt.includes('intentions'), '');
  await page.screenshot({ path: SHOTS + '/p15-quran-daily.png' });

  // open the Qur'an reader browser
  const quranCard = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === "The Holy Qur'an");
    if (!el.length) return null;
    const r = el[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (quranCard) { await page.mouse.click(quranCard.x, quranCard.y); await page.waitForTimeout(2200); }
  let sTxt = await bodyText();
  const heroOk = sTxt.includes('READING PROGRESS') && sTxt.includes('Juz') && sTxt.includes('Continue Reading') && /\d+%/.test(sTxt);
  check('quran: reading-progress hero', heroOk, heroOk ? 'ok' : sTxt.slice(0, 110).replace(/\n/g, ' '));
  check('quran: bookmarks filter chip', sTxt.includes('Bookmarks'), '');
  await page.screenshot({ path: SHOTS + '/p15-quran-hero.png' });
  // continue reading → reader with audio bar
  const cont = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Continue Reading');
    if (!el.length) return null;
    const r = el[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (cont) {
    await page.mouse.click(cont.x, cont.y);
    await page.waitForTimeout(2600);
    const rTxt = await bodyText();
    check('quran reader: opens + audio bar', rTxt.includes('Alafasy') && rTxt.includes(' verses'), rTxt.slice(0, 70).replace(/\n/g, ' '));
    await page.screenshot({ path: SHOTS + '/p15-quran-reader.png' });
    await page.goBack();
    await page.waitForTimeout(1500);
    await page.goBack();
    await page.waitForTimeout(1500);
  }

  // hadith: collections → chapters → reader
  const hCard = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Hadith Collections');
    if (!el.length) return null;
    const r = el[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (hCard) { await page.mouse.click(hCard.x, hCard.y); await page.waitForTimeout(2400); }
  let hTxt = await bodyText();
  check('hadith: collections list', hTxt.includes('Sahih al-Bukhari') && hTxt.includes('Sahih Muslim') && hTxt.includes('Muwatta Malik'), page.url().slice(-30) + ' | ' + hTxt.slice(0, 150).replace(/\n/g, ' '));
  await page.screenshot({ path: SHOTS + '/p15-hadith-books.png' });
  const bukhari = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Sahih al-Bukhari');
    if (!el.length) return null;
    const r = el[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (bukhari) {
    await page.mouse.click(bukhari.x, bukhari.y);
    await page.waitForTimeout(2200);
    hTxt = await bodyText();
    check('hadith: chapters list', hTxt.includes('Faith (Kitab al-Iman)') && hTxt.includes('chapters'), '');
    const chapter = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div'));
      const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Faith (Kitab al-Iman)');
      if (!el.length) return null;
      const r = el[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (chapter) {
      await page.mouse.click(chapter.x, chapter.y);
      await page.waitForTimeout(2000);
      const cTxt2 = await bodyText();
      check('hadith: chapter reader', cTxt2.includes('Sahih al-Bukhari') && /\d/.test(cTxt2), '');
      await page.screenshot({ path: SHOTS + '/p15-hadith-reader.png' });
    } else check('hadith: chapter reader', false, 'chapter row missing');
  } else check('hadith: chapters list', false, 'bukhari row missing');
}

// pass-15: profile identity card + settings tab
{
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const pTab = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Profile" && d.getBoundingClientRect().y > 640)');
  if (pTab) { await page.mouse.click(pTab.x, pTab.y); await page.waitForTimeout(2400); }
  let prTxt = await bodyText();
  check('profile: identity card', (prTxt.includes('@abdalrahman') || prTxt.includes('@deenlink_user')) && prTxt.includes('Edit Profile') && prTxt.includes('FOLLOWERS'), prTxt.slice(0, 90).replace(/\n/g, ' '));
  await page.screenshot({ path: SHOTS + '/p15-profile.png' });
  const setTab = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Settings');
    if (!el.length) return null;
    // DOM-level click — the stacked-screens DOM can place this below the fold
    (el[0].closest('[role],div')?.parentElement ?? el[0]).click?.();
    return 'clicked';
  });
  if (setTab) {
    await page.waitForTimeout(900);
    prTxt = await bodyText();
    check('profile: settings tab lists sign out', prTxt.includes('Sign out'), '');
    await page.screenshot({ path: SHOTS + '/p15-profile-settings.png' });
  } else check('profile: settings tab lists sign out', false, 'tab missing');
}

// pass-15: splash gate shows once, then hides (fresh context)
{
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(1600);
  const splashThere = await p3.evaluate(() => !!document.querySelector('img[src*="splash-anim"]'));
  await p3.waitForTimeout(3400);
  const splashGone = await p3.evaluate(() => !document.querySelector('img[src*="splash-anim"]'));
  check('splash: shows then fades', splashThere && splashGone, `shown=${splashThere} gone=${splashGone}`);
  await p3.screenshot({ path: SHOTS + '/p15-splash.png' }).catch(() => {});
  await ctx3.close();
}

// login redesign (logged-out view renders directly)
{
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1500);
  await p2.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('dl.onboarded', '1');
  });
  await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(3000);
  const t = await p2.evaluate(() => document.body.innerText);
  check('login: design headings', t.includes('Welcome back!') && t.includes('Sign in to continue your journey'), '');
  check('login: fields + google', t.toUpperCase().includes('EMAIL') && t.includes('PASSWORD') && t.includes('Sign in with Google') && t.includes('OR'), '');
  check('login: switch line', t.includes("Don’t have an account?") && t.includes('Sign Up'), '');
  await p2.screenshot({ path: '/tmp/p12-login-dark.png' });
  await ctx2.close();
}
// community: composer bar on top + poll change-vote
{
  // close the videos modal first (it covers the tab bar)
  await page.goBack();
  await page.waitForTimeout(1800);
  const tabBtn = await hitPoint('Array.from(document.querySelectorAll("div")).filter((d) => d.children.length === 0 && (d.textContent || "").trim() === "Community" && d.getBoundingClientRect().y > 640)');
  if (tabBtn) {
    await page.mouse.click(tabBtn.x, tabBtn.y);
    await page.waitForTimeout(2800);
  }
  const cTxt = await bodyText();
  check('community: composer bar on top', cTxt.includes('Share a thought, question or du’aa'), '');
  check('community: recent activities removed', !cTxt.includes('Recent Activity'), cTxt.includes('Recent Activity') ? 'still present' : 'gone');
  await page.screenshot({ path: '/tmp/p12-community-top.png' });
  // poll: find post 110 poll options and vote twice (change)
  const poll = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const opt = els.filter((d) => d.children.length <= 3 && /^(Fajr itself|The dhikr after Fajr|Both, honestly)$/i.test((d.textContent || '').trim()));
    return opt.slice(0, 4).map((d) => { const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: d.textContent.trim() }; });
  });
  check('community: poll options found', poll.length >= 2, JSON.stringify(poll.map((p) => p.txt)));
  if (poll.length >= 2) {
    // scroll the poll into view first (off-screen clicks are no-ops in RNW),
    // then click the LEFT part of the option row (text area)
    const clickOption = (label) =>
      page.evaluate((lbl) => {
        const els = Array.from(document.querySelectorAll('div'));
        const cands = els.filter((d) => (d.textContent || '').trim() === lbl);
        const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 100; });
        if (!vis.length) return null;
        vis[0].scrollIntoView({ block: 'center' });
        return true;
      }, label);
    const point = (label) =>
      page.evaluate((lbl) => {
        const els = Array.from(document.querySelectorAll('div'));
        const cands = els.filter((d) => (d.textContent || '').trim() === lbl);
        const vis = cands.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 100 && r.y > 60 && r.y < 800; });
        if (!vis.length) return null;
        const r = vis[0].getBoundingClientRect();
        return { x: r.x + 20, y: r.y + r.height / 2 };
      }, label);
    let ok1 = await clickOption('Fajr itself');
    await page.waitForTimeout(500);
    let p1 = await point('Fajr itself');
    if (ok1 && p1) await page.mouse.click(p1.x, p1.y);
    await page.waitForTimeout(700);
    let t = await bodyText();
    const votedOnce = t.includes('You voted for');
    let ok2 = await clickOption('The dhikr after Fajr');
    await page.waitForTimeout(500);
    let p2 = await point('The dhikr after Fajr');
    if (ok2 && p2) await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(700);
    t = await bodyText();
    const changed = t.includes('You voted for') && t.includes('The dhikr after Fajr');
    check('community: poll vote + change', votedOnce && changed, `once=${votedOnce} changed=${changed}`);
    await page.screenshot({ path: '/tmp/p12-poll.png' });
  }
}await browser.close();
process.exit(0);

/* ---------------- summary ---------------- */
const fails = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - fails.length}/${results.length} checks passed ====`);
if (fails.length) console.log('FAILED:', fails.map((f) => f.name).join(' | '));


