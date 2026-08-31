/* probe34 — translations: quran 6-language cycle + hadith CDN translations */
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const results = [];
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

/* 1. quran reader: cycle EN → HA → YO → FR and see French text */
await page.goto('http://localhost:3996/deenapp/read/112', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5500);
{
  const chip = await page.evaluate(() => { const el = document.querySelector('[aria-label="translation language"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 830) }; });
  ok('quran: language chip present', chip != null);
  if (chip) {
    for (let i = 0; i < 2; i++) { await page.touchscreen.tap(chip.x, chip.y); await page.waitForTimeout(1400); }
    const t2 = await page.evaluate(() => document.body.innerText);
    ok('quran: YORUBA translation renders (2 taps)', /Sọ pé|Ọ̀kan|Allāhu|ṣoṣo/.test(t2), (t2.match(/Sọ pé|Ọ̀kan/) || [''])[0]);
    await page.touchscreen.tap(chip.x, chip.y); await page.waitForTimeout(1400);
    const t = await page.evaluate(() => document.body.innerText);
    ok('quran: 3rd tap lands on FRENCH translation', /\bDis\b|Unique|Éternel/.test(t), (t.match(/(Dis|Unique|Éternel)/) || [''])[0]);
  }
}

/* 2. hadith: FR chip fetches CDN translation for visible hadiths */
await page.goto('http://localhost:3996/deenapp/tools/hadith/buhari?h=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
{
  const fr = await page.evaluate(() => { const el = document.querySelector('[aria-label="translation FR"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(Math.max(r.y + r.height / 2, 8), 830) }; });
  ok('hadith: translation chips (EN/FR/BN/UR) present', fr != null);
  if (fr) {
    await page.touchscreen.tap(fr.x, fr.y);
    await page.waitForTimeout(6000);
    const t = await page.evaluate(() => document.body.innerText);
    ok('hadith: French translation loads from CDN', /Rapporté|Le Prophète|récompense|Messager d'Allah/.test(t), (t.match(/Rapporté|récompense/) || [''])[0].slice(0, 24));
  }
}

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
