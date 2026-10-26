/** Shared, offline-only domain model. No browser or network dependency. */
import {
  ENTERPRISE_STATUSES,
  ORGANIZATION_KINDS,
  TRACKS,
  DEFAULT_PUBLIC_STAGE_SCORES,
  DEFAULT_PUBLIC_DIMENSIONS,
  getTrack,
  organizationKind,
  isPublicJob,
  statusesFor,
  publicStageScoresFor,
  tagScoreEffect,
} from "./opportunity.js";
export {
  DEFAULT_PUBLIC_STAGE_SCORES,
  DEFAULT_PUBLIC_DIMENSIONS,
} from "./opportunity.js";
export const COLLECTIONS = [
  "companies",
  "jobs",
  "questions",
  "scripts",
  "interviews",
  "sessions",
  "attachments",
  "contentCards",
  "scheduleItems",
];
const OPTIONAL_COLLECTIONS = ["contentCards", "scheduleItems"];
export const TAG_COLORS = ["green", "red", "yellow", "blue"];
export const QUESTION_DIFFICULTIES = Object.freeze(["天堂", "人间", "地狱"]);
const LEGACY_QUESTION_DIFFICULTIES = Object.freeze({ 易: "天堂", 中: "人间", 难: "地狱" });
/** Suggestions for old archives are presented to the user, never applied on load. */
export function suggestQuestionDifficulty(value) {
  return LEGACY_QUESTION_DIFFICULTIES[value] || null;
}
export const SCHEDULE_TYPES = ["general", "training", "interview-prep", "interview"];
export function isWeakScheduleReference(collection, field) {
  return collection === "scheduleItems" && ["companyId", "interviewId", "knowledgeId"].includes(field);
}
export const STATUSES = [...ENTERPRISE_STATUSES];
export const DEFAULT_STAGE_SCORES = {
  未沟通: 0,
  已沟通: 15,
  简历已投递: 22,
  约面试: 35,
  面试完成: 60,
  关注: 0,
  沟通: 15,
  待面试: 30,
  面试中: 50,
  Offer: 90,
  结束: 0,
  不通过: 0,
};
export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `nr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  );
}
export function blankState() {
  return {
    schemaVersion: 1,
    companies: [],
    jobs: [],
    questions: [],
    scripts: [],
    interviews: [],
    sessions: [],
    attachments: [],
    contentCards: [],
    scheduleItems: [],
    trash: [],
    settings: {
      keywords: [],
      synonyms: {},
      dimensions: [
        { id: "salary", name: "薪酬回报", weight: 35 },
        { id: "balance", name: "工作生活", weight: 35 },
        { id: "growth", name: "发展空间", weight: 30 },
      ],
      stageScores: { ...DEFAULT_STAGE_SCORES },
      publicStageScores: Object.fromEntries(
        Object.entries(DEFAULT_PUBLIC_STAGE_SCORES).map(([track, scores]) => [
          track,
          { ...scores },
        ]),
      ),
      publicDimensions: DEFAULT_PUBLIC_DIMENSIONS.map((dimension) => ({
        ...dimension,
      })),
      positiveFeedbackPoints: 5,
      negativeFeedbackPoints: 5,
      tagColorScores: { green: 3, red: -3, yellow: -1, blue: 0 },
      lastBackup: null,
    },
    conflicts: [],
  };
}
/** Fill only fields introduced after schema v1; preserve every existing record. */
export function normalizeState(state) {
  const next = structuredClone(state);
  if (!next || typeof next !== "object" || Array.isArray(next)) return next;
  for (const name of OPTIONAL_COLLECTIONS)
    if (next[name] === undefined) next[name] = [];
  if (next.trash === undefined) next.trash = [];
  if (Array.isArray(next.trash))
    for (const entry of next.trash)
      for (const field of ["records", "dependencies"])
        if (entry?.[field] && typeof entry[field] === "object" && !Array.isArray(entry[field]))
          for (const name of OPTIONAL_COLLECTIONS)
            if (entry[field][name] === undefined) entry[field][name] = [];
  return next;
}
/** Keep pre-review interview records without presenting an unconfirmed meeting as completed. */
export function upgradeLegacyInterviewStatuses(state) {
  if (!state || typeof state !== "object") return state;
  const hasLegacy = (record) => record?.status === "待面试" || record?.history?.some((event) => event.status === "待面试");
  const hasEntry = (entry) => entry?.collection === "interviews" && hasLegacy(entry.incoming);
  const needsUpgrade = state.interviews?.some(hasLegacy) || state.conflicts?.some(hasEntry) ||
    state.trash?.some((entry) => entry.records?.interviews?.some(hasLegacy) ||
      entry.dependencies?.interviews?.some(hasLegacy) || entry.conflicts?.some(hasEntry));
  if (!needsUpgrade) return state;
  const next = structuredClone(state);
  const upgrade = (record) => {
    if (record.status === "待面试") record.status = "待确认";
    for (const event of record.history || []) if (event.status === "待面试") event.status = "待确认";
  };
  for (const record of next.interviews || []) upgrade(record);
  for (const entry of next.conflicts || []) if (entry.collection === "interviews") upgrade(entry.incoming);
  for (const entry of next.trash || []) {
    for (const record of entry.records?.interviews || []) upgrade(record);
    for (const record of entry.dependencies?.interviews || []) upgrade(record);
    for (const conflict of entry.conflicts || []) if (conflict.collection === "interviews") upgrade(conflict.incoming);
  }
  return next;
}
/** Upgrade the untouched four-color defaults; explicit custom scores stay intact. */
export function upgradeLegacyTagColorDefaults(state) {
  const settings = state?.settings;
  const scores = settings?.tagColorScores;
  if (settings?.tagScoreDefaultsVersion || !scores ||
      scores.green !== 3 || scores.red !== -3 || scores.yellow !== 0 || scores.blue !== 0 ||
      Object.keys(scores).length !== 4) return state;
  const next = structuredClone(state);
  next.settings.tagColorScores.yellow = -1;
  next.settings.tagScoreDefaultsVersion = 2;
  return next;
}
export function touch(record = {}, patch = {}) {
  const now = new Date().toISOString();
  return {
    ...record,
    ...patch,
    id: record.id || patch.id || uid(),
    createdAt: record.createdAt || patch.createdAt || now,
    updatedAt: now,
    revision: (record.revision || 0) + 1,
  };
}
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const clone = (x) => structuredClone(x);
function date(value) {
  if (typeof value !== "string") return false;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
      value,
    );
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(parts[1]),
    month = Number(parts[2]),
    day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <=
      [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  );
}
const stable = (x) => JSON.stringify(canonical(x));
function canonical(x) {
  return Array.isArray(x)
    ? x.map(canonical)
    : object(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canonical(x[k])]),
        )
      : x;
}
function requireValue(test, message) {
  if (!test) throw new Error(`数据校验失败：${message}`);
}
function jsonSafe(value, path = "数据", depth = 0) {
  requireValue(depth < 80, `${path} 嵌套过深`);
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    requireValue(Number.isFinite(value), `${path} 数字无效`);
    return;
  }
  requireValue(
    Array.isArray(value) || object(value),
    `${path} 必须是可备份的 JSON 数据`,
  );
  requireValue(
    Array.isArray(value) ||
      [Object.prototype, null].includes(Object.getPrototypeOf(value)),
    `${path} 对象类型无效`,
  );
  for (const [key, item] of Object.entries(value)) {
    requireValue(
      !["__proto__", "prototype", "constructor"].includes(key),
      `${path} 含保留字段`,
    );
    jsonSafe(item, `${path}.${key}`, depth + 1);
  }
}
const stringFields = [
  "name",
  "title",
  "notes",
  "answer",
  "question",
  "content",
  "text",
  "jd",
  "location",
  "website",
  "industry",
  "interviewer",
  "format",
  "mime",
  "data",
  "category",
  "feedback",
  "strengths",
  "weaknesses",
  "confirmedRecruiterFeedback",
  "examName",
  "positionCode",
  "eligibility",
  "examNotes",
  "interviewFormat",
  "remarks",
];
const numberFields = [
  "salaryMonthly",
  "months",
  "hoursWeek",
  "duration",
  "durationSeconds",
  "targetSeconds",
  "salaryMin",
  "salaryMax",
  "examYear",
  "writtenScore",
  "interviewScore",
  "finalScore",
  "rank",
  "vacancies",
];
const references = {
  companyId: "companies",
  jobId: "jobs",
  questionId: "questions",
  scriptId: "scripts",
  interviewId: "interviews",
  sessionId: "sessions",
  attachmentId: "attachments",
};
const referenceArrays = {
  questionIds: "questions",
  attachmentIds: "attachments",
  companyIds: "companies",
  jobIds: "jobs",
};
function validateEntity(record, path, collection, organization = null) {
  requireValue(object(record), `${path} 不是对象`);
  requireValue(
    typeof record.id === "string" &&
      record.id.trim().length > 0 &&
      record.id.length <= 200,
    `${path}.id 无效`,
  );
  requireValue(
    date(record.createdAt) && date(record.updatedAt),
    `${path} 日期无效`,
  );
  requireValue(
    Date.parse(record.updatedAt) >= Date.parse(record.createdAt),
    `${path} 更新日期早于创建日期`,
  );
  requireValue(
    Number.isInteger(record.revision) && record.revision >= 1,
    `${path}.revision 无效`,
  );
  for (const key of stringFields)
    if (record[key] !== undefined)
      requireValue(
        typeof record[key] === "string",
        `${path}.${key} 必须是文本`,
      );
  if (record.source !== undefined)
    requireValue(typeof record.source === "string" || collection === "jobs" && object(record.source), `${path}.source 必须是文本或岗位来源对象`);
  if (["companies", "jobs"].includes(collection) && record.tags !== undefined) {
    requireValue(Array.isArray(record.tags), `${path} 标签必须是数组`);
    const tagIds = new Set();
    for (const tag of record.tags) {
      // Older job records could store free text tags; preserve these existing archives.
      if (collection === "jobs" && typeof tag === "string") continue;
      requireValue(object(tag) && typeof tag.name === "string" && TAG_COLORS.includes(tag.color) && (tag.detail === undefined || typeof tag.detail === "string") && (tag.veto === undefined || typeof tag.veto === "boolean"), `${path} 标签无效`);
      if (tag.id !== undefined) {
        requireValue(typeof tag.id === "string" && tag.id.trim() && tag.id.length <= 200 && !tagIds.has(tag.id), `${path} 标准标签 ID 无效或重复`);
        tagIds.add(tag.id);
        if (tag.weight !== undefined)
          requireValue(typeof tag.weight === "number" && Number.isFinite(tag.weight) && tag.weight >= 0, `${path} 标签权重无效`);
      } else {
        requireValue(["red", "green"].includes(tag.color) && typeof tag.weight === "number" && Number.isFinite(tag.weight) && tag.weight >= 0, `${path} 旧红绿标签无效`);
      }
    }
  }
  if (collection === "contentCards") {
    requireValue(typeof record.title === "string" && typeof record.content === "string", `${path} 素材卡标题和正文必须是文本`);
    if (record.variant !== undefined) requireValue(typeof record.variant === "string", `${path}.variant 素材版本必须是文本`);
    if (record.tags !== undefined)
      requireValue(Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string"), `${path} 标签必须是文本数组`);
  }
  if (collection === "questions" && record.difficulty !== undefined && record.difficulty !== null && record.difficulty !== "")
    requireValue(QUESTION_DIFFICULTIES.includes(record.difficulty) || suggestQuestionDifficulty(record.difficulty), `${path}.difficulty 只能是天堂／人间／地狱；旧题仅兼容易／中／难`);
  if (collection === "scheduleItems") {
    requireValue(typeof record.title === "string" && record.title.trim(), `${path} 日程标题不能为空`);
    requireValue(date(record.startsAt) && /T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(record.startsAt), `${path}.startsAt 必须是含时区的有效 ISO 日期时间`);
    requireValue(SCHEDULE_TYPES.includes(record.type), `${path}.type 日程类型无效`);
    if (record.completed !== undefined)
      requireValue(typeof record.completed === "boolean", `${path}.completed 必须是布尔值`);
    for (const field of ["companyId", "interviewId", "knowledgeId"])
      if (record[field] !== undefined && record[field] !== null && record[field] !== "")
        requireValue(typeof record[field] === "string" && record[field].trim() && record[field].length <= 200, `${path}.${field} 关联 ID 无效`);
    const hasKnowledge = record.knowledgeId !== undefined && record.knowledgeId !== null && record.knowledgeId !== "";
    requireValue(hasKnowledge ? ["questions", "scripts", "contentCards"].includes(record.knowledgeKind) : record.knowledgeKind === undefined || record.knowledgeKind === null || record.knowledgeKind === "", `${path} 知识库类型与关联 ID 必须成对提供`);
    for (const field of ["companyName", "interviewTitle", "knowledgeTitle"])
      if (record[field] !== undefined) requireValue(typeof record[field] === "string", `${path}.${field} 快照必须是文本`);
  }
  if (record.composition !== undefined) {
    requireValue(["questions", "scripts"].includes(collection) && Array.isArray(record.composition), `${path}.composition 分段结构无效`);
    const partIds = new Set();
    for (const part of record.composition) {
      requireValue(object(part) && typeof part.id === "string" && part.id.trim() && part.id.length <= 200 && !partIds.has(part.id), `${path}.composition 分段 ID 无效或重复`);
      requireValue(part.sourceCardId === null || (typeof part.sourceCardId === "string" && part.sourceCardId.trim() && part.sourceCardId.length <= 200), `${path}.composition 来源卡片 ID 无效`);
      requireValue(typeof part.title === "string" && typeof part.text === "string" && (part.variant === undefined || typeof part.variant === "string"), `${path}.composition 分段内容必须是文本`);
      partIds.add(part.id);
    }
    const contentKey = collection === "questions" ? "answer" : "content";
    requireValue(typeof record[contentKey] === "string", `${path} 正文必须是文本`);
    if (record.composition.length)
      requireValue(record[contentKey] === record.composition.map((part) => part.text).join("\n\n"), `${path} 正文与 composition 分段不一致`);
  }
  for (const key of numberFields)
    if (record[key] !== undefined && record[key] !== null && record[key] !== "")
      requireValue(
        typeof record[key] === "number" &&
          Number.isFinite(record[key]) &&
          record[key] >= 0,
        `${path}.${key} 必须是非负数字`,
      );
  for (const key of ["examYear", "rank", "vacancies"])
    if (record[key] !== undefined && record[key] !== null && record[key] !== "")
      requireValue(
        Number.isInteger(record[key]) &&
          record[key] >= (key === "vacancies" ? 0 : 1) &&
          (key !== "examYear" || record[key] <= 9999),
        `${path}.${key} 必须是有效整数`,
      );
  for (const key of ["applicationDeadline", "writtenDate"])
    if (record[key] !== undefined && record[key] !== null && record[key] !== "")
      requireValue(date(record[key]), `${path}.${key} 日期无效`);
  if (collection === "companies" && record.kind !== undefined)
    requireValue(
      ORGANIZATION_KINDS.includes(record.kind),
      `${path}.kind 组织类型无效`,
    );
  if (record.track !== undefined)
    requireValue(TRACKS.includes(record.track), `${path}.track 岗位类型无效`);
  if (
    collection === "jobs" &&
    record.track !== undefined &&
    organization?.kind !== undefined
  )
    requireValue(
      (record.track === "enterprise") === (organization.kind === "enterprise"),
      `${path}.track 与关联组织类型不匹配`,
    );
  for (const key of ["scheduledAt", "startedAt", "endedAt", "date"])
    if (record[key]) requireValue(date(record[key]), `${path}.${key} 日期无效`);
  for (const key of ["tags", "versions", "answers", "history", "questions"])
    if (record[key] !== undefined)
      requireValue(Array.isArray(record[key]), `${path}.${key} 必须是数组`);
  if (record.status !== undefined)
    requireValue(
      typeof record.status === "string",
      `${path}.status 必须是文本`,
    );
  if (record.status !== undefined && collection === "jobs")
    requireValue(
      statusesFor(record, organization).includes(record.status),
      `${path}.status 无效`,
    );
  if (collection === "jobs")
    for (const field of ["personalIntent", "employerIntent"])
      if (record[field] !== undefined && record[field] !== null)
        requireValue(typeof record[field] === "number" && Number.isFinite(record[field]) && record[field] >= 0 && record[field] <= 100, `${path}.${field} 必须为 0—100`);
  if (record.status !== undefined && collection === "interviews")
    requireValue(
      ["待面试", "待确认", "已完成", "已取消"].includes(record.status),
      `${path}.status 无效`,
    );
  if (record.ratings !== undefined) {
    requireValue(object(record.ratings), `${path}.ratings 无效`);
    for (const value of Object.values(record.ratings))
      requireValue(
        typeof value === "number" && value >= 0 && value <= 10,
        `${path}.ratings 必须为 0—10`,
      );
  }
}
function validateSettings(settings) {
  requireValue(object(settings), "settings 无效");
  requireValue(
    Array.isArray(settings.keywords) &&
      settings.keywords.every((k) => typeof k === "string"),
    "关键词必须是文本数组",
  );
  requireValue(
    object(settings.synonyms) &&
      Object.values(settings.synonyms).every(
        (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
      ),
    "同义词必须是文本数组映射",
  );
  if (settings.contentCardTagOrder !== undefined) {
    requireValue(
      Array.isArray(settings.contentCardTagOrder) &&
        settings.contentCardTagOrder.every((tag) => typeof tag === "string" && tag.trim()) &&
        new Set(settings.contentCardTagOrder.map((tag) => tag.trim())).size === settings.contentCardTagOrder.length,
      "素材卡标签顺序必须是不重复的非空文本数组",
    );
  }
  function validateDimensions(dimensions, label) {
    requireValue(Array.isArray(dimensions), `${label}必须是数组`);
    const ids = new Set();
    for (const d of dimensions) {
      requireValue(
        object(d) &&
          typeof d.id === "string" &&
          d.id &&
          !ids.has(d.id) &&
          typeof d.name === "string" &&
          typeof d.weight === "number" &&
          Number.isFinite(d.weight) &&
          d.weight >= 0,
        `${label}无效或 ID 重复`,
      );
      ids.add(d.id);
    }
  }
  validateDimensions(settings.dimensions, "评分维度");
  if (settings.publicDimensions !== undefined)
    validateDimensions(settings.publicDimensions, "公招评分维度");
  if (settings.publicStageScores !== undefined) {
    requireValue(object(settings.publicStageScores), "公招进展规则无效");
    for (const [track, scores] of Object.entries(settings.publicStageScores)) {
      requireValue(
        ["civil-service", "public-institution"].includes(track) &&
          object(scores),
        "公招进展规则类型无效",
      );
      for (const [stage, value] of Object.entries(scores))
        requireValue(
          statusesFor(track).includes(stage) &&
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0 &&
            value <= 100,
          "公招进展规则分必须为 0—100",
        );
    }
  }
  if (settings.stageScores !== undefined) {
    requireValue(object(settings.stageScores), "招聘进展规则无效");
    for (const [stage, value] of Object.entries(settings.stageScores))
      requireValue(
        STATUSES.includes(stage) &&
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 100,
        "招聘进展规则分必须为 0—100",
      );
  }
  if (settings.tagColorScores !== undefined) {
    requireValue(object(settings.tagColorScores), "四色标签评分规则无效");
    for (const [color, points] of Object.entries(settings.tagColorScores))
      requireValue(TAG_COLORS.includes(color) && typeof points === "number" && Number.isFinite(points) && points >= -100 && points <= 100, "标签颜色分值必须为 -100—100");
  }
  for (const field of ["positiveFeedbackPoints", "negativeFeedbackPoints"])
    if (settings[field] !== undefined)
      requireValue(
        typeof settings[field] === "number" &&
          Number.isFinite(settings[field]) &&
          settings[field] >= 0 &&
          settings[field] <= 100,
        "反馈加减分必须为 0—100",
      );
  requireValue(
    settings.lastBackup === null || date(settings.lastBackup),
    "备份日期无效",
  );
}
/** Throws on malformed input. Additional referenceState permits a partial incremental backup. */
export function validateState(state, referenceState = null) {
  jsonSafe(state);
  requireValue(
    object(state) && state.schemaVersion === 1,
    "不支持的 schemaVersion",
  );
  for (const name of OPTIONAL_COLLECTIONS)
    if (state[name] === undefined) state = { ...state, [name]: [] };
  for (const name of [...COLLECTIONS, "conflicts"])
    requireValue(Array.isArray(state[name]), `${name} 必须是数组`);
  requireValue(state.trash === undefined || Array.isArray(state.trash), "trash 必须是数组");
  validateSettings(state.settings);
  const ids = Object.fromEntries(
    COLLECTIONS.map((name) => [
      name,
      new Set(
        [...(referenceState?.[name] || []), ...state[name]].map((r) => r.id),
      ),
    ]),
  );
  if (state.settings.trainingDraft !== undefined) {
    requireValue(object(state.settings.trainingDraft), "训练草稿无效");
    function validateDraftReferences(value) {
      if (!value || typeof value !== "object") return;
      for (const [field, child] of Object.entries(value)) {
        if (references[field] && child !== "" && child !== null)
          requireValue(typeof child === "string" && ids[references[field]].has(child), `训练草稿.${field} 引用不存在`);
        if (referenceArrays[field])
          requireValue(Array.isArray(child) && child.every((id) => typeof id === "string" && ids[referenceArrays[field]].has(id)), `训练草稿.${field} 引用不存在`);
        if (child && typeof child === "object") validateDraftReferences(child);
      }
    }
    validateDraftReferences(state.settings.trainingDraft);
  }
  const organizations = new Map(
    [...(referenceState?.companies || []), ...state.companies].map((record) => [
      record.id,
      record,
    ]),
  );
  const linkedJobs = new Map(
    [...(referenceState?.jobs || []), ...state.jobs].map((record) => [
      record.id,
      record,
    ]),
  );
  const allIds = new Set();
  for (const name of COLLECTIONS)
    for (const record of state[name]) {
      const path = `${name}[${record?.id || "?"}]`;
      validateEntity(record, path, name, organizations.get(record.companyId));
      requireValue(!allIds.has(record.id), `${record.id} ID 重复`);
      allIds.add(record.id);
      for (const [field, target] of Object.entries(references))
        if (
          record[field] !== undefined &&
          record[field] !== null &&
          record[field] !== "" &&
          !isWeakScheduleReference(name, field)
        )
          requireValue(
            typeof record[field] === "string" && ids[target].has(record[field]),
            `${path}.${field} 引用不存在`,
          );
      for (const [field, target] of Object.entries(referenceArrays))
        if (record[field] !== undefined)
          requireValue(
            Array.isArray(record[field]) &&
              record[field].every(
                (id) => typeof id === "string" && ids[target].has(id),
              ),
            `${path}.${field} 引用不存在`,
          );
      if (name === "questions" && record.scope !== undefined)
        requireValue(
          ["common", "enterprise", "public"].includes(record.scope),
          `${path} 题目适用场景无效`,
        );
      if (["questions", "scripts"].includes(name) && record.tags)
        requireValue(
          record.tags.every((t) => typeof t === "string"),
          `${path} 标签必须是文本`,
        );
      if (name === "interviews" && record.jobId && record.companyId) {
        const job = linkedJobs.get(record.jobId);
        requireValue(
          job?.companyId === record.companyId,
          `${path} 岗位不属于所选单位`,
        );
      }
      if (name === "sessions" && record.jobId && record.companyId) {
        const job = linkedJobs.get(record.jobId);
        requireValue(
          job?.companyId === record.companyId,
          `${path} 训练岗位不属于目标单位`,
        );
      }
      if (name === "attachments") {
        requireValue(
          typeof record.data === "string" &&
            typeof record.mime === "string" &&
            typeof record.name === "string",
          `${path} 附件不完整`,
        );
        requireValue(
          /^(?:data:[^,]*;base64,)?[A-Za-z0-9+/]*={0,2}$/.test(record.data),
          `${path} 附件编码无效`,
        );
      }
      if (name === "interviews" && record.questions)
        for (const item of record.questions) {
          requireValue(
            object(item) && typeof item.text === "string",
            `${path}.questions 问题必须是文本`,
          );
          for (const field of ["answer", "improved", "category"])
            if (item[field] !== undefined)
              requireValue(
                typeof item[field] === "string",
                `${path}.questions.${field} 必须是文本`,
              );
          if (item.questionId)
            requireValue(
              ids.questions.has(item.questionId),
              `${path} 面试问题引用不存在`,
            );
          if (item.attachmentIds)
            requireValue(
              Array.isArray(item.attachmentIds) &&
                item.attachmentIds.every((id) => ids.attachments.has(id)),
              `${path} 面试附件引用不存在`,
            );
        }
    }
  const conflicts = new Set();
  for (const entry of state.conflicts) {
    requireValue(
      object(entry) &&
        typeof entry.id === "string" &&
        !conflicts.has(entry.id) &&
        typeof entry.collection === "string" &&
        (COLLECTIONS.includes(entry.collection) ||
          entry.collection === "settings") &&
        typeof entry.entityId === "string" &&
        date(entry.createdAt) &&
        object(entry.incoming),
      "冲突记录无效",
    );
    if (entry.collection === "settings") validateSettings(entry.incoming);
    else
      validateEntity(
        entry.incoming,
        "冲突快照",
        entry.collection,
        organizations.get(entry.incoming.companyId),
      );
    conflicts.add(entry.id);
  }
  if (state.v4Imports !== undefined) {
    requireValue(Array.isArray(state.v4Imports), "V4 导入元数据必须是数组");
    for (const metadata of state.v4Imports) {
      requireValue(object(metadata) && typeof metadata.version === "string" && /^4(?:\.\d+){0,2}$/.test(metadata.version) && object(metadata.tag_catalog) && object(metadata.tag_colors), "V4 导入元数据无效");
      requireValue(Object.keys(metadata.tag_colors).length === 4 && TAG_COLORS.every((color) => object(metadata.tag_colors[color])), "V4 标签颜色必须是四种标准颜色");
      for (const definition of Object.values(metadata.tag_colors))
        requireValue(typeof definition.name === "string" && /^#[0-9a-f]{6}$/i.test(definition.hex), "V4 标签颜色定义无效");
      for (const [id, tag] of Object.entries(metadata.tag_catalog))
        requireValue(object(tag) && tag.id === id && typeof tag.label === "string" && tag.label.trim() && TAG_COLORS.includes(tag.default_color), "V4 标准词表无效");
    }
  }
  const trashIds = new Set();
  for (const entry of state.trash || []) {
    requireValue(
      object(entry) && typeof entry.id === "string" && entry.id.trim() &&
        !trashIds.has(entry.id) && COLLECTIONS.includes(entry.collection) &&
        typeof entry.entityId === "string" && typeof entry.label === "string" &&
        date(entry.deletedAt) && object(entry.records) && object(entry.dependencies),
      "垃圾箱记录无效或 ID 重复",
    );
    const snapshot = blankState();
    delete snapshot.trash;
    for (const name of COLLECTIONS) {
      const records = entry.records[name] === undefined && OPTIONAL_COLLECTIONS.includes(name) ? [] : entry.records[name];
      const dependencies = entry.dependencies[name] === undefined && OPTIONAL_COLLECTIONS.includes(name) ? [] : entry.dependencies[name];
      requireValue(Array.isArray(records) && Array.isArray(dependencies), "垃圾箱记录包不完整");
      snapshot[name] = [...records, ...dependencies];
    }
    requireValue(Array.isArray(entry.records[entry.collection]) && entry.records[entry.collection].some((record) => record.id === entry.entityId), "垃圾箱缺少原始记录");
    if (entry.trainingDraft !== undefined) {
      requireValue(object(entry.trainingDraft), "垃圾箱训练草稿无效");
      snapshot.settings.trainingDraft = entry.trainingDraft;
    }
    requireValue(entry.conflicts === undefined || Array.isArray(entry.conflicts), "垃圾箱冲突版本必须是数组");
    snapshot.conflicts = entry.conflicts || [];
    validateState(snapshot);
    const snapshotIds = Object.fromEntries(COLLECTIONS.map((name) => [name, new Set(snapshot[name].map((record) => record.id))]));
    function validateConflictReferences(value, collection) {
      if (!value || typeof value !== "object") return;
      for (const [field, child] of Object.entries(value)) {
        if (references[field] && child !== "" && child !== null && !isWeakScheduleReference(collection, field))
          requireValue(typeof child === "string" && snapshotIds[references[field]].has(child), `垃圾箱冲突版本.${field} 引用不存在`);
        if (referenceArrays[field])
          requireValue(Array.isArray(child) && child.every((id) => typeof id === "string" && snapshotIds[referenceArrays[field]].has(id)), `垃圾箱冲突版本.${field} 引用不存在`);
        if (child && typeof child === "object") validateConflictReferences(child, collection);
      }
    }
    for (const conflict of snapshot.conflicts) validateConflictReferences(conflict.incoming, conflict.collection);
    trashIds.add(entry.id);
  }
  return true;
}
/** Existing records always win. Incoming alternatives are retained as full snapshots. */
export function mergeData(local, incoming) {
  validateState(local);
  validateState(incoming, local);
  local = upgradeLegacyInterviewStatuses(normalizeState(local));
  incoming = upgradeLegacyInterviewStatuses(normalizeState(incoming));
  const state = clone(local),
    report = { added: 0, unchanged: 0, conflicts: 0 };
  function conflict(collection, entityId, value) {
    if (
      state.conflicts.some(
        (c) =>
          c.collection === collection &&
          c.entityId === entityId &&
          stable(c.incoming) === stable(value),
      )
    ) {
      report.unchanged++;
      return;
    }
    state.conflicts.push({
      id: uid(),
      collection,
      entityId,
      createdAt: new Date().toISOString(),
      incoming: clone(value),
    });
    report.conflicts++;
  }
  for (const collection of COLLECTIONS) {
    const existing = new Map(state[collection].map((r) => [r.id, r]));
    for (const item of incoming[collection]) {
      if (!existing.has(item.id)) {
        state[collection].push(clone(item));
        existing.set(item.id, item);
        report.added++;
      } else if (stable(existing.get(item.id)) === stable(item))
        report.unchanged++;
      else conflict(collection, item.id, item);
    }
  }
  // Settings are shared data too: preserve the local setup and retain imported setup as a recoverable version.
  if (stable(local.settings) !== stable(incoming.settings))
    conflict("settings", "settings", incoming.settings);
  for (const item of incoming.conflicts)
    if (
      !state.conflicts.some(
        (c) =>
          c.collection === item.collection &&
          c.entityId === item.entityId &&
          stable(c.incoming) === stable(item.incoming),
      )
    ) {
      state.conflicts.push({
        ...clone(item),
        id: state.conflicts.some((c) => c.id === item.id) ? uid() : item.id,
      });
      report.conflicts++;
    }
  state.trash ||= [];
  for (const item of incoming.trash || []) {
    // Metadata does not create another copy of the same deleted version.
    const fingerprint = ({ collection, entityId, records, dependencies, trainingDraft, conflicts = [] }) =>
      stable({ collection, entityId, records, dependencies, conflicts: conflicts.map(({ collection, entityId, incoming }) => ({ collection, entityId, incoming })).sort((a, b) => stable(a).localeCompare(stable(b))), ...(trainingDraft === undefined ? {} : { trainingDraft }) });
    if (state.trash.some((entry) => fingerprint(entry) === fingerprint(item))) {
      report.unchanged++;
    } else {
      state.trash.push({ ...clone(item), id: state.trash.some((entry) => entry.id === item.id) ? uid() : item.id });
      report.added++;
    }
  }
  if (local.v4Imports !== undefined || incoming.v4Imports !== undefined) {
    state.v4Imports = clone(local.v4Imports || []);
    for (const metadata of incoming.v4Imports || [])
      if (!state.v4Imports.some((existing) => stable(existing) === stable(metadata))) state.v4Imports.push(clone(metadata));
  }
  validateState(state);
  return { state, report };
}
export function keywordCoverage(text, keywords = [], synonyms = {}) {
  const normalized = String(text || "")
    .normalize("NFKC")
    .toLocaleLowerCase();
  const unique = [
    ...new Set(keywords.map((k) => String(k).trim()).filter(Boolean)),
  ];
  function contains(term) {
    const word = String(term).normalize("NFKC").toLocaleLowerCase().trim();
    if (!word) return false;
    if (/^[a-z0-9_+#. -]+$/i.test(word)) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9_])${escaped}(?=$|[^a-z0-9_])`, "i").test(
        normalized,
      );
    }
    return normalized.includes(word);
  }
  const matched = unique.filter((k) =>
    [k, ...(synonyms[k] || [])].some(contains),
  );
  return {
    matched,
    missing: unique.filter((k) => !matched.includes(k)),
    percent: unique.length
      ? Math.round((matched.length / unique.length) * 100)
      : 0,
  };
}
export function scoreCompany(
  company,
  jobs = [],
  settings = blankState().settings,
) {
  const related = jobs.filter((job) => job.companyId === company.id);
  const publicAssessment =
    organizationKind(company) === "public" ||
    related.some((job) => isPublicJob(job, company));
  const dimensions =
      (publicAssessment
        ? settings.publicDimensions || DEFAULT_PUBLIC_DIMENSIONS
        : settings.dimensions) || [],
    ratings = company.ratings || {};
  const reasons = [],
    totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  let personal = 0;
  for (const d of dimensions) {
    const value = Math.max(0, Math.min(10, Number(ratings[d.id]) || 0));
    if (totalWeight) personal += (value * 10 * d.weight) / totalWeight;
    reasons.push(
      `${d.name}：${value}/10，权重 ${d.weight}；${ratings[d.id] === undefined ? "尚未评分，暂按 0 分" : "个人评价"}`,
    );
  }
  const tags = company.tags || [];
  const colorScores = { green: 3, red: -3, yellow: -1, blue: 0, ...(settings.tagColorScores || {}) };
  const adjustment = tags.reduce((sum, tag) => sum +
    (tag.id ? Number(colorScores[tag.color]) || 0 : tagScoreEffect(tag)), 0);
  personal = Math.round(Math.max(0, Math.min(100, personal + adjustment)));
  const veto = tags.some((t) => t.color === "red" && t.veto);
  if (tags.length)
    reasons.push(
      `四色标签合计 ${adjustment >= 0 ? "+" : ""}${adjustment} 分；绿色利好，红色和黄色风险，蓝色参考，可在设置中调整`,
    );
  if (veto)
    reasons.push("命中一票否决条件，保留原评分供比较，不建议进入最终选择");
  let interest = 0;
  if (publicAssessment) {
    const publicJobs = related.filter((job) => isPublicJob(job, company));
    let best = null;
    for (const job of publicJobs) {
      const scores = publicStageScoresFor(job, company, settings);
      const value = scores[job.status] || 0;
      if (!best || value > best.score) best = { job, score: value };
    }
    interest = Math.max(0, Math.min(100, best?.score || 0));
    reasons.push(
      `招录流程进展：${best?.job.status || "尚无招录进展"} ${interest} 分（可编辑的本地流程规则，不代表成绩、排名或真实录用概率）`,
    );
    reasons.push(
      "优势、不足与反馈文字不参与公招流程加减分；各笔试、面试成绩仅保留原始记录，不自动推断录用结果",
    );
  } else {
    const stageScores = {
      ...DEFAULT_STAGE_SCORES,
      ...(settings.stageScores || {}),
    };
    const positivePoints = settings.positiveFeedbackPoints ?? 5,
      negativePoints = settings.negativeFeedbackPoints ?? 5;
    const best = related.reduce(
      (current, job) =>
        (stageScores[job.status] || 0) > (stageScores[current?.status] || 0)
          ? job
          : current,
      related[0],
    );
    interest = best ? stageScores[best.status] || 0 : 0;
    reasons.push(
      `企业意向基准：${best?.status || "尚无招聘进展"} ${interest} 分（规则分，不是真实录用概率）`,
    );
    // Preserve existing enterprise rubric; public assessment never takes this branch.
    if (company.strengths?.trim()) {
      interest += positivePoints;
      reasons.push(
        `已记录招聘方认可的优势：+${positivePoints} 分；请核对原始记录`,
      );
    }
    if (company.weaknesses?.trim()) {
      interest -= negativePoints;
      reasons.push(
        `已记录招聘方指出的不足：−${negativePoints} 分；请核对原始记录`,
      );
    }
    if (company.feedback?.trim())
      reasons.push("已记录招聘反馈，文字内容不进行自动情感推断");
    interest = Math.max(0, Math.min(100, interest));
  }
  const monthlyEstimate = (job) => {
    const min = Number(job.salaryMin), max = Number(job.salaryMax);
    if (min > 0 && max >= min) return (min + max) / 2;
    return Number(job.salaryMonthly) > 0 ? Number(job.salaryMonthly) : null;
  };
  const salaryJob =
    related.find((j) => j.status === "Offer" && monthlyEstimate(j) !== null) ||
    related.find((j) => monthlyEstimate(j) !== null);
  const annual = salaryJob
    ? monthlyEstimate(salaryJob) * (salaryJob.months || 12)
    : null;
  const hourly =
    annual !== null && salaryJob.hoursWeek > 0
      ? Math.round((annual / (salaryJob.hoursWeek * 52)) * 100) / 100
      : null;
  if (salaryJob)
    reasons.push(
      `${salaryJob.salaryMin > 0 && salaryJob.salaryMax >= salaryJob.salaryMin ? "估算年包时以月薪区间上下限中点" : "年包以记录的月薪"} × ${salaryJob.months || 12} 薪；时薪按年包 ÷（每周工时 × 52），未扣税费与通勤`,
    );
  return {
    personal,
    interest,
    veto,
    reasons,
    annual,
    hourly,
    assessmentKind: publicAssessment
      ? "public-progress"
      : "enterprise-interest",
    ...(publicAssessment ? { progress: interest } : {}),
  };
}

/** Scores exactly one opportunity; sibling tracks and organizations cannot affect it. */
export function scoreJob(
  job,
  organization = null,
  settings = blankState().settings,
) {
  const profile = organization || { id: job.companyId };
  const tags = new Map((profile.tags || []).map((tag) => [tag.id || tag.name, tag]));
  for (const tag of job.tags || [])
    if (tag && typeof tag === "object") tags.set(tag.id || tag.name, tag);
  return scoreCompany(
    { ...profile, tags: [...tags.values()], ...(job.ratings ? { ratings: job.ratings } : {}) },
    [job],
    settings,
  );
}
