import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox','--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu' } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession','1'); sessionStorage.clear(); } catch {} });
await page.goto('http://localhost:3996/deenapp/read/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(async () => {
  // real verse arabic spans: inline fontFamily includes Amiri
  const spans = [...document.querySelectorAll('span,div')].filter(e => (e.getAttribute('style')||'').includes('Amiri'));
  const out = [];
  // which font ACTUALLY renders? compare pixel width of a sample string in Amiri vs fallback
  const c = document.createElement('canvas').getContext('2d');
  const s = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ';
  c.font = '30px Amiri'; const wAmiri = c.measureText(s).width;
  c.font = '30px serif'; const wSerif = c.measureText(s).width;
  const checkA = document.fonts.check('30px Amiri');
  const checkP = document.fonts.check('16px Poppins');
  // find english translation text style in a verse card
  const en = [...document.querySelectorAll('span,div')].filter(e => (e.getAttribute('style')||'').includes('13.5'));
  const enStyle = en[0] ? (en[0].getAttribute('style')||'').match(/font-family:[^;]+/) : null;
  return {
    amiriSpans: spans.length,
    checkAmiri: checkA, checkPoppins: checkP,
    wAmiri: Math.round(wAmiri), wSerif: Math.round(wSerif),
    englishStyle: enStyle ? enStyle[0] : null,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
