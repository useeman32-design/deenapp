import { chromium } from 'playwright-core';
const D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], env: { ...process.env, LD_LIBRARY_PATH: D } });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('dl.demoSession', '1'); sessionStorage.clear(); } catch {} });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));

// 1. reader actions + share
await page.goto('http://localhost:3996/deenapp/read/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4500);
const r1 = await page.evaluate(() => {
  const leaf = (t) => [...document.querySelectorAll('div,span')].filter((e) => e.childElementCount === 0 && (e.textContent || '').trim() === t).length;
  const both = document.body.innerText.includes('In the name of Allah') && document.body.innerText.includes('Da sunan Allah');
  return { ayah: leaf('Ayah'), save: leaf('Save'), share: leaf('Share'), bothTranslationsShown: both };
});
console.log('READER-ACTIONS:', JSON.stringify(r1));
await page.evaluate(() => { [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'Share')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(1400);
const sh = await page.evaluate(() => { const t = document.body.innerText; return { open: t.includes('SEND TO'), copyLink: t.includes('Copy link'), image: t.includes('Share as image') }; });
console.log('SHARE:', JSON.stringify(sh));
// generate the image card
await page.evaluate(() => { [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Share as image/.test(e.textContent || ''))?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(3500);
const img = await page.evaluate(() => ({ card: [...document.querySelectorAll('img')].some((i) => i.src.startsWith('data:image')), }));
console.log('SHARE-IMAGE:', JSON.stringify(img));
await page.screenshot({ path: '/tmp/p20-shareimg.png' });

// 2. mushaf settings by real button
await page.goto('http://localhost:3996/deenapp/read/2', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /Mushaf$/.test((e.textContent || '').trim()))?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(6000);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('div')].find((d) => { const st = d.getAttribute('style') || ''; return st.includes('width: 32px') && st.includes('height: 32px') && st.includes('border-radius: 11px'); });
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(1000);
const st = await page.evaluate(() => ({ open: document.body.innerText.includes('PAGE THEME') && document.body.innerText.includes('TEXT SIZE'), madina: document.body.innerText.toUpperCase().includes('MADINA') }));
console.log('MUSHAF-SETTINGS:', JSON.stringify(st));
await page.screenshot({ path: '/tmp/p20-msettings.png' });

// 3. comments via feed actions row (2nd button)
await page.goto('http://localhost:3996/deenapp/community', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div')].filter((d) => (d.getAttribute('style') || '').includes('border-top-width') || (d.getAttribute('style') || '').includes('borderTopWidth'));
  const actions = rows.find((d) => d.querySelectorAll(':scope > div').length >= 3);
  actions?.querySelectorAll(':scope > div')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(2500);
const c1 = await page.evaluate(() => ({ open: document.body.innerText.includes('Comments'), gifBtn: [...document.querySelectorAll('div,span')].some((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'GIF') }));
console.log('COMMENTS:', JSON.stringify(c1));
await page.evaluate(() => { [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === 'GIF')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(900);
const c2 = await page.evaluate(() => ({ pickerGifs: [...document.querySelectorAll('img')].filter((i) => i.src.includes('.gif')).length }));
console.log('GIF-PICKER:', JSON.stringify(c2));
// send one
await page.evaluate(() => { const gif = [...document.querySelectorAll('img')].find((i) => i.src.includes('.gif')); gif?.closest('div')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await page.waitForTimeout(1200);
const c3 = await page.evaluate(() => ({ sent: [...document.querySelectorAll('img')].filter((i) => i.src.includes('.gif')).length }));
console.log('GIF-SENT:', JSON.stringify(c3));
await page.screenshot({ path: '/tmp/p20-comments.png' });
console.log('PAGEERRORS:', errs.slice(0, 5));
await browser.close();
