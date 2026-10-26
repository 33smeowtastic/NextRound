import test from "node:test";
import assert from "node:assert/strict";
import {
  blankState,
  touch,
  validateState,
  mergeData,
  upgradeLegacyInterviewStatuses,
  keywordCoverage,
  scoreCompany,
} from "../core.js";
import { exportBackup, importBackup } from "../db.js";
const entity = (id, patch = {}) => touch({ id }, patch);

test("empty state validates; touch preserves stable identity and creation history", () => {
  assert.equal(validateState(blankState()), true);
  const first = entity("company-1", {
    name: "第一家公司",
    custom: { kept: true },
  });
  const next = touch(first, {
    name: "更名",
    id: "cannot-replace",
    createdAt: "2000-01-01",
  });
  assert.equal(next.id, first.id);
  assert.equal(next.createdAt, first.createdAt);
  assert.equal(next.revision, 2);
  assert.deepEqual(next.custom, { kept: true });
});
test("incremental import retains existing entities, attachments and linked records", () => {
  const local = blankState();
  local.companies.push(entity("co", { name: "本地公司" }));
  local.attachments.push(
    entity("audio", {
      name: "练习.webm",
      mime: "audio/webm",
      data: "data:audio/webm;base64,AQIDBA==",
    }),
  );
  const incoming = blankState();
  incoming.jobs.push(
    entity("job", { companyId: "co", title: "设计师", status: "关注" }),
  );
  const { state, report } = mergeData(local, incoming);
  assert.equal(report.added, 1);
  assert.equal(state.jobs[0].companyId, "co");
  assert.deepEqual(state.attachments, local.attachments);
  assert.deepEqual(state.companies, local.companies);
  assert.equal(local.jobs.length, 0);
});
test("repeat imports are idempotent; changed versions preserve local and keep incoming snapshot once", () => {
  const local = blankState();
  local.questions.push(
    entity("q", { question: "介绍一下自己", answer: "本地答案" }),
  );
  const incoming = structuredClone(local);
  incoming.questions[0] = touch(incoming.questions[0], {
    answer: "其他设备的答案",
  });
  const one = mergeData(local, incoming);
  assert.equal(one.report.conflicts, 1);
  assert.equal(one.state.questions[0].answer, "本地答案");
  assert.equal(one.state.conflicts[0].incoming.answer, "其他设备的答案");
  const two = mergeData(one.state, incoming);
  assert.equal(two.report.conflicts, 0);
  assert.equal(two.state.conflicts.length, 1);
  assert.equal(mergeData(local, local).report.unchanged, 1);
});
test("malformed schema, duplicate IDs, dates, ratings and dangling links fail without mutation", () => {
  const local = blankState();
  const original = structuredClone(local);
  const badInputs = [];
  badInputs.push({ ...blankState(), schemaVersion: 2 });
  badInputs.push({ ...blankState(), jobs: "oops" });
  const duplicate = blankState();
  duplicate.companies = [entity("same"), entity("same")];
  badInputs.push(duplicate);
  const malformedDate = blankState();
  malformedDate.companies = [{ ...entity("co"), createdAt: "yesterday" }];
  badInputs.push(malformedDate);
  const impossibleDate = blankState();
  impossibleDate.companies = [
    { ...entity("co"), createdAt: "2026-02-31T00:00:00.000Z" },
  ];
  badInputs.push(impossibleDate);
  const dangling = blankState();
  dangling.jobs = [entity("j", { companyId: "missing" })];
  badInputs.push(dangling);
  const ratings = blankState();
  ratings.companies = [entity("co", { ratings: { salary: 11 } })];
  badInputs.push(ratings);
  const nested = blankState();
  nested.interviews = [entity("i", { questions: [{ questionId: "missing" }] })];
  badInputs.push(nested);
  const invalidAudio = blankState();
  invalidAudio.attachments = [
    entity("a", { name: "audio", mime: "audio/webm", data: "<bad>" }),
  ];
  badInputs.push(invalidAudio);
  for (const bad of badInputs)
    assert.throws(() => mergeData(local, bad), /校验失败/);
  assert.deepEqual(local, original);
});
test("settings conflicts preserve editable local rules and imported full alternative", () => {
  const local = blankState(),
    incoming = blankState();
  incoming.settings.keywords = ["React"];
  const merged = mergeData(local, incoming);
  assert.deepEqual(merged.state.settings.keywords, []);
  assert.deepEqual(merged.state.conflicts[0].incoming.keywords, ["React"]);
  assert.equal(mergeData(merged.state, incoming).state.conflicts.length, 1);
});
test("keyword coverage matches synonyms, handles C++ literally and avoids JS in JSON", () => {
  const result = keywordCoverage(
    "React、用户体验和 C++；JSON is used.",
    ["react", "UX", "C++", "JS", "Node"],
    { UX: ["用户体验"] },
  );
  assert.deepEqual(result.matched, ["react", "UX", "C++"]);
  assert.deepEqual(result.missing, ["JS", "Node"]);
  assert.equal(result.percent, 60);
  assert.equal(keywordCoverage("", []).percent, 0);
});
test("weighted decisions explain scores, veto, feedback and salary computation", () => {
  const company = entity("co", {
    ratings: { salary: 8, balance: 6, growth: 10 },
    tags: [{ name: "超长通勤", color: "red", weight: 5, veto: true }],
    strengths: "项目经验",
    weaknesses: "英语",
    feedback: "等待确认",
  });
  const jobs = [
    entity("job", {
      companyId: "co",
      status: "Offer",
      salaryMonthly: 20000,
      months: 14,
      hoursWeek: 40,
    }),
    entity("other", {
      companyId: "another",
      status: "Offer",
      salaryMonthly: 100000,
    }),
  ];
  const result = scoreCompany(company, jobs, blankState().settings);
  assert.equal(result.personal, 74);
  assert.equal(result.interest, 90);
  assert.equal(result.veto, true);
  assert.equal(result.annual, 280000);
  assert.equal(result.hourly, 134.62);
  const ranged = scoreCompany(company, [{ ...jobs[0], salaryMin: 10000, salaryMax: 20000 }], blankState().settings);
  assert.equal(ranged.annual, 210000);
  assert.ok(ranged.reasons.some((reason) => reason.includes("区间上下限中点")));
  assert.ok(result.reasons.some((r) => r.includes("不是真实录用概率")));
  assert.equal(
    scoreCompany(entity("new"), [], blankState().settings).annual,
    null,
  );
});
test("portable backup round-trip contains complete audio and is incremental", async () => {
  const source = blankState();
  source.attachments.push(
    entity("audio", {
      name: "录音.webm",
      mime: "audio/webm",
      data: "data:audio/webm;base64,AQIDBA==",
    }),
  );
  const backup = exportBackup(source);
  const { state } = await importBackup(backup, blankState());
  assert.equal(state.attachments[0].data, source.attachments[0].data);
  assert.equal((await importBackup(backup, state)).report.added, 0);
  await assert.rejects(importBackup("{broken", state), /JSON/);
  assert.equal(state.attachments.length, 1);
});

test("interview lifecycle is independent of job pipeline, including restored conflicts", () => {
  const state = blankState();
  for (const [index, status] of ["待面试", "已完成", "已取消"].entries())
    state.interviews.push(entity(`interview-${index}`, { status }));
  state.jobs.push(entity("job", { status: "Offer" }));
  assert.equal(validateState(state), true);
  const incoming = structuredClone(state);
  incoming.interviews[0] = touch(incoming.interviews[0], { status: "已完成" });
  assert.equal(validateState(mergeData(state, incoming).state), true);
  const invalidJob = structuredClone(state);
  invalidJob.jobs[0].status = "已完成";
  assert.throws(() => validateState(invalidJob), /status/);
  const invalidInterview = structuredClone(state);
  invalidInterview.interviews[0].status = "Offer";
  assert.throws(() => validateState(invalidInterview), /status/);
});
test("legacy pending interview keeps its content without claiming completion", async () => {
  const old = blankState();
  old.interviews.push(entity("legacy-interview", {
    status: "待面试", transcript: "原始面试记录", notes: "用户备注",
    history: [{ at: new Date().toISOString(), status: "待面试" }],
  }));
  const migrated = upgradeLegacyInterviewStatuses(old);
  assert.equal(old.interviews[0].status, "待面试");
  assert.equal(migrated.interviews[0].status, "待确认");
  assert.equal(migrated.interviews[0].history[0].status, "待确认");
  assert.equal(migrated.interviews[0].transcript, "原始面试记录");
  assert.equal(migrated.interviews[0].notes, "用户备注");
  assert.equal(validateState(migrated), true);
  const restored = await importBackup({ format: "NextRound", workspace: "formal", state: old }, blankState(), { workspace: "formal", mode: "replace" });
  assert.equal(restored.state.interviews[0].status, "待确认");
  assert.equal(restored.state.interviews[0].transcript, "原始面试记录");
});
test("mechanical progress and feedback rules are editable, bounded and backward compatible", () => {
  const state = blankState(),
    company = entity("co", {
      strengths: "招聘方认可",
      weaknesses: "招聘方指出不足",
    });
  const jobs = [entity("job", { companyId: "co", status: "面试中" })];
  state.settings.stageScores["面试中"] = 65;
  state.settings.positiveFeedbackPoints = 12;
  state.settings.negativeFeedbackPoints = 3;
  assert.equal(validateState(state), true);
  const custom = scoreCompany(company, jobs, state.settings);
  assert.equal(custom.interest, 74);
  assert.ok(custom.reasons.some((r) => r.includes("+12")));
  assert.ok(custom.reasons.some((r) => r.includes("−3")));
  const legacy = structuredClone(state.settings);
  delete legacy.stageScores;
  delete legacy.positiveFeedbackPoints;
  delete legacy.negativeFeedbackPoints;
  assert.equal(validateState({ ...state, settings: legacy }), true);
  assert.equal(scoreCompany(company, jobs, legacy).interest, 50);
  state.settings.stageScores["面试中"] = 0;
  state.settings.positiveFeedbackPoints = 0;
  state.settings.negativeFeedbackPoints = 0;
  assert.equal(scoreCompany(company, jobs, state.settings).interest, 0);
  for (const value of [-1, 101, "50", null]) {
    assert.throws(
      () =>
        validateState({
          ...state,
          settings: { ...state.settings, positiveFeedbackPoints: value },
        }),
      /反馈加减分/,
    );
    assert.throws(
      () =>
        validateState({
          ...state,
          settings: { ...state.settings, stageScores: { Offer: value } },
        }),
      /招聘进展规则/,
    );
  }
  const ceiling = {
    ...state.settings,
    stageScores: { 面试中: 100 },
    positiveFeedbackPoints: 100,
    negativeFeedbackPoints: 0,
  };
  assert.equal(scoreCompany(company, jobs, ceiling).interest, 100);
});

test("nested question corruption and company/job mismatches are rejected before import", () => {
  const local = blankState();
  const c = touch({ id: "company-a" }, { name: "A" }),
    other = touch({ id: "company-b" }, { name: "B" });
  local.companies.push(c, other);
  const job = touch(
    { id: "job-a" },
    { title: "设计师", companyId: c.id, status: "关注" },
  );
  local.jobs.push(job);
  const broken = structuredClone(local);
  broken.interviews.push(
    touch(
      { id: "interview-b" },
      { companyId: other.id, jobId: job.id, status: "已完成", questions: [] },
    ),
  );
  assert.throws(() => mergeData(local, broken), /岗位不属于/);
  broken.interviews[0].companyId = c.id;
  broken.interviews[0].questions = [{ text: 42, answer: "bad" }];
  assert.throws(() => mergeData(local, broken), /问题必须是文本/);
  broken.interviews[0].questions = [{ text: "valid", improved: 42 }];
  assert.throws(() => mergeData(local, broken), /必须是文本/);
  assert.equal(local.interviews.length, 0);
});
