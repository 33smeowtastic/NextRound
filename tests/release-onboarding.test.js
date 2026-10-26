import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankState, validateState } from '../core.js';
import { parseUnifiedImport, mergeUnifiedImport, UNIFIED_MODULES } from '../unified-import.js';
import { exportBackup, importBackup } from '../db.js';
const example=JSON.parse(readFileSync(new URL('../examples/interview-prep.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../examples/interview-prep.md',import.meta.url),'utf8');

test('the public onboarding fixture is complete, fictional, readable in Markdown and imports all three independent difficulties',()=>{
 assert.equal(parseUnifiedImport(example).schemaVersion,'next-round-unified-1.2');
 assert.equal(example.version,'4.0.1');
 assert.ok(UNIFIED_MODULES.every(module=>Array.isArray(example[module])));
 assert.ok(UNIFIED_MODULES.filter(module=>module!=='questions').every(module=>example[module].length===0));
 const result=mergeUnifiedImport(example,blankState());
 assert.equal(result.report.added,3);assert.equal(validateState(result.state),true);
 assert.deepEqual(result.state.questions.map(question=>question.difficulty),['天堂','人间','地狱']);
 for(const question of result.state.questions){
  assert.ok(question.category&&question.answer.includes('完全虚构'));
  assert.ok(source.includes(question.text)&&source.includes(question.answer));
 }
 assert.deepEqual(result.state.questions.map(question=>question.unifiedSource),example.questions);
});

test('the actual public fixture reimports without duplicates and round-trips through a complete formal backup',async()=>{
 const first=mergeUnifiedImport(example,blankState()),again=mergeUnifiedImport(example,first.state);
 assert.equal(again.report.added,0);assert.equal(again.report.conflicts,0);assert.equal(again.report.unchanged,3);
 assert.deepEqual(again.state,first.state);
 const restored=await importBackup(exportBackup(first.state),blankState(),{workspace:'formal',mode:'replace'});
 assert.deepEqual(restored.state,first.state);
});
