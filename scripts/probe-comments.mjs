import { chromium } from 'playwright-core';
const BASE = 'http://app.deenlink.org';
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept().catch(() => {}));

const fire = (el) => {
  const opts = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
};

const tapByText = async (re) => page.evaluate((src) => {
  const re2 = new RegExp(src);
  const els = Array.from(document.querySelectorAll('div,span')).filter((e) => re2.test((e.textContent || '').trim()) && e.children.length <= 3);
  const el = els[els.length - 1];
  if (!el) return false;
  const opts = { bubbles: true, composed: true, cancelable: true, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
  return (el.textContent || '').trim().slice(0, 40);
}, re.source);

const hasText = (t) => page.evaluate((s) => document.body.textContent.includes(s), t);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const inputs = await page.$$('input');
await inputs[0].fill('pC1788729642@t.co');
await inputs[1].fill('Str0ngPass!23');
await page.getByText('Sign In', { exact: true }).first().click();
await page.waitForTimeout(5500);
await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

// open the comments modal on the probe post — retry a few times
let opened = false;
for (let i = 0; i < 5 && !opened; i++) {
  await page.evaluate(() => {
    // find the card that contains the probe post text, then its comment control
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n, node = null;
    while ((n = walker.nextNode())) { if ((n.textContent || '').includes('UI probe chain')) { node = n; break; } }
    if (!node) return;
    let el = node.parentElement;
    for (let k = 0; k < 14 && el; k++) {
      const btn = el.querySelector('[aria-label="open comments"]');
      if (btn) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      el = el.parentElement;
    }
  });
  await page.waitForTimeout(2500);
  opened = await hasText('root comment by A');
  if (!opened) await page.waitForTimeout(1500);
}
console.log('modal opened:', opened);

const r1 = await tapByText(/^View \d+ repl/i);
console.log('expand tapped:', r1);
await page.waitForTimeout(1500);

const out = await page.evaluate(() => {
  const body = document.body.innerText.replace(/\s+/g, ' ');
  const i = body.indexOf('root comment by A');
  return { slice: i >= 0 ? body.slice(i, i + 500) : body.slice(0, 300), hasB: body.includes('B reply to A'), hasC: body.includes('C reply to B'), labels: [...body.matchAll(/replying to ›\s*([A-Za-z]+)/gi)].map((m) => m[1]) };
});
console.log('slice:', out.slice);
console.log('has B reply:', out.hasB, '| has C reply:', out.hasC, '| labels:', JSON.stringify(out.labels));
await page.screenshot({ path: '/tmp/comments-modal.png' });
await browser.close();
