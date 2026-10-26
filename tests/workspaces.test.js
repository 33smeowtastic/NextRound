import test from "node:test";
import assert from "node:assert/strict";
import { blankState, touch, validateState, COLLECTIONS } from "../core.js";
import {
  separateLegacyState,
  hasLegacyDemo,
  stripLegacyDemoConflicts,
  workspaceName,
  prepareFormalBackup,
} from "../workspaces.js";
import { exportBackup, importBackup, saveState } from "../db.js";
import { moveToTrash, restoreTrash } from "../trash.js";
const record = (id, fields = {}) => touch({ id }, fields);
test("legacy demo conflicts are removed without touching formal records or personal conflicts", () => {
  const state = blankState();
  state.companies.push(record("personal-company", { name: "个人公司" }));
  state.conflicts = [
    { id: "sample", collection: "companies", entityId: "demo-company-1", incoming: { id: "demo-company-1" } },
    { id: "demo-settings", collection: "settings", entityId: "settings", incoming: { demo: true } },
    { id: "personal", collection: "companies", entityId: "personal-company", incoming: { id: "personal-company" } },
  ];
  const original = structuredClone(state);
  const cleaned = stripLegacyDemoConflicts(state);
  assert.deepEqual(cleaned.companies, state.companies);
  assert.deepEqual(cleaned.conflicts.map((item) => item.id), ["personal"]);
  assert.deepEqual(state, original);
});
function legacy() {
  const state = blankState();
  state.settings.demo = true;
  state.settings.keywords = ["用户自己增加的规则"];
  state.companies = [
    record("demo-company-1", {
      name: "被用户改过的演示公司",
      history: [{ text: "用户历史原文" }],
    }),
  ];
  state.jobs = [
    record("demo-job-1", {
      title: "演示岗位",
      companyId: "demo-company-1",
      status: "关注",
    }),
  ];
  state.questions = [
    record("demo-q-1", {
      text: "演示问题",
      answer: "用户在演示问题上写过的答案",
    }),
  ];
  return state;
}
test("pure legacy demo is separated without rewriting its original text or settings", () => {
  const before = legacy(),
    original = structuredClone(before);
  const result = separateLegacyState(before);
  assert.equal(hasLegacyDemo(before), true);
  assert.equal(result.state.companies.length, 0);
  assert.equal(result.state.jobs.length, 0);
  assert.equal(result.state.questions.length, 0);
  assert.equal(result.state.settings.demo, undefined);
  assert.deepEqual(result.state.settings.keywords, ["用户自己增加的规则"]);
  assert.deepEqual(before, original);
});
test("mixed legacy preserves personal entities, transitive dependencies, attachments, history and conflicts", () => {
  const state = legacy();
  state.jobs.push(
    record("personal-job", {
      title: "真实岗位",
      companyId: "demo-company-1",
      status: "待面试",
    }),
  );
  state.attachments.push(
    record("personal-audio", {
      name: "练习.wav",
      mime: "audio/wav",
      data: "data:audio/wav;base64,AQIDBA==",
    }),
  );
  state.sessions.push(
    record("personal-session", {
      jobId: "personal-job",
      companyId: "demo-company-1",
      questionIds: ["demo-q-1"],
      attachmentIds: ["personal-audio"],
      notes: "个人训练原文",
    }),
  );
  state.conflicts.push({
    id: "personal-conflict",
    collection: "companies",
    entityId: "demo-company-1",
    createdAt: new Date().toISOString(),
    incoming: record("demo-company-1", { name: "旧候选" }),
  });
  const result = separateLegacyState(state);
  assert.equal(validateState(result.state), true);
  assert.deepEqual(result.state.companies, state.companies);
  assert.deepEqual(
    result.state.jobs.map((j) => j.id),
    ["personal-job"],
  );
  assert.deepEqual(result.state.questions, state.questions);
  assert.deepEqual(result.state.attachments, state.attachments);
  assert.deepEqual(result.state.conflicts, state.conflicts);
  assert.deepEqual(result.state.sessions, state.sessions);
  assert.deepEqual(
    new Set(result.report.retainedDependencyIds),
    new Set(["demo-company-1", "demo-q-1"]),
  );
});
test("only known seed IDs are classified as demo; user IDs sharing the prefix survive", () => {
  const state = blankState();
  state.companies.push(record("demo-my-real-company", { name: "真实公司" }));
  assert.equal(hasLegacyDemo(state), false);
  assert.deepEqual(separateLegacyState(state).state.companies, state.companies);
  assert.throws(() => workspaceName({ workspace: "other" }), /未知/);
});
test("workspace backup metadata prevents both directions of accidental import and legacy demo imports", async () => {
  const demo = legacy(),
    formal = blankState();
  formal.companies.push(record("real-company", { name: "我的公司" }));
  const untouched = structuredClone(formal);
  const demoBackup = exportBackup(demo, { workspace: "demo" });
  assert.equal(JSON.parse(await demoBackup.text()).workspace, "demo");
  await assert.rejects(importBackup(demoBackup, formal), {
    code: "WORKSPACE_MISMATCH",
  });
  await assert.rejects(
    importBackup(JSON.stringify({ format: "NextRound", state: demo }), formal),
    { code: "WORKSPACE_MISMATCH" },
  );
  await assert.rejects(
    importBackup(exportBackup(formal), blankState(), { workspace: "demo" }),
    { code: "WORKSPACE_MISMATCH" },
  );
  const accepted = await importBackup(demoBackup, blankState(), {
    workspace: "demo",
  });
  assert.equal(accepted.state.companies[0].name, demo.companies[0].name);
  assert.deepEqual(formal, untouched);
  await assert.rejects(saveState(demo), { code: "WORKSPACE_MISMATCH" });
});
test("previous explicit formal backups with migrated seed dependencies remain recoverable, while new exports block the ambiguity", async () => {
  const state = legacy();
  state.jobs.push(
    record("personal-job", {
      title: "个人岗位",
      companyId: "demo-company-1",
      status: "关注",
    }),
  );
  const separated = separateLegacyState(state).state;
  const before = structuredClone(separated);
  assert.throws(() => exportBackup(separated), { code: "FORMAL_BACKUP_DEMO_DEPENDENCY" });
  for (const mode of ["merge", "replace"]) {
    const restored = await importBackup({ format: "NextRound", workspace: "formal", state: separated }, blankState(), { mode });
    assert.equal(restored.state.jobs[0].id, "personal-job");
    assert.equal(restored.state.companies[0].id, "demo-company-1");
  }
  assert.deepEqual(separated, before);
});


test("replacement import uses the complete incoming archive and clears prior records, settings, conflicts and trash", async () => {
  const local = blankState();
  local.companies.push(record("old-company", { name: "旧公司" }));
  local.jobs.push(record("old-job", { title: "旧岗位", companyId: "old-company", status: "关注" }));
  local.questions.push(record("old-question", { text: "旧问题" }));
  local.scripts.push(record("old-script", { title: "旧底稿", content: "旧介绍内容" }));
  local.attachments.push(record("old-audio", { name: "旧录音.wav", mime: "audio/wav", data: "data:audio/wav;base64,QQ==" }));
  local.interviews.push(record("old-interview", { companyId: "old-company", jobId: "old-job", status: "已完成", questions: [], attachmentIds: ["old-audio"] }));
  local.sessions.push(record("old-session", { title: "旧练习", duration: 30, companyId: "old-company", jobId: "old-job", scriptId: "old-script", questionIds: ["old-question"], attachmentIds: ["old-audio"] }));
  local.settings.keywords = ["旧规则"];
  local.conflicts.push({ id: "old-conflict", collection: "settings", entityId: "settings", createdAt: new Date().toISOString(), incoming: structuredClone(blankState().settings) });
  const records = Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
  records.questions.push(record("deleted-question", { text: "已删除的问题" }));
  local.trash.push({ id: "old-trash", collection: "questions", entityId: "deleted-question", label: "已删除的问题", deletedAt: new Date().toISOString(), records, dependencies: Object.fromEntries(COLLECTIONS.map((name) => [name, []])) });
  assert.equal(validateState(local), true);
  const incoming = blankState();
  incoming.companies.push(record("new-company", { name: "新公司" }));
  incoming.settings.keywords = ["新规则"];
  const payload = { format: "NextRound", workspace: "formal", state: incoming };
  const beforeLocal = structuredClone(local), beforePayload = structuredClone(payload);
  const merged = await importBackup(payload, local);
  assert.deepEqual(merged.state.companies.map((row) => row.id), ["old-company", "new-company"]);
  assert.deepEqual(merged.state.settings.keywords, ["旧规则"]);
  const replaced = await importBackup(payload, local, { mode: "replace" });
  assert.deepEqual(replaced.state, incoming);
  assert.deepEqual(replaced.state.jobs, []);
  assert.deepEqual(replaced.state.questions, []);
  for (const name of COLLECTIONS.filter((name) => name !== "companies"))
    assert.deepEqual(replaced.state[name], [], `${name} from the old archive must be gone`);
  assert.deepEqual(replaced.state.conflicts, []);
  assert.deepEqual(replaced.state.trash, []);
  assert.equal(replaced.report.added, 1);
  assert.notEqual(replaced.state, incoming);
  replaced.state.companies[0].name = "修改返回副本";
  replaced.state.settings.keywords.push("新副本规则");
  assert.deepEqual(payload, beforePayload);
  assert.deepEqual(local, beforeLocal);
});

test("replacement import rejects both cross-workspace directions without mutating inputs", async () => {
  const local = blankState(), incoming = legacy();
  const before = structuredClone({ local, incoming });
  await assert.rejects(importBackup(exportBackup(incoming, { workspace: "demo" }), local, { mode: "replace" }), { code: "WORKSPACE_MISMATCH" });
  await assert.rejects(importBackup(exportBackup(local), incoming, { workspace: "demo", mode: "replace" }), { code: "WORKSPACE_MISMATCH" });
  assert.deepEqual({ local, incoming }, before);
});

test("replacement backup must contain its own references even when local records could satisfy them", async () => {
  const local = blankState(), incoming = blankState();
  local.companies.push(record("local-company", { name: "本地公司" }));
  incoming.jobs.push(record("imported-job", { title: "引用不完整岗位", companyId: "local-company", status: "关注" }));
  const before = structuredClone({ local, incoming });
  const payload = { format: "NextRound", workspace: "formal", state: incoming };
  assert.equal((await importBackup(payload, local)).state.jobs.length, 1);
  await assert.rejects(importBackup(payload, local, { mode: "replace" }), /引用不存在/);
  assert.deepEqual({ local, incoming }, before);
});

test("unknown import modes and retired mixed recovery packages fail before changing local data", async () => {
  const local = blankState(), before = structuredClone(local);
  await assert.rejects(importBackup(exportBackup(blankState()), local, { mode: "unknown" }), /未知的导入方式/);
  for (const mode of ["merge", "replace"])
    await assert.rejects(importBackup({ format: "NextRoundLegacyRecovery", state: legacy() }, local, { mode }), /已停用/);
  assert.deepEqual(local, before);
});
test("formal export omits unreferenced known demo entities and their conflicts without mutating the archive", async () => {
  const state = legacy(); delete state.settings.demo;
  state.companies.push(record("my-company", { name: "个人真实公司" }));
  state.jobs.push(record("my-job", { title: "真实岗位", companyId: "my-company", status: "关注" }));
  state.conflicts.push({ id: "demo-alternative", collection: "companies", entityId: "demo-company-1", createdAt: new Date().toISOString(), incoming: record("demo-company-1", { name: "演示旧版本" }) });
  state.conflicts.push({ id: "my-alternative", collection: "companies", entityId: "my-company", createdAt: new Date().toISOString(), incoming: record("my-company", { name: "个人旧版本" }) });
  const before = structuredClone(state), payload = JSON.parse(await exportBackup(state).text());
  assert.deepEqual(payload.state.companies, state.companies.filter(item => item.id === "my-company"));
  assert.deepEqual(payload.state.jobs, state.jobs.filter(item => item.id === "my-job")); assert.equal(payload.state.questions.length, 0);
  assert.deepEqual(payload.state.conflicts, state.conflicts.filter(item => item.id === "my-alternative"));
  assert.equal(hasLegacyDemo(payload.state), false); assert.equal(validateState(payload.state), true); assert.deepEqual(state, before);
  const restored = await importBackup(payload, blankState(), { mode: "replace" }); assert.deepEqual(restored.state, payload.state);
});

test("all current public-track demo seed identities are recognized without broad prefix matching", async () => {
  const state = blankState();
  state.companies = [record("demo-public-unit", { name: "演示公招单位", kind: "public" }), record("demo-my-real-company", { name: "真实自定义公司" })];
  state.jobs = [record("demo-public-job", { title: "演示职位", companyId: "demo-public-unit", track: "civil-service", status: "关注" })];
  state.questions = [record("demo-public-q", { text: "演示题目", scope: "public" })];
  assert.equal(hasLegacyDemo(state), true);
  const prepared = prepareFormalBackup(state); assert.equal(prepared.report.removed.active.length, 3); assert.deepEqual(prepared.state.companies.map(item => item.id), ["demo-my-real-company"]);
  const payload = JSON.parse(await exportBackup(state).text()); assert.equal(payload.state.jobs.length, 0); assert.equal(payload.state.questions.length, 0); assert.equal(payload.state.companies[0].name, "真实自定义公司");
});
test("planned demo interview stays out of formal backup", () => {
  const state = blankState();
  state.scheduleItems = [record("demo-interview-plan-1", { title: "演示面试安排", type: "interview", startsAt: "2026-10-25T06:30:00Z" })];
  assert.equal(hasLegacyDemo(state), true);
  const prepared = prepareFormalBackup(state);
  assert.deepEqual(prepared.state.scheduleItems, []);
  assert.deepEqual(state.scheduleItems.map((item) => item.id), ["demo-interview-plan-1"]);
});

test("formal export refuses personal strong references, weak agenda links and draft dependencies rather than inventing replacements", () => {
  for (const kind of ["job", "question", "agenda", "draft"]) {
    const state = legacy(); delete state.settings.demo;
    if (kind === "job") state.jobs.push(record("my-job", { title: "个人岗位", companyId: "demo-company-1", status: "关注" }));
    if (kind === "question") state.sessions.push(record("my-session", { title: "个人训练", questionIds: ["demo-q-1"] }));
    if (kind === "agenda") state.scheduleItems.push(record("my-event", { title: "个人日程", startsAt: "2026-10-24T00:00:00Z", type: "general", companyId: "demo-company-1", companyName: "历史单位快照" }));
    if (kind === "draft") state.settings.trainingDraft = { questionIds: ["demo-q-1"] };
    const before = structuredClone(state);
    assert.throws(() => exportBackup(state), error => error.code === "FORMAL_BACKUP_DEMO_DEPENDENCY" && error.dependencies.length > 0 && /当前档案及已有备份未改变/.test(error.message));
    assert.deepEqual(state, before);
  }
});

test("pure demo trash packages are excluded while personal trash remains exactly restorable", async () => {
  const state = legacy(); delete state.settings.demo; state.companies.push(record("my-deleted-company", { name: "个人公司历史" }));
  const withDemoTrash = moveToTrash(state, "companies", "demo-company-1"), both = moveToTrash(withDemoTrash, "companies", "my-deleted-company"), before = structuredClone(both);
  const payload = JSON.parse(await exportBackup(both).text()); assert.equal(payload.state.trash.length, 1); assert.equal(payload.state.trash[0].entityId, "my-deleted-company");
  const restoredBackup = await importBackup(payload, blankState(), { mode: "replace" }), recovered = restoreTrash(restoredBackup.state, payload.state.trash[0].id);
  assert.equal(recovered.companies[0].id, "my-deleted-company"); assert.equal(recovered.companies[0].name, "个人公司历史"); assert.deepEqual(both, before);
});

test("mixed trash and personal conflict dependencies block formal export without discarding recovery data", () => {
  const state = legacy(); delete state.settings.demo; state.jobs.push(record("my-job", { title: "个人岗位", companyId: "demo-company-1", status: "关注" }));
  for (const deleted of [moveToTrash(state, "jobs", "my-job"), moveToTrash(state, "companies", "demo-company-1")]) {
    const before = structuredClone(deleted); assert.throws(() => exportBackup(deleted), { code: "FORMAL_BACKUP_DEMO_DEPENDENCY" }); assert.deepEqual(deleted, before);
  }
  const clean = blankState(); clean.companies.push(record("my-company", { name: "个人公司" })); clean.jobs.push(record("my-job", { title: "个人岗位", companyId: "my-company", status: "关注" }));
  clean.conflicts.push({ id: "my-prior-job", collection: "jobs", entityId: "my-job", createdAt: new Date().toISOString(), incoming: record("my-job", { title: "个人历史岗位", companyId: "demo-company-1", status: "关注" }) });
  assert.equal(validateState(clean), true); const before = structuredClone(clean); assert.throws(() => exportBackup(clean), { code: "FORMAL_BACKUP_DEMO_DEPENDENCY" }); assert.deepEqual(clean, before);
});

test("clean personal backups keep unknown metadata and source quotations; demo-space exports remain full fidelity", async () => {
  const state = blankState(); state.contentCards.push(record("my-card", { title: "示例代码说明", content: "用户原文提及 demo-company-1，仅为文字记录。", unifiedSource: { companyId: "demo-company-1" } }));
  const prepared = prepareFormalBackup(state); assert.deepEqual(prepared.state, state);
  const demo = legacy(), before = structuredClone(demo), payload = JSON.parse(await exportBackup(demo, { workspace: "demo" }).text());
  assert.deepEqual(payload.state, demo); assert.deepEqual(demo, before); assert.equal(payload.workspace, "demo");
});
