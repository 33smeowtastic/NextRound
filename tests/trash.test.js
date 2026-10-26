import test from "node:test";
import assert from "node:assert/strict";
import { blankState, touch, validateState, mergeData } from "../core.js";
import { moveToTrash, restoreTrash, deleteTrash, emptyTrash } from "../trash.js";
const entity = (id, patch = {}) => touch({ id }, patch);
const audio = (id) => entity(id, { name: `${id}.webm`, mime: "audio/webm", data: "AQIDBA==" });
function fixture() {
  const state = blankState();
  state.companies = [entity("co", { name: "个人单位" }), entity("other", { name: "其他单位" })];
  state.jobs = [entity("job", { companyId: "co", title: "个人岗位" })];
  state.questions = [entity("q", { text: "个人问题" })];
  state.scripts = [entity("script", { title: "个人介绍", content: "完整正文" })];
  state.interviews = [entity("interview", { companyId: "co", jobId: "job", questions: [{ text: "现场问题", questionId: "q", attachmentIds: ["nested"] }], attachmentIds: ["audio"] })];
  state.sessions = [entity("session", { companyId: "co", jobId: "job", interviewId: "interview", questionIds: ["q"], scriptId: "script", attachmentIds: ["shared"] })];
  state.attachments = [audio("audio"), audio("nested"), audio("shared")];
  return state;
}

test("legacy backups without trash validate and merge with an empty trash", () => {
  const legacy = blankState(); delete legacy.trash;
  assert.equal(validateState(legacy), true);
  assert.deepEqual(mergeData(legacy, legacy).state.trash, []);
});
test("company removal cascades only its jobs/interviews/sessions and full exclusive audio", () => {
  const before = fixture(), unchanged = structuredClone(before);
  const next = moveToTrash(before, "companies", "co"), entry = next.trash[0];
  assert.deepEqual(before, unchanged);
  assert.deepEqual(next.companies.map((item) => item.id), ["other"]);
  for (const name of ["jobs", "interviews", "sessions", "attachments"]) assert.equal(next[name].length, 0);
  assert.equal(next.questions.length, 1); assert.equal(next.scripts.length, 1);
  assert.equal(entry.records.attachments.length, 3);
  assert.equal(entry.dependencies.questions[0].text, "个人问题");
  assert.equal(entry.dependencies.scripts[0].content, "完整正文");
  assert.equal(entry.dependencies.companies.length, 0);
  assert.equal(entry.records.interviews[0].questions[0].attachmentIds[0], "nested");
  assert.equal(validateState(next), true);
  const restored = restoreTrash(next, entry.id);
  for (const name of ["companies", "jobs", "questions", "scripts", "interviews", "sessions", "attachments"]) assert.deepEqual(restored[name].slice().sort((a,b) => a.id.localeCompare(b.id)), before[name].slice().sort((a,b) => a.id.localeCompare(b.id)));
  assert.equal(restored.trash.length, 0);
});
test("record restore preserves active parents and shared attachments", () => {
  const state = fixture();
  state.settings.trainingDraft = { attachmentIds: ["audio"] };
  const next = moveToTrash(state, "interviews", "interview"), entry = next.trash[0];
  assert.equal(next.attachments.some((record) => record.id === "audio"), true);
  assert.equal(entry.dependencies.attachments[0].id, "audio");
  assert.equal(next.sessions.length, 0);
  next.companies[0] = touch(next.companies[0], { name: "改过的单位" });
  const restored = restoreTrash(next, entry.id);
  assert.equal(restored.companies[0].name, "改过的单位");
  assert.equal(restored.attachments.filter((record) => record.id === "audio").length, 1);
});
test("missing parents and knowledge dependencies can be recovered from a record-sized package", () => {
  const next = moveToTrash(fixture(), "sessions", "session"), isolated = blankState();
  isolated.trash = next.trash;
  const restored = restoreTrash(isolated, next.trash[0].id);
  assert.equal(restored.sessions.length, 1);
  assert.equal(restored.companies.length, 1);
  assert.equal(restored.companies[0].id, "co");
  assert.equal(restored.interviews[0].questions[0].text, "现场问题");
  assert.equal(restored.attachments.length, 3);
  assert.equal(validateState(restored), true);
});
test("in-use questions/scripts and standalone attachments reject deletion without mutation", () => {
  for (const [collection, id] of [["questions", "q"], ["scripts", "script"], ["attachments", "audio"]]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => moveToTrash(state, collection, id), /引用|附件/);
    assert.deepEqual(state, before);
  }
});
test("a conflicting restored record rejects atomically and keeps its trash package", () => {
  const next = moveToTrash(fixture(), "sessions", "session"), entry = next.trash[0];
  next.sessions.push(touch(entry.records.sessions[0], { notes: "新版本" }));
  next.attachments.push(...entry.records.attachments);
  const before = structuredClone(next);
  assert.throws(() => restoreTrash(next, entry.id), /同 ID/);
  assert.deepEqual(next, before);
});
test("draft associations move with their record and restore without replacing a new draft", () => {
  const state = blankState();
  state.questions.push(entity("q", { text: "草稿题" }));
  state.attachments.push(audio("draft-audio"));
  state.settings.trainingDraft = { questionId: "q", attachmentIds: ["draft-audio"] };
  const next = moveToTrash(state, "questions", "q"), entry = next.trash[0];
  assert.equal(next.settings.trainingDraft, undefined);
  assert.equal(next.attachments.length, 0);
  assert.deepEqual(restoreTrash(next, entry.id).settings.trainingDraft, state.settings.trainingDraft);
  next.settings.trainingDraft = { attachmentIds: [] };
  assert.deepEqual(restoreTrash(next, entry.id).settings.trainingDraft, { attachmentIds: [] });
});
test("trash packages validate independently and reject damaged references, duplicates and encoding", () => {
  const next = moveToTrash(fixture(), "sessions", "session");
  const damaged = structuredClone(next);
  damaged.trash[0].dependencies.companies = [];
  assert.throws(() => validateState(damaged), /引用不存在/);
  const duplicate = structuredClone(next); duplicate.trash.push(structuredClone(next.trash[0]));
  assert.throws(() => validateState(duplicate), /垃圾箱/);
  const audioDamage = structuredClone(next); audioDamage.trash[0].records.attachments[0].data = "<bad>";
  assert.throws(() => validateState(audioDamage), /编码/);
  const missingRoot = structuredClone(next); missingRoot.trash[0].entityId = "missing";
  assert.throws(() => validateState(missingRoot), /原始记录/);
});
test("trash merge deduplicates equivalent versions, retaining different versions with clashing entry IDs", () => {
  const first = moveToTrash(fixture(), "sessions", "session");
  const other = structuredClone(first);
  other.trash[0].id = "other-trash-id"; other.trash[0].deletedAt = "2026-10-22T12:00:00.000Z";
  assert.equal(mergeData(first, other).state.trash.length, 1);
  other.trash[0].id = first.trash[0].id;
  other.trash[0].records.sessions[0].notes = "另一个完整版本";
  const merged = mergeData(first, other).state;
  assert.equal(merged.trash.length, 2);
  assert.notEqual(merged.trash[0].id, merged.trash[1].id);
  assert.equal(mergeData(merged, other).state.trash.length, 2);
});
test("permanent deletion and emptying trash only affect trash and never active personal records", () => {
  const state = moveToTrash(fixture(), "sessions", "session"), before = structuredClone(state);
  const one = deleteTrash(state, state.trash[0].id), all = emptyTrash(state);
  assert.equal(one.trash.length, 0); assert.equal(all.trash.length, 0);
  assert.deepEqual(one.companies, state.companies);
  assert.deepEqual(all.questions, state.questions);
  assert.deepEqual(state, before);
  assert.throws(() => deleteTrash(state, "missing"), /不存在/);
});

test("changed shared knowledge/audio reject restoration instead of substituting the old recording or answer", () => {
  for (const [collection, id] of [["questions", "q"], ["scripts", "script"], ["attachments", "audio"]]) {
    const state = fixture();
    // Make audio shared so it remains active and is captured as a dependency.
    state.settings.trainingDraft = { attachmentIds: ["audio"] };
    const next = moveToTrash(state, "sessions", "session"), entry = next.trash[0];
    next[collection] = next[collection].map((record) => record.id === id ? touch(record, collection === "attachments" ? { data: "BQY=" } : { notes: "changed" }) : record);
    const before = structuredClone(next);
    assert.throws(() => restoreTrash(next, entry.id), /同 ID/);
    assert.deepEqual(next, before);
  }
});
test("permanently deleting another trash package leaves independently recoverable dependencies", () => {
  let state = moveToTrash(fixture(), "sessions", "session");
  const sessionTrashId = state.trash[0].id;
  state = moveToTrash(state, "companies", "co");
  state = deleteTrash(state, state.trash[1].id);
  const restored = restoreTrash(state, sessionTrashId);
  assert.equal(restored.sessions[0].id, "session");
  assert.equal(restored.companies.some((record) => record.id === "co"), true);
  assert.equal(restored.interviews[0].id, "interview");
  assert.equal(validateState(restored), true);
});

test("deleted entities take their conflicting full alternatives and exclusive audio out of active conflicts", () => {
  const local = blankState(); local.questions = [entity("q", { text: "current" })];
  local.attachments = [audio("alternative-audio")];
  const incoming = structuredClone(local);
  incoming.questions[0] = touch(incoming.questions[0], { answer: "PRIVATE-ALTERNATIVE-CONTENT", attachmentIds: ["alternative-audio"] });
  const state = mergeData(local, incoming).state, before = structuredClone(state);
  const next = moveToTrash(state, "questions", "q"), entry = next.trash[0];
  assert.deepEqual(state, before);
  assert.equal(next.conflicts.length, 0);
  assert.equal(entry.conflicts.length, 1);
  assert.equal(entry.conflicts[0].incoming.answer, "PRIVATE-ALTERNATIVE-CONTENT");
  assert.equal(next.attachments.length, 0);
  assert.equal(entry.records.attachments[0].id, "alternative-audio");
  assert.equal(JSON.stringify(deleteTrash(next, entry.id)).includes("PRIVATE-ALTERNATIVE-CONTENT"), false);
  assert.equal(JSON.stringify(emptyTrash(next)).includes("PRIVATE-ALTERNATIVE-CONTENT"), false);
  const restored = restoreTrash(next, entry.id);
  assert.equal(restored.conflicts[0].incoming.answer, "PRIVATE-ALTERNATIVE-CONTENT");
  assert.equal(restored.attachments[0].data, local.attachments[0].data);
});
test("conflicts for retained records move when their incoming snapshot references deleted IDs", () => {
  const local = blankState();
  local.questions = [entity("q", { text: "removable" }), entity("unrelated-q", { text: "other" })];
  local.sessions = [entity("s", { questionIds: [] })];
  local.companies = [entity("conflict-parent", { name: "parent required only by alternative" })];
  const incoming = structuredClone(local);
  incoming.sessions[0] = touch(incoming.sessions[0], { questionIds: ["q"], companyId: "conflict-parent" });
  incoming.questions[1] = touch(incoming.questions[1], { answer: "unrelated conflict survives" });
  const next = moveToTrash(mergeData(local, incoming).state, "questions", "q"), entry = next.trash[0];
  assert.equal(next.sessions.length, 1);
  assert.equal(next.conflicts.length, 1);
  assert.equal(next.conflicts[0].entityId, "unrelated-q");
  assert.equal(entry.conflicts[0].entityId, "s");
  assert.equal(entry.dependencies.sessions[0].id, "s");
  assert.equal(entry.dependencies.companies[0].id, "conflict-parent");
  const isolated = blankState(); isolated.trash = [entry];
  const restored = restoreTrash(isolated, entry.id);
  assert.equal(restored.sessions[0].id, "s");
  restored.sessions[0] = touch(restored.conflicts[0].incoming);
  assert.equal(validateState(restored), true);
});
test("restoring conflicts deduplicates full versions and replaces only colliding conflict IDs", () => {
  const local = blankState(); local.questions = [entity("q", { text: "current" }), entity("other-q", { text: "other" })];
  const incoming = structuredClone(local); incoming.questions[0] = touch(incoming.questions[0], { answer: "alternative" });
  const next = moveToTrash(mergeData(local, incoming).state, "questions", "q"), entry = next.trash[0];
  const same = structuredClone(next); same.conflicts = structuredClone(entry.conflicts);
  assert.equal(restoreTrash(same, entry.id).conflicts.length, 1);
  const collision = structuredClone(next);
  collision.conflicts = [{ ...structuredClone(entry.conflicts[0]), entityId: "other-q", incoming: touch(local.questions[1], { answer: "different alternative" }) }];
  const restored = restoreTrash(collision, entry.id);
  assert.equal(restored.conflicts.length, 2);
  assert.notEqual(restored.conflicts[0].id, restored.conflicts[1].id);
  assert.equal(validateState(restored), true);
});
test("trash conflict validation checks shape and private dependency completeness", () => {
  const local = blankState(); local.questions = [entity("q", { text: "current" })];
  local.companies = [entity("alt-company", { name: "alternative parent" })];
  const incoming = structuredClone(local); incoming.questions[0] = touch(incoming.questions[0], { companyId: "alt-company" });
  const next = moveToTrash(mergeData(local, incoming).state, "questions", "q");
  const brokenShape = structuredClone(next); brokenShape.trash[0].conflicts = "bad";
  assert.throws(() => validateState(brokenShape), /垃圾箱冲突/);
  const brokenEntity = structuredClone(next); brokenEntity.trash[0].conflicts[0].incoming.revision = 0;
  assert.throws(() => validateState(brokenEntity), /revision/);
  const missingDependency = structuredClone(next); missingDependency.trash[0].dependencies.companies = [];
  assert.throws(() => validateState(missingDependency), /垃圾箱冲突版本.companyId 引用不存在/);
});
test("trash merge fingerprints include conflict contents while ignoring their IDs and timestamps", () => {
  const local = blankState(); local.questions = [entity("q", { text: "current" })];
  const incoming = structuredClone(local); incoming.questions[0] = touch(incoming.questions[0], { answer: "alternative" });
  const first = moveToTrash(mergeData(local, incoming).state, "questions", "q");
  const copy = structuredClone(first); copy.trash[0].conflicts[0].id = "different-conflict-id";
  copy.trash[0].conflicts[0].createdAt = "2026-10-22T12:00:00.000Z";
  assert.equal(mergeData(first, copy).state.trash.length, 1);
  copy.trash[0].conflicts[0].incoming.answer = "another alternative";
  const merged = mergeData(first, copy).state;
  assert.equal(merged.trash.length, 2);
  assert.equal(mergeData(merged, copy).state.trash.length, 2);
});
test("legacy trash packages lacking conflicts remain valid and recover normally", () => {
  const next = moveToTrash(fixture(), "sessions", "session");
  delete next.trash[0].conflicts;
  assert.equal(validateState(next), true);
  assert.equal(restoreTrash(next, next.trash[0].id).sessions.length, 1);
});

test("exclusive attachment alternatives follow their owner into trash and disappear on permanent deletion", () => {
  const local = blankState();
  local.questions = [entity("q", { text: "current", attachmentIds: ["audio"] })];
  local.attachments = [audio("audio")];
  const incoming = structuredClone(local);
  incoming.attachments[0] = touch(incoming.attachments[0], { name: "PRIVATE-ATTACHMENT-ALTERNATIVE.webm", data: "BQY=" });
  const state = mergeData(local, incoming).state;
  const next = moveToTrash(state, "questions", "q"), entry = next.trash[0];
  assert.equal(next.conflicts.length, 0);
  assert.equal(entry.conflicts[0].collection, "attachments");
  assert.equal(entry.conflicts[0].incoming.data, "BQY=");
  assert.equal(JSON.stringify(deleteTrash(next, entry.id)).includes("PRIVATE-ATTACHMENT-ALTERNATIVE"), false);
  assert.equal(restoreTrash(next, entry.id).conflicts[0].incoming.data, "BQY=");
});
