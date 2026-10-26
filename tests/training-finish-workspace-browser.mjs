import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from 'node:assert/strict';
const origin = baseUrl.replace(/\/$/, '');
const baseline = process.argv.includes('--expect-vulnerable');
const browser = await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio']});
const context = await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
const page = await context.newPage(), errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
const check=(value,label)=>{assert.ok(value,label);checks.push(label)};
let blocker;
try {
 await page.goto(origin+'/core.js');
 check(await page.evaluate(async()=>(await indexedDB.databases()).length)===0,'Disposable context starts without user databases');
 await page.goto(origin+'/#/train');await page.locator('html:not([data-starting])').waitFor();
 await page.locator('[data-action="train-mode"][data-mode="self"]').click();
 await page.locator('[data-action="timer-toggle"]').click();
 await page.waitForTimeout(1100);
 blocker=await context.newPage();await blocker.goto(origin+'/core.js');
 await blocker.evaluate(async()=>{
  window.__release=false;
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('nextround-local',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  const transaction=db.transaction('state','readwrite'),store=transaction.objectStore('state');
  transaction.oncomplete=()=>db.close();
  const loop=()=>{const request=store.get('current');request.onsuccess=()=>{if(!window.__release)loop()}};loop();
 });
 await page.locator('[data-action="finish-training"]').click();
 // Hash navigation can still come from the address bar while the app is inert.
 await page.evaluate(()=>location.hash='/');await page.locator('[data-action="demo"]').waitFor();
 await page.locator('[data-action="demo"]').evaluate(button=>button.click());
 if(!baseline){
  check(await page.locator('#app').evaluate(node=>node.inert),'Slow training save keeps the application interaction lease');
  check(await page.evaluate(()=>!location.search.includes('space=demo')),'Demo action is blocked until the captured formal save finishes');
  check(await page.locator('#editor-dialog').count()===0,'Pending save does not open an editor prematurely');
 }
 await blocker.evaluate(()=>window.__release=true);
 if(baseline){
  await page.waitForFunction(()=>document.querySelector('.workspace-badge')?.textContent==='演示空间');
  await page.locator('#editor-dialog textarea[name="notes"]').fill('cross-space-proof');
  await page.locator('#editor-dialog button[type="submit"]').click();
  await page.locator('#editor-dialog').waitFor({state:'detached'});
  const proof=await page.evaluate(async()=>{const db=await import('./db.js'),formal=await db.loadState(),demo=await db.loadState({workspace:'demo'});const mixed=demo.sessions.find(record=>record.notes==='cross-space-proof');return{formalSessions:formal.sessions.length,demoSessions:demo.sessions.length,sameIdInBoth:!!mixed&&formal.sessions.some(record=>record.id===mixed.id)}});
  check(proof.sameIdInBoth,'Old implementation actually mixes the formal session into demo after completing the stale editor');
  console.log(JSON.stringify({result:'BASELINE_VULNERABLE',proof,checks,errors}));
 } else {
  await page.locator('#editor-dialog').waitFor();
  check(await page.evaluate(()=>!location.search.includes('space=demo')),'Successful completion stays in the captured formal workspace');
  check(!await page.locator('#app').evaluate(node=>node.inert),'Successful completion releases the interaction lease');
  await page.locator('#editor-dialog textarea[name="notes"]').fill('formal-session-only');
  await page.locator('#editor-dialog button[type="submit"]').click();await page.locator('#editor-dialog').waitFor({state:'detached'});
  await page.locator('[data-action="demo"]').click();
  await page.waitForFunction(()=>document.querySelector('.workspace-badge')?.textContent==='演示空间');
  check(await page.locator('#editor-dialog').count()===0,'Entering demo leaves no old formal editor');
  const states=await page.evaluate(async()=>{const db=await import('./db.js');return{formal:await db.loadState(),demo:await db.loadState({workspace:'demo'})}});
  check(states.formal.sessions.length===1&&states.formal.sessions[0].notes==='formal-session-only','Completed formal session and edits persist exactly once');
  check(states.demo.sessions.length===4&&states.demo.sessions.every(record=>record.id!==states.formal.sessions[0].id),'Demo retains its four independent records without a formal session');
  check(errors.length===0,'No browser runtime errors');
  console.log(JSON.stringify({result:'PASS',checks:checks.length,details:checks,errors}));
 }
} finally {
 if(blocker&&!blocker.isClosed())await blocker.evaluate(()=>window.__release=true).catch(()=>{});
 await context.close();await browser.close();
}
