import { chromium } from 'playwright-core';
const BIN = '/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8152/deenapp';
const browser = await chromium.launch({ executablePath: BIN, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const user = { id: 1, username: 'abdalrahman', full_name: 'Abdulrahman Al-Harbi', user_type: 'user', profile_image_url: null, deenpoints_balance: 240, is_email_verified: 1, account_status: 'active', verification_badge: 'verified', scholar: null };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await ctx.addInitScript((u) => { try { localStorage.setItem('dl.session', 'demo-session-token'); localStorage.setItem('dl.user', JSON.stringify(u)); localStorage.setItem('dl.onboarded', '1'); localStorage.setItem('dl.demoSession', '1'); sessionStorage.setItem('dl.splash.seen', '1'); } catch {} }, user);
await ctx.route('**/*', async (route) => { const u = route.request().url(); if (u.includes('deenlink.org')) { if (u.includes('/api/auth/me.php')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) }); return route.abort(); } return route.continue(); });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
// videos chip
let chip = await page.evaluate(() => { const els = Array.from(document.querySelectorAll('div')); const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Videos'); return el.length ? (() => { const r = el[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })() : null; });
if (chip) { await page.mouse.click(chip.x, chip.y); await page.waitForTimeout(3200); }
await page.goBack();
await page.waitForTimeout(1800);
// quran tab
const q = await page.evaluate(() => { const els = Array.from(document.querySelectorAll('div')); const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Quran &'); const vis = el.filter((d) => d.getBoundingClientRect().y > 640); return vis.length ? (() => { const r = vis[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: els.filter((e) => (e.textContent || '').trim() === 'Quran &').length }; })() : null; });
console.log('quran tab probe:', JSON.stringify(q));
if (q) { await page.mouse.click(q.x, q.y); await page.waitForTimeout(2600); }
// profile tab
const p = await page.evaluate(() => { const els = Array.from(document.querySelectorAll('div')); const el = els.filter((d) => d.children.length === 0 && (d.textContent || '').trim() === 'Profile'); const all = el.map((d) => Math.round(d.getBoundingClientRect().y)); const vis = el.filter((d) => d.getBoundingClientRect().y > 640); return { allYs: all, click: vis.length ? (() => { const r = vis[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })() : null }; });
console.log('profile tab probe:', JSON.stringify(p));
if (p.click) { await page.mouse.click(p.click.x, p.click.y); await page.waitForTimeout(2600); }
const t = await page.evaluate(() => document.body.innerText);
console.log('url:', page.url().slice(-20));
console.log('has My Posts:', t.includes('My Posts'), '| has FOLLOWERS:', t.includes('FOLLOWERS'), '| has Settings word:', t.includes('Settings'));
console.log('tail:', JSON.stringify(t.slice(-260)));
await browser.close();
