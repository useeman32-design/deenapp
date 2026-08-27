import { chromium } from 'playwright-core';
import { execSync } from 'child_process';

const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({
  executablePath: BIN,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto('http://127.0.0.1:8152/deenapp/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

// go to community
await page.getByText('Community', { exact: true }).first().click();
await page.waitForTimeout(800);

// find action rows: pressable containing heart svg (d includes 12 19.6)
const info = await page.evaluate(() => {
  const out = [];
  const hearts = Array.from(document.querySelectorAll('path')).filter((p) => (p.getAttribute('d') || '').includes('12 19.6'));
  for (const h of hearts.slice(0, 3)) {
    const svg = h.closest('svg');
    let press = svg ? svg.closest('[data-testid]') : null;
    // climb to the nearest pressable (div with role/onClick) — RNW Pressable renders a div
    let el = svg;
    while (el && el.tagName === 'DIV') {
      // check for click handler by presence of tabindex? RNW pressable has no marker; use heuristic: direct children count
      const kids = Array.from(el.children);
      if (kids.length >= 2 && el.getBoundingClientRect().height > 10 && el.getBoundingClientRect().height < 80) break;
      el = el.parentElement;
    }
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // collect sibling pressables at same parent
    const parent = el.parentElement;
    const sibs = parent ? Array.from(parent.children).map((c) => {
      const cr = c.getBoundingClientRect();
      return { tag: c.tagName, w: Math.round(cr.width), h: Math.round(cr.height), txt: (c.textContent || '').slice(0, 24), svgs: c.querySelectorAll('svg').length };
    }) : [];
    out.push({ row: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, selfTxt: (el.textContent || '').slice(0, 20), sibs });
  }
  return out;
});
console.log(JSON.stringify(info, null, 1).slice(0, 2600));

// also find the community FAB + sticky + search + trending markers
const markers = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    members: txt.includes('Members'),
    online: txt.includes('Online now'),
    postsToday: txt.includes('Posts today'),
    searchPlaceholder: !!document.querySelector('[placeholder*="Search posts or accounts"]'),
    trending: txt.includes('TRENDING'),
    forYou: txt.includes('For you'),
    following: txt.includes('Following'),
    scholars: txt.includes('Scholars'),
    fab: !!document.querySelector('[aria-label], svg path[d*="M12 5v14M5 12h14"]'),
    watchMore: txt.includes('Watch more'),
  };
});
console.log('MARKERS', JSON.stringify(markers));

await browser.close();
