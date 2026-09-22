import { chromium } from '/tmp/pwtest/node_modules/playwright-core/index.mjs';
const EXE='/home/user/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const B='http://127.0.0.1:8099';
const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:412,height:900}});
const p=await ctx.newPage();
// api login (app session)
await p.goto(B+'/', {waitUntil:'domcontentloaded'});
const tok=await p.evaluate(async()=>{const r=await fetch('/api/auth/login.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'usman_ahmad',password:'Str0ngPass!23'})});const j=await r.json();return j.token||j.data?.token||JSON.stringify(j).slice(0,120)});
await p.evaluate((t)=>{try{localStorage.setItem('deenlink.token',t);localStorage.setItem('token',t);localStorage.setItem('dl.token',t);}catch{}},tok);
await p.goto(B+'/', {waitUntil:'networkidle'});
await p.waitForTimeout(2500);
async function cardPoint(title){
  return await p.evaluate((tt)=>{
    const els=[...document.querySelectorAll('div')].filter(e=>e.textContent&&e.textContent.trim().startsWith(tt)&&e.textContent.length<200);
    let best=null; for(const e of els){const r=e.getBoundingClientRect(); if(r.width>80&&r.width<260&&r.height>80&&(!best||r.width*r.height<best.a)){best={x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,a:r.width*r.height}}}
    return best;
  }, title);
}
async function openUploaded(){
  const seen=new Set();
  for(let round=0;round<16;round++){
    const cards=await p.evaluate(()=>[...document.querySelectorAll('div')].filter(e=>/^Admin UI daily/.test((e.textContent||'').trim())&&e.textContent.length<200).map(e=>({t:e.textContent.trim().slice(0,60),r:e.getBoundingClientRect().toJSON()})));
    for(const c of cards){
      if(!/uploaded/.test(c.t)) continue;
      if(seen.has(c.t)) continue; seen.add(c.t);
      const pt=await cardPoint(c.t.slice(0,30));
      if(pt&&pt.w>80){ await p.mouse.click(pt.x,pt.y); await p.waitForTimeout(2500); return pt; }
    }
    await p.mouse.wheel(0,220); await p.waitForTimeout(700);
  }
  return null;
}
const pt=await openUploaded();
await p.waitForTimeout(1200);
const info=await p.evaluate(()=>{
  const vs=[...document.querySelectorAll('video')];
  return vs.map(v=>({src:v.getAttribute('src'),currentSrc:v.currentSrc,inner:v.innerHTML.slice(0,240),readyState:v.readyState,networkState:v.networkState,duration:v.duration,paused:v.paused,w:v.videoWidth,h:v.videoHeight,err:v.error?v.error.code+':'+v.error.message:null}));
});
console.log('cardPoint', JSON.stringify(pt));
console.log('videos', JSON.stringify(info,null,1));
// playback attempt
const play=await p.evaluate(async()=>{const v=document.querySelector('video'); if(!v) return 'no video'; try{await v.play();}catch(e){return 'play() threw '+e.message} await new Promise(r=>setTimeout(r,1800)); return {t:v.currentTime,paused:v.paused,readyState:v.readyState,err:v.error?v.error.code:null};});
console.log('playback', JSON.stringify(play));
// screenshot
await p.screenshot({path:'/tmp/pwtest/out/b3-video.png'});
await b.close();
