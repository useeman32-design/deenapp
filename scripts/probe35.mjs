/* probe35 — pass-34 features */
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const results = [];
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const go = async (path, ms = 3000) => { await page.goto(`http://localhost:3996/deenapp${path}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(ms); };
const ensureAuth = async () => {
  for (let i = 0; i < 14; i++) {
    const t = await page.evaluate(() => document.body.innerText);
    if (t.includes('Welcome back!')) {
      const b = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === 'Sign In'); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 16 }; });
      if (b) await page.touchscreen.tap(b.x, b.y).catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    if (/\bOF 4\b|\bOF 3\b|Skip|Get Started/i.test(t)) {
      const nb = await page.evaluate(() => {
        const labels = ['Get Started', 'Next', 'Skip'];
        for (const L of labels) {
          const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === L);
          const el = els[els.length - 1];
          if (el) { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 820) }; }
        }
        return null;
      });
      if (!nb) break;
      await page.touchscreen.tap(nb.x, nb.y).catch(() => {});
      await page.waitForTimeout(1100);
      continue;
    }
    break;
  }
};
const tap = async (label) => page.evaluate((l) => { const el = document.querySelector(`[aria-label="${l}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 830) }; }, label);

/* 1. catch-all: garbage route lands home (no Unmatched Route) */
await go('/tools/definitely-not-a-route', 8000);
{
  const t = await page.evaluate(() => document.body.innerText);
  ok('unmatched: bad route redirects home, never shows "Unmatched Route"', !/unmatched route/i.test(t) && t.length > 100, t.length + ' chars');
}

/* 2. learning still opens */
await go('/tools/learning', 7000);
{
  const t = await page.evaluate(() => document.body.innerText);
  ok('learning: hub opens (LEARNING HUB)', /LEARNING HUB/i.test(t));
}

/* 3. groups rail on community (tab bar from home) */
await go('/', 5000);
await ensureAuth();
{
  const tab = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim().match(/^Community$/i)); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 835) }; });
  if (tab) { await page.touchscreen.tap(tab.x, tab.y); await page.waitForTimeout(4500); }
}
{
  const t = await page.evaluate(() => document.body.innerText);
  ok('groups: rail on community tab', /GROUPS/i.test(t) && /\+ Create/.test(t), (t.match(/GROUPS/) || [''])[0]);
  const g = await tap('group Abuja Jumu\'ah Circle');
  if (g) {
    await page.touchscreen.tap(g.x, g.y);
    await page.waitForTimeout(1500);
    const t2 = await page.evaluate(() => document.body.innerText);
    ok('groups: group page opens with members + join', /members/i.test(t2) && /(Join group|Request to join|Leave group)/.test(t2));
  } else ok('groups: group page opens', false, 'rail card not found');
}

/* 4. donations: menu → form → receipt simulation */
await go('/tools/charity', 6500);
{
  let t = await page.evaluate(() => document.body.innerText);
  /* pass 40 — Support DeenLink card is BACK (user order; only the inner
   * purpose selector stays removed): Support DeenLink → Zakat → Sadaqah */
  ok('donations: 3 categories + history (Support DeenLink first, no purpose selector)', /Support DeenLink/i.test(t) && /Sadaqah/i.test(t) && /Zakat/i.test(t) && /History/i.test(t) && t.indexOf('Support DeenLink') < t.indexOf('Zakat') && !/SELECT ALL THAT APPLY/i.test(t.split('History')[0]));
  ok('donations: hero ayah + hadith (rearranged + icon)', /Quran 2:261/.test(t) && /Muslim 1631/.test(t) && /Give for the sake of Allah/i.test(t));
  const b = await tap('donate Zakat');
  if (b) {
    await page.touchscreen.tap(b.x, b.y);
    await page.waitForTimeout(1200);
    const rcp = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'The poor (fuqara)'); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 830) }; });
    if (rcp) await page.touchscreen.tap(rcp.x, rcp.y);
    await page.waitForTimeout(500);
    const amt = await page.evaluate(() => { const el = [...document.querySelectorAll('input')].find((e) => e.getBoundingClientRect().width > 80 && e.getBoundingClientRect().y > 300); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (amt) { await page.touchscreen.tap(amt.x, amt.y); await page.keyboard.type('5000', { delay: 20 }); }
    await page.waitForTimeout(800);
    t = await page.evaluate(() => document.body.innerText);
    ok('donations: form shows multi-select recipients + currency + fee', /GIVEN TO[\s\S]*SELECT ALL THAT APPLY/i.test(t) && /CURRENCY/i.test(t) && /processing \(5%\)/i.test(t) && /Pay NGN 5,000/.test(t), (t.match(/Pay [A-Z]{3} [\d,]+/) || [''])[0]);
  }
}

/* 5. scholars: pass 41 SELECTION screen first, then browse + ask sheet */
await go('/tools/scholars', 6500);
{
  let t = await page.evaluate(() => document.body.innerText);
  ok('scholars: selection screen (3 choices)', /Ask Scholars/i.test(t) && /Browse scholars/i.test(t) && /Public questions/i.test(t) && /My questions/i.test(t));
  const card = await tap('browse scholars');
  if (card) {
    await page.touchscreen.tap(card.x, card.y);
    await page.waitForTimeout(1400);
    t = await page.evaluate(() => document.body.innerText);
    ok('scholars: browse list + back-to-choices', /BROWSE SCHOLARS/i.test(t) && /Choices/i.test(t) && /DeenPoints do not buy fatwas/i.test(t) && /fairness, respect/i.test(t));
    const a = await tap('ask Sheikh Abdurrahman Al-Ameen');
    if (a) {
      await page.touchscreen.tap(a.x, a.y);
      await page.waitForTimeout(1200);
      t = await page.evaluate(() => document.body.innerText);
      ok('scholars: ask sheet (title/question/category/urgency/public/points)', /DeenPoints/i.test(t) && /URGENCY/i.test(t) && /(Public|Private) question/i.test(t) && /CATEGORY/i.test(t));
    }
  }
}

/* 6. quran shazam button (direct route + auth) */
await go('/quran', 6000);
await ensureAuth();
await page.waitForTimeout(4500);
{
  const t = await page.evaluate(() => document.body.innerText);
  ok('quran: Shazam card on the hub', /Quran Shazam/i.test(t));
}

/* 7. hadith: header language button + chapter names + bigger arabic (deep chapter) */
await go('/tools/hadith/buhari?h=9', 8000);
{
  const t = await page.evaluate(() => document.body.innerText);
  ok('hadith: header translation button present', /TRANSLATION|EN\b/.test(t));
  const langBtn = await tap('translation language');
  ok('hadith: language button in header (aria)', langBtn != null);
  if (langBtn) {
    await page.touchscreen.tap(langBtn.x, langBtn.y);
    await page.waitForTimeout(6000);
    const t2 = await page.evaluate(() => document.body.innerText);
    ok('hadith: FR translation loads from header button', /Rapporté|récompense|Le Prophète/.test(t2));
  }
}

/* 8. reciters present in the bundle */
{
  const inBundle = await page.evaluate(async () => {
    const r = await fetch(location.pathname.replace(/^(\/deenapp\b).*$/, '$1') + '_expo/static/js/web/' + (performance.getEntriesByType('resource').map((e) => e.name.split('/').pop()).find((n) => /^entry-/.test(n)) ?? ''));
    const j = await r.text();
    return ['As-Sudais', 'Ash-Shuraim', 'Muhammad Ayyub', 'Maher Al Muaiqly'].map((n) => j.includes(n));
  });
  ok('reciters: Sudais + Shuraim + Ayyub + Maher in the bundle', inBundle.every(Boolean), inBundle.join(','));
}

/* 9. onboarding: pro theme slide (phone previews) — fresh context */
{
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await fresh.newPage();
  await p2.goto('http://localhost:3996/deenapp/', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(7500);
  for (let i = 0; i < 3; i++) {
    const t = await p2.evaluate(() => document.body.innerText);
    if (/Choose your/i.test(t)) break;
    const nb = await p2.evaluate(() => { const els = [...document.querySelectorAll('div,span,button')].filter((e) => (e.textContent || '').trim() === 'Next'); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (nb) { await p2.touchscreen.tap(nb.x, nb.y); await p2.waitForTimeout(900); }
  }
  const t = await p2.evaluate(() => document.body.innerText);
  ok('onboarding: theme slide has phone-preview labels', /Choose your/i.test(t) && /\bDark\b/.test(t) && /\bLight\b/.test(t) && /Match my phone/i.test(t));
  await fresh.close();
}

/* 10. pass 41 — signup rebuild + gold nisab + back buttons + AI header */
{
  /* signup: choose screen → user form → Nigeria tribe chips */
  await go('/register', 6000);
  let t = await page.evaluate(() => document.body.innerText);
  ok('signup: choose screen (user + scholar cards)', /Join DeenLink/i.test(t) && /User account/i.test(t) && /Scholar account/i.test(t));
  let el = await tap('continue as user');
  if (el) {
    await page.touchscreen.tap(el.x, el.y);
    await page.waitForTimeout(1200);
    t = await page.evaluate(() => document.body.innerText);
    ok('signup: user form fields + password checks', /FULL NAME/i.test(t) && /EMAIL/i.test(t) && /USERNAME/i.test(t) && /GENDER/i.test(t) && /AQEEDAH/i.test(t) && /At least 6 characters/i.test(t) && /Contains a number/i.test(t));
    ok('signup: aqeedah descriptions + Izala/Salafiyya note is conditional', /righteous predecessors/i.test(t) && !/Izala and Salafiyya/i.test(t));
    /* pick Nigeria → tribe chips appear */
    const cp = await tap('country picker');
    if (cp) {
      await page.touchscreen.tap(cp.x, cp.y);
      await page.waitForTimeout(900);
      const ng = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span')].filter((e) => (e.textContent || '').trim() === 'Nigeria'); const r = els[els.length - 1]?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
      if (ng) { await page.touchscreen.tap(ng.x, ng.y); await page.waitForTimeout(900); }
      t = await page.evaluate(() => document.body.innerText);
      ok('signup: Nigeria → tribe chips + Izala/Salafiyya under Sunni', /Hausa/i.test(t) && /Igbo/i.test(t) && /Yoruba/i.test(t) && /General/i.test(t) && /Izala and Salafiyya fall under Sunni/i.test(t));
    }
  }
  /* scholar wizard */
  await go('/register', 900);
  t = await page.evaluate(() => document.body.innerText);
  const sc = await tap('continue as scholar');
  if (sc) {
    await page.touchscreen.tap(sc.x, sc.y);
    await page.waitForTimeout(1200);
    t = await page.evaluate(() => document.body.innerText);
    ok('signup: scholar step 1 (basic + steps header)', /BASIC/i.test(t) && /QUALIFICATIONS/i.test(t) && /VERIFICATION/i.test(t) && /Display name/i.test(t) && /Phone/i.test(t));
  }
  /* gmail complete-your-info */
  await go('/register', 900);
  t = await page.evaluate(() => document.body.innerText);
  const gb = await page.evaluate(() => { const els = [...document.querySelectorAll('div,span,button')].filter((e) => /Continue with Google|Google/i.test((e.textContent || '').trim()) && e.getBoundingClientRect().height > 0); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 830) }; });
  if (gb) {
    await page.touchscreen.tap(gb.x, gb.y);
    await page.waitForTimeout(1400);
    t = await page.evaluate(() => document.body.innerText);
    ok('signup: Gmail → complete-your-info (no password fields)', /Complete your info/i.test(t) && /USERNAME/i.test(t) && !/CONFIRM PASSWORD/i.test(t));
  }

  /* zakat: GOLD is the standard now */
  await go('/tools/zakat', 6000);
  t = await page.evaluate(() => document.body.innerText);
  ok('zakat: gold standard is the default', /GOLD/i.test(t) && /gold standard is the DeenLink default/i.test(t));

  /* prayer + qibla: back buttons */
  await go('/tools/prayer', 6000);
  {
    const hasBack = await page.evaluate(() => !!document.querySelector('[aria-label="back"]'));
    t = await page.evaluate(() => document.body.innerText);
    ok('prayer: back button + adhan style entry', hasBack && /Preview the adhan alert/i.test(t));
  }
  await go('/tools/qibla', 6000);
  {
    const hasBack = await page.evaluate(() => !!document.querySelector('[aria-label="back"]'));
    ok('qibla: back button present', hasBack);
  }

  /* AI: no provider pill in header, capability words instead of model names */
  await go('/tools/ai', 6000);
  t = await page.evaluate(() => document.body.innerText);
  ok('ai: header has no provider pill, models never named', /DeenLink AI/i.test(t) && !/GROQ\b/i.test(t) && !/gpt-oss/i.test(t) && !/Grok/i.test(t));
}

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
