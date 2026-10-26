import test from "node:test";
import assert from "node:assert/strict";
import { blankState, COLLECTIONS, SCHEDULE_TYPES, touch, normalizeState, validateState, mergeData } from "../core.js";
import { moveToTrash, restoreTrash, deleteTrash } from "../trash.js";
import { exportBackup, importBackup } from "../db.js";
import { separateLegacyState } from "../workspaces.js";
const entity = (id, patch = {}) => touch({ id }, patch);
const item = (id = "event", patch = {}) => entity(id, { title: "准备下一场", startsAt: "2026-10-23T10:30:00.000Z", type: "general", notes: "保留完整安排", ...patch });
function fixture() {
  const state = blankState();
  state.companies = [entity("co", { name: "个人单位" })];
  state.jobs = [entity("job", { companyId: "co", title: "个人岗位" })];
  state.interviews = [entity("interview", { companyId: "co", jobId: "job", status: "待面试", scheduledAt: "2026-10-23T10:30:00Z" })];
  state.questions = [entity("q", { text: "个人问题", answer: "个人答案" })];
  state.scripts = [entity("script", { title: "个人介绍", content: "当前介绍正文" })];
  state.contentCards = [entity("card", { title: "项目卡片", content: "项目内容", tags: ["项目"] })];
  state.scheduleItems = [
    item("interview-event", { type: "interview", companyId: "co", interviewId: "interview", companyName: "个人单位", interviewTitle: "第一轮面试" }),
    item("question-event", { type: "training", knowledgeKind: "questions", knowledgeId: "q", knowledgeTitle: "个人问题" }),
    item("script-event", { type: "training", knowledgeKind: "scripts", knowledgeId: "script", knowledgeTitle: "个人介绍" }),
    item("card-event", { type: "training", knowledgeKind: "contentCards", knowledgeId: "card", knowledgeTitle: "项目卡片" }),
  ];
  return state;
}

test("legacy states and trash packages normalize missing schedules without changing existing data", () => {
  assert.equal(COLLECTIONS.includes("scheduleItems"), true);
  const legacy = blankState(); delete legacy.scheduleItems;
  legacy.questions = [entity("q", { text: "旧问题", answer: "完整手写内容" })];
  const oldTrash = moveToTrash(legacy, "questions", "q"); delete oldTrash.scheduleItems;
  delete oldTrash.trash[0].records.scheduleItems; delete oldTrash.trash[0].dependencies.scheduleItems;
  const before = structuredClone(oldTrash);
  assert.equal(validateState(oldTrash), true);
  const normalized = normalizeState(oldTrash);
  assert.deepEqual(normalized.scheduleItems, []);
  assert.deepEqual(normalized.trash[0].records.scheduleItems, []);
  assert.deepEqual(normalized.trash[0].dependencies.scheduleItems, []);
  assert.equal(restoreTrash(oldTrash, oldTrash.trash[0].id).questions[0].answer, "完整手写内容");
  assert.deepEqual(mergeData(legacy, legacy).state.scheduleItems, []);
  assert.deepEqual(oldTrash, before);
});
test("all schedule types and ISO timezone offsets validate without requiring live linked records", () => {
  for (const type of SCHEDULE_TYPES) {
    const state = blankState();
    state.scheduleItems = [item("orphan", { type, startsAt: "2026-10-23T18:30:00+08:00", companyId: "deleted-co", interviewId: "deleted-interview", knowledgeKind: "questions", knowledgeId: "deleted-question", companyName: "历史单位", interviewTitle: "历史轮次", knowledgeTitle: "历史问题" })];
    assert.equal(validateState(state), true);
  }
  const noLinks = blankState(); noLinks.scheduleItems = [item("no-links", { companyId: null, interviewId: "", knowledgeKind: "", knowledgeId: "" })];
  assert.equal(validateState(noLinks), true);
});
test("invalid dates, types, links, title and snapshot fields are rejected atomically", () => {
  const patches = [
    { title: " " }, { title: 42 }, { type: "unknown" }, { startsAt: "2026-02-30T10:00:00Z" }, { startsAt: "2026-10-23" }, { startsAt: "2026-10-23T10:30" },
    { startsAt: "not-a-date" }, { startsAt: null }, { companyId: 1 }, { interviewId: [] }, { companyId: " " }, { knowledgeId: {} },
    { knowledgeKind: "questions" }, { knowledgeId: "q" }, { knowledgeKind: "unknown", knowledgeId: "q" }, { knowledgeKind: "scripts", knowledgeId: "" },
    { companyName: {} }, { interviewTitle: [] }, { knowledgeTitle: 7 }, { notes: [] },
  ];
  for (const patch of patches) {
    const state = blankState(); state.scheduleItems = [item("event", patch)];
    const before = structuredClone(state);
    assert.throws(() => validateState(state), /校验失败/);
    assert.deepEqual(state, before);
  }
  const invalidArray = blankState(); invalidArray.scheduleItems = {};
  assert.throws(() => validateState(invalidArray), /scheduleItems 必须是数组/);
  const duplicate = blankState(); duplicate.questions = [entity("same", { text: "问题" })]; duplicate.scheduleItems = [item("same")];
  assert.throws(() => validateState(duplicate), /ID 重复/);
});
test("weak schedule links never relax strong company references on other collections", () => {
  const state = blankState(); state.scheduleItems = [item("event", { companyId: "missing" })];
  state.questions = [entity("q", { text: "问题", companyId: "missing" })];
  assert.throws(() => validateState(state), /questions\[q\].companyId 引用不存在/);
});
test("deleting a linked organization and interview leaves schedules and their text snapshots untouched", () => {
  const state = fixture(), events = structuredClone(state.scheduleItems);
  const incoming = structuredClone(state); incoming.scheduleItems[0] = touch(incoming.scheduleItems[0], { notes: "另一个日程版本" });
  const withConflict = mergeData(state, incoming).state;
  const next = moveToTrash(withConflict, "companies", "co");
  assert.equal(next.companies.length, 0); assert.equal(next.jobs.length, 0); assert.equal(next.interviews.length, 0);
  assert.deepEqual(next.scheduleItems, events);
  assert.equal(next.conflicts[0].collection, "scheduleItems");
  assert.equal(next.trash[0].records.scheduleItems.length, 0);
  assert.equal(next.trash[0].conflicts.length, 0);
  assert.equal(validateState(next), true);
  assert.deepEqual(deleteTrash(next, next.trash[0].id).scheduleItems, events);
});
test("deleting linked questions, scripts and content cards does not block or cascade schedules", () => {
  for (const [collection, id] of [["questions", "q"], ["scripts", "script"], ["contentCards", "card"]]) {
    const state = fixture(), before = structuredClone(state.scheduleItems);
    const next = moveToTrash(state, collection, id);
    assert.deepEqual(next.scheduleItems, before);
    assert.equal(next[collection].some((record) => record.id === id), false);
    assert.equal(validateState(next), true);
  }
});
test("schedule trash packages are independent and restore orphan links without resurrecting their targets", () => {
  const state = fixture();
  const incoming = structuredClone(state); incoming.scheduleItems[0] = touch(incoming.scheduleItems[0], { title: "另一个完整版本" });
  const withConflict = mergeData(state, incoming).state, before = structuredClone(withConflict);
  const next = moveToTrash(withConflict, "scheduleItems", "interview-event"), entry = next.trash[0];
  assert.equal(next.scheduleItems.length, 3);
  assert.equal(entry.records.scheduleItems[0].id, "interview-event");
  for (const name of COLLECTIONS) assert.equal(entry.dependencies[name].length, 0, `${name} must not be captured for a weak link`);
  assert.equal(entry.conflicts[0].collection, "scheduleItems");
  const isolated = blankState(); isolated.trash = [entry];
  const restored = restoreTrash(isolated, entry.id);
  assert.equal(restored.scheduleItems[0].companyName, "个人单位");
  assert.equal(restored.scheduleItems[0].interviewId, "interview");
  assert.equal(restored.companies.length, 0); assert.equal(restored.interviews.length, 0);
  assert.equal(restored.conflicts[0].incoming.title, "另一个完整版本");
  assert.equal(validateState(restored), true);
  assert.deepEqual(withConflict, before);
});
test("schedule merges deduplicate full records and retain different incoming versions once", () => {
  const local = blankState(); local.scheduleItems = [item("event")];
  const incoming = structuredClone(local); incoming.scheduleItems[0] = touch(incoming.scheduleItems[0], { title: "另一设备版本", startsAt: "2026-10-24T10:30:00Z", knowledgeKind: "scripts", knowledgeId: "missing-script" });
  const merged = mergeData(local, incoming);
  assert.equal(merged.state.scheduleItems[0].title, local.scheduleItems[0].title);
  assert.equal(merged.state.conflicts[0].collection, "scheduleItems");
  assert.deepEqual(merged.state.conflicts[0].incoming, incoming.scheduleItems[0]);
  assert.equal(mergeData(merged.state, incoming).state.conflicts.length, 1);
  assert.equal(mergeData(local, local).report.unchanged, 1);
});
test("complete, incremental and replacement backups preserve schedules with weak links and trash", async () => {
  const incoming = moveToTrash(fixture(), "scheduleItems", "interview-event"), before = structuredClone(incoming);
  const expected = structuredClone(incoming); expected.interviews[0].status = "待确认";
  const backup = exportBackup(incoming), restored = await importBackup(backup, blankState());
  assert.deepEqual(restored.state, expected);
  assert.equal((await importBackup(backup, restored.state)).report.added, 0);
  const local = blankState(); local.scheduleItems = [item("old")];
  const replaced = await importBackup(backup, local, { mode: "replace" });
  assert.deepEqual(replaced.state, expected);
  assert.equal(replaced.state.scheduleItems.some((record) => record.id === "old"), false);
  assert.deepEqual(incoming, before);
});
test("old backups lacking schedules replace and merge without seeding events or losing records", async () => {
  const old = blankState(); delete old.scheduleItems;
  old.questions = [entity("q", { text: "旧问题", answer: "旧答案" })];
  const local = blankState(); local.scheduleItems = [item("local-event")];
  const replaced = await importBackup(exportBackup(old), local, { mode: "replace" });
  assert.deepEqual(replaced.state.scheduleItems, []);
  assert.deepEqual(replaced.state.questions, old.questions);
  const merged = await importBackup(exportBackup(old), local);
  assert.deepEqual(merged.state.scheduleItems, local.scheduleItems);
});
test("schedule backup workspace checks remain bidirectional and do not mutate either archive", async () => {
  const formal = fixture(), demo = fixture(), before = structuredClone({ formal, demo });
  for (const mode of ["merge", "replace"]) {
    await assert.rejects(importBackup(exportBackup(demo, { workspace: "demo" }), formal, { mode }), { code: "WORKSPACE_MISMATCH" });
    await assert.rejects(importBackup(exportBackup(formal), demo, { mode, workspace: "demo" }), { code: "WORKSPACE_MISMATCH" });
  }
  assert.deepEqual({ formal, demo }, before);
});
test("legacy separation preserves personal schedules but does not retain demo targets solely for weak links", () => {
  const old = blankState(); old.settings.demo = true;
  old.companies = [entity("demo-company-1", { name: "旧示例单位" })];
  old.questions = [entity("demo-q-1", { text: "旧示例题" })];
  old.scheduleItems = [item("personal-event", { companyId: "demo-company-1", companyName: "旧示例单位", knowledgeKind: "questions", knowledgeId: "demo-q-1", knowledgeTitle: "旧示例题" })];
  const separated = separateLegacyState(old).state;
  assert.deepEqual(separated.scheduleItems, old.scheduleItems);
  assert.deepEqual(separated.companies, []); assert.deepEqual(separated.questions, []);
  assert.equal(validateState(separated), true);
});

test("completion is optional for legacy schedules and only explicit booleans are valid", () => {
  const state = blankState(); state.scheduleItems = [item("legacy"), item("incomplete", { completed: false }), item("complete", { completed: true })];
  const before = structuredClone(state);
  assert.equal(validateState(state), true);
  const normalized = normalizeState(state);
  assert.equal(Object.hasOwn(normalized.scheduleItems[0], "completed"), false);
  assert.deepEqual(normalized.scheduleItems.map((record) => record.completed === true), [false, false, true]);
  assert.deepEqual(state, before);
  for (const completed of [null, "true", "false", 0, 1, [], {}]) {
    const invalid = blankState(); invalid.scheduleItems = [item("invalid", { completed })];
    assert.throws(() => validateState(invalid), /completed 必须是布尔值/);
  }
});
test("completion flags round-trip through complete backups and both import modes without adding legacy defaults", async () => {
  const incoming = blankState(); incoming.scheduleItems = [item("legacy"), item("incomplete", { completed: false }), item("complete", { completed: true })];
  const before = structuredClone(incoming), backup = exportBackup(incoming);
  for (const mode of ["merge", "replace"]) {
    const imported = await importBackup(backup, blankState(), { mode });
    assert.deepEqual(imported.state.scheduleItems, incoming.scheduleItems);
    assert.equal(Object.hasOwn(imported.state.scheduleItems[0], "completed"), false);
  }
  assert.deepEqual(incoming, before);
});
test("completion conflicts preserve local status and move with schedule trash for complete restoration", async () => {
  const local = blankState(); local.scheduleItems = [item("event", { completed: false })];
  const incoming = structuredClone(local); incoming.scheduleItems[0] = touch(incoming.scheduleItems[0], { completed: true });
  const merged = mergeData(local, incoming).state;
  assert.equal(merged.scheduleItems[0].completed, false);
  assert.equal(merged.conflicts[0].incoming.completed, true);
  assert.equal(mergeData(merged, incoming).state.conflicts.length, 1);
  const removed = moveToTrash(merged, "scheduleItems", "event"), entry = removed.trash[0];
  assert.equal(entry.records.scheduleItems[0].completed, false);
  assert.equal(entry.conflicts[0].incoming.completed, true);
  const backedUp = await importBackup(exportBackup(removed), blankState(), { mode: "replace" });
  assert.equal(backedUp.state.trash[0].records.scheduleItems[0].completed, false);
  assert.equal(backedUp.state.trash[0].conflicts[0].incoming.completed, true);
  const restored = restoreTrash(backedUp.state, entry.id);
  assert.equal(restored.scheduleItems[0].completed, false);
  assert.equal(restored.conflicts[0].incoming.completed, true);
});
test("malformed completion flags in active, conflict or trash snapshots reject imports without mutation", async () => {
  const base = blankState(); base.scheduleItems = [item("event", { completed: false })];
  const incoming = structuredClone(base); incoming.scheduleItems[0] = touch(incoming.scheduleItems[0], { completed: true });
  const merged = mergeData(base, incoming).state;
  for (const location of ["active", "conflict", "trash", "trash-conflict"]) {
    const invalid = location.startsWith("trash") ? moveToTrash(merged, "scheduleItems", "event") : structuredClone(merged);
    if (location === "active") invalid.scheduleItems[0].completed = "false";
    if (location === "conflict") invalid.conflicts[0].incoming.completed = "true";
    if (location === "trash") invalid.trash[0].records.scheduleItems[0].completed = null;
    if (location === "trash-conflict") invalid.trash[0].conflicts[0].incoming.completed = 1;
    const before = structuredClone(invalid);
    assert.throws(() => exportBackup(invalid), /completed 必须是布尔值/);
    for (const mode of ["merge", "replace"]) await assert.rejects(importBackup(invalid, blankState(), { mode }), /completed 必须是布尔值/);
    assert.deepEqual(invalid, before);
  }
});
