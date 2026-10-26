import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { blankState } from "../core.js";
const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("async function clearCurrentArchive() {");
assert.ok(start >= 0);
const body = source.slice(start, source.indexOf("\nasync function changeTrash(", start));
function fixture({ confirm = true, recording = false, rejectSave = false } = {}) {
  const original = { ...blankState(), questions: [{ id: "retained" }], scripts: [{ id: "script" }], settings: { custom: true } };
  const other = { ...blankState(), scripts: [{ id: "other-space" }] };
  const writes = [], messages = [], confirmations = [];
  const c = { state: original, activeWorkspace: "formal", workspaceBusy: false, switchingWorkspace: false,
    train: { recording }, editor: null, saveQueue: Promise.resolve(), saveError: false, trainingStartedAt: null,
    bulkSelection: { ids: new Set(["retained"]) }, view: { search: "old" },
    toast: (text) => messages.push(text), trainingLocked: () => false, flushEditor: () => true, closeEditor() {},
    blankState, createTrainingState: () => ({ tags: [], attachmentIds: [] }), spaceTitle: () => "正式档案", render() {},
    window: { confirm: (message) => { confirmations.push(message); return confirm; } },
    saveState: async (state, options) => { if (rejectSave) throw new Error("storage failure"); writes.push({ state, options }); },
  };
  c.beginWorkspaceTask = () => { const task = { workspace: c.activeWorkspace, state: c.state }; c.workspaceBusy = task; return task; };
  c.verifyWorkspaceTask = (task) => { if (c.workspaceBusy !== task || task.workspace !== c.activeWorkspace || task.state !== c.state) throw new Error("stale workspace"); };
  c.endWorkspaceTask = (task) => { if (c.workspaceBusy === task) c.workspaceBusy = false; };
  vm.createContext(c); vm.runInContext(body, c);
  return { c, original, other, writes, messages, confirmations };
}
test("cancelled archive clearing never writes or resets selected records", async () => {
  const f = fixture({ confirm: false }); await f.c.clearCurrentArchive();
  assert.equal(f.writes.length, 0); assert.equal(f.c.state, f.original); assert.equal(f.c.bulkSelection.ids.has("retained"), true);
  assert.equal(f.c.workspaceBusy, false); assert.match(f.confirmations[0], /录音、附件、设置、冲突版本和垃圾箱/);
});
test("confirmed archive clearing writes only the captured workspace and resets local training selections", async () => {
  const f = fixture(), beforeOther = structuredClone(f.other); await f.c.clearCurrentArchive();
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].options.workspace, "formal"); assert.deepEqual(f.writes[0].state, blankState());
  assert.deepEqual(f.other, beforeOther); assert.equal(f.c.train.tags.length, 0); assert.equal(f.c.bulkSelection.ids.size, 0); assert.equal(f.c.workspaceBusy, false);
});
test("recording prevents archive clearing before confirmation or storage access", async () => {
  const f = fixture({ recording: true }); await f.c.clearCurrentArchive(); assert.equal(f.confirmations.length, 0); assert.equal(f.writes.length, 0);
});
test("a changed workspace during a pending save cancels archive clearing", async () => {
  const f = fixture(); let resolve; f.c.saveQueue = new Promise((r) => { resolve = r; });
  const pending = f.c.clearCurrentArchive(); f.c.activeWorkspace = "demo"; resolve(); await pending;
  assert.equal(f.writes.length, 0); assert.equal(f.c.state, f.original); assert.equal(f.confirmations.length, 0); assert.equal(f.c.workspaceBusy, false);
});
test("storage failure preserves the original in-memory archive", async () => {
  const f = fixture({ rejectSave: true }); await f.c.clearCurrentArchive(); assert.equal(f.c.state, f.original); assert.equal(f.c.workspaceBusy, false); assert.match(f.messages[0], /storage failure/);
});
