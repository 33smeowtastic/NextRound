import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = await testOutput(import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'], executablePath: process.env.NEXTROUND_BROWSER });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await context.newPage();
const evidence = { date: new Date().toISOString(), checks: [], viewports: [], errors: [] };
p.on('pageerror', e => evidence.errors.push(e.message));
const check = (value, name) => { assert.ok(value, name); evidence.checks.push(name); };
const expandBackup = async () => { const panel=p.locator('.settings-panel[data-section=backup]'); if(!await panel.evaluate(node=>node.open))await panel.locator('summary').first().click(); };
const route = async name => { await p.goto(new URL('#/', baseUrl).href + name); await p.locator('html:not([data-starting])').waitFor(); if(name==='settings')await expandBackup(); };
const stored = () => p.evaluate(() => new Promise((resolve, reject) => {
  const r = indexedDB.open('nextround-local', 1);
  r.onsuccess = () => { const db=r.result,t=db.transaction('state'),q=t.objectStore('state').get('current'); q.onsuccess=()=>resolve(q.result.state); t.oncomplete=()=>db.close(); t.onerror=()=>reject(t.error); };
  r.onerror=()=>reject(r.error);
}));
const waitStored = async predicate => { for(let n=0;n<50;n++){const s=await stored();if(predicate(s))return s;await p.waitForTimeout(50);}throw new Error('Stored-state timeout'); };
const upload = async (state, mode='merge', workspace='formal') => {
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.locator(mode==='replace'?'[data-action=import-replace]':'[data-action=import]').click()]);
  await chooser.setFiles({name:'test-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NextRound',workspace,state}))});
};
try {
  // This script uses only fresh browser contexts; never the user's browser profile.
  await p.goto(new URL('core.js', baseUrl).href);
  const workspaceScenario = await readFile(new URL('./workspaces-browser.js',import.meta.url),'utf8');
  evidence.workspaces = await (new Function('return ('+workspaceScenario+')'))()(p);
  check(evidence.workspaces.result==='PASS','IndexedDB migration, old-package purge, space isolation, queued and cross-window writes');
  await route('');
  for(const [width,height] of [[1842,854],[1440,900],[900,650],[390,844],[320,740]]) {
    await p.setViewportSize({width,height});
    await p.evaluate(()=>document.fonts.ready);
    await p.locator('.wordmark-art').evaluate(img=>img.decode());
    const geometry=await p.evaluate(()=>{
      const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};
      return {wordmark:rect('.wordmark'),title:rect('.poster-name>span'),caption:rect('.poster-caption'),mask:getComputedStyle(document.querySelector('.poster-caption'),'::before').backgroundImage,bodyWidth:document.documentElement.scrollWidth,stars:[...document.querySelectorAll('.poster-star path')].every(p=>p.getAttribute('d').includes('C21.8'))};
    });
    assert.ok(geometry.title.x > geometry.wordmark.x + 10, 'Chinese title remains inset');
    assert.ok(geometry.title.right<=width+1,'Chinese title fits viewport');
    assert.ok(geometry.mask.includes('radial-gradient'),'feathered caption mask exists');
    assert.ok(geometry.stars,'all decorative stars have four rays');
    assert.ok(geometry.bodyWidth<=width+1,'no horizontal document overflow');
    await p.screenshot({path:artifactPath(`home-${width}.png`, out),fullPage:true});
    evidence.viewports.push({width,height,...geometry});
  }
  check(true,'Five desktop/intermediate/mobile homepage layouts, feathered mask, inset Chinese title and cross stars');
  await p.setViewportSize({width:1440,height:900});
  await p.goto(new URL('core.js', baseUrl).href);
  const original = await p.evaluate(async()=>{
    const c=await import('./core.js'),db=await import('./db.js');
    await db.loadState();const s=c.blankState();
    const row=(id,fields)=>c.touch({id},fields);
    s.companies=[row('company-real',{name:'正式个人单位'})];
    s.jobs=[row('job-real',{companyId:'company-real',title:'个人岗位',status:'关注'})];
    s.questions=[row('question-real',{text:'个人问题'})];
    s.attachments=[row('audio-real',{name:'recording.wav',mime:'audio/wav',data:'data:audio/wav;base64,AQIDBA=='})];
    s.interviews=[row('interview-real',{companyId:'company-real',jobId:'job-real',status:'已完成',attachmentIds:['audio-real'],questions:[{text:'问题',questionId:'question-real',answer:'原始回答'}]})];
    s.sessions=[row('session-real',{companyId:'company-real',jobId:'job-real',questionIds:['question-real'],attachmentIds:['audio-real'],duration:60})];
    s.conflicts=[{id:'conflict-company',collection:'companies',entityId:'company-real',createdAt:new Date().toISOString(),incoming:{...s.companies[0],name:'旧导入版本'}}];
    await db.saveState(s);
    await db.loadState({workspace:'demo'});const demo=c.blankState();demo.settings.demo=true;demo.companies=[row('demo-sentinel',{name:'演示哨兵'})];await db.saveState(demo,{workspace:'demo'});
    return s;
  });
  await route('companies');
  await p.locator('[data-action=edit][data-kind=companies]').first().click();
  p.once('dialog',d=>d.accept());await p.locator('[data-action=trash-record]').click();
  const removed=await waitStored(s=>s.trash.length===1);
  check(removed.companies.length===0&&removed.jobs.length===0&&removed.interviews.length===0&&removed.sessions.length===0&&removed.attachments.length===0&&removed.conflicts.length===0&&removed.trash[0].conflicts.length===1,'Editor deletion moves dependent records and complete audio into trash');
  await route('settings');
  await p.getByRole('button',{name:'持久存储说明',exact:true}).click();check((await p.locator('#persistence-help').innerText()).includes('不是云备份'),'Settings explain persistence and backup limits');await p.keyboard.press('Escape');
  await p.locator('[data-action=trash]').click();
  await p.screenshot({path:artifactPath('trash-desktop.png', out)});
  await p.locator('[data-action=restore-trash]').click();
  const restored=await waitStored(s=>s.trash.length===0&&s.companies.length===1);
  check(JSON.stringify(restored.attachments)===JSON.stringify(original.attachments)&&restored.sessions.length===1&&restored.conflicts.length===1,'Restore preserves original recording bytes and related records');
  await p.locator('[data-action=close-trash]').click();
  await route('companies');await p.locator('[data-action=edit][data-kind=companies]').first().click();
  p.once('dialog',d=>d.accept());await p.locator('[data-action=trash-record]').click();await waitStored(s=>s.trash.length===1);
  await route('settings');await p.locator('[data-action=trash]').click();
  const beforeDelete=JSON.stringify(await stored());
  p.once('dialog',d=>d.dismiss());await p.locator('[data-action=delete-trash]').click();
  assert.equal(JSON.stringify(await stored()),beforeDelete);
  p.once('dialog',d=>d.accept());await p.locator('[data-action=delete-trash]').click();
  const purged=await waitStored(s=>s.trash.length===0);
  check(purged.companies.length===0&&purged.attachments.length===0&&purged.conflicts.length===0,'Permanent delete cancellation preserves data; confirmation purges trash records and audio');
  await p.locator('[data-action=close-trash]').click();
  // A second independent deleted record exercises clear-all and cancellation.
  await route('knowledge');await p.locator('[data-action=edit][data-kind=questions]').first().click();
  p.once('dialog',d=>d.accept());await p.locator('[data-action=trash-record]').click();await waitStored(s=>s.trash.length===1);
  await route('settings');await p.locator('[data-action=trash]').click();
  const beforeClear=JSON.stringify(await stored());
  p.once('dialog',d=>d.dismiss());await p.locator('[data-action=empty-trash]').click();
  assert.equal(JSON.stringify(await stored()),beforeClear);
  p.once('dialog',d=>d.accept());await p.locator('[data-action=empty-trash]').click();await waitStored(s=>s.trash.length===0);
  check(true,'Clear-all cancellation preserves trash; confirmation empties it');
  await p.locator('[data-action=close-trash]').click();
  await upload(original);await waitStored(s=>s.companies.length===1);
  const incremental=structuredClone(original);incremental.companies[0].name='导入差异单位';
  await upload(incremental);const merged=await waitStored(s=>s.conflicts.length>original.conflicts.length);
  check(merged.companies[0].name==='正式个人单位','Incremental import preserves local record and stores conflicting incoming version');
  // Give replace a nonempty trash, old audio, old settings, and conflicts to overwrite.
  await route('knowledge');await p.locator('[data-action=edit][data-kind=questions]').first().click();
  // Referenced knowledge must not disappear, even when requested through the editor.
  await p.locator('[data-action=trash-record]').click();
  check((await p.locator('#toast').innerText()).includes('引用'),'Referenced question deletion is rejected without data loss');
  await p.locator('[data-action=close-editor]').click();
  await route('companies');await p.locator('[data-action=edit][data-kind=companies]').first().click();
  p.once('dialog',d=>d.accept());await p.locator('[data-action=trash-record]').click();await waitStored(s=>s.trash.length===1);
  await route('settings');
  const replacement=structuredClone(original);for(const key of ['companies','jobs','questions','scripts','interviews','sessions','attachments'])replacement[key]=[];
  replacement.companies=[{...original.companies[0],id:'replacement-company',name:'替换后的单位'}];replacement.settings.keywords=['替换设置'];replacement.trash=[];replacement.conflicts=[];
  const beforeReplace=JSON.stringify(await stored());let message='';
  p.once('dialog',async d=>{message=d.message();await d.dismiss();});await upload(replacement,'replace');
  await p.waitForFunction(()=>!document.querySelector('#app').inert);
  check(message.includes('正式档案')&&message.includes('无法撤销')&&JSON.stringify(await stored())===beforeReplace,'Replacement dialog names target and irreversible effect; cancel performs no write');
  p.once('dialog',d=>d.accept());await upload(replacement,'replace');
  const replaced=await waitStored(s=>s.companies[0]?.id==='replacement-company');
  assert.deepEqual(replaced,replacement);check(true,'Confirmed replacement exactly replaces records, attachments, settings, conflicts and trash');
  await upload(original,'replace','demo');await p.waitForFunction(()=>!document.querySelector('#app').inert);
  check((await p.locator('#toast').innerText()).includes('不能导入正式档案')&&JSON.stringify(await stored())===JSON.stringify(replacement),'Cross-workspace replacement is rejected before confirmation and write');
  await p.screenshot({path:artifactPath('settings-desktop.png', out),fullPage:true});
  await p.setViewportSize({width:390,height:844});await route('settings');await p.locator('[data-action=trash]').click();
  await p.screenshot({path:artifactPath('trash-mobile.png', out)});
  check(await p.locator('#trash-dialog').evaluate(e=>e.getBoundingClientRect().right<=innerWidth),'Trash dialog fits mobile viewport');
  await p.locator('[data-action=close-trash]').click();
  await p.goto(new URL('?space=demo#/settings', baseUrl).href);await p.locator('html:not([data-starting])').waitFor();
  check((await p.locator('main').innerText()).includes('演示空间'),'Independent demo workspace remains selectable');
  check(await p.evaluate(async()=>{const db=await import('./db.js');return (await db.loadState({workspace:'demo'})).companies[0].name==='演示哨兵';}),'Formal replacement leaves demo database unchanged');
  await p.goto(new URL('#/settings', baseUrl).href);await p.locator('html:not([data-starting])').waitFor();await expandBackup();
  await p.evaluate(async()=>{const r=await navigator.serviceWorker.ready;if(r.active.state!=='activated')await new Promise(resolve=>r.active.addEventListener('statechange',resolve,{once:true}));});
  await p.reload();await p.locator('html:not([data-starting])').waitFor();
  await context.setOffline(true);await p.reload();await p.locator('html:not([data-starting])').waitFor();await expandBackup();await p.locator('[data-action=trash]').waitFor();
  check((await stored()).companies[0].id==='replacement-company','Offline refresh loads new trash module and persists replacement data');
  check(evidence.errors.length===0,'No uncaught browser errors');
  evidence.result='PASS';
} catch(error) { evidence.result='FAIL';evidence.failure=error.stack;throw error; }
finally { await writeFile(new URL('VERIFICATION.json',out),JSON.stringify(evidence,null,2));await browser.close();console.log(JSON.stringify({result:evidence.result,checks:evidence.checks,failure:evidence.failure,errors:evidence.errors})); }
