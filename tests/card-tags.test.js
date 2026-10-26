import test from "node:test";
import assert from "node:assert/strict";
import { cardTags, orderedCardTags, sortContentCards, filterContentCards, reorderCardTag } from "../card-tags.js";
import { blankState, touch, validateState, mergeData } from "../core.js";
import { exportBackup, importBackup } from "../db.js";
const card = (id, patch = {}) => touch({ id }, { title: id, content: `${id}完整正文`, ...patch });
const ids = (cards) => cards.map((item) => item.id);

test("category, variant and custom tags are searchable even on cards with no custom tags", () => {
  assert.deepEqual(cardTags(card("legacy", { category: "项目经历", variant: "长版" })), ["项目经历", "长版"]);
  assert.deepEqual(cardTags(card("all", { category: " 协作 ", variant: "短版", tags: ["协作", "短版", " 领导力 ", "", "   "] })), ["协作", "短版", "领导力"]);
  assert.deepEqual(cardTags(null), []);
  assert.deepEqual(cardTags({ category: " ", variant: 3, tags: [null, "可用"] }), ["可用"]);
});
test("Chinese, punctuation and object-key-like tags remain distinct, literal labels", () => {
  const special = ["__proto__", "constructor", "A/B", "C++", "星·月 ✦", "项目[1]", "原型<文本>"];
  const source = card("special", { category: "__proto__", variant: "constructor", tags: special });
  assert.deepEqual(cardTags(source), special);
  assert.deepEqual(orderedCardTags([source], [...special].reverse()), [...special].reverse());
  for (const tag of special) assert.deepEqual(ids(filterContentCards([source], tag)), ["special"]);
  assert.equal({}.polluted, undefined);
});
test("current tags follow saved order and new tags append by first appearance without editing history", () => {
  const cards = [card("a", { category: "甲", variant: "长版", tags: ["新一"] }), card("b", { category: "乙", tags: ["新二", "新一"] })];
  const saved = ["暂时没有卡片", "乙", "甲"], before = structuredClone({ cards, saved });
  assert.deepEqual(orderedCardTags(cards, saved), ["乙", "甲", "长版", "新一", "新二"]);
  assert.deepEqual(orderedCardTags([], saved), []);
  assert.deepEqual({ cards, saved }, before);
  const rebuilt = [...cards, card("rebuilt", { category: "暂时没有卡片" })];
  assert.equal(orderedCardTags(rebuilt, saved)[0], "暂时没有卡片");
});
test("the earliest matching tag controls multi-tag priority with a stable tie break", () => {
  const cards = [
    card("unlabeled"), card("low", { category: "低" }), card("multi", { category: "低", tags: ["高"] }),
    card("high-a", { category: "高" }), card("high-b", { tags: ["高", "中"] }), card("middle", { variant: "中" }), card("empty", { tags: [] }),
  ];
  const order = ["高", "中", "低"], before = structuredClone({ cards, order });
  assert.deepEqual(ids(sortContentCards(cards, order)), ["multi", "high-a", "high-b", "middle", "low", "unlabeled", "empty"]);
  assert.deepEqual({ cards, order }, before);
  assert.deepEqual(ids(sortContentCards([card("a"), card("b"), card("c")])), ["a", "b", "c"]);
});
test("filtering uses literal tags and preserves whole-library ranking", () => {
  const cards = [card("both", { category: "低", tags: ["高"] }), card("low", { category: "低" }), card("high", { variant: "高" }), card("blank")];
  assert.deepEqual(ids(filterContentCards(cards, "低", ["高", "低"])), ["both", "low"]);
  assert.deepEqual(ids(filterContentCards(cards, " 高 ", ["高", "低"])), ["both", "high"]);
  assert.deepEqual(ids(filterContentCards(cards, "不存在", ["高", "低"])), []);
  assert.deepEqual(filterContentCards(cards, null, ["高", "低"]), sortContentCards(cards, ["高", "低"]));
  assert.deepEqual(filterContentCards(cards, "", ["高", "低"]), sortContentCards(cards, ["高", "低"]));
});
test("drag ordering returns a new list, keeps absent labels and handles move-to-end and self moves", () => {
  const order = Object.freeze(["甲", "暂时消失", "乙", "丙"]);
  assert.deepEqual(reorderCardTag(order, "丙", "甲"), ["丙", "甲", "暂时消失", "乙"]);
  assert.deepEqual(reorderCardTag(order, "甲", null), ["暂时消失", "乙", "丙", "甲"]);
  const self = reorderCardTag(order, "乙", "乙");
  assert.deepEqual(self, order); assert.notEqual(self, order);
  assert.deepEqual(order, ["甲", "暂时消失", "乙", "丙"]);
  const cards = [card("b", { category: "乙" }), card("a", { category: "甲" })];
  assert.deepEqual(ids(sortContentCards(cards, reorderCardTag(["甲", "乙"], "乙", "甲"))), ["b", "a"]);
});
test("invalid orders and unknown drag targets fail readably without mutating input", () => {
  for (const invalid of [null, {}, "甲", [""], [" "], [1], ["甲", "甲"], ["甲", " 甲 "]]) {
    assert.throws(() => orderedCardTags([], invalid), /标签操作失败/);
    assert.throws(() => reorderCardTag(invalid, "甲", null), /标签操作失败/);
  }
  const order = ["甲", "乙"], before = structuredClone(order);
  assert.throws(() => reorderCardTag(order, "未知", "甲"), /找不到要拖动/);
  assert.throws(() => reorderCardTag(order, "甲", "未知"), /找不到目标/);
  assert.throws(() => filterContentCards([], {}), /筛选标签必须是文本/);
  assert.throws(() => sortContentCards(null), /素材卡必须是数组/);
  assert.deepEqual(order, before);
});
test("tag order settings are optional, nonempty text arrays without normalized duplicates", () => {
  assert.equal(validateState(blankState()), true);
  const valid = blankState(); valid.settings.contentCardTagOrder = ["中文标签", "长版", "__proto__", "不存在但保留"];
  assert.equal(validateState(valid), true);
  for (const value of [null, "甲", {}, [""], [" "], [42], ["甲", "甲"], ["甲", " 甲 "]]) {
    const invalid = blankState(); invalid.settings.contentCardTagOrder = value;
    assert.throws(() => validateState(invalid), /素材卡标签顺序/);
  }
  const empty = blankState(); empty.settings.contentCardTagOrder = [];
  assert.equal(validateState(empty), true);
});
test("incremental settings import retains local order and full incoming order once", async () => {
  const local = blankState(); local.settings.contentCardTagOrder = ["甲", "乙", "历史标签"];
  const incoming = blankState(); incoming.settings.contentCardTagOrder = ["乙", "甲", "新标签"];
  const before = structuredClone({ local, incoming });
  const merged = await importBackup(exportBackup(incoming), local);
  assert.deepEqual(merged.state.settings.contentCardTagOrder, local.settings.contentCardTagOrder);
  assert.deepEqual(merged.state.conflicts[0].incoming.contentCardTagOrder, incoming.settings.contentCardTagOrder);
  assert.equal(mergeData(merged.state, incoming).state.conflicts.length, 1);
  assert.deepEqual({ local, incoming }, before);
});
test("backup replacement round-trips tag order and workspace restrictions keep demo order isolated", async () => {
  const formal = blankState(); formal.settings.contentCardTagOrder = ["正式专用"];
  const demo = blankState(); demo.settings.contentCardTagOrder = ["演示专用"];
  const formalBefore = structuredClone(formal), demoBefore = structuredClone(demo);
  const restored = await importBackup(exportBackup(formal), blankState(), { mode: "replace" });
  assert.deepEqual(restored.state.settings.contentCardTagOrder, ["正式专用"]);
  await assert.rejects(importBackup(exportBackup(demo, { workspace: "demo" }), formal), { code: "WORKSPACE_MISMATCH" });
  await assert.rejects(importBackup(exportBackup(formal), demo, { workspace: "demo", mode: "replace" }), { code: "WORKSPACE_MISMATCH" });
  assert.deepEqual(formal, formalBefore); assert.deepEqual(demo, demoBefore);
});
test("legacy backups lacking tag-order settings stay readable without added seed data", async () => {
  const old = blankState(); delete old.settings.contentCardTagOrder; delete old.contentCards;
  old.questions = [touch({ id: "legacy-q" }, { text: "旧问题", answer: "完整旧答案" })];
  const restored = await importBackup(exportBackup(old), blankState(), { mode: "replace" });
  assert.equal(restored.state.settings.contentCardTagOrder, undefined);
  assert.deepEqual(restored.state.contentCards, []);
  assert.deepEqual(restored.state.questions, old.questions);
});
