import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio']});
const context = await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
const page = await context.newPage();
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
const baseline=process.argv.includes('--expect-vulnerable');
const checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label)};
const ready=async()=>{await page.locator('html:not([data-starting])').waitFor();await page.locator('.shell').waitFor()};
const route=async value=>{await page.evaluate(value=>location.hash='/'+value,value);await page.waitForFunction(value=>location.hash==='#/'+value,value);await page.locator('.shell').waitFor()};
const safe=async label=>{
 check(await page.locator('img[onerror]').count()===0,label+': no injected HTML');
 check(!await page.evaluate(()=>globalThis.__nrSecurity),label+': no executable import content');
};
const byId=(selector,id)=>page.locator(selector).evaluateAll((nodes,id)=>nodes.some(node=>node.dataset.id===id),id);
try {
 await page.goto(new URL('#/settings', baseUrl).href);await ready();
 const fixture=await page.evaluate(async()=>{
  const core=await import('./core.js');const db=await import('./db.js');
  const local=await db.loadState();if(core.COLLECTIONS.some(key=>local[key].length))throw Error('Test context is not empty');
  const state=core.blankState(),make=(id,patch)=>core.touch({id},patch);
  const id=key=>key+',\"><img src=x onerror=globalThis.__nrSecurity=1>';
  const ids=Object.fromEntries(['company','job','question','interview','session','attachment','conflict'].map(key=>[key,id(key)]));
  state.settings.keywords=['沟通'];
  state.settings.dimensions.push({id:id('dimension'),name:'Security fixture dimension',weight:1});
  state.companies=[make(ids.company,{name:'Security fixture company'})];
  state.jobs=[make(ids.job,{companyId:ids.company,title:'Security fixture job',status:'关注',jd:'沟通'})];
  state.questions=[make(ids.question,{text:'Security fixture question',answer:'沟通',difficulty:'人间'})];
  state.interviews=[make(ids.interview,{companyId:ids.company,jobId:ids.job,round:'Security fixture interview',status:'已完成',scheduledAt:new Date().toISOString(),questions:[{text:'Security fixture question',questionId:ids.question}],attachmentIds:[ids.attachment],strengths:'Security fixture feedback'})];
  state.sessions=[make(ids.session,{title:'Security fixture session',duration:60,questionIds:[ids.question],attachmentIds:[ids.attachment],ratingPercent:'<img src=x onerror=globalThis.__nrSecurity=1>'})];
  state.attachments=[make(ids.attachment,{name:'Security fixture.txt',mime:'application/octet-stream',data:'AQIDBA=='})];
  state.conflicts=[{id:ids.conflict,collection:'questions',entityId:ids.question,createdAt:new Date().toISOString(),incoming:make(ids.question,{text:'Security fixture alternative'})}];
  core.validateState(state);
  const blob=db.exportBackup(state,{workspace:'formal'});
  return {ids,backup:await blob.text()};
 });
 page.on('dialog',dialog=>dialog.accept());
 await page.locator('#import-file').evaluate(node=>node.dataset.mode='replace');
 await page.locator('#import-file').setInputFiles({name:'security-fixture.json',mimeType:'application/json',buffer:Buffer.from(fixture.backup)});
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('替换导入完成'));
 if(baseline){await page.waitForFunction(()=>globalThis.__nrSecurity===1);console.log(JSON.stringify({result:'BASELINE_VULNERABLE',boundary:'actual backup file input + settings conflict rendering'}));process.exitCode=0;}
 else {
  await safe('Backup import and conflict settings');
  const ids=fixture.ids;
  await page.locator('.settings-conflicts').evaluate(node=>node.open=true);
  check(await byId('[data-action="resolve-conflict"]',ids.conflict),'Conflict action retains exact imported ID');
  await route('train');await page.locator('#train-company').waitFor();await safe('Training list and untyped rating text');
  check(await byId('[data-action="edit"][data-kind="sessions"]',ids.session),'Session action retains exact imported ID');
  const session=page.locator('[data-action="edit"][data-kind="sessions"]').first();await session.click();
  await page.locator('#entity-form').waitFor();await safe('Session editor question and attachment references');
  check(await byId('[data-action="edit"][data-kind="questions"]',ids.question),'Question reference retains exact imported ID');
  check(await byId('[data-action="download-attachment"]',ids.attachment),'Attachment download retains exact imported ID');
  await page.locator('[data-action="close-editor"]').click();
  await route('companies');await page.locator('.opportunity-card').waitFor();await safe('Job list');
  await page.locator('[data-action="edit"][data-kind="jobs"]').first().click();await page.locator('#entity-form').waitFor();await safe('Imported dimension ID in rating field names');
  check(await page.locator('input[name]').evaluateAll(nodes=>nodes.some(node=>node.name.startsWith('rating-dimension,'))),'Rating field preserves the imported dimension ID');
  await page.locator('[data-action="close-editor"]').click();
  await route('interviews');await safe('Interview list');
  check(await byId('[data-action="edit"][data-kind="interviews"]',ids.interview),'Interview action retains exact imported ID');
  await route('analytics');await safe('Analytics IDs and joined trace references');
  const trace=page.locator('[data-action="trace"]').first();await trace.waitFor();
  check(await trace.evaluate((node,id)=>JSON.parse(node.dataset.ids).includes(id),ids.interview),'Trace transport preserves quotes and commas in IDs');
  await trace.click();await page.locator('#trace-dialog').waitFor();await safe('Interview trace modal');
  check(await byId('#trace-dialog [data-action="trace-open"]',ids.interview),'Trace finds the exact original imported record');
  await page.locator('[data-action="close-trace"]').click();
  await page.locator('[data-action="trace-sessions"]').click();await page.locator('#trace-dialog').waitFor();await safe('Session trace modal');
  check(await byId('#trace-dialog [data-action="trace-open"]',ids.session),'Session trace retains imported ID');
  await page.locator('[data-action="close-trace"]').click();
  await route('search');await page.locator('#global-search').fill('Security fixture');
  await page.waitForFunction(()=>document.querySelectorAll('[data-action="edit"]').length>=5);await safe('Global search all record kinds');
  for(const key of ['company','job','question','interview','session'])check(await byId('[data-action="edit"]',ids[key]),'Global search retains '+key+' ID');
  await page.reload();await ready();await safe('Persisted backup after reload');
  const persisted=await page.evaluate(async()=>{const db=await import('./db.js');return{formal:await db.loadState(),demo:await db.loadState({workspace:'demo'})}});
  check(persisted.formal.sessions[0].id===ids.session&&persisted.demo.sessions.length===0,'Exact IDs persist only in formal test workspace');
  check(errors.length===0,'No browser runtime errors');
  console.log(JSON.stringify({result:'PASS',checks:checks.length,details:checks,errors}));
 }
} finally {await context.close();await browser.close()}
