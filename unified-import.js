/** Unified exchange adapter. Pure functions: no storage, DOM, network or workspace changes. */
import { blankState, normalizeState, validateState, COLLECTIONS, TAG_COLORS, QUESTION_DIFFICULTIES, suggestQuestionDifficulty } from "./core.js";
import { parseSalaryRange } from "./opportunity.js";
import { V4_STATUSES } from "./v4-import.js";
export const UNIFIED_MODULES = Object.freeze(["companies", "jobs", "questions", "introductions", "cards", "schedules", "interviews"]);
export const UNIFIED_SCHEMA_VERSIONS = Object.freeze(["next-round-unified-1.0", "next-round-unified-1.1", "next-round-unified-1.2"]);
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_RECORDS = 10000;
const DEFAULT_TAG_COLORS = Object.freeze({ green: { name: "绿色", hex: "#268765" }, red: { name: "红色", hex: "#CB4553" }, yellow: { name: "黄色", hex: "#C28A24" }, blue: { name: "蓝色", hex: "#3476B8" } });
const LABELS = { companies: "公司", jobs: "岗位", questions: "面试题库", introductions: "介绍稿", cards: "内容卡片", schedules: "我的日程", interviews: "面试档案" };
const TARGET = { companies: "companies", jobs: "jobs", questions: "questions", introductions: "scripts", cards: "contentCards", schedules: "scheduleItems", interviews: "interviews" };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = value => structuredClone(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const stable = value => JSON.stringify(canonical(value));
const hasText = value => typeof value === "string" && value.trim().length > 0;
function fail(message) { throw Object.assign(new Error("统一导入失败：" + message), { code: "IMPORT_INVALID" }); }
function need(condition, message) { if (!condition) fail(message); }
function sameRecord(a, b) { const left = copy(a), right = copy(b); for (const key of ["createdAt", "updatedAt", "revision"]) { delete left[key]; delete right[key]; } return stable(left) === stable(right); }
function fingerprint(value) {
  let first = 2166136261, second = 2246822519;
  for (const char of stable(value)) { const code = char.codePointAt(0); first = Math.imul(first ^ code, 16777619); second = Math.imul(second ^ code, 3266489917); }
  return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
}
function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z"); return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
function timestamp(value) {
  if (typeof value !== "string") return false;
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  return !!parts && calendarDate(parts[1]) && +parts[2] < 24 && +parts[3] < 60 && +(parts[4] || 0) < 60 && +(parts[6] || 0) <= 14 && +(parts[7] || 0) < 60 && (+parts[6] !== 14 || +parts[7] === 0) && Number.isFinite(Date.parse(value));
}
function validZone(value) { try { return hasText(value) && !!new Intl.DateTimeFormat("en", { timeZone: value }).format(0); } catch { return false; } }
function zonedParts(value, zone) {
  const date = new Date(value), parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).map(part => [part.type, part.value]));
  return parts;
}
function validateLengths(value, depth = 0) {
  need(depth < 70, "JSON 嵌套过深");
  if (typeof value === "string") need(value.length <= 2_000_000, "单项文本超过 200 万字；请拆分文件，不要截断正文");
  if (value && typeof value === "object") for (const child of Object.values(value)) validateLengths(child, depth + 1);
}
/** Parse root structure only; row-specific errors remain previewable and excludable. */
export function parseUnifiedImport(input) {
  if (input?.type === "NextRoundUnifiedImportSource") input = input.payload;
  if (typeof input === "string") {
    need(new TextEncoder().encode(input).length <= MAX_IMPORT_BYTES, "文件超过 10 MB，请拆分后导入");
    try { input = JSON.parse(input.replace(/^\uFEFF/, "")); } catch { fail("文件不是有效的 JSON，请提供纯 JSON 文件"); }
  }
  need(object(input), "顶层必须是 JSON 对象");
  validateState({ ...blankState(), importedPayload: input });
  validateLengths(input);
  need(new TextEncoder().encode(JSON.stringify(input)).length <= MAX_IMPORT_BYTES, "文件超过 10 MB，请拆分后导入");
  const payload = copy(input), warnings = [], unified = payload.import_schema_version !== undefined;
  if (unified) need(UNIFIED_SCHEMA_VERSIONS.includes(payload.import_schema_version), "不支持的 import_schema_version；支持 next-round-unified-1.0 / 1.1 / 1.2");
  else need(typeof payload.version === "string" && /^4(?:\.\d+){0,2}$/.test(payload.version) && payload.format === undefined && payload.schemaVersion === undefined, "不是统一 JSON 或兼容的 V4 岗位文件；完整备份请使用备份恢复入口");
  need(typeof payload.version === "string" && /^4(?:\.\d+){0,2}$/.test(payload.version), "version 必须是兼容的 V4 版本，例如 4.0.1");
  for (const module of UNIFIED_MODULES) {
    if (!unified && !["companies", "jobs"].includes(module)) payload[module] ??= [];
    if (unified && payload.import_schema_version === "next-round-unified-1.0" && module === "interviews" && payload[module] === undefined) { payload[module] = []; warnings.push("1.0 文件未提供 interviews，按未提供面试档案处理。"); }
    need(Array.isArray(payload[module]), module + " 必须是数组；不提供该模块内容时请保留 []");
  }
  need(UNIFIED_MODULES.reduce((count, module) => count + payload[module].length, 0) <= MAX_IMPORT_RECORDS, "记录超过 10000 条，请拆分文件");
  if (payload.created_at !== undefined) need(calendarDate(payload.created_at) || timestamp(payload.created_at), "created_at 日期无效");
  if (payload.timezone !== undefined) need(validZone(payload.timezone), "timezone 必须是有效 IANA 时区");
  if (payload.statuses !== undefined) need(Array.isArray(payload.statuses) && payload.statuses.length > 0 && payload.statuses.every(status => V4_STATUSES.includes(status)) && new Set(payload.statuses).size === payload.statuses.length, "statuses 必须是七项合法岗位状态的不重复列表");
  if (payload.tag_catalog !== undefined) {
    need(object(payload.tag_catalog), "tag_catalog 必须是对象");
    for (const [id, tag] of Object.entries(payload.tag_catalog)) need(hasText(id) && id.length <= 200 && object(tag) && tag.id === id && hasText(tag.label) && TAG_COLORS.includes(tag.default_color), "tag_catalog." + id + " 的 ID、名称或颜色无效");
  }
  if (payload.tag_colors !== undefined) need(object(payload.tag_colors) && Object.keys(payload.tag_colors).length === 4 && TAG_COLORS.every(color => object(payload.tag_colors[color]) && hasText(payload.tag_colors[color].name) && /^#[0-9a-f]{6}$/i.test(payload.tag_colors[color].hex)), "tag_colors 必须完整定义 green/red/yellow/blue 四色");
  if (payload.tag_catalog === undefined || payload.tag_colors === undefined) warnings.push("文件未提供完整标签词表或四色说明，缺少的部分使用标准四色默认；来源中的实际标签与颜色保持原样。");
  return { type: "NextRoundUnifiedImportSource", format: unified ? "unified" : "V4", schemaVersion: payload.import_schema_version || "V4", version: payload.version, payload, warnings };
}
export function isUnifiedImport(input) { try { parseUnifiedImport(input); return true; } catch { return false; } }
function text(raw, key, required = false, nullable = true) {
  const value = raw[key];
  if (value === undefined || value === null && nullable) { need(!required, key + " 不能为空"); return ""; }
  need(typeof value === "string" && (!required || value.trim()), key + " 必须是" + (required ? "非空" : "") + "文本"); return value;
}
function texts(raw, key) { const value = raw[key]; need(value === undefined || Array.isArray(value) && value.every(item => typeof item === "string"), key + " 必须是文本数组"); return copy(value || []); }
function refs(raw, key) { const values = texts(raw, key); need(values.every(value => hasText(value) && value.length <= 200), key + " 含无效关联 ID"); return values; }
function reference(raw, key) { const value = raw[key]; need(value === undefined || value === null || typeof value === "string" && (!value || hasText(value) && value.length <= 200), key + " 关联 ID 无效"); return value || null; }
function sourceText(value) { need(value === undefined || value === null || typeof value === "string" || object(value), "source 必须是文本或来源对象"); return typeof value === "string" ? value : value ? (typeof value.description === "string" ? value.description : JSON.stringify(value)) : ""; }
function sourceTags(raw, payload) {
  need(raw.tags === undefined || Array.isArray(raw.tags), "tags 必须是数组"); const tags = new Map();
  for (const tag of raw.tags || []) {
    need(object(tag) && hasText(tag.id) && tag.id.length <= 200 && hasText(tag.name), "公司或岗位标签必须包含稳定 id 和名称");
    const definition = payload.tag_catalog?.[tag.id], color = tag.color ?? definition?.default_color;
    need(TAG_COLORS.includes(color), "标签颜色只能是 green/red/yellow/blue"); need(tag.detail === undefined || typeof tag.detail === "string", "标签 detail 必须是文本");
    const normalized = { ...copy(tag), name: definition?.label || tag.name, color };
    if (tags.has(tag.id)) need(stable(tags.get(tag.id)) === stable(normalized), "同一标签 ID 内容或颜色冲突，请先统一"); else tags.set(tag.id, normalized);
  }
  return [...tags.values()];
}
function metadataDate(payload) { return payload.created_at || "1970-01-01T00:00:00.000Z"; }
function base(raw, id, module, payload) { return { ...copy(raw), id, createdAt: metadataDate(payload), updatedAt: metadataDate(payload), revision: 1, unifiedModule: module, unifiedSource: copy(raw) }; }
function optionalTypes(raw) {
  for (const key of ["notes", "reason", "score_type", "score_basis", "description", "size", "financing_display", "industry", "location", "city", "salary", "experience", "education", "platform", "applied_date", "status_notes", "jd_fidelity"]) if (raw[key] !== undefined && raw[key] !== null) need(typeof raw[key] === "string", key + " 必须是文本或 null");
  for (const key of ["urls", "upskilling", "tag_names", "tags_legacy"]) if (raw[key] !== undefined) texts(raw, key);
  if (raw.score !== undefined && raw.score !== null) need(typeof raw.score === "number" && Number.isFinite(raw.score) && raw.score >= 0 && raw.score <= 5, "score 必须是 0—5");
  if (raw.recommendation !== undefined && raw.recommendation !== null) { const score = raw.recommendation; need(object(score) && typeof score.score === "number" && Number.isFinite(score.score) && typeof score.max === "number" && Number.isFinite(score.max) && score.max > 0 && score.score >= 0 && score.score <= score.max, "recommendation 评分无效"); text(score, "type"); text(score, "comment"); }
  if (raw.jd_summary !== undefined && raw.jd_summary !== null) need(object(raw.jd_summary), "jd_summary 必须是对象或 null");
}
function salaryFields(value) {
  return parseSalaryRange(value) || {};
}
function mappedRecords(raw, id, module, payload, now) {
  need(object(raw), "记录必须是对象"); const record = base(raw, id, module, payload);
  if (module === "companies") {
    optionalTypes(raw); need(hasText(raw.key) || hasText(raw.full_name), "公司缺少 key 或 full_name 名称");
    return [{ collection: "companies", record: { ...record, kind: "enterprise", name: raw.key || raw.full_name, notes: text(raw, "notes") || text(raw, "description"), industry: text(raw, "industry"), location: text(raw, "location") || text(raw, "city"), source: sourceText(raw.source), tags: sourceTags(raw, payload) } }];
  }
  if (module === "jobs") {
    optionalTypes(raw); text(raw, "role", true); need(typeof raw.jd_full_text === "string", "jd_full_text 必须是文本，缺少正文时请明确提供空字符串");
    need(hasText(raw.company_id), "岗位必须提供 company_id 公司强关联"); reference(raw, "company_id");
    const status = raw.status === undefined ? "未沟通" : raw.status;
    need(V4_STATUSES.includes(status) && (!payload.statuses || payload.statuses.includes(status)), "岗位 status 不是合法七项状态，或未在 statuses 中声明");
    if (raw.status_options !== undefined) need(Array.isArray(raw.status_options) && raw.status_options.every(value => V4_STATUSES.includes(value)) && new Set(raw.status_options).size === raw.status_options.length && raw.status_options.includes(status), "status_options 不合法或不包含当前状态");
    if (raw.applied_date !== undefined && raw.applied_date !== null && raw.applied_date !== "") need(calendarDate(raw.applied_date), "applied_date 日期无效");
    sourceText(raw.source);
    return [{ collection: "jobs", record: { ...record, track: "enterprise", title: raw.role, companyId: null, source: raw.source ?? "", jd: raw.jd_full_text ?? "", status, notes: text(raw, "notes"), location: text(raw, "location") || text(raw, "city"), tags: sourceTags(raw, payload), ...salaryFields(raw.salary) } }];
  }
  if (module === "questions") {
    text(raw, "question", true); text(raw, "title"); text(raw, "answer", false, false); text(raw, "category"); texts(raw, "tags"); refs(raw, "related_job_ids");
    const hasDifficulty = Object.hasOwn(raw, "difficulty");
    const modernQuestions = payload.questions.some(question => object(question) && QUESTION_DIFFICULTIES.includes(question.difficulty));
    need(!modernQuestions || hasDifficulty, "difficulty 缺失；同一文件的面试题必须全部独立分级");
    if (hasDifficulty) need(QUESTION_DIFFICULTIES.includes(raw.difficulty) || !modernQuestions && suggestQuestionDifficulty(raw.difficulty), "difficulty 只能是天堂／人间／地狱；旧版整份题库的易／中／难可原样导入后手动确认");
    const difficultyTags = new Set(["天堂", "人间", "地狱", "易", "中", "难", "低", "高", "简单", "普通", "困难", "easy", "medium", "hard"]);
    need(!(raw.tags || []).some(tag => difficultyTags.has(tag.trim().toLowerCase())), "难度只能写在 difficulty，不能混入 tags");
    return [{ collection: "questions", record: { ...record, title: raw.title || raw.question, text: raw.question, question: raw.question, answer: raw.answer ?? "", category: raw.category || "", tags: copy(raw.tags || []), source: sourceText(raw.source), jobIds: [], ...(hasDifficulty ? { difficulty: raw.difficulty } : {}) } }];
  }
  if (module === "introductions") {
    text(raw, "title", true); text(raw, "project_name"); texts(raw, "tags"); refs(raw, "related_job_ids");
    need(["self", "project"].includes(raw.kind), "介绍稿 kind 只能是 self 或 project"); need(Array.isArray(raw.versions) && raw.versions.length > 0, "介绍稿必须有至少一个 versions 正文版本"); const labels = new Set();
    return raw.versions.map((version, index) => {
      need(object(version), "介绍版本必须是对象"); text(version, "label", true); need(typeof version.content === "string", "versions.content 必须是完整文本，不能省略或用摘要替代");
      need(!labels.has(version.label), "介绍稿版本 label 重复，请给各版本独立名称"); labels.add(version.label);
      const versionId = index === 0 ? id : (id.length <= 150 ? id : "unified-intro-" + fingerprint(id)) + "::version:" + fingerprint(version.label);
      const duration = version.duration_seconds ?? version.duration ?? raw.duration_seconds ?? raw.duration;
      if (duration !== undefined && duration !== null) need(typeof duration === "number" && Number.isFinite(duration) && duration >= 0, "介绍稿时长必须是非负数字");
      return { collection: "scripts", record: { ...record, id: versionId, introductionId: id, versionName: version.label, type: raw.kind === "project" ? "项目介绍" : "自我介绍", project: raw.project_name || "", content: version.content ?? "", tags: copy(raw.tags || []), source: sourceText(raw.source), jobIds: [], ...(duration === undefined || duration === null ? {} : { duration }) } };
    });
  }
  if (module === "cards") {
    text(raw, "title", true); need(typeof raw.body === "string", "body 必须是完整文本"); text(raw, "category"); texts(raw, "tags"); refs(raw, "related_question_ids"); refs(raw, "related_job_ids");
    return [{ collection: "contentCards", record: { ...record, content: raw.body ?? "", category: raw.category || "", tags: copy(raw.tags || []), source: sourceText(raw.source), jobIds: [], questionIds: [] } }];
  }
  if (module === "schedules") {
    text(raw, "title", true); text(raw, "notes"); need(["training", "interview", "task", "other"].includes(raw.kind), "日程 kind 只能是 training/interview/task/other"); need(typeof raw.all_day === "boolean", "日程 all_day 必须是布尔值");
    need(timestamp(raw.start_at), "start_at 必须是有效且含时区偏移的 ISO 时间");
    need(raw.end_at !== null && raw.end_at !== undefined, "日程缺少结束时刻（end_at），属于待补充项；请补充或取消此项，不会自行推断时长");
    need(timestamp(raw.end_at) && Date.parse(raw.end_at) > Date.parse(raw.start_at), "end_at 必须有效且晚于 start_at");
    const zone = raw.timezone ?? payload.timezone; need(validZone(zone), "日程 timezone 必须是有效 IANA 时区"); 
    if (raw.all_day) need([raw.start_at, raw.end_at].every(value => { const parts = zonedParts(value, zone); return +parts.hour === 0 && +parts.minute === 0 && +parts.second === 0; }), "全天事项起止必须使用当地午夜，结束为下一日或更晚的排除边界");
    need(raw.repeat === undefined || raw.repeat === null, "当前应用不支持重复日程规则；规则已保留在来源，取消本项或调整文件后再导入");
    for (const key of ["related_question_ids", "related_introduction_ids", "related_job_ids"]) refs(raw, key); reference(raw, "company_id"); reference(raw, "interview_id"); if (raw.status !== undefined) text(raw, "status");
    return [{ collection: "scheduleItems", record: { ...record, startsAt: raw.start_at, endsAt: raw.end_at, timezone: zone, allDay: raw.all_day, type: ["training", "interview"].includes(raw.kind) ? raw.kind : "general", notes: raw.notes || "", source: sourceText(raw.source), jobIds: [], questionIds: [], ...(raw.status === "completed" ? { completed: true } : {}) } }];
  }
  text(raw, "company_name"); text(raw, "job_title"); text(raw, "round"); text(raw, "format"); text(raw, "raw_notes");
  need(raw.status === "已完成", "面试档案仅用于面试结束后的复盘，请将面试安排放入日程或在岗位记录中更新状态（status 只接受已完成）");
  for (const key of ["company_id", "job_id", "schedule_id"]) reference(raw, key); refs(raw, "related_question_ids"); texts(raw, "next_steps");
  need(raw.interview_date === undefined || raw.interview_date === null || calendarDate(raw.interview_date), "interview_date 必须是有效 YYYY-MM-DD 日期或 null");
  const zone = raw.timezone ?? payload.timezone ?? "Asia/Shanghai"; need(validZone(zone), "面试 timezone 必须是有效 IANA 时区");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (raw.interview_date) need(raw.interview_date <= today, "未来日期的面试尚未结束，不能导入复盘档案");
  for (const key of ["start_at", "end_at"]) if (raw[key] !== undefined && raw[key] !== null) { need(timestamp(raw[key]), key + " 必须是含有效时区偏移的 ISO 时间"); need(Date.parse(raw[key]) <= +now, "未来时刻的面试尚未结束，不能导入复盘档案"); }
  if (raw.start_at && raw.end_at) need(Date.parse(raw.end_at) > Date.parse(raw.start_at), "面试 end_at 必须晚于 start_at");
  if (raw.interview_date && raw.start_at) { const parts = zonedParts(raw.start_at, zone); need([parts.year, parts.month, parts.day].join("-") === raw.interview_date, "面试日期与 start_at 在指定时区中的日期不一致"); }
  need(raw.questions_asked === undefined || Array.isArray(raw.questions_asked), "questions_asked 必须是实际问答数组");
  const actualQuestions = (raw.questions_asked || []).map(asked => {
    need(object(asked), "实际问题必须是对象"); text(asked, "question", true); text(asked, "answer"); text(asked, "notes");
    need(!asked.predicted && !asked.is_predicted && !asked.simulated && !["predicted", "simulation", "preparation"].includes(asked.type), "预测问题或模拟问题不能放入 questions_asked 实际问答");
    return { ...copy(asked), text: asked.question, answer: asked.answer || "" };
  });
  const review = raw.self_review ?? {}, feedback = raw.employer_feedback ?? {}; need(object(review) && object(feedback), "self_review 和 employer_feedback 必须是对象");
  text(review, "summary"); for (const key of ["strengths", "improvements", "action_items"]) texts(review, key); for (const key of ["text", "source", "result"]) text(feedback, key);
  const feedbackExists = hasText(feedback.text) || hasText(feedback.result); need(!feedbackExists || hasText(feedback.source), "企业反馈必须有明确来源，个人复盘不能代替招聘方反馈");
  const reviewExists = hasText(review.summary) || ["strengths", "improvements", "action_items"].some(key => (review[key] || []).some(hasText));
  const notes = raw.raw_notes || "", onlyNotice = /面试通知|面试邀请|面试邀约|仅有准备|仅准备|尚未(?:举行|面试)|未举行/.test(notes) && !/面试(?:已|结束|后|中)|当场|问了|实际提问|复盘|纪要|面试官(?:问|提)/.test(notes);
  need(actualQuestions.length || reviewExists || feedbackExists || hasText(notes) && !onlyNotice, "缺少实际面试后的问答、纪要、本人复盘或有来源的企业反馈；仅准备材料或面试通知不能导入");
  if (raw.preparation !== undefined) need(object(raw.preparation), "preparation 必须是历史准备资料对象");
  const reviewNotes = [review.summary || "", ...(review.strengths?.length ? ["本人复盘·优势：\n" + review.strengths.join("\n")] : []), ...(review.improvements?.length ? ["本人复盘·待改进：\n" + review.improvements.join("\n")] : []), ...(review.action_items?.length ? ["本人复盘·行动：\n" + review.action_items.join("\n")] : [])].filter(Boolean).join("\n\n");
  return [{ collection: "interviews", record: { ...record, status: "已完成", companyId: null, jobId: null, companyName: raw.company_name || "", jobTitle: raw.job_title || "", date: raw.interview_date ?? null, ...(raw.start_at ? { scheduledAt: raw.start_at, startedAt: raw.start_at } : {}), ...(raw.end_at ? { endedAt: raw.end_at } : {}), questions: actualQuestions, transcript: notes, notes: reviewNotes, selfReview: copy(review), employerFeedback: copy(feedback), feedback: feedbackExists ? [feedback.text, feedback.result, "来源：" + feedback.source].filter(Boolean).join("\n") : "", feedbackSource: feedbackExists ? "招聘方明确反馈" : "个人复盘", confirmedRecruiterFeedback: feedbackExists ? [feedback.text, feedback.result].filter(Boolean).join("\n") : "", strengths: "", weaknesses: "", questionIds: [], source: sourceText(raw.source) } }];
}
function issue(row, message, code = "INVALID_RECORD") { row.issues.push(message.replace(/^统一导入失败：/, "")); row.issueDetails.push({ code, message: row.issues.at(-1) }); }
function comparable(record) { const value = copy(record); for (const key of ["id", "createdAt", "updatedAt", "revision", "unifiedSource", "unifiedModule", "introductionId"]) delete value[key]; return stable(value); }
function choices(options) {
  const modules = options.modules === undefined ? [...UNIFIED_MODULES] : options.modules;
  need(Array.isArray(modules) && modules.every(module => UNIFIED_MODULES.includes(module)), "模块选择无效");
  need(options.excludedIds === undefined || Array.isArray(options.excludedIds) && options.excludedIds.every(key => typeof key === "string"), "excludedIds 必须是条目 key 数组");
  need(options.decisions === undefined || object(options.decisions) && Object.values(options.decisions).every(value => ["skip", "update"].includes(value)), "冲突选择仅支持 skip 或 update");
  return { modules: new Set(modules), excluded: new Set(options.excludedIds || []), decisions: options.decisions || {} };
}
/** Preview all rows, including invalid rows; never persists any state. */
export function previewUnifiedImport(input, local, options = {}) {
  validateState(local); const parsed = parseUnifiedImport(input), { payload } = parsed;
  const now = new Date(options.now ?? Date.now()); need(Number.isFinite(+now), "校验基准时间无效");
  const selection = choices(options), rows = [], maps = Object.fromEntries(UNIFIED_MODULES.map(module => [module, new Map()]));
  const owners = new Map(); for (const collection of COLLECTIONS) for (const record of local[collection] || []) owners.set(record.id, collection);
  const allocated = new Map();
  for (const module of UNIFIED_MODULES) for (const [index, raw] of payload[module].entries()) {
    const suppliedId = object(raw) ? raw.id : null;
    let id = typeof suppliedId === "string" && suppliedId.trim() && suppliedId.length <= 200 ? suppliedId : "unified-" + module + "-" + fingerprint(raw);
    const prior = (local[TARGET[module]] || []).find(record => record.unifiedModule === module && suppliedId && record.unifiedSource?.id === suppliedId && (!record.introductionId || record.introductionId === record.id));
    if (prior) id = prior.id;
    else if (owners.has(id) && owners.get(id) !== TARGET[module] || allocated.has(id) && allocated.get(id) !== module) id = "unified-" + module + "-" + fingerprint(suppliedId || raw);
    allocated.set(id, module);
    const repeated = maps[module].has(suppliedId || id), key = module + ":" + (suppliedId || id) + (repeated ? "#" + index : "");
    const row = { key, module, id, sourceId: suppliedId || null, title: object(raw) ? String(raw.title || raw.role || raw.key || raw.full_name || raw.question || id) : id, status: "new", issues: [], issueDetails: [], warnings: [], records: [], selected: selection.modules.has(module) && !selection.excluded.has(key), decision: selection.decisions[key] || null };
    if (suppliedId !== undefined && suppliedId !== null && suppliedId !== "" && !(typeof suppliedId === "string" && suppliedId.trim() && suppliedId.length <= 200)) issue(row, "id 必须是 1—200 字符的稳定文本");
    if (!suppliedId) row.warnings.push("来源未提供 ID，已按完整内容生成稳定 ID；修改来源内容可能需要人工核对重复项。");
    if (repeated) { issue(row, "同一模块内来源 ID 重复"); issue(maps[module].get(suppliedId || id), "同一模块内来源 ID 重复"); }
    else maps[module].set(suppliedId || id, row);
    try { row.records = mappedRecords(raw, id, module, payload, now); } catch (error) { issue(row, error.message); }
    if (module === "questions" && object(raw)) {
      if (!Object.hasOwn(raw, "difficulty")) row.warnings.push("旧版题目未提供独立难度；导入后保持未分级，请手动选择天堂／人间／地狱。");
      else if (suggestQuestionDifficulty(raw.difficulty)) row.warnings.push(`来源使用旧难度「${raw.difficulty}」；原样保留，建议映射为「${suggestQuestionDifficulty(raw.difficulty)}」，请手动确认。`);
    }
    if (module === "schedules") row.warnings.push("完整起止时间、时区与全天标记已保存；现有日程主要显示开始时间，重复规则尚不支持。");
    rows.push(row);
  }
  function resolve(row, rawId, target, field, required = false) {
    if (!rawId) return null;
    const incoming = maps[target].get(rawId);
    if (incoming && incoming.selected && !incoming.issues.length && incoming.decision !== "skip") return incoming.id;
    const localRecord = (local[TARGET[target]] || []).find(record => record.id === rawId || record.unifiedModule === target && record.unifiedSource?.id === rawId);
    if (localRecord && options.confirmLocalReferences === true) return localRecord.id;
    const message = localRecord ? field + " 指向本地现有条目，需确认关联：" + rawId : field + " 未匹配，待手动关联：" + rawId;
    if (required) issue(row, message, localRecord ? "LOCAL_REFERENCE_CONFIRMATION" : "MISSING_REFERENCE");
    else { if (!row.warnings.includes(message)) row.warnings.push(message); for (const entry of row.records) (entry.record.unresolvedReferences ??= []).push({ field, id: rawId, module: target, reason: localRecord ? "confirmation-required" : "not-found" }); }
    return null;
  }
  for (const row of rows) if (!row.issues.length) {
    const raw = row.records[0]?.record.unifiedSource || {};
    for (const entry of row.records) {
      const record = entry.record;
      if (row.module === "jobs") record.companyId = resolve(row, raw.company_id, "companies", "company_id", true);
      if (row.module === "interviews") {
        record.companyId = resolve(row, raw.company_id, "companies", "company_id"); record.jobId = resolve(row, raw.job_id, "jobs", "job_id");
        const schedule = resolve(row, raw.schedule_id, "schedules", "schedule_id"); if (schedule) record.scheduleId = schedule;
      }
      if (["questions", "introductions", "cards", "schedules"].includes(row.module)) record.jobIds = (raw.related_job_ids || []).map(id => resolve(row, id, "jobs", "related_job_ids")).filter(Boolean);
      if (["cards", "schedules", "interviews"].includes(row.module)) record.questionIds = (raw.related_question_ids || []).map(id => resolve(row, id, "questions", "related_question_ids")).filter(Boolean);
      if (row.module === "schedules") {
        const introIds = (raw.related_introduction_ids || []).map(id => resolve(row, id, "introductions", "related_introduction_ids")).filter(Boolean);
        if (introIds.length) record.relatedIntroductionIds = introIds;
        if (record.questionIds[0]) { record.knowledgeKind = "questions"; record.knowledgeId = record.questionIds[0]; } else if (introIds[0]) { record.knowledgeKind = "scripts"; record.knowledgeId = introIds[0]; }
        const company = resolve(row, raw.company_id, "companies", "company_id"); if (company) record.companyId = company;
        const interview = resolve(row, raw.interview_id, "interviews", "interview_id"); if (interview) record.interviewId = interview;
      }
    }
  }
  const referenceState = normalizeState(local);
  for (const row of rows) if (row.selected && !row.issues.length && row.decision !== "skip") for (const { collection, record } of row.records) { const existing = (local[collection] || []).find(item => item.id === record.id); if (!existing || row.decision === "update" || sameRecord(existing, record)) referenceState[collection].push(record); }
  for (const row of rows) if (!row.issues.length) {
    try { const probe = blankState(); for (const { collection, record } of row.records) probe[collection].push(record); validateState(probe, referenceState); } catch (error) { issue(row, error.message); }
  }
  for (const row of rows) {
    if (!row.selected || row.decision === "skip") row.status = "excluded";
    else if (row.issues.length) row.status = "invalid";
    else {
      const exact = row.records.map(({ collection, record }) => (local[collection] || []).find(existing => existing.id === record.id));
      row.status = exact.some((record, index) => record && !sameRecord(record, row.records[index].record)) ? "conflict" : exact.every(Boolean) ? "duplicate" : "new";
      if (row.module === "questions" && exact[0] && suggestQuestionDifficulty(exact[0].difficulty)) row.warnings.push(`本地旧难度「${exact[0].difficulty}」建议映射为「${suggestQuestionDifficulty(exact[0].difficulty)}」；请确认后手动调整或明确选择更新，默认保留本地值。`);
      if (row.status === "new") {
        const possible = row.records.flatMap(({ collection, record }) => (local[collection] || []).filter(existing => existing.id !== record.id && !(row.module === "interviews" && !record.date) && (comparable(existing) === comparable(record) || collection === "jobs" && existing.companyId === record.companyId && existing.title === record.title && existing.platform === record.platform && existing.posting_group_id === record.posting_group_id)).map(record => record.id));
        if (possible.length) { row.possibleDuplicates = [...new Set(possible)]; row.warnings.push("发现可能相同的现有条目，请核对；不同 ID 不会自动合并：" + row.possibleDuplicates.join("、")); }
      }
    }
  }
  const modules = UNIFIED_MODULES.map(module => { const selected = rows.filter(row => row.module === module); return { id: module, module, label: LABELS[module], total: selected.length, selected: selection.modules.has(module), added: selected.filter(row => row.status === "new").length, unchanged: selected.filter(row => row.status === "duplicate").length, conflicts: selected.filter(row => row.status === "conflict").length, invalid: selected.filter(row => row.status === "invalid").length, excluded: selected.filter(row => row.status === "excluded").length }; });
  const report = { added: 0, updated: 0, unchanged: 0, conflicts: rows.filter(row => row.status === "conflict").length, skipped: 0, excluded: rows.filter(row => row.status === "excluded").length, invalid: rows.filter(row => row.status === "invalid").length, byModule: Object.fromEntries(modules.map(module => [module.id, module])) };
  const errors = rows.filter(row => row.status === "invalid").flatMap(row => row.issues.map(message => row.title + "：" + message));
  if (!errors.length) {
    const candidate = normalizeState(local);
    for (const row of rows) if (row.status === "new" || row.status === "conflict" && row.decision === "update") for (const { collection, record } of row.records) {
      const index = candidate[collection].findIndex(existing => existing.id === record.id);
      if (index < 0) candidate[collection].push(copy(record));
      else if (row.decision === "update") candidate[collection][index] = copy(record);
    }
    try { validateState(candidate); } catch (error) { errors.push("所选条目的整体关联校验失败：" + error.message); }
  }
  return { parsed, format: parsed.format, schemaVersion: parsed.schemaVersion, version: parsed.version, rows, modules, report, errors, warnings: parsed.warnings, canImport: errors.length === 0 && rows.some(row => ["new", "duplicate", "conflict"].includes(row.status)) };
}
/** Return a fully validated candidate. Caller owns atomic save/snapshot/workspace guards. */
export function mergeUnifiedImport(input, local, options = {}) {
  const preview = previewUnifiedImport(input, local, options);
  if (!preview.canImport) throw Object.assign(new Error(preview.errors.length ? "统一导入失败：" + preview.errors.join("；") : "没有可导入的条目，请检查模块选择"), { code: "IMPORT_INVALID", preview });
  const state = normalizeState(local), report = { ...preview.report }, now = new Date(options.now ?? Date.now()).toISOString();
  function retainPrior(collection, record) {
    if (state.conflicts.some(conflict => conflict.collection === collection && conflict.entityId === record.id && sameRecord(conflict.incoming, record))) return;
    state.conflicts.push({ id: "unified-conflict-" + fingerprint([collection, record]), collection, entityId: record.id, createdAt: now, incoming: copy(record) });
  }
  for (const row of preview.rows) {
    if (row.status === "excluded" || row.status === "invalid") continue;
    if (row.status === "conflict" && row.decision !== "update") { report.skipped += row.records.length; continue; }
    for (const { collection, record } of row.records) {
      const index = state[collection].findIndex(existing => existing.id === record.id);
      if (index < 0) { state[collection].push(copy(record)); report.added++; }
      else if (sameRecord(state[collection][index], record)) report.unchanged++;
      else if (row.decision === "update") { retainPrior(collection, state[collection][index]); state[collection][index] = { ...copy(record), createdAt: state[collection][index].createdAt, updatedAt: new Date(Math.max(Date.parse(now), Date.parse(state[collection][index].updatedAt))).toISOString(), revision: state[collection][index].revision + 1 }; report.updated++; }
    }
  }
  const metadata = Object.fromEntries(Object.entries(preview.parsed.payload).filter(([key]) => !UNIFIED_MODULES.includes(key)).map(([key, value]) => [key, copy(value)]));
  if (!metadata.tag_catalog || !metadata.tag_colors) { metadata.importMetadataSource = copy(metadata); metadata.tag_catalog ??= {}; metadata.tag_colors ??= copy(DEFAULT_TAG_COLORS); }
  state.v4Imports ??= []; if (!state.v4Imports.some(existing => stable(existing) === stable(metadata))) state.v4Imports.push(metadata);
  validateState(state); return { state, report, preview };
}
