import test from "node:test";
import assert from "node:assert/strict";
import { blankState, touch, validateState, mergeData } from "../core.js";
import { isV4Import, parseV4Import, mergeV4Import, V4_STATUSES } from "../v4-import.js";
import { exportBackup, importBackup } from "../db.js";
import { moveToTrash, restoreTrash } from "../trash.js";
function fixture() {
  return {
    version: "4.0.1", created_at: "2026-10-23", timezone: "Asia/Shanghai", description: "纯测试虚构岗位数据库", counts: { distinct_companies: 1, active_roles: 1 }, note: "保留完整来源，不代表真实投递",
    statuses: [...V4_STATUSES],
    tag_colors: {
      green: { name: "绿色", hex: "#268765", meaning: "正面" }, red: { name: "红色", hex: "#CB4553", meaning: "负面" },
      yellow: { name: "黄色", hex: "#C28A24", meaning: "权衡" }, blue: { name: "蓝色", hex: "#3476B8", meaning: "事实" },
    },
    tag_catalog: {
      weekend_off: { id: "weekend_off", label: "双休", default_color: "green", meaning: "明确双休", scope: "both" },
      overtime: { id: "overtime", label: "明确加班", default_color: "red", scope: "both" },
      filming: { id: "filming", label: "拍摄相关", default_color: "yellow", scope: "both" },
      ai_product: { id: "ai_product", label: "AI产品", default_color: "blue", scope: "both" },
    },
    tag_rules: { allowed_colors: ["green", "red", "yellow", "blue"], dedup_key: "tag.id", only_tag_if_explicit: "有证据才添加" },
    excluded: ["虚构旧职位已停止招聘，不能当作活跃岗位"], custom_metadata: { preserve: true },
    companies: [{ id: "company-test", key: "测试公司", full_name: "虚构测试公司全称", industry: "创作工具", size: "虚构规模", description: "完整公司资料", financing_display: "以实际信息为准", score: 4.3, reason: "编辑评估原文", score_type: "个人契合度，满分5分", score_basis: "测试依据", urls: ["https://example.invalid/company"], tags: [{ id: "ai_product", name: "AI产品", color: "blue" }], tags_legacy: ["旧显示标签"], tag_names: ["AI产品"], custom_company: { kept: true } }],
    jobs: [{ id: "job-test", company_id: "company-test", company: "测试公司", role: "测试产品岗位", platform: "测试平台", posting_group_id: "conversation-test", city: "虚构城市", location: "虚构地址", salary: "20–40K·14薪", experience: "原始年限", education: "原始学历", applied_date: "2026-10-23", status: "已沟通", status_options: [...V4_STATUSES], status_notes: "用户确认的原始状态", jd_summary: { core: "摘要", hard_requirements: ["完整要求"], preferred_conditions: ["完整加分条件"] }, jd_full_text: "完整JD第一段\n\n完整JD第二段\n第三行", jd_fidelity: "测试转录说明", source: { type: "user_upload_screenshot", image_file: "fictional.jpg", pdf_page: null, description: "保留原始来源", url: null }, tags: [{ id: "weekend_off", name: "双休", color: "green" }, { id: "filming", name: "拍摄相关", color: "yellow", detail: "原始工作细节" }], recommendation: { score: 4.2, max: 5, type: "个人匹配度", comment: "原始推荐说明，不是录用概率" }, upskilling: ["补强事项一", "补强事项二"], tag_color_override_allowed: true, custom_job: { retained: [1, 2] } }],
  };
}
function deepFreeze(value) {
  if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); }
  return value;
}

test("V4 and native backups are identified separately, including BOM JSON input", () => {
  const payload = fixture();
  assert.equal(isV4Import(payload), true);
  assert.equal(isV4Import(`\uFEFF${JSON.stringify(payload)}`), true);
  assert.equal(isV4Import(blankState()), false);
  assert.equal(isV4Import({ format: "NextRound", version: "4.0.1", companies: [], jobs: [] }), false);
  assert.equal(isV4Import("invalid JSON"), false);
  assert.throws(() => parseV4Import("invalid JSON"), /不是有效的 JSON/);
  assert.throws(() => parseV4Import({ ...payload, version: "3.0" }), /不是 V4/);
});
test("mapping preserves full company/job fields, raw sources, JD, recommendation and upskilling", () => {
  const input = fixture(), before = structuredClone(input);
  const result = parseV4Import(deepFreeze(input)), { state, report } = result;
  assert.equal(validateState(state), true);
  assert.equal(report.added, 2); assert.equal(report.companies, 1); assert.equal(report.jobs, 1);
  assert.equal(state.companies[0].id, input.companies[0].id);
  assert.equal(state.companies[0].name, input.companies[0].key);
  assert.equal(state.companies[0].full_name, input.companies[0].full_name);
  assert.equal(state.companies[0].score, 4.3);
  assert.equal(state.jobs[0].title, input.jobs[0].role);
  assert.equal(state.jobs[0].companyId, input.jobs[0].company_id);
  assert.equal(state.jobs[0].jd, input.jobs[0].jd_full_text);
  for (const key of ["jd_summary", "jd_full_text", "source", "recommendation", "upskilling", "custom_job"]) assert.deepEqual(state.jobs[0][key], input.jobs[0][key]);
  assert.deepEqual(state.companies[0].v4Source, input.companies[0]);
  assert.deepEqual(state.jobs[0].v4Source, input.jobs[0]);
  assert.deepEqual(input, before);
});
test("mapping uses stable source IDs and dataset dates so identical imports are idempotent", () => {
  const payload = fixture(), first = parseV4Import(payload).state, second = parseV4Import(JSON.stringify(payload)).state;
  assert.deepEqual(first, second);
  assert.equal(first.jobs[0].createdAt, payload.created_at);
  assert.equal(first.jobs[0].updatedAt, payload.created_at);
  assert.equal(first.jobs[0].revision, 1);
  const imported = mergeV4Import(payload, blankState()), repeated = mergeV4Import(payload, imported.state);
  assert.equal(imported.report.added, 2);
  assert.equal(repeated.report.added, 0); assert.equal(repeated.report.conflicts, 0);
  assert.equal(repeated.state.v4Imports.length, 1);
});
test("manual local edits win while complete differing incoming records are retained once", () => {
  const payload = fixture(), local = mergeV4Import(payload, blankState()).state;
  local.jobs[0] = touch(local.jobs[0], { title: "我自己的岗位标题", notes: "个人补充" });
  local.companies[0] = touch(local.companies[0], { notes: "个人公司备注" });
  local.settings.keywords = ["保留个人设置"];
  const before = structuredClone(local), merged = mergeV4Import(payload, local);
  assert.equal(merged.state.jobs[0].title, "我自己的岗位标题");
  assert.equal(merged.state.companies[0].notes, "个人公司备注");
  assert.deepEqual(merged.state.settings, local.settings);
  assert.equal(merged.report.conflicts, 2);
  assert.equal(merged.state.conflicts.some((entry) => entry.collection === "settings"), false);
  assert.equal(merged.state.conflicts.find((entry) => entry.collection === "jobs").incoming.jd, payload.jobs[0].jd_full_text);
  assert.deepEqual(merged.state.conflicts.find((entry) => entry.collection === "jobs").incoming.v4Source, payload.jobs[0]);
  assert.equal(mergeV4Import(payload, merged.state).state.conflicts.length, 2);
  assert.deepEqual(local, before);
});
test("V4 statuses remain exact and omitted status defaults only to 未沟通", () => {
  for (const status of V4_STATUSES) {
    const payload = fixture(); payload.jobs[0].status = status;
    assert.equal(parseV4Import(payload).state.jobs[0].status, status);
  }
  const omitted = fixture(); delete omitted.jobs[0].status;
  assert.equal(parseV4Import(omitted).state.jobs[0].status, "未沟通");
});
test("tag IDs deduplicate, catalog labels normalize and per-record colors override defaults", () => {
  const payload = fixture();
  payload.jobs[0].tags = [{ id: "weekend_off", name: "周末双休" }, { id: "weekend_off", name: "双休" }, { id: "ai_product", name: "AI产品", color: "yellow", detail: "用户覆盖" }];
  const job = parseV4Import(payload).state.jobs[0];
  assert.deepEqual(job.tags, [{ id: "weekend_off", name: "双休", color: "green" }, { id: "ai_product", name: "AI产品", color: "yellow", detail: "用户覆盖" }]);
  assert.deepEqual(job.v4Source.tags, payload.jobs[0].tags);
  const conflict = fixture(); conflict.jobs[0].tags.push({ id: "weekend_off", name: "双休", color: "red" });
  assert.throws(() => parseV4Import(conflict), /同一标签 ID 存在不同内容/);
});
test("salary keeps source text and only explicit bounds or salary months are extracted", () => {
  const mapped = parseV4Import(fixture()).state.jobs[0];
  assert.equal(mapped.salary, "20–40K·14薪");
  assert.equal(mapped.salaryMin, 20000); assert.equal(mapped.salaryMax, 40000); assert.equal(mapped.months, 14);
  assert.equal(mapped.salaryMonthly, undefined);
  const noMonths = fixture(); noMonths.jobs[0].salary = "20–40K";
  assert.equal(parseV4Import(noMonths).state.jobs[0].months, undefined);
  const unknown = fixture(); unknown.jobs[0].salary = "面议，以正式合同为准";
  const raw = parseV4Import(unknown).state.jobs[0];
  assert.equal(raw.salary, unknown.jobs[0].salary); assert.equal(raw.salaryMin, undefined); assert.equal(raw.salaryMonthly, undefined);
});
test("V4 salary month suffixes import explicitly without changing source or legacy extraction", () => {
  for (const [salary, expectedMonths] of [["25k~50k×13个月",13],["25-50K x 14 月",14],["25-50K·25薪",25]]) {
    const input = fixture(); input.jobs[0].salary = salary;
    const before = structuredClone(input);
    const mapped = parseV4Import(input).state.jobs[0];
    assert.equal(mapped.salaryMin,25000);
    assert.equal(mapped.salaryMax,50000);
    assert.equal(mapped.months,expectedMonths);
    assert.equal(mapped.salary,salary);
    assert.equal(mapped.v4Source.salary,salary);
    assert.deepEqual(input,before);
  }
});
test("top-level dictionaries, excluded history and unknown metadata survive merges without seeding active rows", () => {
  const payload = fixture(), imported = mergeV4Import(payload, blankState()).state;
  const metadata = imported.v4Imports[0];
  for (const key of Object.keys(payload).filter((key) => !["companies", "jobs"].includes(key))) assert.deepEqual(metadata[key], payload[key]);
  assert.equal(imported.jobs.length, 1); assert.equal(imported.companies.length, 1);
  const next = fixture(); next.note = "新来源说明";
  const combined = mergeV4Import(next, imported).state;
  assert.equal(combined.v4Imports.length, 2);
  assert.equal(mergeV4Import(next, combined).state.v4Imports.length, 2);
});
test("complete backup, replacement and trash restoration preserve V4 information", async () => {
  const state = mergeV4Import(fixture(), blankState()).state;
  const exported = exportBackup(state), restored = await importBackup(exported, blankState(), { mode: "replace" });
  assert.deepEqual(restored.state, state);
  const repeated = await importBackup(exported, restored.state);
  assert.equal(repeated.report.added, 0); assert.equal(repeated.report.conflicts, 0);
  assert.equal(repeated.state.v4Imports.length, 1);
  const removed = moveToTrash(state, "companies", "company-test"), recovered = restoreTrash(removed, removed.trash[0].id);
  assert.deepEqual(recovered.companies, state.companies);
  assert.deepEqual(recovered.jobs, state.jobs);
});
test("malformed IDs, references, status values, colors and payload types reject without mutation", () => {
  const changes = [
    (p) => { p.jobs[0].company_id = "missing"; }, (p) => { p.jobs[0].id = p.companies[0].id; },
    (p) => { p.jobs.push(structuredClone(p.jobs[0])); }, (p) => { p.jobs[0].status = "自行推断"; },
    (p) => { p.jobs[0].status_options = ["未沟通"]; }, (p) => { p.jobs[0].tags[0].color = "#ffffff"; },
    (p) => { p.companies[0].tags[0].color = "purple"; }, (p) => { p.jobs[0].tags[0].id = "unknown"; },
    (p) => { p.jobs[0].source = 42; }, (p) => { p.jobs[0].upskilling = "not an array"; },
    (p) => { p.jobs[0].recommendation.score = 9; }, (p) => { p.companies[0].score = 9; },
    (p) => { p.tag_catalog.weekend_off.default_color = "other"; }, (p) => { p.tag_colors.purple = { name: "紫", hex: "#000000" }; },
    (p) => { p.created_at = "2026-02-30"; }, (p) => { delete p.created_at; }, (p) => { delete p.jobs[0].jd_full_text; },
  ];
  for (const change of changes) {
    const payload = fixture(); change(payload); const before = structuredClone(payload);
    assert.throws(() => parseV4Import(payload), /失败/);
    assert.deepEqual(payload, before);
  }
});
test("unsafe JSON keys are rejected before mapping or metadata merging", () => {
  const payload = fixture(); payload.jobs[0].source = JSON.parse('{"constructor":{"polluted":true}}');
  assert.throws(() => parseV4Import(payload), /保留字段/);
  assert.equal({}.polluted, undefined);
});
test("core accepts standard four-color tags and source objects while retaining legacy weighted tags", () => {
  const state = parseV4Import(fixture()).state;
  state.companies[0].tags = [
    { id: "one", name: "绿", color: "green" }, { id: "two", name: "红", color: "red" },
    { id: "three", name: "黄", color: "yellow" }, { id: "four", name: "蓝", color: "blue" },
    { name: "旧加分", color: "green", weight: 7 }, { name: "旧减分", color: "red", weight: 3, veto: true },
  ];
  assert.equal(validateState(state), true);
  const invalid = structuredClone(state); invalid.companies[0].tags[0].color = "purple";
  assert.throws(() => validateState(invalid), /标签无效/);
  const duplicate = structuredClone(state); duplicate.jobs[0].tags.push(structuredClone(duplicate.jobs[0].tags[0]));
  assert.throws(() => validateState(duplicate), /标准标签 ID 无效或重复/);
  const source = structuredClone(state); source.jobs[0].source = [];
  assert.throws(() => validateState(source), /source 必须是文本或岗位来源对象/);
});
