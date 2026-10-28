import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { blankState, touch, validateState, QUESTION_DIFFICULTIES, suggestQuestionDifficulty } from "../core.js";
import { exportBackup, importBackup } from "../db.js";
import { parseUnifiedImport, previewUnifiedImport, mergeUnifiedImport, UNIFIED_MODULES, MAX_IMPORT_BYTES } from "../unified-import.js";
const TEMPLATE = new URL("../assets/NextRound_AI整理与一键导入通用模板_V1.2_仅面试后复盘.md", import.meta.url);
const TEMPLATE_V14 = new URL("../assets/NextRound_AI整理与一键导入通用模板_V1.4_面试题三级难度.md", import.meta.url);
const TEMPLATE_V15 = new URL("../assets/NextRound_AI整理与一键导入通用模板_V1.5.md", import.meta.url);
const document = readFileSync(TEMPLATE, "utf8");
const actualExample = JSON.parse(document.match(/```json\s*\n([\s\S]*?)\n```/)[1]);
const actualV14Example = JSON.parse(readFileSync(TEMPLATE_V14, "utf8").match(/```json\s*\n([\s\S]*?)\n```/)[1]);
const actualV15Example = JSON.parse(readFileSync(TEMPLATE_V15, "utf8").match(/```json\s*\n([\s\S]*?)\n```/)[1]);
const clock = { now: "2026-10-24T12:00:00+08:00" };
const fixture = () => structuredClone(actualExample);
const preview = (input, local = blankState(), options = {}) => previewUnifiedImport(input, local, { ...clock, ...options });
const merge = (input, local = blankState(), options = {}) => mergeUnifiedImport(input, local, { ...clock, ...options });
function partial(modules) { const value = fixture(); for (const module of UNIFIED_MODULES) if (!modules.includes(module)) value[module] = []; return value; }
function freeze(value) { if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; }
function expectInvalid(change, pattern) { const value = fixture(); change(value); const before = structuredClone(value), local = blankState(); const result = preview(value, local); assert.equal(result.canImport, false); assert.match(result.errors.join(";"), pattern); assert.throws(() => merge(value, local), pattern); assert.deepEqual(value, before); assert.deepEqual(local, blankState()); }

test("the historical V1.2 Markdown remains available for backward-compatibility regression", () => {
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest(readFileSync(TEMPLATE)), "66856cd374a20bf81c4656c2dc0debe9f06bfd97813ab5e6da247f5b200d0594");
  assert.equal(actualExample.import_schema_version, "next-round-unified-1.2");
});

test("the supplied V1.4 template remains byte-exact and its seven-module example imports with independent question difficulties", async () => {
  assert.equal(createHash("sha256").update(readFileSync(TEMPLATE_V14)).digest("hex"), "cb9884fcb8920bcfc73f537b16ab52afe275aa508269f36e6c4ddf2ea35f706a");
  assert.equal(actualV14Example.import_schema_version, "next-round-unified-1.2");
  const { state, report } = merge(actualV14Example);
  assert.equal(report.added, 11);
  assert.deepEqual(state.questions.map(question => question.difficulty), ["人间", "地狱"]);
  assert.deepEqual(state.questions.map(question => question.tags), actualV14Example.questions.map(question => question.tags));
  assert.deepEqual(state.questions.map(question => question.unifiedSource), actualV14Example.questions);
  assert.equal(validateState(state), true);
  const restored = await importBackup(exportBackup(state), blankState(), { mode: "replace" });
  assert.deepEqual(restored.state.questions.map(question => question.difficulty), ["人间", "地狱"]);
  const repeated = merge(actualV14Example, state);
  assert.equal(repeated.report.added, 0); assert.equal(repeated.report.conflicts, 0); assert.equal(repeated.report.unchanged, 11);
});

test("three difficulty values persist; invalid and mixed legacy values fail before write", () => {
  assert.deepEqual(QUESTION_DIFFICULTIES, ["天堂", "人间", "地狱"]);
  for (const difficulty of QUESTION_DIFFICULTIES) {
    const value = structuredClone(actualV14Example); value.questions[0].difficulty = difficulty;
    const state = merge(value).state;
    assert.equal(state.questions[0].difficulty, difficulty);
    assert.equal(validateState(state), true);
  }
  for (const bad of ["易", "中", "难", "高", "easy", 2, null, ""]) {
    const value = structuredClone(actualV14Example); value.questions[0].difficulty = bad;
    const local = blankState(), before = structuredClone(local), result = preview(value, local);
    assert.equal(result.canImport, false, String(bad));
    assert.match(result.errors.join("；"), /difficulty/);
    assert.deepEqual(local, before);
  }
  for (const badTag of ["天堂", "中", "hard"]) {
    const value = structuredClone(actualV14Example); value.questions[0].tags.push(badTag);
    assert.match(preview(value).errors.join("；"), /difficulty|难度/);
  }
  const missing = structuredClone(actualV14Example); delete missing.questions[0].difficulty;
  assert.match(preview(missing).errors.join("；"), /difficulty 缺失/);
});

test("the current V1.5 template preserves supplied bytes and its example imports", () => {
  assert.equal(createHash("sha256").update(readFileSync(TEMPLATE_V15)).digest("hex"), "df062fb7a9e8f0f2258a8266b5bce8fd2f3df8762d82e87b2a9468172e19cfab");
  assert.equal(actualV15Example.import_schema_version, "next-round-unified-1.2");
  const { state, report } = merge(actualV15Example);
  assert.equal(report.added, 11);
  assert.equal(state.companies[0].reason, actualV15Example.companies[0].reason);
  assert.equal(state.companies[0].score_basis, actualV15Example.companies[0].score_basis);
  assert.equal(validateState(state), true);
});
test("legacy difficulty is preserved and suggested without silently rewriting local or imported records", () => {
  const oldFile = fixture(), old = merge(oldFile).state;
  assert.equal(old.questions[0].difficulty, "中");
  assert.equal(suggestQuestionDifficulty("易"), "天堂");
  assert.equal(suggestQuestionDifficulty("中"), "人间");
  assert.equal(suggestQuestionDifficulty("难"), "地狱");
  assert.match(preview(oldFile).rows.find(row => row.module === "questions").warnings.join("；"), /建议映射/);
  const modern = structuredClone(actualV14Example), p = preview(modern, old);
  const conflict = p.rows.find(row => row.module === "questions" && row.status === "conflict");
  assert.ok(conflict); assert.match(conflict.warnings.join("；"), /本地旧难度/);
  const skipped = merge(modern, old); assert.equal(skipped.state.questions[0].difficulty, "中");
  const updated = merge(modern, old, { decisions: { [conflict.key]: "update" } });
  assert.equal(updated.state.questions[0].difficulty, "人间");
  assert.equal(updated.state.conflicts.find(item => item.entityId === conflict.id)?.incoming.difficulty, "中");
});

test("the actual Markdown example imports every module with full references and separate introduction versions", () => {
  const value = fixture(), before = structuredClone(value), local = blankState();
  const result = preview(freeze(value), freeze(local)); assert.equal(result.canImport, true); assert.equal(result.rows.length, 10); assert.equal(result.rows.every(row => row.status === "new"), true);
  const { state, report } = merge(value, local); assert.equal(validateState(state), true); assert.equal(report.added, 11);
  for (const [collection, count] of [["companies",1],["jobs",2],["questions",2],["scripts",2],["contentCards",1],["scheduleItems",2],["interviews",1]]) assert.equal(state[collection].length, count, collection);
  assert.equal(state.jobs[0].companyId, state.companies[0].id); assert.equal(state.jobs[0].posting_group_id, state.jobs[1].posting_group_id); assert.notEqual(state.jobs[0].id, state.jobs[1].id);
  assert.deepEqual(state.questions[0].jobIds, state.jobs.map(record => record.id));
  assert.deepEqual(state.scripts.map(record => record.content), value.introductions[0].versions.map(version => version.content));
  assert.deepEqual(state.scripts.map(record => record.versionName), ["短版", "长版"]); assert.equal(state.scripts[0].id, value.introductions[0].id);
  assert.equal(state.scheduleItems[0].knowledgeId, state.questions[0].id); assert.equal(state.scheduleItems[0].endsAt, value.schedules[0].end_at); assert.equal(state.scheduleItems[1].allDay, true);
  assert.equal(state.interviews[0].jobId, state.jobs[1].id); assert.equal(state.interviews[0].status, "已完成");
  assert.deepEqual(value, before); assert.deepEqual(local, blankState());
});

test("raw long text, nulls, unknown fields and top-level metadata survive without truncation or source mutation", () => {
  const value = fixture(), long = "  定稿原文\n\n下一段\r\n".repeat(1500); value.jobs[0].jd_full_text = long; value.introductions[0].versions[1].content = long; value.cards[0].body = long; value.interviews[0].raw_notes = long;
  value.jobs[0].source.custom = { original: true }; value.cards[0].customField = { exact: ["原话", null, 0] }; value.customTopLevel = { exact: [1, 2, null] };
  const { state } = merge(value);
  assert.equal(state.jobs[0].jd, long); assert.equal(state.scripts[1].content, long); assert.equal(state.contentCards[0].content, long); assert.equal(state.interviews[0].transcript, long);
  assert.equal(state.companies[0].financing_display, null); assert.equal(state.jobs[0].applied_date, null);
  for (const module of UNIFIED_MODULES) for (const raw of value[module]) { const mapped = Object.values(state).flatMap(v => Array.isArray(v) ? v : []).find(record => record?.unifiedModule === module && record.unifiedSource?.id === raw.id); assert.deepEqual(mapped.unifiedSource, raw, module); }
  assert.deepEqual(state.v4Imports[0].customTopLevel, value.customTopLevel); assert.deepEqual(state.v4Imports[0].tag_catalog, value.tag_catalog);
});

test("reimporting the same file is idempotent even with a different validation clock", () => {
  const first = merge(fixture()).state, before = structuredClone(first);
  const second = mergeUnifiedImport(JSON.stringify(fixture()), freeze(first), { now: "2026-10-25T20:00:00+08:00" });
  assert.equal(second.report.added, 0); assert.equal(second.report.conflicts, 0); assert.equal(second.report.updated, 0); assert.equal(second.report.unchanged, 11); assert.deepEqual(second.state, before);
});

test("default conflicts preserve local edits; explicit update changes only that row and retains its previous full version", () => {
  const value = fixture(), local = merge(value).state;
  local.jobs[0] = touch(local.jobs[0], { title: "我保留的手动标题", notes: "个人补充" });
  local.settings.keywords = ["个人关键词"]; const old = structuredClone(local), p = preview(value, local), conflict = p.rows.find(row => row.module === "jobs" && row.status === "conflict");
  assert.ok(conflict); const skipped = merge(value, local); assert.deepEqual(skipped.state.jobs, local.jobs); assert.deepEqual(skipped.state.settings, local.settings);
  const updated = merge(value, local, { decisions: { [conflict.key]: "update" } });
  assert.equal(updated.report.updated, 1); assert.equal(updated.state.jobs[0].title, value.jobs[0].role); assert.deepEqual(updated.state.jobs[1], local.jobs[1]);
  assert.deepEqual(updated.state.conflicts.find(item => item.entityId === local.jobs[0].id).incoming, local.jobs[0]); assert.deepEqual(local, old);
  const repeated = merge(value, updated.state); assert.equal(repeated.report.updated, 0); assert.equal(repeated.report.conflicts, 0); assert.deepEqual(repeated.state, updated.state);
});

test("empty arrays never clear local modules and selecting only schedules leaves other collections and statuses intact", () => {
  const local = merge(fixture()).state, input = partial(["schedules"]); input.schedules[0].id = "independent-schedule";
  const result = merge(input, local, { modules: ["schedules"], excludedIds: ["schedules:demo-schedule-002"] });
  assert.equal(result.report.added, 1);
  for (const collection of ["companies", "jobs", "questions", "scripts", "contentCards", "interviews", "sessions", "attachments"]) assert.deepEqual(result.state[collection], local[collection]);
});

test("selectively excluding invalid interviews and pending schedules imports all other valid modules", () => {
  const value = fixture(); value.interviews[0].status = "待面试"; value.schedules[0].end_at = null;
  const blocked = preview(value); assert.equal(blocked.report.invalid, 2); assert.equal(blocked.canImport, false);
  const result = merge(value, blankState(), { excludedIds: blocked.rows.filter(row => row.status === "invalid").map(row => row.key) });
  assert.equal(result.state.interviews.length, 0); assert.equal(result.state.scheduleItems.length, 1); assert.equal(result.state.jobs.length, 2); assert.equal(result.preview.canImport, true);
  assert.equal(value.interviews[0].status, "待面试"); assert.equal(value.schedules[0].end_at, null);
});

test("unselected modules are not imported, and jobs cannot borrow an unselected missing company", () => {
  const p = preview(fixture(), blankState(), { modules: ["jobs"] }); assert.equal(p.canImport, false); assert.match(p.errors.join(";"), /company_id/);
  const value = partial(["companies", "jobs"]); const result = merge(value); assert.equal(result.state.questions.length, 0); assert.equal(result.state.interviews.length, 0);
});

test("a jobs-only file may resolve a local company only after explicit local-reference confirmation", () => {
  const full = merge(fixture()).state, value = partial(["jobs"]); value.jobs[0].id = "another-job"; value.jobs = [value.jobs[0]];
  const local = blankState(); local.companies = structuredClone(full.companies);
  const blocked = preview(value, local); assert.equal(blocked.canImport, false); assert.equal(blocked.rows.find(row => row.module === "jobs").issueDetails[0].code, "LOCAL_REFERENCE_CONFIRMATION");
  const accepted = merge(value, local, { confirmLocalReferences: true }); assert.equal(accepted.state.jobs[0].companyId, local.companies[0].id);
});

test("interview-only records allow missing and unmatched optional references without creating organizations or schedules", () => {
  const value = partial(["interviews"]), raw = value.interviews[0]; raw.company_id = "unknown-company"; raw.job_id = "unknown-job"; raw.schedule_id = "unknown-schedule"; raw.related_question_ids = ["unknown-question"];
  const p = preview(value); assert.equal(p.canImport, true); assert.match(p.rows[0].warnings.join(";"), /待手动关联/);
  const result = merge(value); assert.equal(result.state.companies.length, 0); assert.equal(result.state.jobs.length, 0); assert.equal(result.state.scheduleItems.length, 0); assert.equal(result.state.interviews[0].companyId, null); assert.equal(result.state.interviews[0].jobId, null);
  assert.equal(result.state.interviews[0].unresolvedReferences.length, 4); assert.deepEqual(result.state.interviews[0].unifiedSource, raw);
});
test("interview admission rejects pending/cancelled/future/preparation-only/notice-only archives across every supported schema", () => {
  for (const schema of ["next-round-unified-1.0", "next-round-unified-1.1", "next-round-unified-1.2"]) for (const status of ["待面试", "已取消", "未开始", "待安排"]) {
    const value = partial(["interviews"]); value.import_schema_version = schema; value.interviews[0].status = status;
    assert.equal(preview(value).canImport, false); assert.match(preview(value).errors.join(";"), /面试结束后的复盘/);
  }
  expectInvalid(value => { value.interviews[0].interview_date = "2099-10-10"; value.interviews[0].start_at = null; value.interviews[0].end_at = null; }, /未来日期/);
  expectInvalid(value => { value.interviews[0].start_at = "2026-10-24T13:00:00+08:00"; value.interviews[0].interview_date = "2026-10-24"; value.interviews[0].end_at = null; }, /未来时刻/);
  for (const notes of ["", "面试通知：请准时参加", "面试邀请：明天到公司面试"]) {
    const value = partial(["interviews"]), raw = value.interviews[0]; raw.questions_asked = []; raw.self_review = {}; raw.employer_feedback = {}; raw.raw_notes = notes; raw.preparation = { predicted_questions: ["您预计会被问到什么？"], notes: "准备材料" };
    assert.equal(preview(value).canImport, false); assert.match(preview(value).errors.join(";"), /缺少实际面试后/);
  }
});

test("real post-event materials with unknown date import without fabricated times; distinct rounds stay independent", () => {
  const value = partial(["interviews"]); value.interviews[0].interview_date = null; value.interviews[0].start_at = null; value.interviews[0].end_at = null; value.interviews[0].company_id = null; value.interviews[0].job_id = null;
  value.interviews.push({ ...structuredClone(value.interviews[0]), id: "another-completed-round", round: "第二轮" });
  const result = merge(value); assert.equal(result.state.interviews.length, 2); assert.equal(result.state.scheduleItems.length, 0); assert.equal(result.state.jobs.length, 0);
  for (const row of result.state.interviews) { assert.equal(row.date, null); assert.equal(row.scheduledAt, undefined); assert.equal(row.endedAt, undefined); assert.equal(row.status, "已完成"); }
  const third = partial(["interviews"]); third.interviews[0] = { ...structuredClone(value.interviews[0]), id: "another-unknown-date", raw_notes: "另一场已结束面试的纪要。" };
  const p = preview(third, result.state); assert.equal(p.rows[0].status, "new"); assert.equal(p.rows[0].possibleDuplicates, undefined);
});

test("actual Q&A, personal review, employer feedback and prediction materials retain independent meanings", () => {
  const value = fixture(), raw = value.interviews[0]; raw.preparation.predicted_questions = ["假设的预测问题，不是真实提问"];
  raw.employer_feedback = { text: "招聘方的原始反馈\n第二行", source: "用户提供的HR邮件原文", result: "进入下一轮" };
  const result = merge(value), row = result.state.interviews[0];
  assert.equal(row.questions.length, raw.questions_asked.length); assert.equal(row.questions.some(question => question.text.includes("预测问题")), false);
  assert.deepEqual(row.selfReview, raw.self_review); assert.deepEqual(row.employerFeedback, raw.employer_feedback); assert.equal(row.transcript, raw.raw_notes);
  assert.match(row.notes, /本人复盘/); assert.equal(row.strengths, ""); assert.equal(row.weaknesses, ""); assert.equal(row.feedback.includes(raw.self_review.summary), false); assert.match(row.feedback, /招聘方的原始反馈\n第二行/);
  assert.deepEqual(result.state.jobs.map(job => job.status), value.jobs.map(job => job.status)); assert.equal(result.state.scheduleItems.length, value.schedules.length);
  expectInvalid(input => { input.interviews[0].employer_feedback = { text: "个人猜测招聘方认可", source: "", result: "" }; }, /明确来源/);
  expectInvalid(input => { input.interviews[0].questions_asked[0].predicted = true; }, /预测问题/);
});

test("strict schedule boundaries reject missing end, invalid dates, timezones and unsupported repeats", () => {
  const changes = [
    [value => { value.schedules[0].end_at = null; }, /待补充/],
    [value => { value.schedules[0].start_at = "2026-02-30T14:00:00+08:00"; }, /start_at/],
    [value => { value.schedules[0].start_at = "2026-11-12T24:00:00+08:00"; }, /start_at/],
    [value => { value.schedules[0].start_at = "2026-11-12T14:00:00"; }, /start_at/],
    [value => { value.schedules[0].end_at = value.schedules[0].start_at; }, /晚于/],
    [value => { value.schedules[0].timezone = "Not/A_Timezone"; }, /IANA/],
    [value => { value.schedules[0].repeat = { freq: "weekly" }; }, /不支持重复/],
    [value => { value.schedules[1].start_at = "2026-11-13T01:00:00+08:00"; }, /午夜/],
    [value => { value.schedules[0].all_day = "false"; }, /布尔/],
  ]; for (const [change, pattern] of changes) expectInvalid(change, pattern);
});

test("record field, status, tag, reference and version errors prevent any partial candidate", () => {
  const changes = [
    [value => { value.jobs[0].company_id = "missing"; }, /company_id/],
    [value => { value.jobs[0].status = "不确定"; }, /七项状态/],
    [value => { value.jobs[0].tags[0].color = "purple"; }, /四色|green/],
    [value => { value.jobs[0].recommendation.max = 0; }, /评分/],
    [value => { value.questions[0].answer = 123; }, /answer/],
    [value => { value.introductions[0].versions[0].content = ["not text"]; }, /content/],
    [value => { value.introductions[0].versions[1].label = value.introductions[0].versions[0].label; }, /label/],
    [value => { value.cards[0].body = 123; }, /body/],
    [value => { value.jobs.push(structuredClone(value.jobs[0])); }, /重复/],
  ]; for (const [change, pattern] of changes) expectInvalid(change, pattern);
});

test("malformed roots, missing arrays, unsafe JSON, oversized inputs and unknown schemas are rejected", () => {
  assert.throws(() => parseUnifiedImport("{bad"), /有效的 JSON/);
  for (const module of UNIFIED_MODULES) { const value = fixture(); delete value[module]; assert.throws(() => parseUnifiedImport(value), new RegExp(module)); }
  assert.throws(() => parseUnifiedImport({ ...fixture(), import_schema_version: "next-round-unified-9.0" }), /不支持/);
  assert.throws(() => parseUnifiedImport(JSON.stringify(fixture()).replace('"version":', '"__proto__":{},"version":')), /保留字段/);
  assert.throws(() => parseUnifiedImport(" ".repeat(MAX_IMPORT_BYTES + 1)), /10 MB/);
  assert.throws(() => parseUnifiedImport(blankState()), /备份恢复/);
});

test("legacy unified versions and original V4 accept nullable optional fields without bypassing interview admission", () => {
  for (const schema of ["next-round-unified-1.0", "next-round-unified-1.1"]) { const value = fixture(); value.import_schema_version = schema; assert.equal(merge(value).state.interviews.length, 1); }
  const old = fixture(); old.import_schema_version = "next-round-unified-1.0"; delete old.interviews; assert.equal(merge(old).state.interviews.length, 0);
  const v4 = partial(["companies", "jobs"]); delete v4.import_schema_version; for (const module of UNIFIED_MODULES.filter(module => !["companies", "jobs"].includes(module))) delete v4[module];
  const parsed = parseUnifiedImport(v4); assert.equal(parsed.format, "V4"); const result = merge(parsed); assert.equal(result.state.jobs.length, 2); assert.equal(result.state.jobs[0].applied_date, null); assert.equal(result.state.companies[0].financing_display, null);
  for (const key of ["created_at", "timezone", "statuses", "tag_colors", "tag_catalog", "tag_rules", "counts"]) delete v4[key];
  assert.equal(merge(v4).state.jobs.length, 2);
});

test("cross-collection source-ID collisions are remapped deterministically and all references follow", () => {
  const value = fixture(), oldCompany = value.companies[0].id, oldJob = value.jobs[0].id; value.companies[0].id = "shared-id"; value.jobs[0].id = "shared-id";
  for (const job of value.jobs) job.company_id = "shared-id"; value.questions[0].related_job_ids[0] = "shared-id"; value.interviews[0].company_id = "shared-id";
  const state = merge(value).state; assert.notEqual(state.companies[0].id, state.jobs[0].id); assert.equal(state.jobs[0].companyId, state.companies[0].id); assert.equal(state.questions[0].jobIds[0], state.jobs[0].id); assert.equal(state.interviews[0].companyId, state.companies[0].id);
  assert.equal(merge(value, state).report.added, 0); assert.ok(oldCompany && oldJob);
});

test("missing source IDs remain stable on repeated imports and content is never executed", () => {
  const value = partial(["cards"]); delete value.cards[0].id; value.cards[0].body = '<script>throw new Error("NEVER EXECUTED")</script>\n原文';
  const first = merge(value).state; assert.match(first.contentCards[0].id, /^unified-cards-/); assert.equal(first.contentCards[0].content, value.cards[0].body); assert.deepEqual(merge(value, first).state, first);
});

test("complete backup replacement and incremental backup merge retain imported source records and dictionaries", async () => {
  const state = merge(fixture()).state, exported = exportBackup(state);
  const restored = await importBackup(exported, blankState(), { mode: "replace" }); assert.deepEqual(restored.state, state);
  const incremental = await importBackup(exported, blankState()); assert.deepEqual(incremental.state.v4Imports, state.v4Imports); assert.deepEqual(incremental.state.scripts, state.scripts); assert.deepEqual(incremental.state.interviews, state.interviews);
});
test("UTC instants use the stated IANA display zone without inventing or shifting event times", () => {
  const value = partial(["schedules"]); value.schedules[0].start_at = "2026-11-12T06:00:00Z"; value.schedules[0].end_at = "2026-11-12T07:30:00Z";
  value.schedules[1].start_at = "2026-11-12T16:00:00Z"; value.schedules[1].end_at = "2026-11-13T16:00:00Z";
  const state = merge(value).state;
  assert.equal(state.scheduleItems[0].startsAt, value.schedules[0].start_at); assert.equal(state.scheduleItems[1].allDay, true);
  const interview = partial(["interviews"]); interview.interviews[0].start_at = "2026-10-10T02:00:00Z"; interview.interviews[0].end_at = "2026-10-10T02:45:00Z";
  assert.equal(merge(interview).state.interviews[0].scheduledAt, "2026-10-10T02:00:00Z");
});

test("preview validates the actual selected candidate when a conflicting parent is kept local", () => {
  const value = partial(["companies", "jobs"]), local = blankState();
  local.companies.push(touch({}, { id: value.companies[0].id, name: "已有公招单位", kind: "public" }));
  const p = preview(value, local); assert.equal(p.canImport, false); assert.match(p.errors.join(";"), /track|关联组织/);
  assert.throws(() => merge(value, local), /track|关联组织/); assert.equal(local.jobs.length, 0);
  const accepted = merge(value, local, { decisions: { ["companies:" + value.companies[0].id]: "update" } });
  assert.equal(accepted.state.companies[0].kind, "enterprise"); assert.equal(accepted.state.jobs.length, 2);
});
