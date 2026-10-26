import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = await testOutput(import.meta.url);await mkdir(out,{recursive:true});
const file=n=>artifactPath(n, out);
const b=await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const c=await b.newContext({viewport:{width:1403,height:900},reducedMotion:'reduce',permissions:['microphone']});
await c.addInitScript(() => {
  const Native = window.AudioContext;
  window.__bgmContexts = [];
  window.AudioContext = class extends Native {
    constructor(...args) { super(...args); this.__sources = []; window.__bgmContexts.push(this); }
    createBufferSource() {
      const source = super.createBufferSource(), start = source.start.bind(source);
      source.__starts = []; source.start = (...args) => { source.__starts.push(args); return start(...args); };
      this.__sources.push(source); return source;
    }
  };
});
const p=await c.newPage();const evidence={date:new Date().toISOString(),checks:[],errors:[],layouts:[]};p.on('pageerror',e=>evidence.errors.push(e.message));
const check=(v,label)=>{assert.ok(v,label);evidence.checks.push(label);};
const ready=async()=>p.locator('html:not([data-starting])').waitFor();
const route=async name=>{await p.goto(new URL('#/', baseUrl).href+name);await ready();};
const raw=()=>p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('nextround-local',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('state'),q=t.objectStore('state').get('current');q.onsuccess=()=>resolve(q.result);t.oncomplete=()=>db.close();t.onerror=()=>reject(t.error);};}));
const wait=async f=>{for(let i=0;i<60;i++){const s=await raw();if(f(s))return s;await p.waitForTimeout(50);}throw Error('Stored state timeout');};
const shot=async name=>{await p.evaluate(()=>document.querySelector('#toast')?.classList.remove('visible'));await p.screenshot({path:file(name)});};
const tag=(scope,name)=>p.locator(`[data-scope=${scope}][data-sort-tag]`).filter({hasText:name}).filter({has:p.locator('xpath=self::*')});
const tagExact=(scope,name)=>p.locator(`[data-scope=${scope}][data-sort-tag]`).getByText(name,{exact:true});
const dragTag=async(scope,name,before)=>{
 const source=p.locator(`[data-scope=${scope}][data-sort-tag]`).filter({hasText:new RegExp('^'+name+'$')}),target=p.locator(`[data-scope=${scope}][data-sort-tag]`).filter({hasText:new RegExp('^'+before+'$')});
 await target.scrollIntoViewIfNeeded();await source.scrollIntoViewIfNeeded();
 const a=await source.boundingBox(),z=await target.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.waitForTimeout(400);await p.mouse.move(z.x+3,z.y+z.height/2,{steps:12});await p.mouse.up();
 await p.waitForTimeout(650);
};
try{
 await p.goto(new URL('core.js', baseUrl).href);
 const fixture=await p.evaluate(async()=>{
  const core=await import('./core.js'),s=core.blankState(),make=(id,fields)=>core.touch({id},fields);
  s.contentCards=[make('card-a',{title:'经历甲',content:'甲的项目经历',category:'经历',variant:'短版',tags:['项目','alpha']}),make('card-b',{title:'开场乙',content:'乙的开场说明',category:'开场',variant:'长版',tags:['简洁']}),make('card-c',{title:'收尾丙',content:'丙的收尾表达',category:'收尾',variant:'通用',tags:['项目']}),make('card-d',{title:'未分类丁',content:'未分类内容'})];
  s.scripts=[make('script-a',{title:'当前介绍',content:'甲的项目经历\n\n乙的开场说明',composition:[{id:'part-a',sourceCardId:'card-a',title:'经历甲',text:'甲的项目经历'},{id:'part-b',sourceCardId:'card-b',title:'开场乙',text:'乙的开场说明'}],history:[{at:new Date().toISOString(),content:'应清除的旧介绍'}]})];
  s.questions=[make('question-a',{text:'问题',answer:'保留回答',history:[{at:new Date().toISOString(),answer:'保留题库历史'}]})];
  for(const [name,version,workspace]of [['nextround-local',7,'formal'],['nextround-demo',3,'demo']]){
   const state=structuredClone(s);if(workspace==='demo')state.settings.demo=true;
   const db=await new Promise(resolve=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);});
   await new Promise(resolve=>{const t=db.transaction('state','readwrite');t.objectStore('state').put({version,workspace,workspaceMigration:1,state},'current');t.oncomplete=resolve;});db.close();
  }
  const db=await import('./db.js');const formal=await db.loadState(),demo=await db.loadState({workspace:'demo'});return{formal,demo};
 });
 check(fixture.formal.scripts[0].history.length===0&&fixture.demo.scripts[0].history.length===0&&fixture.formal.questions[0].history.length===1,'Legacy introduction histories are removed in both spaces while current composition and question history are retained');
 const first=await raw();assert.equal(first.version,8);await p.evaluate(async()=>{const db=await import('./db.js');await db.loadState();});assert.equal((await raw()).version,8);
 check(true,'History cleanup writes once atomically and repeated loads do not increment versions');
 await route('knowledge');await p.locator('[data-tab=contentCards]').click();
 await p.locator('[data-action=filter-card-tag][data-scope=library]').filter({hasText:/^项目$/}).click();assert.equal(await p.locator('.content-card-tile').count(),2);
 await p.locator('[data-action=filter-card-tag][data-scope=library][data-tag=""]').click();
 check((await p.locator('.content-card-title').allTextContents())[0]==='经历甲','Clickable tags filter custom labels and the All chip restores the complete card library');
 await dragTag('library','收尾','经历');await wait(s=>s.state.settings.contentCardTagOrder?.[0]==='收尾');
 check((await p.locator('.content-card-title').allTextContents())[0]==='收尾丙','Mouse long-press reorders tag priority and changes card order');
 await p.reload();await ready();await p.locator('[data-tab=contentCards]').click();assert.equal((await p.locator('.content-card-title').allTextContents())[0],'收尾丙');
 check(true,'Tag order and derived card order persist after reload');
 const demoOrder=await p.evaluate(async()=>{const db=await import('./db.js');return (await db.loadState({workspace:'demo'})).settings.contentCardTagOrder||[];});
 check(demoOrder.length===0,'Formal tag sorting leaves the independent demo settings unchanged');await shot('tags-desktop.png');
 await p.locator('[data-tab=scripts]').click();await p.locator('[data-action=edit][data-kind=scripts]').first().click();assert.equal(await p.getByText('历史介绍版本',{exact:true}).count(),0);
 await p.locator('[data-action=filter-card-tag][data-scope=composer]').filter({hasText:/^开场$/}).click();assert.equal(await p.locator('[data-content-card]').count(),1);assert.equal(await p.locator('[data-content-card]').first().getAttribute('data-content-card'),'card-b');
 await p.locator('[data-action=filter-card-tag][data-scope=composer][data-tag=""]').click();
 await dragTag('composer','开场','收尾');
 check(await p.locator('[data-content-card]').first().getAttribute('data-content-card')==='card-b','Long-press sorting inside the composition panel uses the same saved card priorities');
 await dragTag('composer','收尾','开场');
 await p.locator('[data-action=composition-remove]').first().click();assert.equal(await p.locator('[data-composition-part]').count(),1);await p.locator('[data-composition-text]').first().fill('乙的开场已修改');await shot('deletion-undo-available.png');await p.locator('[data-action=composition-undo]').click();
 assert.equal(await p.locator('[data-composition-part]').count(),2);assert.equal(await p.locator('[data-composition-text]').first().inputValue(),'甲的项目经历');assert.equal(await p.locator('[data-composition-text]').nth(1).inputValue(),'乙的开场已修改');
 check(true,'Deleting a composition part offers Undo that restores its position without reverting subsequent edits');
 await p.locator('[data-action=composition-remove]').last().click();await p.locator('[data-action=composition-remove]').first().click();await p.locator('[data-action=composition-undo]').click();await p.locator('[data-action=composition-undo]').click();assert.equal(await p.locator('[data-composition-part]').count(),2);
 check(true,'Multiple consecutive part deletions can be undone within the editor');await shot('composition-undo.png');
 await p.locator('#entity-form button[type=submit]').click();await p.locator('#editor-dialog').waitFor({state:'detached'});await wait(s=>s.state.scripts[0].composition.length===2&&s.state.scripts[0].history.length===0);
 await p.locator('[data-action=edit][data-kind=scripts]').first().click();check(await p.locator('[data-action=composition-undo]').count()===0&&await p.getByText('历史介绍版本',{exact:true}).count()===0,'Undo is local to the open editor and saved introductions no longer retain historical versions');await p.locator('#entity-form button[type=submit]').click();
 await route('train');check(await p.evaluate(()=>window.__bgmContexts.length===0),'BGM remains silent until the user activates its existing sound control');await p.locator('[data-corner-sound]').click();
 await p.waitForFunction(()=>{const c=window.__bgmContexts[0];return c?.__sources.length===2&&c.currentTime>c.__sources[0].__starts[0][0]+0.15;});
 const audio=await p.evaluate(()=>{const c=window.__bgmContexts[0];return{state:c.state,stems:c.__sources.map(s=>({start:s.__starts[0],duration:s.buffer.duration,loop:s.loop,loopEnd:s.loopEnd,rate:s.playbackRate.value}))};});
 check(audio.state==='running'&&audio.stems.every(s=>s.loop&&s.duration>1&&s.rate===1)&&audio.stems[0].loopEnd===audio.stems[1].loopEnd&&JSON.stringify(audio.stems[0].start)===JSON.stringify(audio.stems[1].start),'Both selected MP3 stems decode and loop on the same Web Audio clock at native speed');
 await p.locator('[data-action=record]').click();await p.waitForFunction(()=>window.__bgmContexts[0].state==='suspended');check(await p.locator('[data-corner-sound]').getAttribute('aria-pressed')==='true','Real MediaRecorder start pauses BGM while preserving the enabled sound intent');
 await p.locator('[data-action=record]').click();await p.waitForFunction(()=>window.__bgmContexts[0].state==='running');check(true,'Stopping and saving the recording resumes the synchronized BGM');await p.locator('[data-corner-sound]').click();
 await route('knowledge');
 for(const [width,height]of [[511,764],[390,844],[320,740]]){
  await p.setViewportSize({width,height});await p.locator('.shell-brand').click();check(await p.locator('.shell.nav-open').count()===1&&await p.locator('.shell-brand .bf-brand__words').isVisible(),'Collapsed mobile logo expands full navigation at '+width);
  assert.equal(await p.locator('.mobile-nav-toggle').count(),0);await shot(`navigation-${width}.png`);await p.mouse.click(width-12,200);assert.equal(await p.locator('.shell.nav-open').count(),0);
  const dimensions=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,header:document.querySelector('.topbar').getBoundingClientRect().height}));assert.ok(dimensions.scroll<=width+1);evidence.layouts.push({width,height,...dimensions});
 }
 await p.locator('.shell-brand').click();await p.route('https://www.brothforge.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Verified brand destination</title>'}));await p.locator('.shell-brand').click();await p.waitForURL('https://www.brothforge.com/#relic');check(true,'A second click on the expanded full brand navigates to the original Brothforge destination');
 await route('');for(const [width,height]of [[511,764],[390,844],[320,740],[1403,764]]){await p.setViewportSize({width,height});await shot(`portal-${width}.png`);}
 // Fresh touch context validates real pointer events rather than synthetic DOM dispatch.
 const touch=await b.newContext({viewport:{width:511,height:764},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),t=await touch.newPage();await t.goto(new URL('core.js', baseUrl).href);
 await t.evaluate(async s=>{const db=await import('./db.js');await db.loadState();await db.saveState(s);},fixture.formal);await t.goto(new URL('#/knowledge', baseUrl).href);await t.locator('html:not([data-starting])').waitFor();await t.locator('[data-tab=contentCards]').click();
 const source=t.locator('[data-sort-tag][data-scope=library]').filter({hasText:/^开场$/}),dest=t.locator('[data-sort-tag][data-scope=library]').filter({hasText:/^经历$/});await dest.scrollIntoViewIfNeeded();await source.scrollIntoViewIfNeeded();const a=await source.boundingBox(),z=await dest.boundingBox(),cdp=await touch.newCDPSession(t);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});await t.waitForTimeout(420);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:z.x+2,y:z.y+z.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await t.waitForFunction(()=>document.querySelector('.content-card-title')?.textContent==='开场乙');check(true,'Actual touch long-press and drag reorder tags and cards on a portrait viewport');await t.screenshot({path:file('touch-tags.png')});await touch.close();
 await route('knowledge');await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await ready();await c.setOffline(true);await p.reload();await ready();await p.locator('[data-tab=contentCards]').click();
 check((await p.locator('.content-card-title').allTextContents())[0]==='收尾丙','Offline reload preserves tag sorting and loads the new modules');await p.locator('[data-corner-sound]').click();await p.waitForFunction(()=>{const c=window.__bgmContexts[0];return c?.state==='running'&&c.__sources.length===2&&c.currentTime>c.__sources[0].__starts[0][0]+0.1;});check(true,'Both selected MP3 stems are cached and playable offline');await p.locator('[data-corner-sound]').click();
 check(evidence.errors.length===0,'No uncaught browser errors');evidence.result='PASS';
}catch(error){evidence.result='FAIL';evidence.failure=error.stack;await p.screenshot({path:file('failure.png')}).catch(()=>{});throw error;}
finally{await writeFile(new URL('VERIFICATION.json',out),JSON.stringify(evidence,null,2));await b.close();console.log(JSON.stringify({result:evidence.result,checks:evidence.checks,errors:evidence.errors,failure:evidence.failure}));}
