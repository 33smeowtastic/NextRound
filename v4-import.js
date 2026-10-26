import { parseSalaryRange } from "./opportunity.js";
/** V4 job database adapter. Reads JSON only; it never writes or replaces a workspace. */
import { blankState, mergeData, validateState, TAG_COLORS } from "./core.js";

export const V4_STATUSES = ["未沟通", "已沟通", "简历已投递", "约面试", "面试完成", "Offer", "不通过"];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = (value) => structuredClone(value);
function requireValue(condition, message) {
  if (!condition) throw new Error(`V4 导入失败：${message}`);
}
function decoded(input) {
  if (typeof input !== "string") return input;
  try { return JSON.parse(input.replace(/^\uFEFF/, "")); }
  catch { throw new Error("V4 导入失败：文件不是有效的 JSON。"); }
}
export function isV4Import(input) {
  try {
    const value = decoded(input);
    return object(value) && value.format === undefined && value.schemaVersion === undefined && typeof value.version === "string" && /^4(?:\.\d+){0,2}$/.test(value.version) && Array.isArray(value.companies) && Array.isArray(value.jobs);
  } catch { return false; }
}
const validId = (value) => typeof value === "string" && value.trim() && value.length <= 200;
const stable = (value) => JSON.stringify(canonical(value));
function canonical(value) {
  return Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
}
function validateCatalog(payload) {
  requireValue(object(payload.tag_colors) && Object.keys(payload.tag_colors).length === 4 && TAG_COLORS.every((color) => object(payload.tag_colors[color])), "tag_colors 只能包含 green/red/yellow/blue 四种颜色");
  for (const [color, definition] of Object.entries(payload.tag_colors)) {
    requireValue(TAG_COLORS.includes(color) && typeof definition.name === "string" && /^#[0-9a-f]{6}$/i.test(definition.hex), `tag_colors.${color} 定义无效`);
  }
  requireValue(object(payload.tag_catalog), "缺少 tag_catalog 标准词表");
  for (const [id, entry] of Object.entries(payload.tag_catalog)) {
    requireValue(validId(id) && object(entry) && entry.id === id && typeof entry.label === "string" && entry.label.trim() && TAG_COLORS.includes(entry.default_color), `tag_catalog.${id} 的 ID、名称或默认颜色无效`);
  }
}
function tagsFor(tags, catalog, path) {
  requireValue(tags === undefined || Array.isArray(tags), `${path}.tags 必须是数组`);
  const result = new Map();
  for (const tag of tags || []) {
    requireValue(object(tag) && validId(tag.id) && Object.hasOwn(catalog, tag.id) && typeof tag.name === "string" && tag.name.trim(), `${path} 标签缺少稳定 ID/名称，或不在标准词表中`);
    const color = tag.color === undefined ? catalog[tag.id].default_color : tag.color;
    requireValue(TAG_COLORS.includes(color), `${path} 标签颜色只能是 green/red/yellow/blue`);
    requireValue(tag.detail === undefined || typeof tag.detail === "string", `${path} 标签 detail 必须是文本`);
    const normalized = { ...clone(tag), name: catalog[tag.id].label, color };
    if (result.has(tag.id)) requireValue(stable(result.get(tag.id)) === stable(normalized), `${path} 同一标签 ID 存在不同内容，请先统一后导入`);
    else result.set(tag.id, normalized);
  }
  return [...result.values()];
}
function validateOptionalFields(record, path) {
  for (const key of ["notes", "reason", "score_type", "score_basis", "description", "size", "financing_display", "industry", "location", "city", "salary", "experience", "education", "platform", "applied_date", "status_notes", "jd_fidelity"])
    if (record[key] !== undefined) requireValue(typeof record[key] === "string", `${path}.${key} 必须是文本`);
  for (const key of ["urls", "upskilling", "tag_names", "tags_legacy"])
    if (record[key] !== undefined) requireValue(Array.isArray(record[key]) && record[key].every((value) => typeof value === "string"), `${path}.${key} 必须是文本数组`);
  if (record.source !== undefined) requireValue(typeof record.source === "string" || object(record.source), `${path}.source 必须是文本或来源对象`);
  if (record.jd_summary !== undefined) requireValue(object(record.jd_summary), `${path}.jd_summary 必须是对象`);
  if (record.score !== undefined) requireValue(typeof record.score === "number" && Number.isFinite(record.score) && record.score >= 0 && record.score <= 5, `${path}.score 必须是 0—5 的推荐评分`);
  if (record.recommendation !== undefined) {
    const score = record.recommendation;
    requireValue(object(score) && typeof score.score === "number" && Number.isFinite(score.score) && typeof score.max === "number" && Number.isFinite(score.max) && score.max > 0 && score.score >= 0 && score.score <= score.max && (score.comment === undefined || typeof score.comment === "string") && (score.type === undefined || typeof score.type === "string"), `${path}.recommendation 推荐评分无效`);
  }
}
function salaryFields(salary) {
  const parsed = parseSalaryRange(salary);
  if (parsed) return parsed;
  // Keep the original V4 extraction boundary for older archives.
  if (typeof salary !== "string") return {};
  const range = /^\s*(\d+(?:\.\d+)?)\s*[-–—~～至]\s*(\d+(?:\.\d+)?)\s*K(?:\s*[·⋅]\s*(\d+)\s*薪)?\s*$/i.exec(salary);
  if (!range || Number(range[1]) > Number(range[2])) return {};
  return { salaryMin: Number(range[1]) * 1000, salaryMax: Number(range[2]) * 1000, ...(range[3] ? { months: Number(range[3]) } : {}) };
}
function baseRecord(raw, datasetDate) {
  return { ...clone(raw), id: raw.id, createdAt: datasetDate, updatedAt: datasetDate, revision: 1, v4Source: clone(raw) };
}
/** Convert a V4 payload to a validated, self-contained NextRound state. */
export function parseV4Import(input) {
  const payload = decoded(input);
  requireValue(isV4Import(payload), "此文件不是 V4 岗位数据库；NextRound 完整备份请使用原有备份导入");
  // Reuse the domain JSON boundary before following any input references or copying fields.
  validateState({ ...blankState(), v4Payload: payload });
  requireValue(typeof payload.created_at === "string" && payload.created_at, "缺少稳定的 created_at 数据日期");
  requireValue(Array.isArray(payload.statuses) && payload.statuses.length > 0 && payload.statuses.every((status) => V4_STATUSES.includes(status)) && new Set(payload.statuses).size === payload.statuses.length, "statuses 必须是 V4 的不重复状态列表");
  validateCatalog(payload);
  const allIds = new Set(), companies = new Set();
  for (const raw of payload.companies) {
    requireValue(object(raw) && validId(raw.id) && !allIds.has(raw.id), "公司 ID 无效或重复");
    requireValue(typeof raw.key === "string" && raw.key.trim() || typeof raw.full_name === "string" && raw.full_name.trim(), `companies[${raw.id}] 缺少公司名称`);
    validateOptionalFields(raw, `companies[${raw.id}]`);
    allIds.add(raw.id); companies.add(raw.id);
  }
  const state = blankState();
  state.companies = payload.companies.map((raw) => ({
    ...baseRecord(raw, payload.created_at), kind: "enterprise", name: raw.key || raw.full_name,
    notes: raw.notes ?? raw.description ?? "", tags: tagsFor(raw.tags, payload.tag_catalog, `companies[${raw.id}]`),
  }));
  state.jobs = payload.jobs.map((raw) => {
    requireValue(object(raw) && validId(raw.id) && !allIds.has(raw.id), "岗位 ID 无效、重复或与公司 ID 冲突");
    allIds.add(raw.id);
    requireValue(typeof raw.role === "string" && raw.role.trim(), `jobs[${raw.id}] 缺少岗位名称 role`);
    requireValue(typeof raw.company_id === "string" && companies.has(raw.company_id), `jobs[${raw.id}].company_id 引用不存在`);
    requireValue(typeof raw.jd_full_text === "string", `jobs[${raw.id}] 缺少 JD 全文 jd_full_text`);
    const status = raw.status === undefined ? "未沟通" : raw.status;
    requireValue(V4_STATUSES.includes(status) && payload.statuses.includes(status), `jobs[${raw.id}] 投递状态无效或不在 statuses 中`);
    if (raw.status_options !== undefined) requireValue(Array.isArray(raw.status_options) && raw.status_options.every((value) => V4_STATUSES.includes(value)) && new Set(raw.status_options).size === raw.status_options.length && raw.status_options.includes(status), `jobs[${raw.id}].status_options 无效`);
    validateOptionalFields(raw, `jobs[${raw.id}]`);
    const salary = salaryFields(raw.salary);
    return {
      ...baseRecord(raw, payload.created_at), track: "enterprise", companyId: raw.company_id, title: raw.role, jd: raw.jd_full_text,
      status, tags: tagsFor(raw.tags, payload.tag_catalog, `jobs[${raw.id}]`),
      ...Object.fromEntries(Object.entries(salary).filter(([key]) => raw[key] === undefined)),
    };
  });
  const metadata = Object.fromEntries(Object.entries(payload).filter(([key]) => !["companies", "jobs"].includes(key)).map(([key, value]) => [key, clone(value)]));
  state.v4Imports = [metadata];
  validateState(state);
  return { state, report: { added: state.companies.length + state.jobs.length, unchanged: 0, conflicts: 0, format: "V4", version: payload.version, companies: state.companies.length, jobs: state.jobs.length, catalogTags: Object.keys(payload.tag_catalog).length } };
}
/** Existing personal edits win; distinct incoming records become full conflict snapshots. */
export function mergeV4Import(input, local) {
  validateState(local);
  const parsed = parseV4Import(input);
  // V4 describes companies/jobs, not the user's scoring, matching or display setup.
  parsed.state.settings = clone(local.settings);
  const merged = mergeData(local, parsed.state);
  return { state: merged.state, report: { ...parsed.report, ...merged.report } };
}
