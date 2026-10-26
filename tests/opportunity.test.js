import test from "node:test";
import assert from "node:assert/strict";
import {
  blankState,
  touch,
  validateState,
  mergeData,
  scoreCompany,
  scoreJob,
  STATUSES,
} from "../core.js";
import {
  getTrack,
  isPublicJob,
  organizationKind,
  statusesFor,
  labelsFor,
  trackLabel,
  questionCategoriesFor,
  DEFAULT_PUBLIC_STAGE_SCORES,
  parseSalaryRange,
  formatSalaryRange,
} from "../opportunity.js";
const entity = (id, values = {}) => touch({ id }, values);

test("monthly salary ranges retain both bounds and never display a midpoint", () => {
  for (const [raw, low, high, months] of [
    ["1w~2w", 10000, 20000, undefined],
    ["9–13K", 9000, 13000, undefined],
    ["16–23K·13薪", 16000, 23000, 13],
    ["1.5-2.5万/月", 15000, 25000, undefined],
    ["10000至20000元", 10000, 20000, undefined],
  ]) assert.deepEqual(parseSalaryRange(raw), { salaryMin: low, salaryMax: high, ...(months ? { months } : {}) }, raw);
  assert.equal(formatSalaryRange({ salary: "1w~2w", salaryMonthly: 15000 }), "10k~20k");
  assert.equal(formatSalaryRange({ salaryMin: 10000, salaryMax: 20000, salaryMonthly: 15000 }), "10k~20k");
  assert.equal(formatSalaryRange({ salaryMonthly: 37500 }), "37.5k");
  assert.equal(formatSalaryRange({ salary: "面议" }), "面议");
  assert.equal(parseSalaryRange("20k~10k"), null);
});
test("explicit pay months are parsed and displayed without inventing defaults", () => {
  for (const raw of ["25k~50k×13个月", "25-50K x 13 月", "25-50K·13薪", "25,000至50,000元/月 * 13个月"]) {
    assert.deepEqual(parseSalaryRange(raw), { salaryMin: 25000, salaryMax: 50000, months: 13 }, raw);
    const job = { salary: raw };
    const before = structuredClone(job);
    assert.equal(formatSalaryRange(job), "25k~50k × 13个月", raw);
    assert.deepEqual(job, before);
  }
  assert.equal(formatSalaryRange({salaryMin:25000,salaryMax:50000,months:14,salary:"25-50K·13薪"}), "25k~50k × 14个月");
  assert.equal(formatSalaryRange({salaryMonthly:25000,months:13}), "25k × 13个月");
  assert.equal(formatSalaryRange({salaryMin:25000,salaryMax:50000}), "25k~50k");
  assert.equal(formatSalaryRange({salary:"面议",months:13}), "面议");
  for (const raw of ["25-50K×0个月", "25-50K×25个月", "25-50K×13.5个月", "25-50K×13个人", "年薪25-50万×13个月"]) assert.equal(parseSalaryRange(raw), null, raw);
});

test("four-color V4 tags affect each job score without changing sibling jobs", () => {
  const state = blankState();
  const company = entity("c", { name: "公司", tags: [{ id: "shared", name: "共同优势", color: "green" }] });
  const first = entity("j1", { companyId: "c", title: "岗位 A", status: "未沟通", tags: [{ id: "risk", name: "风险", color: "red" }, { id: "maybe", name: "待确认", color: "yellow" }] });
  const second = entity("j2", { companyId: "c", title: "岗位 B", status: "未沟通", tags: [{ id: "reference", name: "参考", color: "blue" }] });
  state.companies.push(company);
  state.jobs.push(first, second);
  assert.equal(validateState(state), true);
  assert.equal(scoreJob(first, company, state.settings).personal, 0);
  assert.equal(scoreJob(second, company, state.settings).personal, 3);
  state.settings.tagColorScores = { green: 5, red: -2, yellow: 1, blue: 1 };
  assert.equal(scoreJob(first, company, state.settings).personal, 4);
  assert.equal(scoreJob(second, company, state.settings).personal, 6);
  first.personalIntent = 0;
  first.employerIntent = 100;
  assert.equal(validateState(state), true);
});
const publicState = (track = "civil-service") => {
  const state = blankState();
  state.companies.push(
    entity("unit", { name: "自行填写的招录单位", kind: "public" }),
  );
  state.jobs.push(
    entity("position", {
      companyId: "unit",
      title: "自行填写的职位",
      track,
      status: "报名",
    }),
  );
  return state;
};
test("legacy identity, pipeline and default enterprise behavior remain unchanged", () => {
  const state = blankState();
  state.companies.push(entity("company", { name: "旧公司" }));
  state.jobs.push(entity("job", { companyId: "company", status: "Offer" }));
  const before = structuredClone(state);
  assert.equal(getTrack(state.jobs[0]), "enterprise");
  assert.equal(organizationKind(state.companies[0]), "enterprise");
  assert.deepEqual(statusesFor(state.jobs[0]), STATUSES);
  assert.equal(validateState(state), true);
  assert.deepEqual(state, before);
  const score = scoreCompany(state.companies[0], state.jobs, state.settings);
  assert.equal(score.interest, 90);
  assert.equal(score.assessmentKind, "enterprise-interest");
  assert.equal(score.annual, null);
});
test("public tracks provide separate labels, status arrays and category presets", () => {
  const unit = { kind: "public" };
  assert.equal(getTrack({}, unit), "civil-service");
  assert.equal(
    getTrack({ track: "public-institution" }, unit),
    "public-institution",
  );
  assert.equal(isPublicJob({ track: "civil-service" }), true);
  assert.equal(trackLabel("public-institution"), "事业单位招录");
  const civil = statusesFor({ track: "civil-service" });
  const institution = statusesFor({ track: "public-institution" });
  assert.notEqual(civil, institution);
  assert.ok(civil.includes("待笔试"));
  assert.ok(civil.includes("公示"));
  assert.ok(!civil.includes("Offer"));
  assert.equal(labelsFor({ track: "civil-service" }).requirements, "职位要求");
  assert.equal(labelsFor({ track: "enterprise" }).requirements, "JD");
  assert.ok(
    questionCategoriesFor({ track: "civil-service" }).includes("综合分析"),
  );
});
test("public fields accept self-entered scores with varying totals and preserve references", () => {
  const state = publicState();
  Object.assign(state.jobs[0], {
    examName: "个人招录记录",
    examYear: 2027,
    positionCode: "A-001",
    eligibility: "自行核实",
    applicationDeadline: "2027-03-05T18:00",
    writtenDate: "2027-04-10",
    writtenScore: 250.5,
    interviewScore: 83.2,
    finalScore: 166.85,
    rank: 2,
    vacancies: 3,
    examNotes: "以本人保存的材料为准",
    interviewFormat: "自行填写",
    remarks: "待确认",
  });
  state.interviews.push(
    entity("round", {
      companyId: "unit",
      jobId: "position",
      status: "待面试",
      questions: [],
    }),
  );
  assert.equal(validateState(state), true);
  const imported = mergeData(blankState(), state);
  assert.equal(imported.state.jobs[0].id, "position");
  assert.equal(imported.state.interviews[0].jobId, "position");
  assert.equal(imported.state.jobs[0].writtenScore, 250.5);
});
test("invalid public enums, field types, numeric bounds, dates and associations fail", () => {
  const cases = [
    ["kind", "government", "companies"],
    ["track", "exam", "jobs"],
    ["examName", 42, "jobs"],
    ["eligibility", [], "jobs"],
    ["examYear", 2027.5, "jobs"],
    ["examYear", 0, "jobs"],
    ["writtenScore", "80", "jobs"],
    ["interviewScore", -1, "jobs"],
    ["finalScore", Infinity, "jobs"],
    ["rank", 0, "jobs"],
    ["rank", 1.5, "jobs"],
    ["vacancies", -1, "jobs"],
    ["vacancies", 1.5, "jobs"],
    ["applicationDeadline", "2027-02-30", "jobs"],
    ["writtenDate", 123, "jobs"],
    ["companyId", "missing", "jobs"],
    ["status", "Offer", "jobs"],
  ];
  for (const [field, value, collection] of cases) {
    const state = publicState();
    state[collection][0][field] = value;
    assert.throws(() => validateState(state), /校验失败/, field);
  }
  const mismatch = publicState();
  mismatch.companies[0].kind = "enterprise";
  assert.throws(() => validateState(mismatch), /类型|招录|track/);
  const enterprise = blankState();
  enterprise.jobs.push(entity("legacy", { status: "待笔试" }));
  assert.throws(() => validateState(enterprise), /status/);
});
test("public scoring describes process progress and ignores recruiter or self feedback", () => {
  const state = publicState();
  const unit = state.companies[0];
  unit.strengths = "自评表达清晰";
  unit.weaknesses = "自评紧张";
  unit.feedback = "对方口头积极回应";
  unit.confirmedRecruiterFeedback = "明确反馈也不能等于录用意向";
  unit.ratings = { fit: 8, location: 7, stability: 9 };
  state.jobs[0].status = "资格复审";
  const score = scoreCompany(unit, state.jobs, state.settings);
  assert.equal(score.assessmentKind, "public-progress");
  assert.equal(
    score.interest,
    DEFAULT_PUBLIC_STAGE_SCORES["civil-service"]["资格复审"],
  );
  assert.equal(score.progress, score.interest);
  assert.ok(
    score.reasons.some((r) => r.includes("流程进展") && r.includes("概率")),
  );
  assert.ok(
    !score.reasons.some(
      (r) => r.includes("企业意向") || r.includes("已记录招聘方"),
    ),
  );
  const noFeedback = {
    ...unit,
    strengths: "",
    weaknesses: "",
    feedback: "",
    confirmedRecruiterFeedback: "",
  };
  assert.equal(
    scoreCompany(noFeedback, state.jobs, state.settings).interest,
    score.interest,
  );
});
test("independent public progress rules and dimensions are configurable and validated", () => {
  const state = publicState();
  state.jobs[0].status = "待面试";
  state.settings.publicStageScores["civil-service"]["待面试"] = 73;
  state.settings.publicStageScores["public-institution"]["待面试"] = 49;
  assert.equal(validateState(state), true);
  assert.equal(
    scoreJob(state.jobs[0], state.companies[0], state.settings).interest,
    73,
  );
  const institution = { ...state.jobs[0], track: "public-institution" };
  assert.equal(
    scoreJob(institution, state.companies[0], state.settings).interest,
    49,
  );
  for (const value of [-1, 101, "50", null]) {
    const bad = structuredClone(state);
    bad.settings.publicStageScores["civil-service"]["报名"] = value;
    assert.throws(() => validateState(bad), /进展规则/);
  }
  const badDimension = structuredClone(state);
  badDimension.settings.publicDimensions[1].id =
    badDimension.settings.publicDimensions[0].id;
  assert.throws(() => validateState(badDimension), /评分维度/);
});
test("single-job scoring isolates sibling track progress and unrelated organizations", () => {
  const state = publicState();
  const unit = state.companies[0];
  const a = state.jobs[0];
  a.status = "报名";
  const b = entity("other-track", {
    companyId: unit.id,
    track: "public-institution",
    status: "录用",
  });
  assert.equal(
    scoreJob(a, unit, state.settings).progress,
    DEFAULT_PUBLIC_STAGE_SCORES["civil-service"]["报名"],
  );
  assert.equal(scoreCompany(unit, [a, b], state.settings).progress, 100);
  const unrelated = { ...b, companyId: "other-unit" };
  assert.equal(
    scoreCompany(unit, [a, unrelated], state.settings).progress,
    scoreJob(a, unit, state.settings).progress,
  );
  assert.equal(
    scoreCompany({ id: "empty-unit", kind: "public" }, [], state.settings)
      .progress,
    0,
  );
});
test("partial imports resolve updated organization kind and reject stale relationships", () => {
  const local = blankState();
  local.companies.push(entity("unit", { kind: "public" }));
  const incoming = blankState();
  incoming.jobs.push(
    entity("position", {
      companyId: "unit",
      track: "civil-service",
      status: "报名",
    }),
  );
  assert.equal(mergeData(local, incoming).state.jobs[0].track, "civil-service");
  const snapshot = structuredClone(incoming);
  snapshot.jobs[0].writtenDate = "invalid";
  assert.throws(() => mergeData(local, snapshot), /日期/);
  assert.equal(local.jobs.length, 0);
});

test("inferred public track and legacy settings validate without rewriting old records", () => {
  const state = publicState();
  delete state.jobs[0].track;
  delete state.settings.publicStageScores;
  delete state.settings.publicDimensions;
  const before = structuredClone(state);
  assert.equal(validateState(state), true);
  assert.equal(
    scoreCompany(state.companies[0], state.jobs, state.settings).progress,
    10,
  );
  assert.deepEqual(state, before);
});
test("separate states and tracks never share editable rule objects", () => {
  const one = blankState(),
    two = blankState();
  one.settings.publicStageScores["civil-service"]["报名"] = 0;
  one.settings.publicDimensions[0].weight = 90;
  assert.equal(
    one.settings.publicStageScores["public-institution"]["报名"],
    10,
  );
  assert.equal(two.settings.publicStageScores["civil-service"]["报名"], 10);
  assert.equal(two.settings.publicDimensions[0].weight, 40);
  const state = publicState();
  state.settings.publicStageScores["civil-service"]["报名"] = 0;
  assert.equal(
    scoreJob(state.jobs[0], state.companies[0], state.settings).progress,
    0,
  );
  state.jobs[0].status = "录用";
  assert.equal(
    scoreJob(state.jobs[0], state.companies[0], state.settings).progress,
    100,
  );
});
test("public import conflicts retain complete alternative and reject invalid public snapshots", () => {
  const local = publicState();
  const incoming = structuredClone(local);
  incoming.jobs[0] = touch(incoming.jobs[0], {
    positionCode: "B-02",
    writtenScore: 178.25,
    rank: 4,
  });
  const merged = mergeData(local, incoming);
  assert.equal(merged.state.jobs[0].positionCode, undefined);
  assert.equal(merged.state.conflicts[0].incoming.writtenScore, 178.25);
  assert.equal(mergeData(merged.state, incoming).state.conflicts.length, 1);
  const bad = structuredClone(merged.state);
  bad.conflicts[0].incoming.rank = -1;
  assert.throws(() => validateState(bad), /rank/);
});
test("an imported replacement job is checked against its own company, not a stale local link", () => {
  const state = blankState();
  state.companies.push(entity("a"), entity("b"));
  state.jobs.push(entity("j", { companyId: "a", status: "关注" }));
  const partial = blankState();
  partial.jobs.push(touch(state.jobs[0], { companyId: "b" }));
  partial.interviews.push(
    entity("i", { companyId: "a", jobId: "j", status: "待面试" }),
  );
  assert.throws(() => validateState(partial, state), /岗位不属于/);
});
