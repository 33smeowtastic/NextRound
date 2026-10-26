async (page, baseUrl = new URL("./", page.url()).href) => {
  const browser = page.context().browser();
  const contexts = [];
  const check = (value, label) => {if (!value) throw new Error(`FAIL: ${label}`); return label;};
  const evidence = {date: new Date().toISOString(), browser: browser.version(), checks: []};
  const create = async () => {const context = await browser.newContext(); contexts.push(context);const p = await context.newPage();await p.goto(new URL('core.js', baseUrl).href);return p;};
  try {
    const first = await create();
    const initial = await first.evaluate(async () => {
      window.db = await import('./db.js'); window.core = await import('./core.js');
      window.formal = await db.loadState(); window.demo = await db.loadState({workspace:'demo'});
      formal.companies.push(core.touch({id:'formal-company'},{name:'正式私有公司'}));
      demo.settings.demo = true; demo.companies.push(core.touch({id:'demo-company-1'},{name:'演示专用公司'}));
      const versions = await Promise.all([db.saveState(formal), db.saveState(demo,{workspace:'demo'})]);
      return {versions:versions.map(v=>({workspace:v.workspace,version:v.version})),formal:formal.companies[0].name,demo:demo.companies[0].name};
    });
    check(initial.versions[0].version === 1 && initial.versions[1].version === 1,'independent version 1 writes');
    await first.reload();
    const refreshed = await first.evaluate(async()=>{
      window.db = await import('./db.js'); window.core = await import('./core.js');
      window.formal = await db.loadState(); window.demo = await db.loadState({workspace:'demo'});
      return {formal:formal.companies.map(x=>x.name),demo:demo.companies.map(x=>x.name)};
    });
    evidence.checks.push(check(JSON.stringify(refreshed.formal) === '["正式私有公司"]' && JSON.stringify(refreshed.demo) === '["演示专用公司"]','refresh loads only its own IndexedDB workspace'));
    const second = await first.context().newPage(); await second.goto(new URL('core.js', baseUrl).href);
    await second.evaluate(async()=>{window.db=await import('./db.js');window.core=await import('./core.js');window.formal=await db.loadState();window.demo=await db.loadState({workspace:'demo'});});
    const capture = await first.evaluate(async()=>{
      formal.companies[0] = core.touch(formal.companies[0],{name:'正式第二版'});
      const options = {workspace:'formal'};const saving = db.saveState(formal,options);options.workspace='demo';
      await db.loadState({workspace:'demo'});const result=await saving;
      return {workspace:result.workspace,version:result.version};
    });
    const cross = await second.evaluate(async()=>{
      formal.companies[0]=core.touch(formal.companies[0],{name:'不应覆盖的旧版'});
      const results = await Promise.allSettled([db.saveState(formal),db.saveState(formal)]);
      demo.companies[0]=core.touch(demo.companies[0],{name:'演示第二版'});
      const demoResult=await db.saveState(demo,{workspace:'demo'});
      return {rejected:results.map(r=>r.status==='rejected'?r.reason.code:'unexpected-success'),demoVersion:demoResult.version};
    });
    evidence.checks.push(check(capture.workspace==='formal' && capture.version===2 && cross.rejected.every(x=>x==='CONCURRENT_WRITE') && cross.demoVersion===2,'workspace and version captured before queues; same-workspace stale saves rejected; other workspace unaffected'));
    const queued = await first.evaluate(async()=>{
      formal=await db.loadState();const a=structuredClone(formal),b=structuredClone(formal);
      a.companies[0]=core.touch(a.companies[0],{name:'队列第三版'});b.companies[0]=core.touch(b.companies[0],{name:'队列第四版'});
      const versions=await Promise.all([db.saveState(a),db.saveState(b)]);
      return {versions:versions.map(x=>x.version),formal:(await db.loadState()).companies[0].name,demo:(await db.loadState({workspace:'demo'})).companies[0].name};
    });
    evidence.checks.push(check(JSON.stringify(queued.versions)==='[3,4]'&&queued.formal==='队列第四版'&&queued.demo==='演示第二版','same-tab queued snapshots serialize within one workspace without cross-writes'));
    const imports=await first.evaluate(async()=>{
      const state=await db.loadState(), demoState=await db.loadState({workspace:'demo'});
      let explicit,legacy,reverse;
      try{await db.importBackup(db.exportBackup(demoState,{workspace:'demo'}),state);}catch(e){explicit=e.code;}
      try{await db.importBackup(JSON.stringify({format:'NextRound',state:demoState}),state);}catch(e){legacy=e.code;}
      try{await db.importBackup(db.exportBackup(state),demoState,{workspace:'demo'});}catch(e){reverse=e.code;}
      return {explicit,legacy,reverse,formal:(await db.loadState()).companies[0].name};
    });
    evidence.checks.push(check(imports.explicit==='WORKSPACE_MISMATCH'&&imports.legacy==='WORKSPACE_MISMATCH'&&imports.reverse==='WORKSPACE_MISMATCH'&&imports.formal==='队列第四版','explicit and legacy demo imports are blocked from formal; reverse import blocked'));
    const migrated = await create();
    const migration = await migrated.evaluate(async()=>{
      const core=await import('./core.js');const s=core.blankState(),r=(id,patch)=>core.touch({id},patch);
      s.settings.demo=true;s.settings.keywords=['个人自定义规则'];
      s.companies=[r('demo-company-1',{name:'用户改过的演示公司',history:[{text:'用户历史原文'}]})];
      s.jobs=[r('demo-job-1',{companyId:'demo-company-1',title:'原演示岗位',status:'关注'}),r('my-job',{companyId:'demo-company-1',title:'个人岗位',status:'待面试'})];
      s.questions=[r('demo-q-1',{text:'个人面试引用过的种子问题',answer:'用户亲自写过答案'}),r('demo-q-2',{text:'不应留在正式的演示问题'})];
      s.attachments=[r('my-audio',{name:'个人录音.wav',mime:'audio/wav',data:'data:audio/wav;base64,AQIDBA==',history:[{text:'附件历史保全'}]})];
      s.interviews=[r('my-interview',{companyId:'demo-company-1',jobId:'my-job',status:'已完成',questions:[{id:'actual-1',text:'个人实际提问',answer:'现场回答',improved:'优化回答',questionId:'demo-q-1'}],attachmentIds:['my-audio']})];
      s.conflicts=[{id:'conflict-personal',collection:'jobs',entityId:'my-job',createdAt:new Date().toISOString(),incoming:r('my-job',{companyId:'demo-company-1',title:'个人岗位的导入冲突',status:'关注'})},{id:'conflict-demo',collection:'questions',entityId:'demo-q-2',createdAt:new Date().toISOString(),incoming:r('demo-q-2',{text:'旧演示冲突'})}];
      const original={version:7,savedAt:new Date().toISOString(),customMetadata:'旧包装字段',state:s};
      window.__original=structuredClone(original);
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('nextround-local',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(original,'current');tx.objectStore('state').put({mustKeep:'older backup'},'older-backup');tx.objectStore('state').put({old:'discard'},'legacy-recovery-v1-old');tx.objectStore('state').put({format:'NextRoundLegacyRecovery',state:s},'mixed-package');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
      window.db=await import('./db.js');const formal=await window.db.loadState();
      const read=async()=>{const raw=await new Promise(resolve=>{const req=indexedDB.open('nextround-local',1);req.onsuccess=()=>resolve(req.result);});const result=await new Promise((resolve,reject)=>{const tx=raw.transaction('state','readonly'),store=tx.objectStore('state');const value={};const req=store.openCursor();req.onsuccess=()=>{const cursor=req.result;if(cursor){value[cursor.key]=cursor.value;cursor.continue();}};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);});raw.close();return result;};
      const noMixed=(snapshot)=>!Object.entries(snapshot).some(([key,value])=>key.startsWith('legacy-recovery-v1')||value?.format==='NextRoundLegacyRecovery')&&!Object.hasOwn(snapshot.current,'legacyRecoveryId');
      const first=await read();await window.db.loadState();const second=await read();
      await window.db.saveState(formal);await window.db.loadState();const third=await read();
      // Previously migrated active state is preserved while obsolete packages and the pointer are removed.
      const raw=await new Promise(resolve=>{const request=indexedDB.open('nextround-local',1);request.onsuccess=()=>resolve(request.result);});
      await new Promise((resolve,reject)=>{const tx=raw.transaction('state','readwrite'),store=tx.objectStore('state');store.put({...third.current,legacyRecoveryId:'obsolete-id',workspaceMigration:1},'current');store.put({format:'NextRoundLegacyRecovery',state:window.__original.state},'unrelated-key-mixed');store.put({old:'discard'},'legacy-recovery-v1-second');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});raw.close();
      const migratedAgain=await window.db.loadState();const fourth=await read();
      return {cleared:[first,second,third,fourth].every(noMixed),preservedMigrated:JSON.stringify(migratedAgain)===JSON.stringify(formal),counts:{companies:formal.companies.length,jobs:formal.jobs.length,questions:formal.questions.length,interviews:formal.interviews.length,attachments:formal.attachments.length,conflicts:formal.conflicts.length},job:formal.jobs[0].id,dependency:formal.companies[0].id,question:formal.questions[0].id,audio:formal.attachments[0].data,companyHistory:formal.companies[0].history,audioHistory:formal.attachments[0].history,conflictEntity:formal.conflicts[0]?.entityId,settings:formal.settings.keywords,demoFlag:formal.settings.demo??null,firstVersion:first.current.version,secondVersion:second.current.version,thirdVersion:third.current.version,fourthVersion:fourth.current.version,olderBackup:fourth['older-backup']};
    });
    evidence.checks.push(check(migration.cleared&&migration.preservedMigrated&&migration.firstVersion===8&&migration.secondVersion===8&&migration.thirdVersion===9&&migration.fourthVersion===9,'obsolete mixed packages and pointer are deleted; migration is idempotent and already-migrated active data stays intact'));
    evidence.checks.push(check(migration.job==='my-job'&&migration.dependency==='demo-company-1'&&migration.question==='demo-q-1'&&migration.audio==='data:audio/wav;base64,AQIDBA=='&&migration.counts.conflicts===1&&migration.conflictEntity==='my-job'&&migration.companyHistory[0].text==='用户历史原文'&&migration.audioHistory[0].text==='附件历史保全'&&migration.olderBackup.mustKeep==='older backup'&&migration.settings[0]==='个人自定义规则'&&migration.demoFlag===null,'personal records retain transitive dependencies, audio, personal conflicts, history, settings and older backups; obsolete demo conflicts are removed'));
    const pure = await create();
    const pureResult=await pure.evaluate(async()=>{
      const core=await import('./core.js'),s=core.blankState();s.settings.demo=true;s.companies=[core.touch({id:'demo-company-1'},{name:'演示公司'})];
      const raw=await new Promise(resolve=>{const r=indexedDB.open('nextround-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);});
      await new Promise(resolve=>{const tx=raw.transaction('state','readwrite');tx.objectStore('state').put({version:1,state:s},'current');tx.oncomplete=resolve;});raw.close();
      const db=await import('./db.js'),formal=await db.loadState();const rawAgain=await new Promise(resolve=>{const request=indexedDB.open('nextround-local',1);request.onsuccess=()=>resolve(request.result);});const keys=await new Promise(resolve=>{const request=rawAgain.transaction('state','readonly').objectStore('state').getAllKeys();request.onsuccess=()=>resolve(request.result);});rawAgain.close();return {empty:core.COLLECTIONS.every(name=>formal[name].length===0),keys};
    });
    evidence.checks.push(check(pureResult.empty&&JSON.stringify(pureResult.keys)==='["current"]','pure legacy demo becomes an empty formal archive without retaining the old mixed snapshot'));
    evidence.details={initial,refreshed,capture,cross,queued,imports,migration,pureResult};
    evidence.result='PASS';return evidence;
  } finally {for(const context of contexts.reverse())await context.close();}
}
