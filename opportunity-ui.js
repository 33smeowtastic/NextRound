import { helpTip } from "./help-ui.js";
/** Opportunity forms and comparisons; all dynamic HTML goes through caller-owned escaping. */
import {
  DEFAULT_PUBLIC_DIMENSIONS,
  getTrack,
  isPublicJob,
  organizationKind,
  statusesFor,
  trackLabel,
  TAG_SCORE_RULES,
  opportunityIntentValues,
  formatSalaryRange,
  parseSalaryRange,
} from "./opportunity.js";
import { scoreJob } from "./core.js";

const JOB_CONDITION_FIELDS = [
  ["hoursWeek", "每周实际工作", " 小时"],
  ["commute", "单程通勤", ""],
  ["schedule", "工作时间与双休", ""],
  ["overtime", "加班与工作强度", ""],
  ["benefits", "福利与社保公积金", ""],
  ["offerNotes", "Offer 与薪资结构", ""],
  ["notes", "备注与信息来源", ""],
];

/** Bring older structured working-condition fields into the editable tag list once. */
export function editableJobTags(row = {}) {
  const tags = (row.tags || []).map((tag) => typeof tag === "string" ? { name: tag, color: "blue" } : tag);
  if (row.conditionTagsMigrated || isPublicJob(row)) return tags;
  for (const [field, label, suffix] of JOB_CONDITION_FIELDS) {
    const value = row[field];
    if (value === undefined || value === null || String(value).trim() === "") continue;
    const name = `${label}：${String(value).trim()}${suffix}`;
    if (!tags.some((tag) => tag.name === name)) tags.push({ id: `condition-${field}`, name, color: "blue" });
  }
  return tags;
}

/** Infer an editable estimate from a V4 monthly range; never replace an entered value. */
export function inferMonthlySalary(row = {}) {
  if (Object.hasOwn(row, "salaryMonthly")) return row.salaryMonthly ?? "";
  const low = Number(row.salaryMin), high = Number(row.salaryMax);
  if (Number.isFinite(low) && low > 0 && Number.isFinite(high) && high >= low) return Math.round((low + high) / 2);
  if (Number.isFinite(low) && low > 0 && !row.salaryMax) return low;
  const salary = String(row.salary || row.v4Source?.salary || "").trim();
  const monthlyPattern = /(\d+(?:\.\d+)?)\s*(?:[-–—~～至]\s*(\d+(?:\.\d+)?))?\s*(k|千|万|w|元)(?!\s*\/\s*年)/i;
  let match = monthlyPattern.exec(salary);
  if (!match) {
    const salaryLine = String(row.jd || "").split(/\r?\n|；/).find((line) =>
      /(?:薪资|薪酬|月薪|工资|待遇)/.test(line) && !/(?:年薪|年包|\/\s*年)/.test(line) && monthlyPattern.test(line));
    match = salaryLine ? monthlyPattern.exec(salaryLine) : null;
  }
  if (!match || /(?:年薪|年包|\/\s*年)/.test(salary)) return "";
  const unit = /^(?:万|w)$/i.test(match[3]) ? 10000 : match[3] === "元" ? 1 : 1000;
  const min = Number(match[1]) * unit, max = match[2] ? Number(match[2]) * unit : min;
  return max >= min ? Math.round((min + max) / 2) : "";
}

export function jobTagInputRow(tag = {}, esc = (value) => String(value ?? ""), sourceIndex = "") {
  const color = ["green", "red", "yellow", "blue"].includes(tag.color) ? tag.color : "blue";
  const id = tag.id || (sourceIndex === "" ? globalThis.crypto?.randomUUID?.() || `job-tag-${Date.now()}-${Math.random().toString(36).slice(2)}` : "");
  return `<div class="job-tag-row" data-job-tag-row><input type="hidden" name="jobTagId" value="${esc(id)}"><input type="hidden" name="jobTagIndex" value="${esc(sourceIndex)}"><input name="jobTagName" aria-label="标签名称" maxlength="160" value="${esc(tag.name || "")}" placeholder="输入标签内容"><select name="jobTagColor" aria-label="标签颜色">${[["green", "利好"], ["red", "风险"], ["yellow", "风险 · 待核实"], ["blue", "参考"]].map(([value, label]) => `<option value="${value}" ${color === value ? "selected" : ""}>${label}</option>`).join("")}</select><button type="button" class="icon-btn job-tag-remove" data-action="job-tag-remove" aria-label="删除标签"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h14M9 6V4h6v2M7 6l1 14h8l1-14M10 10v7M14 10v7"/></svg></button></div>`;
}

/** Parse editable tag rows while retaining imported IDs, details and legacy score metadata. */
export function parseEditableJobTags(formData, previousTags = [], makeId = () => crypto.randomUUID()) {
  const names = formData.getAll("jobTagName"), colors = formData.getAll("jobTagColor"), ids = formData.getAll("jobTagId"), indices = formData.getAll("jobTagIndex");
  const result = [], used = new Set();
  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] || "").trim(), color = String(colors[i] || "blue"), id = String(ids[i] || "").trim();
    if (!name) continue;
    if (!["green", "red", "yellow", "blue"].includes(color)) throw new Error("标签颜色无效");
    const indexText = String(indices[i] ?? "").trim(), index = Number(indexText);
    const previous = (id && previousTags.find((tag) => tag?.id === id)) || (indexText && Number.isInteger(index) && index >= 0 ? previousTags[index] : null);
    const base = previous && typeof previous === "object" ? previous : {};
    const finalId = id || base.id || (base.weight !== undefined && ["red", "green"].includes(color) ? "" : makeId());
    if (finalId && used.has(finalId)) throw new Error("标签 ID 重复");
    if (finalId) used.add(finalId);
    const tag = { ...base, ...(finalId ? { id: finalId } : {}), name, color };
    if (!finalId) delete tag.id;
    if (!["green", "red"].includes(color) || finalId && !base.id) delete tag.weight;
    if (color !== "red") delete tag.veto;
    result.push(tag);
  }
  return result;
}

function valueOptions(entries, selected, esc) {
  return entries
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
}
function decisionOptions(current, publicMode, options) {
  const values = publicMode
    ? [
        "还在考虑",
        "计划报考",
        "优先选择",
        "继续备考",
        "接受录用",
        "放弃机会",
        "暂缓",
      ]
    : ["还在考虑", "优先选择", "接受 Offer", "拒绝 Offer", "暂缓"];
  if (current && !values.includes(current)) values.push(current);
  return options(values, current || "还在考虑");
}
function dimensionsFor(state, publicMode) {
  return publicMode
    ? state.settings.publicDimensions || DEFAULT_PUBLIC_DIMENSIONS
    : state.settings.dimensions;
}
function ratingsMarkup(row, dimensions, ctx, fallback = null) {
  return dimensions
    .map((dimension) =>
      ctx.textField(
        "rating-" + dimension.id,
        `${ctx.esc(dimension.name)}（0 至 10）`,
        row.ratings?.[dimension.id] ?? fallback?.[dimension.id] ?? "",
        "number",
        'min="0" max="10" step="0.5"',
      ),
    )
    .join("");
}
function historyMarkup(row, esc) {
  return `<h3 class="subhead">状态足迹</h3>${
    (row.history || [])
      .map(
        (entry) =>
          `<p class="trace">${esc(String(entry.at || "").replace("T", " "))} · ${esc(entry.status)}</p>`,
      )
      .join("") || '<p class="trace">首次保存与之后的状态变更会自动记录。</p>'
  }`;
}

export function organizationEditor(row, ctx) {
  const {
    state,
    isNew,
    textField,
    area,
    selectField,
    options,
    btn,
    esc,
    badge,
  } = ctx;
  const publicMode = organizationKind(row) === "public";
  const noun = publicMode ? "招录单位" : "公司";
  const dimensions = dimensionsFor(state, publicMode);
  const basic = [
    selectField(
      "kind",
      "档案类型",
      valueOptions(
        [
          ["enterprise", "企业求职"],
          ["public", "公务员 / 事业单位招录"],
        ],
        organizationKind(row),
        esc,
      ),
    ),
    textField("name", `${noun}名称 *`, row.name, "text", "required full"),
    textField(
      "industry",
      publicMode ? "单位类型 / 领域（自行填写）" : "行业",
      row.industry,
    ),
    textField("location", "城市 / 地点", row.location),
    textField(
      "website",
      publicMode ? "单位官网 / 招录入口" : "官网 / 链接",
      row.website,
      "url",
      "full",
    ),
    area("facts", "已确认信息 · 请注明来源", row.facts),
    area(
      "claims",
      publicMode ? "公告 / 经办方说法 · 尚待核实" : "招聘方说法 · 尚待确认",
      row.claims,
    ),
    area("assumptions", "个人推测 · 非事实", row.assumptions),
    area(
      "focus",
      publicMode ? "职位要求与备考关注点" : "公司关注的能力",
      row.focus,
    ),
    area(
      "strengths",
      publicMode
        ? "个人优势自评 · 不代表考官认可"
        : "招聘方认可的优势 · 原话与来源",
      row.strengths,
    ),
    area(
      "weaknesses",
      publicMode
        ? "待改进项自评 · 不代表考官评价"
        : "招聘方指出的不足 · 原话与来源",
      row.weaknesses,
    ),
    area(
      "feedback",
      publicMode ? "自行核实的招录信息 · 记录原文与来源" : "其他明确招聘反馈",
      row.feedback,
    ),
  ].join("");
  const jobs = state.jobs.filter((job) => job.companyId === row.id);
  return `${publicMode ? '<p class="note">笔试、面试、排名和资格信息请分别记录在招录职位中。这里的自评与文字记录不会增加招录流程分。</p>' : ""}
    <div class="form-grid">${basic}</div>
    <h3 class="subhead">影响选择的标签</h3>
    ${helpTip("每行：标签名, green / red / yellow / blue。旧版带独立权重的标签可继续保留第三列分值及红色 veto；V4 标准标签按设置页的四色规则计分。", "标签颜色与评分说明")}
    <textarea name="tagRules" aria-label="四色标签配置">${esc(
      (row.tags || [])
        .map(
          (tag) =>
            `${tag.name}, ${tag.color}${tag.weight === undefined ? "" : `, ${tag.weight}`}${tag.veto ? ", veto" : ""}`,
        )
        .join("\n"),
    )}</textarea>
    <h3 class="subhead">${publicMode ? "个人报考意向" : "个人就职意向"}</h3>
    <div class="form-grid">${ratingsMarkup(row, dimensions, ctx)}
      ${selectField("decision", "当前决定", decisionOptions(row.decision, publicMode, options))}
      ${area("decisionNotes", "决定理由与备注", row.decisionNotes)}
    </div><h3 class="subhead">关联${publicMode ? "招录职位" : "岗位"}</h3>
    ${jobs.map((job) => `<div class="row"><div class="grow"><button type="button" class="row-title" data-action="edit" data-kind="jobs" data-id="${esc(job.id)}">${esc(job.title)}</button><p class="trace">${esc(trackLabel(job, row))}</p></div>${badge(job.status || "关注")}</div>`).join("") || `<p class="muted">保存${noun}后可添加${publicMode ? "招录职位" : "岗位"}。</p>`}
    ${!isNew ? btn(publicMode ? "为此单位添加职位" : "为此公司添加岗位", "new-job", "small secondary", `data-company="${esc(row.id)}"`) : ""}`;
}

export function jobEditor(row, ctx) {
  const { state, textField, area, selectField, options, opts, esc } = ctx;
  const organization = state.companies.find(
    (item) => item.id === row.companyId,
  );
  const publicMode = organization ? organizationKind(organization) === "public" : isPublicJob(row);
  const track = !organization ? getTrack(row) : publicMode
    ? row.track === "public-institution"
      ? "public-institution"
      : "civil-service"
    : "enterprise";
  const effective = { ...row, track };
  const states = statusesFor(effective, organization);
  const status = states.includes(row.status) ? row.status : publicMode ? "关注" : "未沟通";
  const fields = [
    textField(
      "title",
      publicMode ? "招录职位名称 *" : "岗位名称 *",
      row.title,
      "text",
      "required full",
    ),
    textField(
      "companyName",
      publicMode ? "招录单位名称 *" : "公司名称 *",
      row.companyName ?? organization?.name ?? "",
      "text",
      'required autocomplete="organization" placeholder="可直接输入新名称"',
    ),
    selectField(
      "companyId",
      "关联已有公司 / 单位（可选）",
      opts(state.companies, row.companyId, "name", "按名称新建或匹配"),
    ),
    selectField(
      "track",
      publicMode ? "招录类型" : "岗位类型",
      valueOptions(
        !organization
          ? [["enterprise", "企业求职"], ["civil-service", "公务员招录"], ["public-institution", "事业单位招录"]]
          : publicMode
          ? [
              ["civil-service", "公务员招录"],
              ["public-institution", "事业单位招录"],
            ]
          : [["enterprise", "企业求职"]],
        track,
        esc,
      ),
    ),
    selectField(
      "status",
      publicMode ? "招录流程" : "求职状态",
      options(states, status),
    ),
    textField("location", "工作地点", row.location),
  ];
  if (publicMode) {
    fields.push(
      textField("examName", "考试 / 招录项目名称", row.examName),
      textField(
        "examYear",
        "招录年度（自行填写）",
        row.examYear,
        "number",
        'min="1" max="9999" step="1"',
      ),
      textField("positionCode", "职位代码", row.positionCode),
      textField(
        "vacancies",
        "计划人数（自行核实）",
        row.vacancies,
        "number",
        'min="0" step="1"',
      ),
      area("eligibility", "报考资格与限制 · 自行核实原文", row.eligibility),
      temporalField(
        "applicationDeadline",
        "报名截止时间",
        row.applicationDeadline,
        ctx,
        true,
      ),
      temporalField("writtenDate", "笔试日期", row.writtenDate, ctx, false),
      textField(
        "writtenScore",
        "笔试成绩（按原始口径填写）",
        row.writtenScore,
        "number",
        'min="0" step="any"',
      ),
      textField(
        "interviewScore",
        "面试成绩（按原始口径填写）",
        row.interviewScore,
        "number",
        'min="0" step="any"',
      ),
      textField(
        "finalScore",
        "综合成绩（按原始口径填写）",
        row.finalScore,
        "number",
        'min="0" step="any"',
      ),
      textField(
        "rank",
        "排名（自行填写）",
        row.rank,
        "number",
        'min="1" step="1"',
      ),
      textField(
        "interviewFormat",
        "面试形式（以本人核实材料为准）",
        row.interviewFormat,
        "text",
        "full",
      ),
      textField("website", "公告 / 招录信息链接", row.website, "url", "full"),
      area("jd", "公告 / 职位要求原文", row.jd),
      area("examNotes", "成绩口径、公告来源与招录备注", row.examNotes),
      area("remarks", "其他备注", row.remarks),
      area("notes", "补充记录与信息来源", row.notes),
    );
  } else {
    fields.push(
      area("jd", "JD 原文", row.jd),
      textField("salaryMin", "税前月薪下限（元）", row.salaryMin ?? row.salaryMonthly ?? "", "number", 'min="0"'),
      textField("salaryMax", "税前月薪上限（元）", row.salaryMax ?? row.salaryMonthly ?? "", "number", 'min="0"'),
      textField(
        "months",
        "年薪月数",
        row.months ?? parseSalaryRange(row.salary)?.months ?? 12,
        "number",
        'min="1" max="36"',
      ),
    );
  }
  const dimensions = dimensionsFor(state, publicMode);
  const editableTags = editableJobTags(row);
  const tagsMarkup = `<section class="job-tag-editor"><div class="job-tag-editor-heading"><h3 class="subhead">岗位标签</h3><button type="button" class="btn small secondary" data-action="job-tag-add">＋ 添加标签</button></div><p class="trace">可直接修改名称和颜色；绿色为利好，红色与黄色为风险，蓝色为参考。</p><div class="job-tag-list" data-job-tag-list>${editableTags.map((tag, index) => jobTagInputRow(tag, esc, index < (row.tags || []).length ? index : "")).join("")}</div></section>`;
  return `${publicMode ? '<p class="note">招录流程仅记录当前进展。各类成绩不预设满分或换算规则，不自动推断入围或录用结果；资格条件与时间请自行核实。</p>' : ""}
    <div class="form-grid">${fields.join("")}</div>
    ${tagsMarkup}
    <details class="editor-section"><summary>本岗位个人评价与决定</summary>${helpTip("可分别评价同一公司或单位的不同岗位。未单独评分时引用组织评价；开始单独评分后，未填维度暂按 0 分。", "岗位评价说明")}
      <div class="form-grid" style="margin-top:15px">${ratingsMarkup(row, dimensions, ctx)}
      ${selectField("decision", "本岗位决定", decisionOptions(row.decision, publicMode, options))}
      ${area("decisionNotes", "本岗位决定理由", row.decisionNotes)}
      </div>
    </details>${historyMarkup(row, esc)}${v4ImportDetails(row, organization, esc)}`;
}

function v4ImportDetails(job, organization, esc) {
  if (!job.v4Source) return "";
  const raw = job.v4Source;
  const fields = [
    ["招聘平台", raw.platform], ["薪酬原文", raw.salary], ["地点", raw.city || raw.location],
    ["经验要求", raw.experience], ["学历要求", raw.education], ["投递日期", raw.applied_date],
    ["状态备注", raw.status_notes], ["JD 摘要", raw.jd_summary], ["岗位推荐依据", raw.recommendation],
    ["待补强项目", raw.upskilling], ["来源资料", raw.source],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  const present = (value) => typeof value === "string" ? esc(value) : `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`;
  return `<details class="editor-section opportunity-import-details"><summary>V4 导入资料与来源</summary><dl>${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${present(value)}</dd></div>`).join("")}</dl>${organization?.v4Source ? `<details><summary>公司原始资料</summary><pre>${esc(JSON.stringify(organization.v4Source, null, 2))}</pre></details>` : ""}<details><summary>岗位完整原始 JSON</summary><pre>${esc(JSON.stringify(raw, null, 2))}</pre></details></details>`;
}

function temporalField(name, label, value, ctx, defaultTime) {
  const withTime = value ? String(value).includes("T") : defaultTime;
  return ctx.textField(
    name,
    label,
    localInputDate(value, withTime),
    withTime ? "datetime-local" : "date",
    withTime ? 'step="any"' : "",
  );
}

function localInputDate(value, withTime = false) {
  if (!value) return "";
  const source = String(value);
  if (!withTime) return source.slice(0, 10);
  // Existing local values stay local; UTC imports are displayed in local device time.
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(source)) return source;
  const date = new Date(source);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, -1);
}

function tagBadges(tags, { badge }) {
  return (tags || []).map((tag) => {
    return badge(tag.name, Object.hasOwn(TAG_SCORE_RULES, tag.color) ? tag.color : "blue");
  }).join("");
}
function mergeTags(job, organization) {
  const tags = new Map((organization.tags || []).map((tag) => [tag.id || tag.name, tag]));
  for (const tag of job.tags || []) if (tag && typeof tag === "object") tags.set(tag.id || tag.name, tag);
  return [...tags.values()];
}
function trashIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function opportunityHeader(job, organization, { esc, badge }) {
  const publicMode = isPublicJob(job, organization);
  return `<header class="company-card-top opportunity-card-heading"><div class="grow"><h2 class="opportunity-card-title"><button type="button" class="row-title" data-action="edit" data-kind="jobs" data-id="${esc(job.id)}">${esc(job.title || (publicMode ? "未命名职位" : "未命名岗位"))}</button></h2><button type="button" class="opportunity-organization" data-action="edit" data-kind="companies" data-id="${esc(organization.id)}">${esc(organization.name || "未命名单位")}</button></div><button type="button" class="icon-btn opportunity-trash" data-action="trash-list-record" data-kind="jobs" data-id="${esc(job.id)}" aria-label="删除 ${esc(job.title || "岗位")}" title="删除">${trashIcon()}</button></header><div class="badges">${badge(job.status || (publicMode ? "关注" : "未沟通"), job.status === "结束" || job.status === "不通过" ? "neutral" : "")}${badge(trackLabel(job, organization), "neutral")}</div>`;
}
function scoreSlider(job, field, title, value, manual, esc) {
  const id = esc(job.id);
  return `<div class="opportunity-slider"><label><span class="opportunity-slider-heading"><span>${title}</span><output data-opportunity-output="${field}" data-job-id="${id}">${esc(value)}</output><small>/ 100</small></span><input type="range" min="0" max="100" step="1" value="${esc(value)}" data-opportunity-score="${field}" data-job-id="${id}" aria-label="${esc(title)}：${esc(job.title || "岗位")}"></label><div class="opportunity-slider-footer"><span class="opportunity-score-source" data-opportunity-source="${field}" data-job-id="${id}">${manual ? "已手动调整" : "按当前规则计算"}</span><button type="button" class="text-btn" data-action="reset-opportunity-score" data-field="${field}" data-job-id="${id}">恢复规则分</button></div></div>`;
}
/** Shared job-first card; ctx.content may add caller-owned, already-escaped markup. */
export function opportunityCard(job, organization, ctx) {
  organization ||= { id: job.companyId || "", name: job.companyName || job.company || "未填写公司", tags: [] };
  const { esc, btn, badge } = ctx;
  const score = ctx.score || scoreJob(job, organization, ctx.state?.settings);
  const values = opportunityIntentValues(job, score);
  const publicMode = isPublicJob(job, organization);
  const location = job.location || organization.location;
  const salary = formatSalaryRange(job);
  const facts = [location, publicMode ? job.examName || job.positionCode : salary ? `月薪 ${salary}` : ""];
  const content = ctx.content ?? `<div class="opportunity-summary-scores"><div><span>${publicMode ? "个人报考意向" : "个人就职意向"}</span><strong>${esc(values.personal)}<small>/ 100</small></strong></div><div><span>${publicMode ? "单位意向" : "企业意向"}</span><strong>${esc(values.employer)}<small>/ 100</small></strong></div></div>${score.veto ? badge("一票否决", "red") : ""}<div class="badges opportunity-tags">${tagBadges(mergeTags(job, organization), ctx)}</div><div class="button-row">${btn("查看岗位", "edit", "small secondary", `data-kind="jobs" data-id="${esc(job.id)}"`)}${btn("专项训练", "company-train", "small secondary", `data-id="${esc(organization.id)}" data-job="${esc(job.id)}"`)}</div>`;
  return `<article class="company-card opportunity-card${ctx.decision ? " decision-card" : ""}" data-opportunity-card="${esc(job.id)}">${ctx.selectCard?.(job) || ""}${opportunityHeader(job, organization, ctx)}${facts.some(Boolean) ? `<div class="opportunity-card-meta">${facts.filter(Boolean).map(value => `<span>${esc(value)}</span>`).join("")}</div>` : ""}${content}</article>`;
}
export function decisionMarkup(ctx) {
  const { state, esc, btn, badge, pageHead } = ctx;
  const mode = ctx.extra?.mode || ctx.mode || (typeof ctx.extra === "string" ? ctx.extra : "") || "enterprise";
  const publicMode = mode === "public";
  const dimensions = dimensionsFor(state, publicMode);
  const rows = state.jobs.map(job => {
    const organization = state.companies.find(item => item.id === job.companyId);
    if (!organization || isPublicJob(job, organization) !== publicMode) return null;
    const evidence = state.interviews.filter(item => item.companyId === organization.id && item.jobId === job.id);
    const confirmed = evidence.filter(item => item.feedbackSource !== "个人复盘");
    const profile = publicMode ? organization : { ...organization,
      strengths: [organization.strengths, ...confirmed.map(item => item.strengths)].filter(Boolean).join("；"),
      weaknesses: [organization.weaknesses, ...confirmed.map(item => item.weaknesses)].filter(Boolean).join("；"),
      feedback: [organization.feedback, ...confirmed.map(item => item.feedback)].filter(Boolean).join("；"),
    };
    return { job, organization, evidence, score: scoreJob(job, profile, state.settings) };
  }).filter(Boolean);
  const display = (value, suffix = "") => value === undefined || value === null || value === "" ? "未记录" : esc(value) + suffix;
  const fact = (title, value) => `<div><dt>${title}</dt><dd>${value}</dd></div>`;
  const cards = rows.map(({ job, organization, evidence, score }) => {
    const values = opportunityIntentValues(job, score);
    const sliders = `<div class="opportunity-sliders">${scoreSlider(job, "personalIntent", publicMode ? "个人报考意向" : "个人就职意向", values.personal, values.personalManual, esc)}${scoreSlider(job, "employerIntent", publicMode ? "单位意向（个人判断）" : "企业意向", values.employer, values.employerManual, esc)}</div>`;
    const ratings = job.ratings || organization.ratings || {};
    let details = dimensions.map(dimension => fact(`${esc(dimension.name)} <small>权重 ${esc(dimension.weight)}</small>`, ratings[dimension.id] === undefined ? "未评分" : `${esc(ratings[dimension.id])} / 10`)).join("");
    details += fact("工作地点", display(job.location || organization.location));
    if (publicMode) {
      details += fact("招录流程进展", `${display(score.progress ?? score.interest)} / 100`);
      for (const [title, field] of [["招录项目", "examName"], ["招录年度", "examYear"], ["职位代码", "positionCode"], ["计划人数", "vacancies"], ["笔试成绩", "writtenScore"], ["面试成绩", "interviewScore"], ["综合成绩", "finalScore"], ["排名", "rank"], ["报名截止", "applicationDeadline"], ["笔试日期", "writtenDate"], ["面试形式", "interviewFormat"], ["报考资格", "eligibility"], ["招录备注与来源", "examNotes"]]) details += fact(title, display(job[field]));
    } else {
      details += fact("税前年包", score.annual === null ? "未记录" : `¥ ${esc(score.annual.toLocaleString("zh-CN"))}`);
      details += fact("估算实际时薪", score.hourly === null ? "薪资或工时未记录" : `¥ ${esc(score.hourly.toFixed(1))} / h`);
      details += fact("Offer 信息", display(job.offerNotes));
    }
    const sourceButton = evidence.length ? btn("查看本岗位原始记录", "trace", "small secondary", `data-ids="${esc(evidence.map(item => item.id).join(","))}"`) : btn(publicMode ? "查看单位记录" : "查看公司记录", "edit", "small secondary", `data-kind="companies" data-id="${esc(organization.id)}"`);
    const reasons = publicMode ? score.reasons.filter(reason => !reason.startsWith("年包按月薪")) : score.reasons;
    const content = `${sliders}${score.veto ? `<div>${badge("一票否决", "red")}</div>` : ""}<div class="badges opportunity-tags">${tagBadges(mergeTags(job, organization), ctx)}</div><details class="opportunity-details"><summary>条件、评分依据与原始记录</summary><dl class="opportunity-facts">${details}</dl><div class="details-copy">${reasons.map(esc).join("<br>")}</div><div class="button-row">${sourceButton}</div></details><div class="button-row">${btn("编辑岗位与决定", "edit", "small secondary", `data-kind="jobs" data-id="${esc(job.id)}"`)}</div>`;
    return opportunityCard(job, organization, { ...ctx, score, content, decision: true });
  }).join("");
  const tab = (track, label) => `<button type="button" data-action="decision-track" data-track="${track}" class="${mode === track ? "active" : ""}" aria-pressed="${mode === track}">${label}</button>`;
  const tabs = `<div class="tabs" aria-label="比较类型">${tab("enterprise", "企业求职")}${tab("public", "公务员 / 事业单位")}</div>`;
  const empty = `<div class="empty"><h3>${publicMode ? "让每个报考选择更有依据" : "选择真正适合您的机会"}</h3><p>添加岗位，直接填写公司或单位名称，再比较条件与意向。</p>${btn(publicMode ? "添加招录职位" : "添加岗位", "new-job", "small secondary")}</div>`;
  const explanation = publicMode ? "意向可以按个人判断手动调整；恢复规则分后，个人意向按评价维度和标签计算，单位意向显示本岗位流程规则分。流程分不代表成绩、排名或录用概率，原始成绩分别保留。" : "意向可以按个人判断手动调整；恢复规则分后，使用本岗位评价、标签、进展与明确反馈重新计算。企业意向不是真实录用概率。年包与时薪为税前估算。";
  return pageHead("决策中心", publicMode ? "按职位记录报考意向与招录进展。" : "按岗位比较条件，调整双方意向。", btn("调整评分规则", "go-settings", "secondary")) + tabs + `<div class="opportunity-help">${helpTip(explanation, "意向调整与评分说明")}</div>` + (rows.length ? `<div class="company-grid opportunity-grid decision-grid">${cards}</div>` : empty);
}
