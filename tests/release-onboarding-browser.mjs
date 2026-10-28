import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, baseUrl, testOutput, artifactPath } from './browser-support.mjs';
const exampleBytes=await readFile(new URL('../examples/interview-prep.json',import.meta.url));
const example=JSON.parse(exampleBytes);
const out=await testOutput(import.meta.url), report={date:new Date().toISOString(),checks:[],errors:[],fixtures:'examples/interview-prep.json',schema:example.import_schema_version};
const browser=await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio']});
const contexts=[];
const check=(value,label)=>{assert.ok(value,label);report.checks.push(label)};
const ready=page=>page.locator('html:not([data-starting])').waitFor();
const stored=page=>page.evaluate(async()=> (await import(new URL('db.js',location.href).href)).loadState({workspace:'formal'}));
const waitStored=async(page,predicate)=>{for(let i=0;i<80;i++){const state=await stored(page);if(predicate(state))return state;await page.waitForTimeout(50)}throw new Error('Expected persisted onboarding state did not arrive')};
async function fresh(width=390,theme='dark'){
 const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'});contexts.push(context);
 await context.addInitScript(theme=>{if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('nextround-theme',theme)},theme);
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(new URL('core.js',baseUrl).href);
 check(await page.evaluate(async()=>(await indexedDB.databases()).length)===0,'A new browser context contains no existing user databases');
 return{context,page};
}
async function chooseJson(page,bytes,name='interview-prep.json',selector='.knowledge-page [data-action=import-unified]'){
 const choosing=page.waitForEvent('filechooser');await page.locator(selector).first().click();
 const chooser=await choosing;await chooser.setFiles({name,mimeType:'application/json',buffer:bytes});
}
async function confirmJson(page,bytes,name){
 await chooseJson(page,bytes,name);await page.locator('#unified-import-dialog').waitFor();
 check(!await page.locator('[data-action=confirm-unified-import]').isDisabled(),'A valid selected file has an enabled explicit confirmation');
 await page.locator('[data-action=confirm-unified-import]').click();await page.locator('#unified-import-dialog').waitFor({state:'detached'});
 await page.waitForFunction(()=>!document.querySelector('#app').inert);
}
try{
 let {context,page}=await fresh();
 await page.goto(baseUrl);await ready(page);await page.locator('.entry-cta[href="#/dashboard"]').click();await page.locator('.sidebar>.nav a[href="#/knowledge"]').click();
 const guide=page.locator('[data-knowledge-guide]');
 check(await guide.evaluate(node=>node.open)&&await page.locator('[data-kind=questions].row-title').count()===0,'First-use formal knowledge bank is empty and shows the onboarding guide');
 await page.locator('.knowledge-guide-step').nth(1).locator('summary').click();
 const templateLink=page.locator('.knowledge-guide-step').nth(1).locator('a[download]');
 check(await templateLink.isVisible()&&(await templateLink.getAttribute('href')).includes('V1.5'),'The new user can find the current AI organization template from the guide');
 const templateResponse=await page.request.get(new URL(await templateLink.getAttribute('href'),baseUrl).href);
 check(templateResponse.status()===200,'The guide template link resolves to a downloadable bundled resource');
 await confirmJson(page,exampleBytes);
 const imported=await waitStored(page,state=>state.questions.length===3);
 check(imported.questions.every(question=>question.answer.includes('完全虚构')),'The actual public example imports three fully fictional answers');
 check(new Set(imported.questions.map(question=>question.difficulty)).size===3,'The public example retains 天堂 / 人间 / 地狱 as independent fields');
 const categories=await page.locator('#knowledge-category option').allTextContents();
 check(example.questions.every(question=>categories.includes(question.category)),'All example categories appear in the real knowledge filter');
 await confirmJson(page,exampleBytes);
 assert.deepEqual(await stored(page),imported);check(true,'Repeating the actual example neither duplicates records nor clears an existing archive');
 const additive=structuredClone(example);additive.questions=[{...additive.questions[1],id:'example-paperboat-followup',question:'【新增虚构练习】如何核对纸舟读书角的书目标签？'}];
 await confirmJson(page,Buffer.from(JSON.stringify(additive)),'interview-prep-additive.json');
 const enlarged=await waitStored(page,state=>state.questions.length===4);
 check(imported.questions.every(question=>JSON.stringify(enlarged.questions.find(record=>record.id===question.id))===JSON.stringify(question)),'An additional stable-ID question is appended while empty modules preserve all original records');
 const malformed=[
  ['invalid-json.json',Buffer.from('{ invalid json'),/有效的 JSON|JSON/],
  ['missing-module.json',Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(example).filter(([key])=>key!=='questions')))),/questions.*数组/],
  ['unknown-schema.json',Buffer.from(JSON.stringify({...example,import_schema_version:'next-round-unified-99.0'})),/import_schema_version|不支持/],
 ];
 for(const[name,bytes,pattern]of malformed){
  const before=await stored(page);await page.evaluate(()=>document.querySelector('#toast').textContent='');await chooseJson(page,bytes,name);
  await page.waitForFunction(()=>!document.querySelector('#app').inert&&!!document.querySelector('#toast')?.textContent);
  check(pattern.test(await page.locator('#toast').textContent())&&await page.locator('#unified-import-dialog').count()===0,name+': understandable rejection occurs before a confirmation or write');
  assert.deepEqual(await stored(page),before);check(true,name+': persisted archive remains unchanged');
 }
 const missingQuestion=structuredClone(example);delete missingQuestion.questions[0].question;
 const beforeInvalidRow=await stored(page);await chooseJson(page,Buffer.from(JSON.stringify(missingQuestion)),'missing-question-field.json');await page.locator('#unified-import-dialog').waitFor();
 check(await page.locator('[data-action=confirm-unified-import]').isDisabled()&&/question/.test(await page.locator('#unified-import-dialog').textContent()),'A missing required question field is identified in preview and disables confirmation');
 assert.deepEqual(await stored(page),beforeInvalidRow);await page.locator('[data-action=close-unified-import]').first().click();check(true,'An invalid preview performs no persistence before cancellation');
 await page.locator('#knowledge-search').fill('整理任务');
 check(await page.locator('.row-title[data-kind=questions]').count()===1,'Search finds the example question in the actual knowledge list');
 await page.locator('.row-title[data-kind=questions]').first().click();await page.locator('#editor-dialog').waitFor();
 const editedAnswer=example.questions[0].answer+'\n\n【虚构练习编辑】下一次表达先交代目标。';
 await page.locator('#entity-form [name=answer]').fill(editedAnswer);await page.locator('#entity-form button[type=submit]').click();await page.locator('#editor-dialog').waitFor({state:'detached'});
 await waitStored(page,state=>state.questions.find(question=>question.id===example.questions[0].id)?.answer===editedAnswer);check(true,'Editing the sample answer persists under its original stable ID');
 await page.locator('.sidebar>.nav a[href="#/train"]').click();await page.locator('.training-layout').waitFor();
 const config=page.locator('.train-config');if(!await config.evaluate(node=>node.open))await config.locator('summary').click();
 for(const difficulty of ['天堂','人间','地狱']){
  await page.locator('#train-difficulty').selectOption(difficulty);await page.locator('[data-action=draw-question]').click();
  const question=(await page.locator('.training-question').textContent()).trim();
  check(enlarged.questions.some(record=>record.difficulty===difficulty&&record.text===question),'Training draws a real '+difficulty+' question from the imported archive');
 }
 await page.locator('[data-action=timer-toggle]').click();await page.waitForTimeout(1100);await page.locator('[data-action=finish-training]').click();await page.locator('#editor-dialog').waitFor();
 await page.locator('#entity-form [name=ratingPercent]').fill('78');await page.locator('#entity-form [name=notes]').fill('【虚构练习】先说明目标，再说明判断依据。');await page.locator('#entity-form button[type=submit]').click();await page.locator('#editor-dialog').waitFor({state:'detached'});
 const trained=await waitStored(page,state=>state.sessions.length===1&&state.sessions[0].ratingPercent===78);
 check(trained.sessions[0].questionIds.includes(example.questions[2].id),'Finishing practice saves the drawn question and manual self-rating without inventing mastery or SRS');
 await page.reload();await ready(page);assert.deepEqual(await stored(page),trained);check(true,'Refreshing restores the edited question and completed practice record');
 await page.close();page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));await page.goto(new URL('#/knowledge',baseUrl).href);await ready(page);
 assert.deepEqual(await stored(page),trained);check(true,'Closing and reopening the app tab within the same browser origin retains the formal archive');
 await page.locator('.side-utilities [data-action=toggle-theme]').click();
 check(await page.locator('body.theme-light').count()===1&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'The real sample remains readable in the light 390px knowledge view');
 await page.screenshot({path:artifactPath('example-knowledge-light-390.png',out)});
 await page.locator('.side-utilities a[href="#/settings"]').click();await page.locator('.settings-panel[data-section=backup]>summary').click();
 const downloading=page.waitForEvent('download');await page.locator('[data-action=export]').click();const download=await downloading;
 const backupBytes=await readFile(await download.path()),backup=JSON.parse(backupBytes);
 check(backup.format==='NextRound'&&backup.workspace==='formal'&&backup.state.questions.length===4&&backup.state.sessions[0].ratingPercent===78,'Normal backup download includes the edited fixture and manual self-rating');
 const second=await fresh(1440,'light');await second.page.goto(new URL('#/settings',baseUrl).href);await ready(second.page);await second.page.locator('.settings-panel[data-section=backup]>summary').click();
 let confirmation='';second.page.once('dialog',async dialog=>{confirmation=dialog.message();await dialog.accept()});
 await chooseJson(second.page,backupBytes,'downloaded-formal-backup.json','[data-action=import-replace]');
 const restored=await waitStored(second.page,state=>state.questions.length===4&&state.sessions.length===1);
 check(/替换.*正式档案/.test(confirmation),'Restoring the downloaded complete backup explicitly confirms its target and replacement effect');
 assert.deepEqual(restored,backup.state);check(true,'The actual downloaded backup restores byte-equivalent domain content in another isolated browser context');
 check(report.errors.length===0,'No browser runtime errors in the release onboarding path');report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error}
finally{for(const context of contexts.reverse())await context.close();await browser.close();await writeFile(new URL('VERIFICATION.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks.length,errors:report.errors,failure:report.failure}));}
