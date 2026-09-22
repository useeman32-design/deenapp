import { chromium } from '/tmp/pwtest/node_modules/playwright-core/index.mjs';
const EXE='/home/user/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const B='http://127.0.0.1:8099';
const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:412,height:900}});
const p=await ctx.newPage();
const reqs=[];
p.on('response', r=>{ const u=r.url(); if(/uploads\/|\.mp4/i.test(u)) reqs.push(`${r.status()} ${r.request().method()} ${u.replace(B,'')}`); });
await p.goto(B+'/', {waitUntil:'domcontentloaded'});
const tok=await p.evaluate(async()=>{const r=await fetch('/api/auth/login.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'usman_ahmad',password:'Str0ngPass!23'})});const j=await r.json();return j.token||(j.data&&j.data.token)||null});
await p.evaluate((t)=>{for(const k of ['deenlink.token','token','dl.token','auth_token']) try{localStorage.setItem(k,t)}catch{}},tok);
await p.goto(B+'/', {waitUntil:'networkidle'});
await p.waitForTimeout(2500);
// scroll the uploaded card into view and click it (same approach as verify101)
const pt = await p.evaluate(()=>{
  const el=[...document.querySelectorAll('div,span')].filter(e=>(e.textContent||'').trim()==='Admin UI daily (uploaded file)'&&e.children.length===0)[0];
  if(!el) return null;
  el.scrollIntoView({block:'center'});
  let card=el; for(let i=0;i<6&&card;i++){ if(card.getAttribute&&(card.getAttribute('role')==='button'||card.getAttribute('tabindex')!==null)) break; card=card.parentElement; }
  const r=(card||el).getBoundingClientRect();
  return {x:Math.round(r.x+Math.min(r.width,150)/2), y:Math.round(r.y+50), w:Math.round(r.width)};
});
await p.waitForTimeout(700);
if(pt) await p.mouse.click(pt.x, pt.y);
await p.waitForTimeout(4000);
const info = await p.evaluate(()=>{
  const rect = e => { const r=e.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}; };
  const vs=[...document.querySelectorAll('video')].map(v=>({
    rect: rect(v), srcAttr: v.getAttribute('src'), srcProp: v.src, currentSrc: v.currentSrc,
    readyState: v.readyState, netState: v.networkState, err: v.error? (v.error.code+':'+v.error.message) : null,
    controls: v.controls, html: v.outerHTML.slice(0,220),
  }));
  return { card: !!document.body.innerText.includes('Admin UI daily (uploaded file)'), videos: vs,
    modalTitleVisible: /Admin UI daily \(uploaded file\)/.test(document.body.innerText),
    tapToPlay: /Tap to play/i.test(document.body.innerText), openVideoFile: /Open video file/i.test(document.body.innerText) };
});
console.log('click pt', JSON.stringify(pt));
console.log(JSON.stringify(info,null,1));
console.log('media requests:', JSON.stringify(reqs,null,1));
await p.screenshot({path:'/tmp/pwtest/out/dbg101c.png'});
await b.close();
