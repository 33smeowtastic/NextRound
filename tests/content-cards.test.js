import test from "node:test";
import assert from "node:assert/strict";
import { blankState, COLLECTIONS, normalizeState, touch, validateState, mergeData } from "../core.js";
import { compositionToText, appendCardComposition, moveCompositionPart, removeCompositionPart, updateCompositionPart } from "../content-cards.js";
import { moveToTrash, restoreTrash, deleteTrash } from "../trash.js";
import { exportBackup, importBackup } from "../db.js";
import { separateLegacyState } from "../workspaces.js";
const entity = (id, patch = {}) => touch({ id }, patch);
const card = (id = "card-1", content = "我负责跨团队协调。", variant = "短版") => entity(id, { title: "协作经历", content, category: "项目经历", variant, tags: ["协作"] });
const part = (id, text, sourceCardId = null) => ({ id, title: id, text, sourceCardId });

test("content cards are a full collection; legacy archives normalize without changing any existing data", () => {
  assert.equal(COLLECTIONS.includes("contentCards"), true);
  const old = blankState(); delete old.contentCards; delete old.trash;
  old.questions = [entity("q", { text: "问题", answer: "完整手写回答", custom: { retained: true } })];
  const before = structuredClone(old);
  assert.equal(validateState(old), true);
  const normalized = normalizeState(old);
  assert.deepEqual(normalized.contentCards, []); assert.deepEqual(normalized.trash, []);
  assert.deepEqual(normalized.questions, old.questions);
  assert.deepEqual(old, before);
  const merged = mergeData(old, old).state;
  assert.deepEqual(merged.contentCards, []);
  assert.deepEqual(merged.questions, old.questions);
});
test("source cards validate independently and missing provenance is intentionally allowed", () => {
  const state = blankState(); state.contentCards = [card()];
  state.questions = [entity("q", { text: "问题", answer: "历史快照", composition: [part("p", "历史快照", "deleted-source-card")] })];
  assert.equal(validateState(state), true);
  for (const patch of [{ title: 3 }, { content: {} }, { category: [] }, { variant: false }, { tags: [42] }]) {
    const invalid = structuredClone(state); Object.assign(invalid.contentCards[0], patch);
    assert.throws(() => validateState(invalid), /校验失败/);
  }
  const collision = structuredClone(state); collision.contentCards[0].id = "q";
  assert.throws(() => validateState(collision), /ID 重复/);
});
test("appending snapshots preserves an existing handwritten answer and never mutates its source", () => {
  const original = entity("q", { answer: "开头手写内容\n保留换行", custom: { kept: true } }), source = card();
  const before = structuredClone({ original, source });
  const result = appendCardComposition(original, source, "answer");
  assert.equal(result.composition.length, 2);
  assert.equal(result.composition[0].sourceCardId, null);
  assert.equal(result.composition[0].text, original.answer);
  assert.equal(result.composition[1].sourceCardId, source.id);
  assert.equal(result.composition[1].variant, "短版");
  assert.equal(result.answer, `${original.answer}\n\n${source.content}`);
  assert.deepEqual({ original, source }, before);
  source.content = "来源后来被修改";
  assert.equal(result.composition[1].text, before.source.content);
  assert.equal(result.answer.includes("来源后来被修改"), false);
  result.custom.kept = false;
  assert.equal(original.custom.kept, true);
});
test("script compositions can combine short/long cards, reorder, edit and remove parts consistently", () => {
  const short = card("short", "简述结果", "短版"), long = card("long", "详细过程\n保留细节", "长版");
  const first = appendCardComposition(entity("script", { content: "" }), short, "content");
  const combined = appendCardComposition(first, long, "content");
  const before = structuredClone(combined), [shortPart, longPart] = combined.composition;
  const reordered = moveCompositionPart(combined, longPart.id, shortPart.id, "content");
  assert.equal(reordered.content, `${long.content}\n\n${short.content}`);
  assert.deepEqual(moveCompositionPart(reordered, longPart.id, null, "content").composition.map((item) => item.id), [shortPart.id, longPart.id]);
  assert.deepEqual(moveCompositionPart(combined, shortPart.id, shortPart.id, "content"), combined);
  const edited = updateCompositionPart(reordered, longPart.id, "适配这个岗位后的说法", "content");
  assert.equal(edited.content, `适配这个岗位后的说法\n\n${short.content}`);
  assert.equal(long.content, "详细过程\n保留细节");
  const remaining = removeCompositionPart(edited, shortPart.id, "content");
  assert.equal(remaining.content, "适配这个岗位后的说法");
  const empty = removeCompositionPart(remaining, longPart.id, "content");
  assert.deepEqual(empty.composition, []); assert.equal(empty.content, "");
  assert.deepEqual(combined, before);
  const state = blankState(); state.scripts = [touch(empty)];
  assert.equal(validateState(state), true);
});
test("composition text joining preserves exact user text, including whitespace and empty parts", () => {
  assert.equal(compositionToText([part("a", "  手写\n"), part("b", ""), part("c", "结尾 ")]), "  手写\n\n\n\n\n结尾 ");
  assert.equal(compositionToText([]), "");
});
test("editing helpers reject missing IDs or inconsistent handwritten edits without modifying inputs", () => {
  const record = appendCardComposition(entity("q", { answer: "旧正文" }), card(), "answer"), before = structuredClone(record);
  for (const action of [
    () => moveCompositionPart(record, "missing", null, "answer"),
    () => moveCompositionPart(record, record.composition[0].id, "missing", "answer"),
    () => updateCompositionPart(record, "missing", "x", "answer"),
    () => removeCompositionPart(record, "missing", "answer"),
    () => appendCardComposition(record, card(), "notes"),
    () => updateCompositionPart(record, record.composition[0].id, {}, "answer"),
  ]) assert.throws(action, /内容编排失败/);
  assert.deepEqual(record, before);
  const edited = { ...structuredClone(record), answer: "用户直接编辑后的完整正文" }, snapshot = structuredClone(edited);
  assert.throws(() => appendCardComposition(edited, card(), "answer"), /手写内容/);
  assert.deepEqual(edited, snapshot);
  delete edited.composition;
  const appended = appendCardComposition(edited, card(), "answer");
  assert.equal(appended.composition[0].text, "用户直接编辑后的完整正文");
});
test("composition validation rejects malformed parts, duplicate IDs, prototype keys and mismatching text", () => {
  const valid = blankState();
  valid.questions = [entity("q", { text: "问题", answer: "段落", composition: [part("p", "段落")] })];
  assert.equal(validateState(valid), true);
  const variants = [null, {}, [null], [{ ...part("p", "段落"), text: 42 }], [{ ...part("p", "段落"), sourceCardId: {} }], [{ ...part("p", "段落"), title: [] }], [{ ...part("p", "段落"), variant: 1 }], [{ ...part("p", "段落"), id: "" }], [part("p", "段落"), part("p", "second")]];
  for (const composition of variants) {
    const invalid = structuredClone(valid); invalid.questions[0].composition = composition;
    assert.throws(() => validateState(invalid), /校验失败/);
  }
  const mismatch = structuredClone(valid); mismatch.questions[0].answer = "different";
  assert.throws(() => validateState(mismatch), /正文与 composition/);
  const malicious = JSON.parse(JSON.stringify(valid)); malicious.questions[0].composition[0] = JSON.parse('{"id":"p","sourceCardId":null,"title":"p","text":"段落","__proto__":{"polluted":true}}');
  assert.throws(() => validateState(malicious), /保留字段/);
  assert.equal({}.polluted, undefined);
});
test("source card deletion and edits leave composed questions/scripts unchanged", () => {
  const state = blankState(), source = card(); state.contentCards = [source];
  state.questions = [appendCardComposition(entity("q", { text: "问题", answer: "" }), source, "answer")];
  state.scripts = [appendCardComposition(entity("s", { title: "自我介绍", content: "" }), source, "content")];
  const answers = structuredClone({ questions: state.questions, scripts: state.scripts });
  state.contentCards[0] = touch(source, { content: "新的长版本", variant: "长版" });
  const next = moveToTrash(state, "contentCards", source.id), entry = next.trash[0];
  assert.equal(next.contentCards.length, 0);
  assert.deepEqual({ questions: next.questions, scripts: next.scripts }, answers);
  assert.equal(entry.dependencies.questions.length, 0);
  assert.equal(validateState(next), true);
  const deleted = deleteTrash(next, entry.id);
  assert.deepEqual({ questions: deleted.questions, scripts: deleted.scripts }, answers);
  assert.equal(restoreTrash(next, entry.id).contentCards[0].content, "新的长版本");
});
test("old trash packages without content-card arrays validate, normalize and restore", () => {
  const state = blankState(); state.questions = [entity("q", { text: "旧问题", answer: "旧回答" })];
  const old = moveToTrash(state, "questions", "q"); delete old.contentCards;
  delete old.trash[0].records.contentCards; delete old.trash[0].dependencies.contentCards;
  const before = structuredClone(old);
  assert.equal(validateState(old), true);
  const normalized = normalizeState(old);
  assert.deepEqual(normalized.trash[0].records.contentCards, []);
  assert.deepEqual(normalized.trash[0].dependencies.contentCards, []);
  const restored = restoreTrash(old, old.trash[0].id);
  assert.equal(restored.questions[0].answer, "旧回答");
  assert.deepEqual(restored.contentCards, []);
  assert.deepEqual(old, before);
});
test("card and composition snapshots round-trip through complete backups and incremental imports", async () => {
  const state = blankState(), source = card(); state.contentCards = [source];
  state.questions = [appendCardComposition(entity("q", { text: "问题", answer: "手写" }), source, "answer")];
  state.scripts = [appendCardComposition(entity("script", { title: "项目介绍", content: "" }), source, "content")];
  state.questions[0].history = [{ savedAt: "2026-10-22T00:00:00Z", answer: state.questions[0].answer, composition: structuredClone(state.questions[0].composition) }];
  const backup = exportBackup(state), restored = await importBackup(backup, blankState());
  assert.deepEqual(restored.state, state);
  const repeated = await importBackup(backup, restored.state);
  assert.equal(repeated.report.added, 0); assert.equal(repeated.report.conflicts, 0);
  assert.deepEqual(repeated.state, state);
  const incoming = structuredClone(state); incoming.contentCards[0] = touch(incoming.contentCards[0], { content: "new source" });
  const changed = mergeData(state, incoming).state;
  assert.equal(changed.contentCards[0].content, source.content);
  assert.equal(changed.conflicts[0].collection, "contentCards");
  assert.equal(changed.conflicts[0].incoming.content, "new source");
  assert.equal(mergeData(changed, incoming).state.conflicts.length, 1);
});
test("replacement imports include content cards and clear previous independent cards", async () => {
  const local = blankState(); local.contentCards = [card("local")];
  const incoming = blankState(); incoming.contentCards = [card("incoming", "完整替换版本", "长版")];
  const result = await importBackup(exportBackup(incoming), local, { mode: "replace" });
  assert.deepEqual(result.state.contentCards, incoming.contentCards);
  assert.equal(result.state.contentCards.some((item) => item.id === "local"), false);
  await assert.rejects(importBackup(exportBackup(incoming, { workspace: "demo" }), local), { code: "WORKSPACE_MISMATCH" });
});
test("legacy migration preserves user cards and does not follow sourceCardId as a live business reference", () => {
  const legacy = blankState(); legacy.settings.demo = true;
  legacy.companies = [entity("demo-company-1", { name: "historical demo" })];
  legacy.contentCards = [card("personal-card")];
  legacy.questions = [entity("personal-question", { text: "个人问题", answer: "独立快照", composition: [part("p", "独立快照", "demo-company-1")] })];
  const separated = separateLegacyState(legacy).state;
  assert.deepEqual(separated.contentCards, legacy.contentCards);
  assert.deepEqual(separated.companies, []);
  assert.equal(separated.questions[0].answer, "独立快照");
  const old = structuredClone(legacy); delete old.contentCards;
  assert.deepEqual(separateLegacyState(old).state.contentCards, []);
});

test("old backup replacement and incremental import fill missing cards without losing handwritten archives", async () => {
  const old = blankState(); delete old.contentCards; delete old.trash;
  old.questions = [entity("legacy-q", { text: "旧问题", answer: "旧手写答案", history: [{ answer: "更早版本", custom: { keep: true } }] })];
  old.attachments = [entity("legacy-audio", { name: "录音.wav", mime: "audio/wav", data: "AQIDBA==" })];
  const before = structuredClone(old), backup = exportBackup(old);
  const local = blankState(); local.contentCards = [card("local-card")];
  const replacement = await importBackup(backup, local, { mode: "replace" });
  assert.deepEqual(replacement.state.contentCards, []);
  assert.deepEqual(replacement.state.trash, []);
  assert.deepEqual(replacement.state.questions, old.questions);
  assert.deepEqual(replacement.state.attachments, old.attachments);
  const merged = await importBackup(backup, local);
  assert.equal(merged.state.contentCards[0].id, "local-card");
  assert.deepEqual(merged.state.questions, old.questions);
  assert.deepEqual(old, before);
});
test("card trash and conflict backups preserve full alternatives without requiring the source in compositions", () => {
  const local = blankState(); local.contentCards = [card()];
  local.questions = [appendCardComposition(entity("q", { answer: "", text: "问题" }), local.contentCards[0], "answer")];
  const incoming = structuredClone(local); incoming.contentCards[0] = touch(incoming.contentCards[0], { content: "alternate card content" });
  const removed = moveToTrash(mergeData(local, incoming).state, "contentCards", "card-1");
  assert.equal(removed.conflicts.length, 0);
  assert.equal(removed.trash[0].conflicts[0].incoming.content, "alternate card content");
  const repeated = mergeData(removed, removed).state;
  assert.equal(repeated.trash.length, 1);
  assert.equal(repeated.questions[0].answer, local.questions[0].answer);
  const invalid = structuredClone(removed); invalid.trash[0].records.contentCards = [];
  assert.throws(() => validateState(invalid), /垃圾箱缺少原始记录/);
  const restored = restoreTrash(removed, removed.trash[0].id);
  assert.equal(restored.contentCards[0].content, local.contentCards[0].content);
  assert.equal(restored.conflicts[0].incoming.content, "alternate card content");
});

test("an empty composition preserves the handwritten full answer before appending a card", () => {
  for (const contentKey of ["answer", "content"]) {
    const original = entity("written", { [contentKey]: "全文手写修改\n逐字保留", composition: [] }), before = structuredClone(original);
    const next = appendCardComposition(original, card(), contentKey);
    assert.equal(next.composition.length, 2);
    assert.equal(next.composition[0].sourceCardId, null);
    assert.equal(next.composition[0].text, original[contentKey]);
    assert.equal(next[contentKey], `${original[contentKey]}\n\n${card().content}`);
    assert.deepEqual(original, before);
    const empty = appendCardComposition(entity("empty", { [contentKey]: "", composition: [] }), card(), contentKey);
    assert.equal(empty.composition.length, 1);
  }
});
test("saving an edited full answer or script with cleared composition remains valid and round-trips", async () => {
  const state = blankState();
  state.questions = [entity("q", { text: "问题", answer: "全篇重新写过的回答", composition: [] })];
  state.scripts = [entity("s", { title: "自我介绍", content: "全篇重新写过的介绍", composition: [] })];
  assert.equal(validateState(state), true);
  assert.deepEqual((await importBackup(exportBackup(state), blankState())).state, state);
  for (const [collection, contentKey] of [["questions", "answer"], ["scripts", "content"]]) {
    const invalid = structuredClone(state); invalid[collection][0][contentKey] = 42;
    assert.throws(() => validateState(invalid), /必须是文本/);
  }
});
