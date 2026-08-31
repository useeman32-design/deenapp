/* probe33 — pass-33 feature verification against dist on :3996 */
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const results = [];
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const go = async (path, ms = 2600) => { await page.goto(`http://localhost:3996/deenapp${path}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(ms); };
const bodyText = () => page.evaluate(() => document.body.innerText);

/* 1. hadith canonical numbers + no "unknown" */
await go('/tools/hadith/buhari?h=9', 7000);
{
  const t = await bodyText();
  ok('hadith: canonical number renders (Hadith 9 = Faith >60 branches)', /Hadith 9\b/.test(t), t.match(/Hadith \d+/)?.[0]);
  ok('hadith: "unknown" grade labels are gone', !/unknown/i.test(t));
  ok('hadith: gzipped corpus loads (real text present)', /Narrated/.test(t) || t.includes('Allah'));
}

/* 2. AI greeting is instant */
{
  const t0 = Date.now();
  await go('/tools/ai', 6000);
  const box = await page.evaluate(() => { const el = [...document.querySelectorAll('textarea,input')].find((e) => e.getBoundingClientRect().height > 15); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (box) {
    await page.touchscreen.tap(box.x, box.y);
    await page.waitForTimeout(300);
    await page.keyboard.type('hello', { delay: 20 });
    await page.waitForTimeout(250);
    const send = await page.evaluate(() => { const els = [...document.querySelectorAll('div')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.width < 70 && r.height > 20 && r.height < 70 && r.y > 700 && r.x > 300; }); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (send) await page.touchscreen.tap(send.x, send.y);
    await page.waitForTimeout(4500);
    const t = await bodyText();
    const dt = Date.now() - t0;
    ok('AI: greeting answers instantly (no corpus load)', /alaikum/i.test(t) && t.includes('DeenLink'), `${((dt) / 1000).toFixed(1)}s`);
  } else ok('AI: greeting answers instantly', false, 'no input found');
}

/* 3. prayer timeline + current prayer + adhan picker */
await go('/tools/prayer', 9000);
{
  const t = await bodyText();
  ok('prayer: timeline chips (NOW and/or NEXT)', /\bNOW\b/.test(t) && /\bNEXT\b/.test(t));
  ok('prayer: arabic names on the timeline', /الفجر|العشاء/.test(t));
  const gear = await page.evaluate(() => { const el = [...document.querySelectorAll('div[role="button"],div')].find((e) => (e.getAttribute('aria-label') || '') === 'Settings'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (gear) {
    await page.touchscreen.tap(gear.x, gear.y);
    await page.waitForTimeout(900);
    const st = await bodyText();
    const hasToggle = /Adhan reminder/i.test(st);
    ok('prayer: adhan reminder setting', hasToggle);
    if (hasToggle) {
      /* the toggle row sits deep in the sheet — scroll the modal, then tap it */
      await page.evaluate(() => { const sc = [...document.querySelectorAll('div')].find((e) => { const cs = getComputedStyle(e); return (cs.overflowY === 'scroll' || cs.overflowY === 'auto') && e.scrollHeight > e.clientHeight + 300 && e.getBoundingClientRect().height > 300; }); if (sc) sc.scrollTop = 600; });
      await page.waitForTimeout(400);
      const row = await page.evaluate(() => { const els = [...document.querySelectorAll('div')].filter((e) => { const r = e.getBoundingClientRect(); return /Adhan reminder/i.test(e.textContent || '') && r.height > 30 && r.height < 90 && r.top > 0 && r.top < 800; }); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width - 26, y: r.y + r.height / 2 }; });
      if (row) { await page.touchscreen.tap(row.x, row.y); await page.waitForTimeout(800); }
      const st2 = await bodyText();
      ok('prayer: adhan RECITATION picker appears', /ADHAN RECITATION/i.test(st2) && /Adhan 1/.test(st2));
    }
  } else ok('prayer: settings gear', false, 'not found');
}

/* 4. qibla: leaflet webview + offline map + center needles */
await go('/tools/qibla', 8000);
{
  const t = await bodyText();
  const leaf = await page.evaluate(() => { const c = [...document.querySelectorAll('.leaflet-container')]; return c.length > 0; });
  ok('qibla: leaflet map mounted', leaf);
  ok('qibla: offline world map still shown', /Offline world view/.test(t));
  const needles = await page.evaluate(() => { const svgs = [...document.querySelectorAll('svg')]; return svgs.some((s) => { const l = s.querySelectorAll('line').length; const p = s.querySelectorAll('polygon').length; return l >= 2 && p >= 2; }); });
  ok('qibla: front+back needles from the center', needles);
}

/* 5. onboarding theme slide */
await go('/', 7500);
{
  const t = await bodyText();
  const themeBtn = await page.evaluate(() => !!document.querySelector('[aria-label="theme Dark"]'));
  ok('onboarding: theme selection slide (4th)', /Choose your/i.test(t) && themeBtn);
  if (themeBtn) {
    /* slide 4 is off-screen — walk the Next button first */
    for (let k = 0; k < 3; k++) {
      const nb = await page.evaluate(() => { const els = [...document.querySelectorAll('div')].filter((e) => (e.textContent || '').trim() === 'Next' && e.getBoundingClientRect().width > 60 && e.getBoundingClientRect().y < 840 && e.getBoundingClientRect().y > 500); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      if (nb) { await page.touchscreen.tap(nb.x, nb.y); await page.waitForTimeout(900); }
    }
    await page.waitForTimeout(600);
    const b = await page.evaluate(() => { const el = document.querySelector('[aria-label="theme Dark"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.touchscreen.tap(b.x, b.y);
    await page.waitForTimeout(700);
    const col = await page.evaluate(() => { const el = [...document.querySelectorAll('div')].filter((e) => (e.textContent || '').includes('Strengthen')).sort((a, b) => b.scrollHeight - a.scrollHeight); const deep = el[el.length - 1]; return deep ? getComputedStyle(deep).color : ''; });
    const m = col.match(/rgb\((\d+), ?(\d+), ?(\d+)/);
    const isLightText = m && Number(m[1]) > 180 && Number(m[2]) > 180;
    ok('onboarding: picking Dark switches theme live', !!isLightText, col);
  }
}

/* 6. tasbeeh renders with the retraced glow */
await go('/tools/tasbeeh', 5000);
{
  const t = await bodyText();
  ok('tasbeeh: screen renders (misbaha glow path active)', t.length > 200 && /SUBHANALLAH|ALHAMDULILLAH|ALLAHU AKBAR|dhikr|TASBEEH/i.test(t));
}

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
