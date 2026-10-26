/** Opportunity vocabulary and editable local rubrics. No policy or probability claims. */
export const ORGANIZATION_KINDS = Object.freeze(["enterprise", "public"]);
/** Monthly salary bounds are stored in yuan; the original salary text remains untouched. */
export function parseSalaryRange(value) {
  if (typeof value !== "string") return null;
  const source = value.trim().replace(/,/g, "");
  const match = /^(\d+(?:\.\d+)?)\s*(k|w|万|元)?\s*(?:-|–|—|~|～|至|到)\s*(\d+(?:\.\d+)?)\s*(k|w|万|元)?(?:\s*元)?(?:\s*\/\s*月)?(?:\s*[·⋅x×*]\s*(\d+)\s*(?:薪|个?月))?$/i.exec(source);
  if (!match) return null;
  const unit = (match[4] || match[2] || "元").toLowerCase();
  const leftUnit = (match[2] || unit).toLowerCase();
  const multiplier = token => token === "k" ? 1000 : token === "w" || token === "万" ? 10000 : 1;
  const low = Number(match[1]) * multiplier(leftUnit), high = Number(match[3]) * multiplier(unit);
  if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high) || low <= 0 || high < low) return null;
  const months = match[5] === undefined ? null : Number(match[5]);
  if (months !== null && (!Number.isInteger(months) || months < 1 || months > 24)) return null;
  return { salaryMin: low, salaryMax: high, ...(months === null ? {} : { months }) };
}
/** Never derive a midpoint or an unstated pay-month count for display. */
export function formatSalaryRange(job = {}) {
  const explicit = Number(job?.salaryMin), upper = Number(job?.salaryMax);
  const parsed = parseSalaryRange(job?.salary);
  const low = Number.isFinite(explicit) && explicit > 0 ? explicit : parsed?.salaryMin;
  const high = Number.isFinite(upper) && upper > 0 ? upper : parsed?.salaryMax;
  const explicitMonths = Number(job?.months);
  const months = Number.isInteger(explicitMonths) && explicitMonths > 0 && explicitMonths <= 36
    ? explicitMonths : parsed?.months;
  const withMonths = salary => months ? salary + " × " + months + "个月" : salary;
  const asK = value => value / 1000 + "k";
  if (Number.isFinite(low) && low > 0 && Number.isFinite(high) && high >= low) return withMonths(low === high ? asK(low) : asK(low) + "~" + asK(high));
  if (Number.isFinite(low) && low > 0) return withMonths(asK(low));
  const scalar = Number(job?.salaryMonthly);
  if (Number.isFinite(scalar) && scalar > 0) return withMonths(asK(scalar));
  return typeof job?.salary === "string" ? job.salary.trim() : "";
}
export const TRACKS = Object.freeze([
  "enterprise",
  "civil-service",
  "public-institution",
]);
export const ENTERPRISE_STATUSES = Object.freeze([
  "未沟通",
  "已沟通",
  "简历已投递",
  "约面试",
  "面试完成",
  "不通过",
  "关注",
  "沟通",
  "待面试",
  "面试中",
  "Offer",
  "结束",
]);
export const PUBLIC_STATUSES = Object.freeze([
  "关注",
  "报名",
  "资格审核",
  "待笔试",
  "资格复审",
  "待面试",
  "面试中",
  "体检考察",
  "公示",
  "录用",
  "结束",
]);
export const STATUSES_BY_TRACK = Object.freeze({
  enterprise: ENTERPRISE_STATUSES,
  "civil-service": Object.freeze([...PUBLIC_STATUSES]),
  "public-institution": Object.freeze([...PUBLIC_STATUSES]),
});
const publicDefaults = {
  关注: 0,
  报名: 10,
  资格审核: 20,
  待笔试: 30,
  资格复审: 45,
  待面试: 55,
  面试中: 65,
  体检考察: 80,
  公示: 90,
  录用: 100,
  结束: 0,
};
export const DEFAULT_PUBLIC_STAGE_SCORES = Object.freeze({
  "civil-service": Object.freeze({ ...publicDefaults }),
  "public-institution": Object.freeze({ ...publicDefaults }),
});
export const DEFAULT_PUBLIC_DIMENSIONS = Object.freeze([
  Object.freeze({ id: "fit", name: "岗位匹配", weight: 40 }),
  Object.freeze({ id: "location", name: "地点生活", weight: 30 }),
  Object.freeze({ id: "stability", name: "发展稳定", weight: 30 }),
]);
export const PUBLIC_QUESTION_CATEGORIES = Object.freeze([
  "综合分析",
  "组织计划",
  "应急应变",
  "人际沟通",
  "岗位认知",
  "自我认知",
  "专业能力",
  "其他",
]);
export const ENTERPRISE_QUESTION_CATEGORIES = Object.freeze([
  "自我介绍",
  "项目经历",
  "专业能力",
  "协作沟通",
  "求职动机",
  "其他",
]);
export function organizationKind(organization) {
  return (typeof organization === "string"
    ? organization
    : organization?.kind) === "public"
    ? "public"
    : "enterprise";
}
export function getTrack(job, organization) {
  const explicit = typeof job === "string" ? job : job?.track;
  if (TRACKS.includes(explicit)) return explicit;
  return organizationKind(organization) === "public"
    ? "civil-service"
    : "enterprise";
}
export function isPublicJob(job, organization) {
  return getTrack(job, organization) !== "enterprise";
}
export function statusesFor(job, organization) {
  return STATUSES_BY_TRACK[getTrack(job, organization)];
}
export function trackLabel(job, organization) {
  return {
    enterprise: "企业求职",
    "civil-service": "公务员招录",
    "public-institution": "事业单位招录",
  }[getTrack(job, organization)];
}
const enterpriseLabels = Object.freeze({
  organization: "公司",
  organizations: "公司档案",
  job: "岗位",
  jobs: "招聘岗位",
  requirements: "JD",
  feedback: "招聘反馈",
  assessment: "企业意向",
  decision: "Offer 决策",
  report: "求职记录",
  pipeline: "求职进程",
  interviewer: "面试官",
  requirementsHint: "保留 JD 原文与招聘方说明",
});
const publicLabels = Object.freeze({
  organization: "招录单位",
  organizations: "单位档案",
  job: "招录职位",
  jobs: "招录职位",
  requirements: "职位要求",
  feedback: "考试与招录记录",
  assessment: "招录流程进展",
  decision: "报考与录用决策",
  report: "备考与招录记录",
  pipeline: "招录流程",
  interviewer: "考官 / 面试记录",
  requirementsHint: "自行填写职位要求与资格条件，依据本人核实的材料",
});
export function labelsFor(job, organization) {
  return isPublicJob(job, organization) ? publicLabels : enterpriseLabels;
}
export function questionCategoriesFor(job, organization) {
  return isPublicJob(job, organization)
    ? PUBLIC_QUESTION_CATEGORIES
    : ENTERPRISE_QUESTION_CATEGORIES;
}
/** A score rubric records workflow only; stages can be edited independently for each track. */
export function publicStageScoresFor(job, organization, settings = {}) {
  const track = getTrack(job, organization);
  if (track === "enterprise") return null;
  return {
    ...DEFAULT_PUBLIC_STAGE_SCORES[track],
    ...(settings.publicStageScores?.[track] || {}),
  };
}

/** One explicit rule table drives both score calculation and tag presentation. */
export const TAG_SCORE_RULES = Object.freeze({
  green: Object.freeze({ label: "利好", factor: 1 }),
  red: Object.freeze({ label: "风险", factor: -1 }),
  yellow: Object.freeze({ label: "风险", factor: -1 }),
  blue: Object.freeze({ label: "参考", factor: 0 }),
});
export const TAG_COLORS = Object.freeze(Object.keys(TAG_SCORE_RULES));
export function tagScoreEffect(tag, rules = TAG_SCORE_RULES) {
  const factor = rules?.[tag?.color]?.factor;
  const weight = Number(tag?.weight ?? (tag?.id ? 3 : 0));
  return Number.isFinite(factor) && Number.isFinite(weight) && weight >= 0 ? factor * weight : 0;
}
export function tagScoreAdjustment(tags = [], rules = TAG_SCORE_RULES) {
  return (Array.isArray(tags) ? tags : []).reduce((total, tag) => total + tagScoreEffect(tag, rules), 0);
}
export function isManualIntentValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
/** Manual values belong to one job; missing values continue using the existing rubric. */
export function opportunityIntentValues(job = {}, score = {}) {
  const personalManual = isManualIntentValue(job.personalIntent);
  const employerManual = isManualIntentValue(job.employerIntent);
  const normalized = value => Math.max(0, Math.min(100, Number(value) || 0));
  return {
    personal: normalized(personalManual ? job.personalIntent : score.personal),
    employer: normalized(employerManual ? job.employerIntent : score.interest),
    personalManual,
    employerManual,
  };
}
