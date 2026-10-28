import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const b=await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio']});
const c=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block',storageState:{cookies:[],origins:[]}});
const p=await c.newPage(),checks=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
const out = await testOutput(import.meta.url);await mkdir(out,{recursive:true});const report={date:new Date().toISOString(),checks,errors};
const check=(value,label)=>{assert.ok(value,label);checks.push(label)};
const load=async workspace=>p.evaluate(async w=>(await import('./db.js')).loadState({workspace:w}),workspace);
try {
 await p.goto(new URL('core.js', baseUrl).href);assert.equal(await p.evaluate(async()=>(await indexedDB.databases()).length),0);
 await p.goto(new URL('#/', baseUrl).href);await p.locator('html:not([data-starting])').waitFor();await p.locator('.entry-cta[href="#/dashboard"]').click();
 await p.locator('.side-utilities a[href="#/settings"]').click();await p.locator('.settings-panel[data-section=ai]>summary').click();
 const ai=p.locator('.settings-panel[data-section=ai]'),backup=p.locator('.settings-panel[data-section=backup]');
 check(await ai.locator('[download]').count()===2&&await ai.locator('[data-action=import-unified]').count()===1,'AI collaboration fold owns the protocol, template and JSON import');
 check((await ai.locator('a[download*="V1.5"]').getAttribute('href'))?.endsWith('/NextRound_AI整理与一键导入通用模板_V1.5.md'),'Settings downloads the current V1.5 template');
 check(await backup.locator('[download],[data-action=import-unified]').count()===0&&await backup.locator('[data-action=export],[data-action=import],[data-action=import-replace]').count()===3,'Backup fold retains backup actions and no duplicate AI actions');
 await p.locator('.settings-grid').screenshot({path:artifactPath('settings-ai-mobile.png', out)});
 if(!await p.locator('body.theme-dark').count())await p.locator('.side-utilities [data-action=toggle-theme]').click();
 await p.setViewportSize({width:1440,height:900});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const summaryBounds=await p.locator('.settings-panel>summary').evaluateAll(nodes=>nodes.map(n=>({x:Math.round(n.getBoundingClientRect().x),right:n.getBoundingClientRect().right,height:n.getBoundingClientRect().height,panelHeight:n.parentElement.getBoundingClientRect().height,closed:!n.parentElement.open})));
 for(const x of new Set(summaryBounds.map(n=>n.x))){const right=summaryBounds.filter(n=>n.x===x).map(n=>n.right);assert.ok(Math.max(...right)-Math.min(...right)<1)}check(true,'Settings summaries align to a shared right edge in each desktop column');check(summaryBounds.filter(n=>n.closed).every(n=>n.panelHeight<=n.height+2),'Collapsed settings rows retain their summary height beside the expanded AI panel');
 await p.locator('.settings-grid').screenshot({path:artifactPath('settings-ai-desktop.png', out)});await p.locator('.side-utilities [data-action=toggle-theme]').click();
 const lightBounds=await p.locator('.settings-panel>summary').evaluateAll(nodes=>nodes.map(n=>({x:Math.round(n.getBoundingClientRect().x),right:n.getBoundingClientRect().right,height:n.getBoundingClientRect().height,panelHeight:n.parentElement.getBoundingClientRect().height,closed:!n.parentElement.open})));
 for(const x of new Set(lightBounds.map(n=>n.x))){const right=lightBounds.filter(n=>n.x===x).map(n=>n.right);assert.ok(Math.max(...right)-Math.min(...right)<1)}check(lightBounds.filter(n=>n.closed).every(n=>n.panelHeight<=n.height+2),'Light theme overrides preserve aligned settings rows and collapsed heights');
 await p.locator('.settings-grid').screenshot({path:artifactPath('settings-ai-light-desktop.png', out)});await p.locator('.side-utilities [data-action=toggle-theme]').click();await p.setViewportSize({width:390,height:844});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const bytes=await p.request.get(new URL('assets/', baseUrl).href+encodeURIComponent('通用AI面试训练协议_公开版_V1.0.md'));assert.equal(bytes.status(),200);assert.deepEqual(await bytes.body(),await readFile(new URL('../assets/通用AI面试训练协议_公开版_V1.0.md',import.meta.url)));check(true,'The served protocol is byte-identical to the supplied source');
 await backup.locator('summary').first().click();
 check(await backup.locator('.section-heading [data-action=trash]').count()===0&&await backup.locator('.settings-storage-actions>[data-action=trash]').count()===1,'Trash occupies its own row below the paired device tools');
 report.storageLayouts=[];
 for(const theme of ['light','dark']){
  if(!await p.locator('body.theme-'+theme).count())await p.locator('.side-utilities [data-action=toggle-theme]').click();
  for(const [width,height]of [[320,844],[390,844],[505,764],[507,844],[1440,900]]){
   await p.setViewportSize({width,height});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const geometry=await backup.locator('.settings-backup-panel').evaluate(panel=>{
    const box=selector=>{const node=panel.querySelector(selector),r=node.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height,overflow:node.scrollWidth>node.clientWidth+1}};
    return {backup:box('.settings-backup-actions'),device:box('.settings-device-row'),persistent:box('[data-action=persistent]'),install:box('[data-action=install]'),trash:box('[data-action=trash]'),help:[...panel.querySelectorAll('.settings-device-row .help-trigger')].map(node=>{const r=node.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height,name:node.getAttribute('aria-label')}}),pageOverflow:document.documentElement.scrollWidth>innerWidth};
   });
   report.storageLayouts.push({theme,width,...geometry});
   const {backup:upper,persistent,install,trash,device}=geometry;
   check(Math.abs(persistent.y-install.y)<1&&Math.abs(persistent.height-install.height)<1&&Math.abs(persistent.width-install.width)<1,theme+' '+width+'px: persistence and install share one equal-sized row');
   check(Math.abs(persistent.x-upper.x)<1&&Math.abs(install.right-upper.right)<1&&Math.abs(device.width-upper.width)<1,theme+' '+width+'px: paired device tools align with both edges of the backup action group');
   check(trash.y>=persistent.bottom+10&&Math.abs(trash.x-upper.x)<1&&Math.abs(trash.right-upper.right)<1,theme+' '+width+'px: trash has an independent full-width row with clear spacing');
   check(persistent.height>=44&&install.height>=44&&trash.height>=44&&!geometry.pageOverflow&&!persistent.overflow&&!install.overflow,theme+' '+width+'px: controls remain readable touch targets without horizontal overflow');
   check(geometry.help.length===2&&geometry.help.every((h,i)=>h.name&&h.width>=24&&h.height>=24&&h.right<=[persistent,install][i].right),theme+' '+width+'px: both named help controls remain within their operation');
   await backup.screenshot({path:artifactPath('backup-tools-'+theme+'-'+width+'.png',out)});
  }
 }
 await backup.locator('.settings-device-row .help-trigger').first().click();check(await p.locator('.help-popover:visible').count()===1,'The repositioned persistence help still opens its visible explanation');await p.keyboard.press('Escape');
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await p.locator('[data-action=trash]').click();check(await p.locator('.trash-title-row [data-action=empty-trash] svg.led-icon').count()===1&&await p.locator('#trash-dialog').getByText('一键清空',{exact:true}).count()===0,'Trash has one labelled LED clear icon beside its title');await p.locator('.trash-header').screenshot({path:artifactPath('trash-header-mobile.png', out)});await p.locator('[data-action=close-trash]').click();
 await p.locator('.sidebar>.nav a[href="#/knowledge"]').click();await p.locator('[data-action=new-question]').first().click();
 await p.locator('#entity-form [name=text]').fill('隔离正式档案中应保留的问题');await p.locator('#entity-form [name=difficulty]').selectOption('人间');await p.locator('#entity-form [name=answer]').fill('保留的原始回答');await p.locator('#entity-form button[type=submit]').click();await p.locator('#editor-dialog').waitFor({state:'detached'});
 const formalBefore=await load('formal');assert.equal(formalBefore.questions.length,1);await p.locator('.side-utilities a[href="#/"]').click();await p.locator('[data-action=demo]').click();
 await p.waitForFunction(async()=>(await(await import('./db.js')).loadState({workspace:'demo'})).questions.length>0);
 const demoBefore=await load('demo');check(demoBefore.questions.length>0,'Only this disposable context uses the normal built-in demo fixture');
 await p.locator('.side-utilities a[href="#/settings"]').click();await p.locator('.settings-panel[data-section=backup]>summary').click();
 p.once('dialog',d=>d.dismiss());await p.locator('[data-action=clear-current-archive]').click();assert.deepEqual(await load('demo'),demoBefore);check(true,'Cancelling current-archive clearing changes no demo data');
 let confirmation='';p.once('dialog',async d=>{confirmation=d.message();await d.accept();});await p.locator('[data-action=clear-current-archive]').click();assert.match(confirmation,/演示空间/);assert.match(confirmation,/另一空间不受影响/);
 await p.waitForFunction(()=>!document.querySelector('#app').inert);
 const cleared=await load('demo');check(['companies','jobs','questions','scripts','contentCards','interviews','sessions','attachments','trash'].every(key=>cleared[key].length===0),'Confirmation clears only the selected demo archive');
 assert.deepEqual(await load('formal'),formalBefore);check(true,'Formal state remains byte-for-byte equivalent after clearing the separate demo space');
 assert.deepEqual(errors,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error;}finally{await writeFile(new URL('VERIFICATION.json',out),JSON.stringify(report,null,2));await b.close();console.log(JSON.stringify(report,null,2));}
