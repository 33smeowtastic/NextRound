import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
const out = await testOutput(import.meta.url); await mkdir(out,{recursive:true});
const file = n => artifactPath(n, out);
const report={date:new Date().toISOString(),checks:[],layouts:[],errors:[],realPhoneVerified:false};
const check=(v,s)=>{assert.ok(v,s);report.checks.push(s)};
const b=await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio']});
const c=await b.newContext({viewport:{width:507,height:764},reducedMotion:'reduce'});const p=await c.newPage();
p.on('pageerror',e=>report.errors.push(e.message));
const ready=async()=>{await p.locator('html:not([data-starting])').waitFor();await p.evaluate(()=>document.fonts.ready)};
const measure=()=>p.evaluate(()=>{
 const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
 const landmark=(s,x,y)=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return{x:r.x+x/e.naturalWidth*r.width,y:r.y+y/e.naturalHeight*r.height}};
 return{theme:document.body.className,angel:landmark('.scene-angel',+document.querySelector('.scene-angel').dataset.headX,+document.querySelector('.scene-angel').dataset.headY),demon:landmark('.scene-demon',+document.querySelector('.scene-demon').dataset.headX,+document.querySelector('.scene-demon').dataset.headY),halo:box('.head-halo'),ring:box('.portal-arc-left'),wizard:box('.scene-wizard'),overflow:document.documentElement.scrollWidth>innerWidth,decoded:[...document.querySelectorAll('.scene-statue,.scene-wizard')].every(e=>e.complete&&e.naturalWidth)};
});
try{
 for (const [preference, expectedTheme] of [[null,'light'],['dark','dark'],['light','light'],['invalid','light']]) {
  const context = await b.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'});
  const page = await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  if (preference !== null) await context.addInitScript(value=>localStorage.setItem('nextround-theme',value),preference);
  let releaseApp;
  const appGate = new Promise(resolve=>{releaseApp=resolve});
  await page.route('**/app.js*',async route=>{await appGate;await route.continue()});
  try {
   await page.goto(baseUrl,{waitUntil:'commit'});
   await page.locator('#startup-loading').waitFor({state:'visible'});
   await page.waitForFunction(()=>!!document.querySelector('link[href="./startup.css"]').sheet);
   const initial = await page.evaluate(()=>({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.querySelector('#startup-loading')).backgroundColor,chrome:document.querySelector('meta[name="theme-color"]').content,outline:getComputedStyle(document.querySelector('.startup-mark g path')).stroke,highlight:getComputedStyle(document.querySelector('.startup-mark>path')).stroke,progress:getComputedStyle(document.querySelector('[data-startup-fill]')).backgroundColor}));
   check(initial.theme===expectedTheme, `Preference ${preference}: theme is resolved before app initialization, independent of dark OS setting`);
   check(initial.bg==='rgb(16, 16, 16)', `Preference ${preference}: loading surface stays dark regardless of the saved application theme`);
   check(initial.chrome==='#101010', `Preference ${preference}: browser theme color stays dark during loading`);
   check(initial.outline==='rgb(255, 255, 255)'&&initial.highlight==='rgb(191, 245, 92)'&&initial.progress==='rgb(191, 245, 92)', `Preference ${preference}: logo stays white/green and loading progress stays green`);
   if (preference===null) await page.screenshot({path:file('first-visit-heaven-loading-390.png')});
   releaseApp();
   await page.locator('html:not([data-starting])').waitFor();
   check(await page.locator('body.theme-'+expectedTheme).count()===1, `Preference ${preference}: first completed homepage uses the resolved theme`);
   check(await page.locator('meta[name="theme-color"]').getAttribute('content')===(expectedTheme==='light'?'#f2eee7':'#12110f'), `Preference ${preference}: browser chrome adopts the application theme after loading`);
   if (preference===null) await page.screenshot({path:file('first-visit-heaven-390.png')});
  } finally {releaseApp();await context.close()}
 }
 await p.goto(baseUrl);await ready();
 check(await p.locator('body.theme-light').count()===1,'A fresh archive defaults to the Heaven world');
 check(await p.locator('.site-controls>button').first().getAttribute('data-action')==='toggle-theme','Home lamp is the first toolbar action');
 for(const [w,h]of [[320,764],[390,844],[507,764],[1280,697],[1440,900]]){
  await p.setViewportSize({width:w,height:h});
  const states=[];
  for(const theme of ['light','dark']){
   if(!await p.locator('body.theme-'+theme).count())await p.locator('[data-action="toggle-theme"]').click();
   const icon=await p.locator('.theme-toggle svg').innerHTML();
   check(theme==='light'?icon.includes('<circle'):icon.includes('A8.5'),`${w}px ${theme}: current sun/moon icon is present`);
   const m=await measure();states.push(m);
   check(Math.hypot(m.angel.x-m.demon.x,m.angel.y-m.demon.y)<.1,`${w}px ${theme}: real visible eye landmarks align within .1px`);
   check(!m.overflow&&m.decoded,`${w}px ${theme}: decoded independent figures and no horizontal overflow`);
   if(w===507||w===1440)await p.screenshot({path:file(`portal-${theme}-${w}.png`)});
  }
  check(JSON.stringify(states[0].halo)===JSON.stringify(states[1].halo)&&JSON.stringify(states[0].ring)===JSON.stringify(states[1].ring),`${w}px: halo and portal stay fixed across themes`);
  report.layouts.push({w,h,states});
 }
 await p.setViewportSize({width:507,height:764});
 for(const theme of ['light','dark']){
  if(!await p.locator('body.theme-'+theme).count())await p.locator('[data-action="toggle-theme"]').click();
  await p.reload();await ready();
  const icon=await p.locator('.theme-toggle svg').innerHTML();
  check(theme==='light'?icon.includes('<circle'):icon.includes('A8.5'),`${theme}: first render after reload has the actual sun/moon icon`);
 }
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const expected=['duality.css?v=guide-polish-20261025','review-ui.css?v=guide-polish-20261025','chrome-review.css?v=guide-polish-20261025','knowledge-guide.js','paired-bgm.js','portal-motion.js?v=guide-polish-20261025','assets/v3-portal/angel-cutout.png','assets/v3-portal/demon-cutout.png','assets/v3-portal/wizard-cutout.png','assets/audio/hermetic-geometry-heaven.mp3','assets/audio/hermetic-geometry-hell.mp3','assets/通用AI面试训练协议_公开版_V1.0.md'];
 const workerResponse=await p.request.get(new URL('sw.js',baseUrl).href);
 assert.equal(workerResponse.status(),200);
 const workerText=await workerResponse.text(),cacheName=workerText.match(/const CACHE\s*=\s*["']([^"']+)["']/)?.[1];
 assert.ok(cacheName,'The target Service Worker declares its cache name');
 const cached=await p.evaluate(async({urls,cacheName})=>{const names=await caches.keys();if(!names.includes(cacheName))return urls.map(url=>({url,ok:false}));const cache=await caches.open(cacheName);return Promise.all(urls.map(async url=>({url,ok:!!await cache.match(new URL(url,location.href).href)})))},{urls:expected,cacheName});
 check(cached.every(x=>x.ok),'Latest shell cache includes scene, both stems, guide, protocol and final CSS');report.cache=cached;
 await c.setOffline(true);await p.reload();await ready();
 check((await measure()).decoded,'A real offline reload decodes all three independent figures');
 await p.locator('.entry-cta[href="#/dashboard"]').click();await p.locator('.sidebar>.nav a[href="#/knowledge"]').click();
 await p.locator('.knowledge-guide-step').first().waitFor({state:'attached'});
 check(await p.locator('.knowledge-guide-step').count()===4,'Offline knowledge entry contains all four guide steps');
 const logo=await p.locator('.crumb .brand-round').evaluate(mark=>({outline:getComputedStyle(mark.querySelector('g path')).stroke,highlight:getComputedStyle(mark.querySelector(':scope>path')).stroke}));
 check(logo.outline==='rgb(255, 255, 255)'&&logo.highlight==='rgb(191, 245, 92)','Workspace logo retains white outline and green highlight');
 await p.locator('.knowledge-guide-step>summary').first().click();
 check(await p.locator('.guide-copy-button').first().isVisible(),'Offline guide exposes the right-side copy icon');
 await p.screenshot({path:file('guide-offline-507.png')});
 await p.locator('.sidebar>.nav a[href="#/train"]').click();await p.locator('.training-stage').waitFor();
 for(const theme of ['dark','light']){
  if(!await p.locator('body.theme-'+theme).count())await p.locator('.side-utilities [data-action="toggle-theme"]').click();
  const art=await p.locator('.training-stage').evaluate(async node=>{
   const url=getComputedStyle(node).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)[1];
   const image=new Image();image.src=url;await image.decode();return {path:new URL(url).pathname,decoded:image.naturalWidth>0};
  });
  check(art.decoded&&art.path.endsWith(theme==='light'?'/angel-cutout.png':'/demon-cutout.png'),`${theme}: offline training decodes the current themed homepage figure`);
 }
 check(!await p.evaluate(async cacheName=>!!await (await caches.open(cacheName)).match(new URL('assets/v3/threshold.jpg',location.href).href),cacheName),'Latest offline cache excludes the retired unified artwork');
 check(report.errors.length===0,'No browser runtime errors in the final integration run');
 report.result='PASS';await writeFile(new URL('VERIFICATION.json',out),JSON.stringify(report,null,2));
 console.log(JSON.stringify({checks:report.checks.length,result:report.result,errors:report.errors}));
}finally{await b.close()}

