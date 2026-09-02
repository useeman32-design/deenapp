/* probe42 — pass-42 features */
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
const text = () => page.evaluate(() => document.body.innerText);
const tapText = async (re) => {
  const p = await page.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const els = [...document.querySelectorAll('div,span,button')].filter((e) => rx.test((e.textContent || '').trim()) && (e.textContent || '').trim().length < 80);
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 830) };
  }, re);
  if (p) await page.touchscreen.tap(p.x, p.y).catch(() => {});
  return !!p;
};

/* 1. tafsir tool */
await go('/tools/tafsir', 6500);
{
  const t = await text();
  ok('tafsir: screen opens with book selector', /TAFSIR|Tafsir/i.test(t) && /Ibn Kathir|Maarif|Tazkirul/i.test(t));
}

/* 2. zikr challenge */
await go('/tools/zikr-challenge', 5500);
{
  const t = await text();
  ok('zikr: 3 challenges listed', /Tasbeeh/i.test(t) && /Istighfar|Istighfār/i.test(t) && /Salawat|Salawāt/i.test(t));
}

/* 3. short lessons */
await go('/tools/lessons', 5500);
{
  const t = await text();
  const hasSearch = await page.evaluate(() => !!document.querySelector('input[placeholder*="earch"], [aria-label*="earch"], input'));
  ok('lessons: searchable lesson library', /Short Lessons/i.test(t) && t.includes('key points') && hasSearch, `search=${hasSearch}`);
}

/* 4. learning hub rework */
await go('/tools/learning', 5500);
{
  const t = await text();
  ok('learning: hub has zikr/tafsir/lessons rows, no Ask a Scholar', /Daily Zikr Challenge/i.test(t) && /Tafsir Library/i.test(t) && /Short Lessons/i.test(t) && !/Ask a Scholar/i.test(t));
}

/* 5. courses quiz */
await go('/tools/courses', 5500);
{
  const opened = await tapText('Tajwid Essentials');
  await page.waitForTimeout(1800);
  const t = await text();
  ok('courses: quiz launcher in course player', opened && /Course quiz/i.test(t) && /question/i.test(t), opened ? '' : 'course card not found');
  if (/Course quiz/i.test(t)) {
    await tapText('Course quiz');
    await page.waitForTimeout(1500);
    const q = await text();
    ok('courses: quiz starts with Q1 + options', /Quiz · Q1 of 5/i.test(q) && /CHOOSE ONE/i.test(q));
  }
}

/* 6. tasbeeh drawn misbaha */
await go('/tools/tasbeeh', 5500);
{
  const circles = await page.evaluate(() => document.querySelectorAll('svg circle').length);
  ok('tasbeeh: drawn misbaha (33 SVG beads + highlights)', circles >= 33, circles + ' circles');
}

/* 7. home Today's Goal modal */
await go('/', 5000);
await ensureAuth();
{
  const goal = await page.evaluate(() => { const el = document.querySelector('[aria-label="today-goal"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (goal) await page.touchscreen.tap(goal.x, goal.y).catch(() => {});
  await page.waitForTimeout(1600);
  const t = await text();
  ok('home: Today’s Goal modal opens with checklist', /resets tomorrow/i.test(t) && /Read a surah/i.test(t) && /Dhikr/i.test(t), goal ? '' : 'goal card not found');
}

/* 8. scholars public Q&A identities */
await go('/tools/scholars', 5500);
{
  const opened = await tapText('Public questions');
  await page.waitForTimeout(2000);
  const t = await text();
  ok('scholars: public Q&A shows asker + scholar credentials', /asked/i.test(t) && /Sheikh|Ustadh/i.test(t) && /(Al-Azhar|Qarawiyyin|Madinah|Verified scholar)/i.test(t));
}

/* 9. qibla per-design back arrow */
await go('/tools/qibla', 5500);
{
  const hasBack = await page.evaluate(() => !!document.querySelector('[aria-label="back"]'));
  ok('qibla: per-design back arrow present', hasBack);
}

/* 10. community feed still mounts (universal videos wiring didn't break it) */
await go('/(tabs)/community', 6000);
{
  const t = await text();
  ok('community: feed mounts with composer', /Community/i.test(t) && t.length > 150);
}

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
