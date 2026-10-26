import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { blankState, touch, validateState } from '../core.js';
import { exportBackup, importBackup } from '../db.js';
import { settingsMarkup } from '../settings-ui.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=(name)=>{
 const start=source.indexOf('function '+name+'(');
 assert.ok(start>=0,'Actual renderer exists: '+name);
 return source.slice(start,source.indexOf('\n}',start)+2);
};
const escapeSource=source.slice(source.indexOf('const esc ='),source.indexOf('\nconst navs ='));
const esc=vm.runInNewContext(escapeSource+';esc');
const payload='record,\"><img src=x onerror=globalThis.__nrSecurity=1>';
const context={esc,fmtDate:()=>'',fmtSeconds:()=>'',badge:()=>'',btn:()=>'',icon:()=>''};
const renderer=(name,extra={})=>vm.runInNewContext(extract(name)+';'+name,{...context,...extra});

test('valid backup preserves adversarial string IDs and relationships without destructive rewriting',async()=>{
 const state=blankState();
 state.questions=[touch({id:payload},{text:'Question'})];
 state.sessions=[touch({id:'session'},{questionIds:[payload]})];
 assert.equal(validateState(state),true);
 const imported=await importBackup(exportBackup(state),blankState());
 assert.equal(imported.state.questions[0].id,payload);
 assert.equal(imported.state.sessions[0].questionIds[0],payload);
});

test('actual training row renderer escapes both imported IDs and untyped rating text',()=>{
 const html=renderer('sessionRow')({id:payload,ratingPercent:'<img src=x onerror=globalThis.__nrSecurity=1>'});
 assert.ok(html.includes('data-id="'+esc(payload)+'"'));
 assert.ok(html.includes('&lt;img'));
 assert.ok(!html.includes('<img'));
});

test('actual attachment and select renderers preserve IDs as attribute data',()=>{
 const html=renderer('attachmentsHTML',{get:()=>({id:payload,name:'Attachment',mime:'application/octet-stream',data:'AQIDBA=='})})([payload]);
 assert.ok(html.includes('data-id="'+esc(payload)+'"'));
 assert.ok(!html.includes('<img'));
 const options=renderer('opts')([{id:payload,name:'Name'}],payload);
 assert.ok(options.includes('value="'+esc(payload)+'"'));
 assert.ok(!options.includes('<img'));
});

test('actual field helpers escape imported dimension IDs in field names',()=>{
 for(const [name,args]of [['textField',[payload,'Label','value']],['area',[payload,'Label','value']],['selectField',[payload,'Label','<option>Value</option>']]]){
  const html=renderer(name)(...args);
  assert.ok(html.includes('name="'+esc(payload)+'"'),name);
  assert.ok(!html.includes('<img'),name);
 }
});

test('actual settings renderer escapes conflict action IDs',()=>{
 const state=blankState();state.conflicts=[{id:payload,collection:'questions',entityId:'q',incoming:{text:'Text'}}];
 const html=settingsMarkup({state,pageHead:()=>'',btn:(text,action,cls,extra)=>`<button ${extra}>${text}</button>`,icon:()=>'',helpTip:()=>'',fmtDate:()=>'',esc,spaceTitle:()=>'',installPrompt:null,statuses:[],publicRulesPanel:()=>'',get:()=>null,types:{}});
 assert.ok(html.includes('data-id="'+esc(payload)+'"'));
 assert.ok(!html.includes('<img'));
});
