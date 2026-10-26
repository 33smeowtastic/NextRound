import test from "node:test";
import assert from "node:assert/strict";
import { blankState, touch, validateState } from "../core.js";
import { hasScriptHistory, stripScriptHistory } from "../script-history.js";
import { moveToTrash, restoreTrash } from "../trash.js";
import { exportBackup, importBackup } from "../db.js";
const entity = (id, patch = {}) => touch({ id }, patch);
const history = () => [{ content: "PRIVATE_SCRIPT_HISTORY", composition: [{ id: "historical-part", sourceCardId: null, title: "旧段落", text: "PRIVATE_SCRIPT_HISTORY" }] }];
const script = (id, patch = {}) => entity(id, { title: `${id}当前标题`, content: `${id}当前正文`, versionName: "当前长版", composition: [{ id: `${id}-part`, sourceCardId: "gone-source-card", title: "当前段落", text: `${id}当前正文`, variant: "长版" }], history: history(), ...patch });
function fixture() {
  let state = blankState();
  state.scripts = [script("live"), script("deleted"), script("dependency"), entity("no-history", { title: "没有历史属性", content: "手写正文" })];
  state.questions = [entity("q", { text: "当前问题", answer: "当前回答", history: [{ answer: "PRIVATE_QUESTION_HISTORY" }] })];
  state.sessions = [entity("session", { title: "练习", scriptId: "dependency", attachmentIds: ["audio"] })];
  state.attachments = [entity("audio", { name: "当前录音.webm", mime: "audio/webm", data: "AQIDBA==" })];
  state.conflicts = [
    { id: "live-conflict", collection: "scripts", entityId: "live", createdAt: "2026-10-22T00:00:00Z", incoming: script("live", { versionName: "导入当前版" }) },
    { id: "deleted-conflict", collection: "scripts", entityId: "deleted", createdAt: "2026-10-22T00:00:00Z", incoming: script("deleted", { versionName: "删除前导入版" }) },
    { id: "question-conflict", collection: "questions", entityId: "q", createdAt: "2026-10-22T00:00:00Z", incoming: entity("q", { text: "冲突问题", answer: "冲突回答", history: [{ answer: "PRIVATE_QUESTION_HISTORY" }] }) },
  ];
  state = moveToTrash(state, "scripts", "deleted");
  state = moveToTrash(state, "sessions", "session");
  state.custom = { scriptLike: { history: ["UNMANAGED_HISTORY"] } };
  assert.equal(validateState(state), true);
  return state;
}
function assertClean(state) {
  assert.equal(hasScriptHistory(state), false);
  for (const item of state.scripts) if (item.id !== "no-history") assert.deepEqual(item.history, []);
  assert.equal(Object.hasOwn(state.scripts.find((item) => item.id === "no-history"), "history"), false);
  assert.deepEqual(state.questions[0].history, [{ answer: "PRIVATE_QUESTION_HISTORY" }]);
  assert.deepEqual(state.conflicts.find((item) => item.collection === "questions").incoming.history, [{ answer: "PRIVATE_QUESTION_HISTORY" }]);
  assert.deepEqual(state.trash[0].records.scripts[0].history, []);
  assert.deepEqual(state.trash[0].conflicts[0].incoming.history, []);
  assert.deepEqual(state.trash[1].dependencies.scripts[0].history, []);
  assert.equal(validateState(state), true);
}

test("history detection checks only nonempty script histories at managed locations", () => {
  const locations = [
    { scripts: [{ history: ["old"] }] },
    { conflicts: [{ collection: "scripts", incoming: { history: ["old"] } }] },
    { trash: [{ records: { scripts: [{ history: ["old"] }] } }] },
    { trash: [{ dependencies: { scripts: [{ history: ["old"] }] } }] },
    { trash: [{ conflicts: [{ collection: "scripts", incoming: { history: ["old"] } }] }] },
  ];
  for (const state of locations) assert.equal(hasScriptHistory(state), true);
  for (const state of [blankState(), { scripts: [{ history: [] }, {}] }, { questions: [{ history: ["question history"] }] }, { custom: { scripts: [{ history: ["unmanaged"] }] } }]) assert.equal(hasScriptHistory(state), false);
});
test("stripping history preserves current scripts, card composition, question histories, audio and input identity", () => {
  const state = fixture(), before = structuredClone(state), cleaned = stripScriptHistory(state);
  assertClean(cleaned);
  assert.deepEqual(state, before);
  assert.notEqual(cleaned, state);
  const expectedLive = structuredClone(state.scripts[0]); expectedLive.history = [];
  assert.deepEqual(cleaned.scripts[0], expectedLive);
  assert.equal(cleaned.scripts[0].versionName, "当前长版");
  assert.deepEqual(cleaned.scripts[0].composition, state.scripts[0].composition);
  assert.deepEqual(cleaned.trash[1].records.attachments, state.trash[1].records.attachments);
  assert.deepEqual(cleaned.custom, state.custom);
  assert.deepEqual(stripScriptHistory(cleaned), cleaned);
});
test("complete backups exclude obsolete script histories at all locations without mutating their source", async () => {
  const state = fixture(), before = structuredClone(state);
  const text = await exportBackup(state).text(), exported = JSON.parse(text).state;
  assertClean(exported);
  assert.equal(text.includes("PRIVATE_SCRIPT_HISTORY"), false);
  assert.equal(text.includes("PRIVATE_QUESTION_HISTORY"), true);
  assert.equal(text.includes("UNMANAGED_HISTORY"), true);
  assert.deepEqual(state, before);
});
test("both import modes strip old script history from active, conflict and trash snapshots", async () => {
  const incoming = fixture(), before = structuredClone(incoming), payload = { format: "NextRound", workspace: "formal", state: incoming };
  for (const mode of ["merge", "replace"]) {
    const result = await importBackup(payload, blankState(), { mode });
    assertClean(result.state);
    assert.equal(JSON.stringify(result.state).includes("PRIVATE_SCRIPT_HISTORY"), false);
  }
  assert.deepEqual(incoming, before);
});
test("incremental imports ignore script-history-only differences and retain question history conflicts", async () => {
  const local = blankState(); local.scripts = [script("live")];
  const incoming = structuredClone(local); incoming.scripts[0].history = [{ content: "different obsolete history" }];
  const before = structuredClone({ local, incoming });
  const result = await importBackup(incoming, local);
  assert.deepEqual(result.state.scripts[0].history, []);
  assert.equal(result.state.conflicts.length, 0);
  assert.equal(result.report.conflicts, 0);
  assert.deepEqual({ local, incoming }, before);
  const questionsLocal = blankState(); questionsLocal.questions = [entity("q", { text: "question", answer: "current", history: [{ answer: "old local" }] })];
  const questionsIncoming = structuredClone(questionsLocal); questionsIncoming.questions[0].history = [{ answer: "old incoming" }];
  assert.equal((await importBackup(questionsIncoming, questionsLocal)).state.conflicts[0].collection, "questions");
});
test("restoring cleaned trash retains current script text and composition without resurrecting history", () => {
  const original = fixture(), cleaned = stripScriptHistory(original);
  const restored = restoreTrash(cleaned, cleaned.trash[0].id), recovered = restored.scripts.find((item) => item.id === "deleted");
  assert.equal(recovered.content, "deleted当前正文");
  assert.equal(recovered.versionName, "当前长版");
  assert.equal(recovered.composition[0].text, "deleted当前正文");
  assert.deepEqual(recovered.history, []);
  assert.equal(hasScriptHistory(restored), false);
});
test("malformed histories are rejected before cleanup rather than being silently sanitized", async () => {
  const local = blankState();
  for (const location of ["active", "conflict", "trash"]) {
    const invalid = fixture();
    if (location === "active") invalid.scripts[0].history = "invalid";
    if (location === "conflict") invalid.conflicts.find((item) => item.collection === "scripts").incoming.history = "invalid";
    if (location === "trash") invalid.trash[0].records.scripts[0].history = "invalid";
    const before = structuredClone(invalid);
    assert.throws(() => exportBackup(invalid), /history 必须是数组/);
    for (const mode of ["merge", "replace"]) await assert.rejects(importBackup(invalid, local, { mode }), /history 必须是数组/);
    assert.deepEqual(invalid, before);
  }
  await assert.rejects(importBackup({ format: "WrongFormat", state: fixture() }, local), /备份格式不属于/);
  await assert.rejects(importBackup({ format: "NextRoundLegacyRecovery", state: fixture() }, local), /已停用/);
});
test("workspace mismatches still reject before import and leave every source history untouched", async () => {
  const formal = fixture(), demo = fixture(), before = structuredClone({ formal, demo });
  await assert.rejects(importBackup({ format: "NextRound", workspace: "demo", state: demo }, formal), { code: "WORKSPACE_MISMATCH" });
  await assert.rejects(importBackup({ format: "NextRound", workspace: "formal", state: formal }, demo, { workspace: "demo", mode: "replace" }), { code: "WORKSPACE_MISMATCH" });
  assert.deepEqual({ formal, demo }, before);
});
test("historyless legacy states normalize without creating history properties or deleting custom fields", () => {
  const old = blankState(); delete old.contentCards; delete old.trash;
  old.scripts = [entity("legacy", { title: "旧介绍", content: "旧全文", versionName: "保留版本名称", custom: { history: ["unknown data"] } })];
  old.questions = [entity("q", { history: [{ answer: "保留题库历史" }] })];
  const before = structuredClone(old), result = stripScriptHistory(old);
  assert.equal(Object.hasOwn(result.scripts[0], "history"), false);
  assert.deepEqual(result.scripts, old.scripts);
  assert.deepEqual(result.questions, old.questions);
  assert.deepEqual(result.contentCards, []); assert.deepEqual(result.trash, []);
  assert.deepEqual(old, before);
});
