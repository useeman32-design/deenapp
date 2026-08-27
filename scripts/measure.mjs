import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = '/tmp/serve';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.json':'application/json' };
const server = createServer(async (req,res) => {
  const url = new URL(req.url,'http://x');
  let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try { const d = await readFile(p); res.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'}); res.end(d); }
  catch { const d = await readFile(join(ROOT,'deenapp','index.html')); res.writeHead(200,{'Content-Type':'text/html'}); res.end(d); }
});
await new Promise(r => server.listen(8124,'127.0.0.1',r));
const browser = await chromium.launch({ executablePath:'/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell', args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, colorScheme:'dark' });
const user = { id:1, username:'abdalrahman', full_name:'Abdulrahman Al-Harbi', user_type:'user', profile_image_url:null, deenpoints_balance:240, is_email_verified:1, account_status:'active', verification_badge:'verified', scholar:null };
await ctx.addInitScript((u) => {
  localStorage.setItem('dl.session','demo-session-token');
  localStorage.setItem('dl.csrf','demo-csrf');
  localStorage.setItem('dl.user', JSON.stringify(u));
  localStorage.setItem('dl.onboarded','1');
  const days=[]; for(let i=0;i<7;i++) days.push(new Date(Date.now()-i*864e5).toDateString());
  localStorage.setItem('dl.streak.days', JSON.stringify(days));
  localStorage.setItem(`dl.goal.${new Date().toDateString()}`, JSON.stringify({surah:true,checkin:true}));
}, user);
await ctx.route('**/*', async (route) => {
  const u = route.request().url();
  if (u.includes('deenlink.org')) {
    if (u.includes('/api/auth/me.php')) return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({status:'success',user}), headers:{'Set-Cookie':'deenlink_session=demo-session-token; Path=/'}});
    return route.abort();
  }
  return route.continue();
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8124/deenapp/', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(6000);
const boxes = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent||'').trim();
    if (['Fajr','Dhuhr','Asr','Maghrib','Isha'].includes(t) && el.children.length === 0) {
      const r = el.getBoundingClientRect();
      out.push({ t, left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  const svg = document.querySelector('svg');
  const sr = svg ? svg.getBoundingClientRect() : null;
  const wEl = document.querySelector('[data-testid]');
  return { out, svgLeft: sr ? Math.round(sr.left) : null, svgWidth: sr ? Math.round(sr.width) : null };
});
console.log(JSON.stringify(boxes, null, 1));
await browser.close();
server.close();
