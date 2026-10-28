import {
  cornerMarkup,
  workspaceCornerMarkup,
  setRecordingActive,
  initCornerControls,
  syncCornerControls,
} from "./corner-ui.js";
import { icon, doorMark } from "./icons.js";
import { helpTip, initHelpTips, closeHelpTips } from "./help-ui.js";
import { shellBrandMarkup } from "./shell-ui.js";
import { settingsMarkup } from "./settings-ui.js";
import { ACCENT_STORAGE_KEY, accentColorFor, applyAccentPrefs, loadAccentPrefs, normalizeAccentColor, pinAccent, saveAccentPrefs, unpinAccent, PINNED_ACCENT_COUNT } from "./theme-accent.js";
import { knowledgeGuideMarkup, GUIDE_COMMANDS } from "./knowledge-guide.js";
import { TRAINING_MODULES, trainingModuleForQuestion } from "./training-modules.js";
import { mergeV4Import } from "./v4-import.js";
import { UNIFIED_MODULES, MAX_IMPORT_BYTES, parseUnifiedImport, previewUnifiedImport, mergeUnifiedImport } from "./unified-import.js";
import { compositionEditor, contentCardEditor, cardTagBar } from "./knowledge-ui.js";
import { appendCardComposition, moveCompositionPart, removeCompositionPart, updateCompositionPart } from "./content-cards.js";
import { orderedCardTags, filterContentCards, reorderCardTag } from "./card-tags.js";
import { moveToTrash, restoreTrash, deleteTrash, emptyTrash } from "./trash.js";
import {
  uid,
  blankState,
  touch,
  mergeData,
  keywordCoverage,
  scoreCompany,
  scoreJob,
  QUESTION_DIFFICULTIES,
  suggestQuestionDifficulty,
  validateState,
} from "./core.js";
import {
  loadState,
  saveState,
  exportBackup,
  importBackup,
} from "./db.js";
import {
  getTrack,
  isPublicJob,
  statusesFor,
  organizationKind,
  trackLabel,
  labelsFor,
  questionCategoriesFor,
  PUBLIC_STATUSES,
  DEFAULT_PUBLIC_DIMENSIONS,
  DEFAULT_PUBLIC_STAGE_SCORES,
  opportunityIntentValues,
  parseSalaryRange,
} from "./opportunity.js";
import {
  organizationEditor,
  jobEditor,
  editableJobTags,
  jobTagInputRow,
  parseEditableJobTags,
  opportunityCard,
  decisionMarkup,
} from "./opportunity-ui.js";
let activeWorkspace =
  new URLSearchParams(location.search).get("space") === "demo"
    ? "demo"
    : "formal";
let switchingWorkspace = false,
  workspaceBusy = false;
const spaceTitle = () => (activeWorkspace === "demo" ? "演示空间" : "正式档案");

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const navs = [
  ["dashboard", "home", "准备控制台"],
  ["companies", "company", "岗位档案"],
  ["knowledge", "book", "知识库"],
  ["train", "train", "训练室"],
  ["interviews", "archive", "面试档案"],
  ["analytics", "chart", "成长分析"],
  ["decision", "decision", "决策中心"],
];
const statuses = ["未沟通", "已沟通", "简历已投递", "约面试", "面试完成", "Offer", "不通过", "关注", "沟通", "待面试", "面试中", "结束"];
const types = {
  companies: "单位",
  jobs: "岗位",
  questions: "题目",
  scripts: "介绍稿",
  contentCards: "内容卡片",
  interviews: "面试",
  sessions: "训练",
  scheduleItems: "日程",
};
let mobileNavOpen = false;
let themeMode = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
let accentPrefs = loadAccentPrefs();
const themeIcon = () => themeMode === "dark" ? `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>` : `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M19.07 4.93l-1.42 1.42M6.35 17.65l-1.42 1.42"/></svg>`;
function applyTheme() {
  document.documentElement.dataset.theme = themeMode;
  if (!document.documentElement.hasAttribute("data-starting")) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeMode === "dark" ? "#12110f" : "#f2eee7");
  document.body.classList.toggle("theme-light", themeMode === "light");
  document.body.classList.toggle("theme-dark", themeMode === "dark");
  applyAccentPrefs(accentPrefs, themeMode);
  for (const control of document.querySelectorAll('[data-action="toggle-theme"]')) {
    const label = themeMode === "light" ? "关灯，切换地狱主题" : "开灯，切换天堂主题";
    control.setAttribute("aria-label", label);
    control.setAttribute("aria-pressed", String(themeMode === "light"));
    control.title = label;
    const artwork = control.closest(".sidebar") ? icon(themeMode === "light" ? "sun" : "moon") : themeIcon();
    const previousArtwork = control.querySelector("svg");
    if (previousArtwork) previousArtwork.outerHTML = artwork;
    else control.insertAdjacentHTML("afterbegin", artwork);
  }
  const motto = document.querySelector(".poster-motto");
  if (motto) motto.textContent = themeMode === "dark" ? "Solve et Coagula" : "Invenies Occultum Lapidem";
  window.dispatchEvent(new CustomEvent("nextround:themechange", { detail: { theme: themeMode } }));
}
applyTheme();
let unifiedImportDraft = null;
let state,
  view = {
    tab: "questions",
    cardTag: null,
    search: "",
    category: "",
    company: "",
    jobTag: "",
    job: "",
    since: "",
    pipelineTrack: "",
    decisionTrack: "enterprise",
    agendaDate: "",
    agendaScrollTarget: "",
  },
  route = "/",
  saveQueue = Promise.resolve(),
  saveError = false,
  savePending = 0,
  installPrompt = null,
  editor = null,
  editTimeout = null,
  storageInfo = {};
function createTrainingState() {
  return {
  mode: "questions",
  countdown: false,
  target: 180,
  elapsed: 0,
  started: null,
  running: false,
  companyId: "",
  jobId: "",
  category: "",
  difficulty: "",
  tags: [],
  configOpen: true,
  tagsOpen: false,
  questionId: "",
  scriptId: "",
  queue: [],
  index: 0,
  answered: [],
  attachmentIds: [],
  ratingPercent: 60,
  note: "",
  recording: false,
};
}
let train = createTrainingState();
let recorder = null,
  recordStream = null,
  recordChunks = [],
  recordPromise = null,
  trainingStartedAt = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("visible");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("visible"), 3600);
}
function setSave(text) {
  document
    .querySelectorAll(".save-indicator,.auto-status")
    .forEach((e) => (e.textContent = text));
}
const saveLabel = () => saveError ? "保存失败 · 请备份" : savePending ? "正在保存…" : "已保存到本机";
function persist() {
  const snapshot = structuredClone(state),
    workspace = activeWorkspace;
  savePending++;
  setSave(saveLabel());
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      try {
        await saveState(snapshot, { workspace });
        saveError = false;
      } catch (e) {
        saveError = true;
        toast(
          e.code === "CONCURRENT_WRITE"
            ? "另一个窗口已更新数据。请先导出本窗口备份，再重新载入合并。"
            : `保存失败：${e.message}。请先导出备份。`,
        );
        throw e;
      } finally {
        savePending--;
        setSave(saveLabel());
      }
    });
  saveQueue.catch(() => {});
  return saveQueue;
}
function create(collection, patch = {}) {
  const row = touch({ id: uid() }, patch);
  state[collection].push(row);
  return row;
}
function update(collection, id, patch) {
  const i = state[collection].findIndex((x) => x.id === id);
  if (i < 0) return;
  state[collection][i] = touch(state[collection][i], patch);
  return state[collection][i];
}
const get = (collection, id) => state[collection].find((x) => x.id === id);
const companyName = (id) => get("companies", id)?.name || "未关联单位";
const jobName = (id) => get("jobs", id)?.title || "未关联岗位";
const fmtDate = (v, long = false) =>
  v
    ? new Date(v).toLocaleString(
        "zh-CN",
        long
          ? {
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          : { month: "2-digit", day: "2-digit" },
      )
    : "未安排";
const fmtSeconds = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const badge = (text, color = "") =>
  `<span class="badge ${color}">${esc(text)}</span>`;
const btn = (text, action, cls = "", extra = "") =>
  `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;
const quickImport = (module) => `${btn(icon("upload") + "导入", "import-unified", "secondary", `data-module="${module}"`)}${helpTip("统一 AI 整理模板可在“设置 → 使用 AI 协作”下载；此处与设置页使用同一个导入预览。", "统一导入说明")}`;
const bulkSelection = { kind: "", ids: new Set() };
function selectedIds(kind, rows) {
  if (bulkSelection.kind !== kind) { bulkSelection.kind = kind; bulkSelection.ids.clear(); }
  const visible = new Set(rows.map(row => row.id));
  for (const id of bulkSelection.ids) if (!visible.has(id)) bulkSelection.ids.delete(id);
  return bulkSelection.ids;
}
function bulkToolbar(kind, rows) {
  const selected = selectedIds(kind, rows);
  return `<div class="bulk-toolbar"><label><input type="checkbox" data-bulk-select="${kind}" ${rows.length && selected.size === rows.length ? "checked" : ""} ${rows.length ? "" : "disabled"}>全选</label><span>${selected.size ? `已选 ${selected.size} 条` : `共 ${rows.length} 条`}</span>${btn("删除所选", "bulk-trash", "small danger", `data-kind="${kind}" ${selected.size ? "" : "disabled"}`)}</div>`;
}
const rowSelect = (kind, row) => `<label class="row-select"><input type="checkbox" data-row-select="${kind}" value="${esc(row.id)}" ${bulkSelection.kind === kind && bulkSelection.ids.has(row.id) ? "checked" : ""} aria-label="选择 ${esc(row.title || row.text || row.name || "记录")}"></label>`;
async function trashSelected(kind) {
  const ids = [...bulkSelection.ids].filter((id) => get(kind, id));
  if (!ids.length || trainingLocked()) return;
  if (!window.confirm(`删除选中的 ${ids.length} 条记录及其关联内容？删除后可在垃圾箱恢复。`)) return;
  let candidate = state;
  for (const id of ids) if (candidate[kind]?.some((row) => row.id === id)) candidate = moveToTrash(candidate, kind, id);
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    await saveState(candidate, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = candidate;
    bulkSelection.ids.clear();
    for (const [field, key] of [["companyId", "companies"], ["jobId", "jobs"], ["questionId", "questions"], ["scriptId", "scripts"]])
      if (train[field] && !get(key, train[field])) train[field] = "";
    train.queue = [];
    train.answered = [];
    render();
    toast(`已删除 ${ids.length} 条记录，可在垃圾箱恢复。`);
  } finally { endWorkspaceTask(task); }
}
const empty = (title, text, action = "", label = "", compact = false) =>
  `<div class="empty ${compact ? "compact" : ""}"><h3>${title}</h3><p>${text}</p>${action ? btn(label, action, "small secondary") : ""}</div>`;
function opts(rows, value, label = "name", blank = "不关联") {
  return (
    `<option value="">${blank}</option>` +
    rows
      .map(
        (x) =>
          `<option value="${esc(x.id)}" ${x.id === value ? "selected" : ""}>${esc(x[label])}</option>`,
      )
      .join("")
  );
}
function pageHead(title, sub, button = "") {
  return `<header class="page-head"><div><h1>${title}</h1><p>${sub}</p></div>${button}</header>`;
}
const posterArrow = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>`;
const posterStar = (cls = "") =>
  `<svg class="poster-star ${cls}" viewBox="0 0 40 40" aria-hidden="true" fill="currentColor"><path d="M20 0C21.8 15.8 24.2 18.2 40 20C24.2 21.8 21.8 24.2 20 40C18.2 24.2 15.8 21.8 0 20C15.8 18.2 18.2 15.8 20 0Z"/></svg>`;
const entryFrame = () =>
  `<svg class="entry-frame" viewBox="0 0 700 190" preserveAspectRatio="none" aria-hidden="true"><path d="M18 1H682Q682 18 699 18V172Q682 172 682 189H18Q18 172 1 172V18Q18 18 18 1Z" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M26 6H674M26 184H674" fill="none" stroke="currentColor" stroke-width=".45" vector-effect="non-scaling-stroke"/></svg>`;
const headHalo = () => {
  const ticks = Array.from({ length: 96 }, (_, i) => {
    const t = (i * Math.PI) / 48,
      a = i % 8 === 0 ? 187 : i % 2 === 0 ? 191 : 194;
    return `<line x1="${(1008 + a * Math.cos(t)).toFixed(2)}" y1="${(342 + a * Math.sin(t)).toFixed(2)}" x2="${(1008 + 198 * Math.cos(t)).toFixed(2)}" y2="${(342 + 198 * Math.sin(t)).toFixed(2)}"/>`;
  }).join("");
  return `<svg class="head-halo" viewBox="0 0 1922 1080" fill="none" aria-hidden="true">
    <defs><path id="head-halo-type" d="M899.37 471.46 A169 169 0 1 1 1092.50 488.36"/></defs>
    <g class="head-halo-rings"><circle cx="1008" cy="342" r="204"/><circle cx="1008" cy="342" r="198"/><circle cx="1008" cy="342" r="140"/><circle cx="1008" cy="342" r="135"/>${ticks}<path d="M1008 129v15m0 396v15M795 342h15m396 0h15"/><circle cx="1008" cy="138" r="2.6"/><circle cx="804" cy="342" r="2.6"/><circle cx="1212" cy="342" r="2.6"/></g>
    <text class="head-halo-text" text-anchor="start" dominant-baseline="central"><textPath href="#head-halo-type" startOffset="0%" textLength="825" lengthAdjust="spacing">DIMIDIUM FACTI · QUI COEPIT HABET SAPERE AUDE · INCIPE</textPath></text>
  </svg>`;
};
const portalArc = (
  side,
) => `<svg class="portal-arc portal-arc-${side}" viewBox="0 0 1922 1080" fill="none" aria-hidden="true">
  <defs><filter id="portal-glow-${side}" x="560" y="90" width="320" height="870" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="8"/></filter></defs>
  <path class="portal-aura" d="M720 169 A85 345.5 0 0 ${side === "right" ? 1 : 0} 720 860" filter="url(#portal-glow-${side})"/>
  <path class="portal-light" d="M720 169 A85 345.5 0 0 ${side === "right" ? 1 : 0} 720 860"/>
  <path class="portal-core" d="M720 169 A85 345.5 0 0 ${side === "right" ? 1 : 0} 720 860"/>
</svg>`;
const portalReflection = () =>
  `<svg class="portal-reflection" viewBox="0 0 1922 1080" fill="none" aria-hidden="true"><defs><linearGradient id="portal-reflection-fade" x1="0" y1="852" x2="0" y2="1080" gradientUnits="userSpaceOnUse"><stop stop-color="#f8dfb4" stop-opacity=".85"/><stop offset="1" stop-color="#b99563" stop-opacity="0"/></linearGradient></defs><g stroke="url(#portal-reflection-fade)" stroke-linecap="round"><path d="M695 861h50m-65 8h79m-72 9h66m-85 12h102m-96 15h89m-114 18h128m-118 22h106m-137 27h164m-149 32h135m-171 39h204" stroke-width="3"/><path d="M703 865h33m-40 12h44m-57 19h64m-68 21h74m-81 29h84m-94 37h109" stroke-width="1.3"/></g></svg>`;

function portal() {
  return `<main class="portal portal-v3 portal-crafted enter-motion" data-ui-version="3">
    <div class="poster-frame" aria-hidden="true"></div>
    ${cornerMarkup({ includeTheme: true })}
    <div class="poster-print">
    <div class="poster-ground" aria-hidden="true"></div>
    <div class="poster-patina" aria-hidden="true"></div>
    <section class="poster-stage" aria-label="下一场 · NextRound">
      <div class="poster-architecture" aria-hidden="true"></div>
      <div class="poster-scene" aria-hidden="true"><div class="scene-environment"><picture><source media="(max-width:780px)" srcset="./assets/v3-portal/environment-no-ring-mobile.webp"><img class="scene-background" src="./assets/v3-portal/environment-no-ring.webp" width="1672" height="941" alt=""></picture></div><div class="scene-subject"><div class="scene-panorama">
        
        <div class="atlas-orbit" aria-hidden="true"><i></i><i></i><span>${posterStar()}</span></div>
        <div class="scene-contact-shadow"></div><div class="wizard-contact-shadow"></div>
        ${portalReflection()}
        ${portalArc("left")}
        ${headHalo()}
        <img class="scene-wizard" src="./assets/v3-portal/wizard-cutout.png" width="1277" height="1231" alt="">
        <img data-head-x="1487" data-head-y="542" class="scene-angel scene-statue" src="./assets/v3-portal/angel-cutout.png" width="3342" height="1882" alt="">
        <img data-head-x="761" data-head-y="1085" class="scene-demon scene-statue" src="./assets/v3-portal/demon-cutout.png" width="3612" height="2228" alt="">
        ${portalArc("right")}
      </div></div></div>


      <header class="portal-intro">
        <div class="wordmark"><h1><span class="visually-hidden">NextRound</span><img class="wordmark-art" src="./assets/v3-refine/lettering-wordmark.webp" width="1920" height="819" alt="" aria-hidden="true"></h1></div>
        <div class="poster-name"><i aria-hidden="true">${posterStar()}</i><span>下一场</span><i aria-hidden="true">${posterStar()}</i></div>
        <p class="poster-motto">${themeMode === "dark" ? "Solve et Coagula" : "Invenies Occultum Lapidem"}</p>
        <div class="poster-rule" aria-hidden="true"><span></span>${posterStar()}<span></span></div>
        <div class="poster-caption"><p><span>准备 · 训练</span> <i aria-hidden="true">·</i> <span>记录 · 复盘</span></p></div>
      </header>
      <span class="poster-side-note" aria-hidden="true">PREPARATION & PRACTICE</span>
    </section>
    <div class="entrances">
      <section class="entrance interview-entry">${entryFrame()}<div class="entry-ornament" aria-hidden="true"></div><div class="entry-orbit" aria-hidden="true"></div><img class="entry-portrait knight-portrait" src="./assets/v3/knight.webp" alt="" width="1024" height="1536"><div class="entry-heading"><h2><span class="visually-hidden">Interview</span><span class="card-title-art card-title-interview"><img src="./assets/v3-refine/lettering-interview.webp" width="2172" height="724" alt="" aria-hidden="true"></span></h2><div class="entry-divider" aria-hidden="true"><span></span>${posterStar()}</div><p>面试训练与备考记录</p><small class="entry-translation">INTERVIEW &amp; EXAMS</small></div><a class="entry-cta" href="#/dashboard" data-action="open-formal" aria-label="进入面试空间">${posterArrow()}<span class="visually-hidden">进入面试空间</span></a>${posterStar("entry-star")}</section>
      <section class="entrance ritual-entry" aria-disabled="true">${entryFrame()}<div class="entry-ornament" aria-hidden="true"></div><div class="entry-orbit" aria-hidden="true"></div><img class="entry-portrait oracle-portrait" src="./assets/v3/oracle.webp" alt="" width="1536" height="1024"><div class="entry-heading"><h2><span class="visually-hidden">Ritual</span><span class="card-title-art card-title-ritual"><img src="./assets/v3-refine/lettering-ritual.webp" width="2172" height="724" alt="" aria-hidden="true"></span></h2><div class="entry-divider" aria-hidden="true"><span></span>${posterStar()}</div><p>仪式实践与研习记录</p><small class="construction"><span class="entry-translation">RITUAL &amp; PRACTICE</span><span class="construction-status">建设中，敬请期待</span></small></div><span class="entry-cta disabled" aria-hidden="true">${posterArrow()}</span>${posterStar("entry-star")}</section>
    </div>
    </div>
    <button type="button" class="poster-demo" data-action="demo">体验演示档案 ${posterArrow()}</button>
  </main>`;
}

function shell(content) {
  const name =
    navs.find((x) => x[0] === route)?.[2] ||
    (route === "search" ? "全局搜索" : "数据与设置");
  return `<div class="shell ${mobileNavOpen ? "nav-open" : ""}"><aside class="sidebar" id="sidebar-nav" aria-label="主导航">${shellBrandMarkup({ expanded: mobileNavOpen, mobile: window.matchMedia("(max-width:780px)").matches })}<nav class="nav" aria-label="面试空间导航">${navs.map(([id, ic, label]) => `<a href="#/${id}" class="${route === id ? "active" : ""}" ${route === id ? 'aria-current="page"' : ""} aria-label="${label}" title="${label}">${icon(ic)}<span class="nav-label">${label}</span></a>`).join("")}</nav><div class="side-bottom"><nav class="nav side-utilities" aria-label="空间操作"><button type="button" class="nav-utility theme-toggle" data-action="toggle-theme" aria-label="${themeMode === "light" ? "关灯，切换地狱主题" : "开灯，切换天堂主题"}" aria-pressed="${themeMode === "light"}" title="切换灯光主题">${icon(themeMode === "light" ? "sun" : "moon")}<span class="nav-label">开关灯</span></button><button type="button" class="nav-utility share-toggle" data-corner-share aria-label="分享下一场" title="分享下一场">${icon("share")}<span class="nav-label">分享</span></button><a href="#/settings" aria-label="数据与设置" title="数据与设置" ${route === "settings" ? 'aria-current="page"' : ""} class="${route === "settings" ? "active" : ""}">${icon("settings")}<span class="nav-label">数据与设置</span></a><a href="#/" aria-label="返回双入口首页" title="返回双入口首页">${icon("back")}<span class="nav-label">返回首页</span></a></nav><div class="side-local"><span class="dot"></span> 本地空间<small>数据仅存于此设备</small></div></div></aside><button type="button" class="nav-scrim" data-action="toggle-nav" aria-label="关闭导航" aria-hidden="${!mobileNavOpen}" ${mobileNavOpen ? "" : "inert"}></button><div class="workspace"><header class="topbar"><div class="topbar-location"><div class="crumb"><a class="workspace-brand" href="#/" aria-label="下一场 NextRound 首页">${doorMark()}<span>NextRound</span></a><span>/</span><b>${name}</b></div></div><div class="top-actions">${activeWorkspace === "demo" ? `<span class="action-with-help">${btn("返回正式档案", "formal", "small secondary")}${helpTip("示例和所有修改只保存在演示空间，正式档案独立保存。", "演示档案说明")}</span>` : ""}<button type="button" class="search-button" data-action="search" aria-label="搜索所有档案">${icon("search")}<span>搜索档案与问题</span><kbd>/</kbd></button><div class="workspace-status"><span class="workspace-badge">${spaceTitle()}</span><span class="save-indicator">${saveLabel()}</span></div></div></header><main class="main enter-motion" id="workspace-main" tabindex="-1">${workspaceNotice()}${content}<footer class="footer-note">下一场 · NextRound &nbsp; / &nbsp; ${activeWorkspace === "demo" ? "独立演示空间 · 内容仅用于体验" : "正式档案 · 数据仅保存在此设备"}</footer></main></div>${workspaceCornerMarkup()}</div>`;
}
function setMobileNavigation(open) {
  mobileNavOpen = Boolean(open) && window.matchMedia("(max-width:780px)").matches;
  const shell = $("#app > .shell");
  if (!shell) return;
  shell.classList.toggle("nav-open", mobileNavOpen);
  const scrim = shell.querySelector(".nav-scrim");
  scrim.inert = !mobileNavOpen;
  scrim.setAttribute("aria-hidden", String(!mobileNavOpen));
  const brand = shell.querySelector(".shell-brand");
  if (window.matchMedia("(max-width:780px)").matches) {
    brand.setAttribute("aria-expanded", String(mobileNavOpen));
    brand.setAttribute("aria-controls", "sidebar-nav");
    brand.setAttribute("aria-label", mobileNavOpen ? "骨汤造物所首页" : "展开导航");
    if (mobileNavOpen) brand.removeAttribute("data-action");
    else brand.dataset.action = "expand-brand-nav";
  } else {
    brand.removeAttribute("data-action");
    brand.removeAttribute("aria-expanded");
    brand.removeAttribute("aria-controls");
    brand.setAttribute("aria-label", "骨汤造物所首页");
  }
}
// Preserve keyboard position when a view is re-rendered, including dialog return targets.
function rememberUiFocus(element = document.activeElement) {
  if (!element?.matches?.("button,a,input,select,textarea,summary,[tabindex]")) return null;
  const attributes = ["id", "name", "data-action", "data-kind", "data-id", "data-tab", "data-mode", "data-scope", "data-tag", "data-date", "data-part", "data-card", "data-unified-module", "data-unified-row", "href"]
    .filter(name => element.hasAttribute(name)).map(name => [name, element.getAttribute(name)]);
  if (!attributes.length && element.hasAttribute("aria-label")) attributes.push(["aria-label", element.getAttribute("aria-label")]);
  let selection = null;
  if (element.matches('input:not([type]),input[type="text"],input[type="search"],textarea'))
    selection = [element.selectionStart, element.selectionEnd];
  return { element, tag: element.tagName, attributes, text: element.textContent, selection };
}
function restoreUiFocus(saved, scope = document) {
  if (!saved) return;
  const target = saved.element.isConnected ? saved.element : [...scope.querySelectorAll("button,a,input,select,textarea,summary,[tabindex]")].find(node =>
    node.tagName === saved.tag && saved.attributes.every(([name, value]) => node.getAttribute(name) === value) &&
    (saved.attributes.length || node.textContent === saved.text));
  if (!target || target.disabled || target.closest("[inert]") || !target.getClientRects().length) return;
  target.focus({ preventScroll: true });
  if (saved.selection && target.setSelectionRange) target.setSelectionRange(...saved.selection);
}
function showUiDialog(dialog, initialSelector) {
  const returning = rememberUiFocus();
  const heading = dialog.querySelector("h2");
  if (heading) {
    heading.id = `${dialog.id}-title`;
    dialog.setAttribute("aria-labelledby", heading.id);
  }
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab" || event.defaultPrevented) return;
    const controls = [...dialog.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')]
      .filter(node => node.tabIndex >= 0 && !node.disabled && !node.closest("[inert]") && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  dialog.addEventListener("close", () => {
    closeHelpTips();
    queueMicrotask(() => { if (!document.querySelector("dialog[open]")) restoreUiFocus(returning); });
  }, { once: true });
  dialog.showModal();
  const initial = dialog.querySelector(initialSelector || '[data-action^="close-"],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
  initial?.focus({ preventScroll: true });
}
function fieldError(message, fields) {
  return Object.assign(new Error(message), { fields: Array.isArray(fields) ? fields : [fields] });
}
function reportFormError(form, message = "", fields = [], focus = false) {
  if (!form) return;
  const error = form.querySelector("[data-form-error]");
  form.querySelectorAll('[data-invalid-field]').forEach(control => {
    control.removeAttribute("aria-invalid");
    control.removeAttribute("data-invalid-field");
    const descriptions = (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== error?.id);
    if (descriptions.length) control.setAttribute("aria-describedby", descriptions.join(" "));
    else control.removeAttribute("aria-describedby");
  });
  if (error) error.textContent = message;
  if (!message) return;
  const controls = fields.map(name => form.elements.namedItem(name)).filter(control => control?.setAttribute);
  controls.forEach(control => {
    control.setAttribute("aria-invalid", "true");
    control.setAttribute("data-invalid-field", "true");
    if (error) control.setAttribute("aria-describedby", [...new Set([...(control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean), error.id])].join(" "));
  });
  if (focus) (controls[0] || error)?.focus();
}
function render() {
  const focused = rememberUiFocus();
  applyTheme();
  const openSettings = route === "settings" ? [...document.querySelectorAll(".settings-panel[open]")].map(panel => panel.dataset.section) : [];
  closeHelpTips();
  const previousAgendaScroll = document.querySelector("#agenda-timeline")?.scrollTop;
  const content =
    route === "/"
      ? portal()
      : shell(
          {
            dashboard,
            train: training,
            knowledge,
            companies,
            interviews,
            analytics,
            decision,
            settings,
            search: globalSearch,
          }[route]?.() || dashboard(),
        );
  const existing = $("#app > .shell");
  if (existing && route !== "/") {
    // Preserve the side rail itself so opening/closing transitions survive route changes.
    const template = document.createElement("template");
    template.innerHTML = content;
    existing.querySelector(".workspace").replaceWith(template.content.querySelector(".workspace"));
    existing.querySelectorAll(".sidebar .nav a").forEach((link) => {
      const active = link.getAttribute("href") === `#/${route}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    setMobileNavigation(mobileNavOpen);
  } else $("#app").innerHTML = content;
  restoreUiFocus(focused, $("#app"));
  updateTimer();
  syncCornerControls();
  if (route === "settings") {
    document.querySelectorAll(".settings-panel").forEach(panel => { panel.open = openSettings.includes(panel.dataset.section) || view.settingsSection === panel.dataset.section; });
    view.settingsSection = "";
    storageEstimate();
  }
  if (route === "dashboard") {
    const target = view.agendaScrollTarget || (previousAgendaScroll === undefined ? agendaDateKey(new Date()) : "");
    view.agendaScrollTarget = "";
    requestAnimationFrame(() => {
      const timeline = document.querySelector("#agenda-timeline");
      if (!timeline) return;
      sizeAgendaTail();
      if (target) scrollAgendaToDate(target);
      else if (previousAgendaScroll !== undefined) timeline.scrollTop = previousAgendaScroll;
    });
  }
}
function workspaceNotice() {
  if (activeWorkspace === "demo")
    return "";
  return "";
}
function editorContext(isNew) {
  return {
    state,
    isNew,
    textField,
    area,
    selectField,
    options,
    opts,
    btn,
    esc,
    pageHead,
    icon,
    badge,
  };
}
async function switchWorkspace(workspace) {
  if (switchingWorkspace) return false;
  if (workspaceBusy) {
    toast("请等待当前文件操作完成，再切换空间。");
    return false;
  }
  if (trainingLocked() || train.recording) {
    toast("本次训练尚未结束，请先完成复盘或重置无录音的训练，再切换空间。");
    return false;
  }
  closeAgendaDialog();
  if (editor) {
    if (!flushEditor(true)) return false;
    closeEditor();
    if (editor) return false;
  }
  switchingWorkspace = true;
  try {
    await saveQueue;
    const next = await loadState({ workspace });
    activeWorkspace = workspace;
    state = next;
    saveQueue = Promise.resolve();
    saveError = false;
    train = createTrainingState();
    if (state.settings.trainingDraft?.attachmentIds?.length)
      train.attachmentIds = [...state.settings.trainingDraft.attachmentIds];
    Object.assign(view, {
      tab: "questions",
      search: "",
      category: "",
      company: "",
      job: "",
      since: "",
      pipelineTrack: "",
      decisionTrack: "enterprise",
    });
    mobileNavOpen = false;
    const url = new URL(location.href);
    if (workspace === "demo") url.searchParams.set("space", "demo");
    else url.searchParams.delete("space");
    url.hash = "/dashboard";
    history.replaceState(null, "", url);
    route = "dashboard";
    render();
    return true;
  } catch (e) {
    toast(`空间未切换：${e.message}`);
    return false;
  } finally {
    switchingWorkspace = false;
  }
}


function showTrash() {
  $("#trash-dialog")?.remove();
  const entries = state.trash || [];
  const dialog = document.createElement("dialog");
  dialog.className = "sheet";
  dialog.id = "trash-dialog";
  dialog.innerHTML = `<header class="sheet-header trash-header"><div><div class="trash-title-row"><h2>${spaceTitle()} · 垃圾箱</h2>${btn(icon("trash"), "empty-trash", "small danger trash-empty-button", `aria-label="清空垃圾箱" title="清空垃圾箱" ${entries.length ? "" : "disabled"}`)}</div><p class="auto-status">${entries.length} 组已删除记录</p></div><button type="button" class="icon-btn" data-action="close-trash" aria-label="关闭垃圾箱">${icon("close")}</button></header><div class="sheet-content">${entries.map((entry) => `<section class="editor-section"><h3>${esc(entry.label)}</h3><p class="trace">${esc(types[entry.collection] || "记录")} · ${fmtDate(entry.deletedAt, true)}</p><details class="history-entry"><summary>查看记录与附件清单</summary>${Object.entries(entry.records).filter(([, rows]) => rows.length).map(([key, rows]) => `<h4>${esc(types[key] || "附件")} · ${rows.length}</h4><pre>${esc(JSON.stringify(rows, (key, value) => key === "data" ? "[附件数据已保存在垃圾箱中]" : value, 2))}</pre>`).join("")}</details>${entry.conflicts?.length ? `<details class="history-entry"><summary>随记录保留的冲突版本 · ${entry.conflicts.length}</summary><pre>${esc(JSON.stringify(entry.conflicts, (key, value) => key === "data" ? "[附件数据已保存在垃圾箱中]" : value, 2))}</pre></details>` : ""}<div class="button-row">${btn("恢复记录", "restore-trash", "small secondary", `data-id="${esc(entry.id)}"`)}${btn("彻底删除", "delete-trash", "small danger", `data-id="${esc(entry.id)}"`)}</div></section>`).join("") || '<p class="muted">垃圾箱是空的。删除后的记录可在这里恢复。</p>'}</div>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  showUiDialog(dialog, '[data-action="close-trash"]');
}
async function clearCurrentArchive() {
  if (workspaceBusy || switchingWorkspace) return toast("请等待当前档案操作完成。");
  if (trainingLocked() || train.recording) return toast("请先结束本次训练，再清空当前档案。");
  if (editor && !flushEditor(true)) return;
  if (editor) closeEditor();
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    if (!window.confirm(`清空当前${spaceTitle()}？\n\n该空间的全部记录、录音、附件、设置、冲突版本和垃圾箱将被彻底删除，无法撤销。\n建议先导出完整备份。另一空间不受影响。`)) return;
    verifyWorkspaceTask(task);
    const candidate = blankState();
    await saveState(candidate, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = candidate;
    saveError = false;
    train = createTrainingState();
    trainingStartedAt = null;
    bulkSelection.ids.clear();
    Object.assign(view, { company: "", job: "", search: "", category: "", cardTag: null });
    render();
    toast(`当前${spaceTitle()}已清空，另一空间未改变。`);
  } catch (error) {
    toast(`档案未清空：${error.message}`);
  } finally {
    endWorkspaceTask(task);
  }
}

async function changeTrash(action, id, collection) {
  const moving = ["trash-record", "trash-list-record"].includes(action);
  if (trainingLocked()) {
    toast("请先结束本次训练，再操作垃圾箱。");
    return;
  }
  if (editor && !flushEditor(true)) return;
  let candidate;
  if (moving) {
    const kind = action === "trash-record" ? editor?.kind : collection;
    const entityId = action === "trash-record" ? editor?.id : id;
    if (!kind || !get(kind, entityId)) return;
    candidate = moveToTrash(state, kind, entityId);
    const entry = candidate.trash.at(-1);
    const count = Object.values(entry.records).reduce((n, rows) => n + rows.length, 0);
    if (!window.confirm(`删除「${entry.label}」？\n包含关联记录与附件共 ${count} 条，删除后可在垃圾箱恢复。`)) return;
  } else if (action === "restore-trash") candidate = restoreTrash(state, id);
  else if (action === "delete-trash") {
    const entry = (state.trash || []).find((entry) => entry.id === id);
    if (!entry || !window.confirm(`彻底删除「${entry.label}」及其垃圾箱内的关联记录与附件？\n此操作无法撤销。`)) return;
    candidate = deleteTrash(state, id);
  } else {
    if (!(state.trash || []).length || !window.confirm(`清空${spaceTitle()}的垃圾箱？\n所有垃圾箱记录与其中附件将被彻底删除，无法撤销。`)) return;
    candidate = emptyTrash(state);
  }
  // Close the editor before awaiting storage so its delayed autosave cannot race deletion.
  if (editor) {
    clearTimeout(editTimeout);
    $("#editor-dialog")?.close();
    $("#editor-dialog")?.remove();
    editor = null;
  }
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    await saveState(candidate, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = candidate;
    saveError = false;
    // Remove references to deleted selections before the next training session.
    for (const [field, key] of [["companyId", "companies"], ["jobId", "jobs"], ["questionId", "questions"], ["scriptId", "scripts"]])
      if (train[field] && !get(key, train[field])) train[field] = "";
    train.queue = [];
    train.answered = [];
    train.attachmentIds = [...(state.settings.trainingDraft?.attachmentIds || [])];
    render();
    if (!moving) showTrash();
    toast(moving ? "已删除，可在数据与设置的垃圾箱恢复或彻底删除。" : action === "restore-trash" ? "记录已恢复。" : "已彻底删除垃圾箱内容。");
  } catch (error) {
    toast(`垃圾箱未更新：${error.message}`);
  } finally {
    endWorkspaceTask(task);
  }
}

const agendaPad = (value) => String(value).padStart(2, "0");
function agendaDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${agendaPad(date.getMonth() + 1)}-${agendaPad(date.getDate())}`;
}
function agendaDateFromKey(key) {
  const date = new Date(`${key}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : new Date();
}
function scrollAgendaToDate(key) {
  const timeline = document.querySelector("#agenda-timeline");
  const day = document.getElementById(`agenda-day-${key}`);
  if (!timeline || !day) return;
  timeline.scrollTop += day.getBoundingClientRect().top - timeline.getBoundingClientRect().top;
}
function sizeAgendaTail() {
  const timeline = document.querySelector("#agenda-timeline");
  const lastDay = timeline?.querySelector(".agenda-day:last-child");
  if (!timeline || !lastDay) return;
  timeline.style.setProperty("--agenda-tail-space", `${Math.max(0, timeline.clientHeight - lastDay.offsetHeight)}px`);
}
function agendaWeekDays(key) {
  const monday = agendaDateFromKey(key);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { date, key: agendaDateKey(date) };
  });
}
function shiftAgendaWeek(days) {
  const selected = agendaDateFromKey(view.agendaDate || agendaDateKey(new Date()));
  selected.setDate(selected.getDate() + days);
  view.agendaDate = agendaDateKey(selected);
  view.agendaScrollTarget = view.agendaDate;
  view.agendaWeekDirection = days > 0 ? "next" : "previous";
  render();
  view.agendaWeekDirection = "";
}
function agendaLocalDateTime(value) {
  const date = new Date(value);
  return `${agendaDateKey(date)}T${agendaPad(date.getHours())}:${agendaPad(date.getMinutes())}`;
}
function agendaKnowledgeOptions(kind, selected = "") {
  const collection = ["questions", "scripts", "contentCards"].includes(kind) ? kind : "";
  const rows = collection ? state[collection] || [] : [];
  return `<option value="">${collection ? "不关联具体内容" : "先选择知识库类型"}</option>${rows.map((row) => `<option value="${esc(row.id)}" ${row.id === selected ? "selected" : ""}>${esc(row.title || row.text || "未命名内容")}</option>`).join("")}`;
}
function agendaKnowledgeLabel(item) {
  const collection = item.knowledgeKind;
  const row = ["questions", "scripts", "contentCards"].includes(collection) ? get(collection, item.knowledgeId) : null;
  return row?.title || row?.text || item.knowledgeTitle || "";
}
function agendaEntries() {
  const planned = (state.scheduleItems || []).map((item) => {
    const linked = state.interviews.find((interview) => interview.scheduleId === item.id);
    return linked && !item.interviewId
      ? { ...item, interviewId: linked.id, interviewTitle: `${companyName(linked.companyId)} · ${linked.round || "面试"}` }
      : item;
  });
  const duplicated = new Set(planned.filter((item) => item.type === "interview" && item.interviewId &&
    Math.abs(new Date(item.startsAt) - new Date(get("interviews", item.interviewId)?.scheduledAt)) < 30 * 60000).map((item) => item.interviewId));
  return [
    ...planned.map((item) => ({ ...item, source: "schedule" })),
    ...state.interviews.filter((item) => item.scheduledAt && !duplicated.has(item.id)).map((item) => ({
      id: item.id, startsAt: item.scheduledAt, type: "interview", source: "interview", interviewId: item.id,
      companyId: item.companyId, title: `${companyName(item.companyId)} · ${item.round || "面试"}`,
      notes: `${jobName(item.jobId)} · ${item.format || "形式待定"}`,
      completed: item.status === "已完成", canceled: item.status === "已取消",
    })),
  ].filter((item) => Number.isFinite(new Date(item.startsAt).getTime()))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt) || a.title.localeCompare(b.title, "zh-CN"));
}
function agendaCard(item) {
  const typeLabel = { general: "日程", training: "训练", "interview-prep": "面试准备", interview: "面试" }[item.type] || "日程";
  const date = new Date(item.startsAt);
  const completed = item.completed === true;
  const company = item.companyId ? (get("companies", item.companyId)?.name || item.companyName) : "";
  const interview = item.interviewId && item.source === "schedule" ?
    (get("interviews", item.interviewId)?.round || item.interviewTitle) : "";
  const knowledge = agendaKnowledgeLabel(item);
  const links = [company, interview, knowledge].filter(Boolean).map((name) => `<span>${esc(name)}</span>`).join("");
  const edit = item.source === "schedule";
  const lockedInterview = item.source === "interview" && (completed || item.canceled);
  return `<article class="agenda-item agenda-type-${esc(item.type)}${completed ? " is-complete" : ""}"><div class="agenda-item-time"><time datetime="${esc(item.startsAt)}">${agendaPad(date.getHours())}:${agendaPad(date.getMinutes())}</time><span class="agenda-type">${typeLabel}</span></div><div class="agenda-item-body"><h3>${edit ? `<button type="button" class="agenda-title-button" data-action="agenda-edit" data-id="${esc(item.id)}">${esc(item.title)}</button>` : esc(item.title)}</h3>${links ? `<div class="agenda-item-links">${links}</div>` : ""}${item.notes ? `<p>${esc(item.notes)}</p>` : ""}</div><div class="agenda-actions">${item.type === "training" ? btn("进入训练", "agenda-train", "small", `data-id="${esc(item.id)}"`) : item.interviewId ? btn("查看面试", "agenda-open-link", "small secondary", `data-kind="interviews" data-id="${esc(item.interviewId)}"`) : ""}${item.companyId && get("companies", item.companyId) ? btn("单位", "agenda-open-link", "small secondary", `data-kind="companies" data-id="${esc(item.companyId)}"`) : ""}${item.knowledgeId && get(item.knowledgeKind, item.knowledgeId) ? btn("知识库", "agenda-open-link", "small secondary", `data-kind="${esc(item.knowledgeKind)}" data-id="${esc(item.knowledgeId)}"`) : ""}${edit ? `${btn("编辑", "agenda-edit", "small secondary", `data-id="${esc(item.id)}"`)}${btn("删除", "agenda-delete", "small danger", `data-id="${esc(item.id)}" aria-label="删除日程 ${esc(item.title)}"`)}` : ""}</div><label class="agenda-completion"><input class="agenda-complete" type="checkbox" data-source="${esc(item.source)}" data-id="${esc(item.id)}" ${completed ? "checked" : ""} ${lockedInterview ? "disabled" : ""} aria-label="${esc(lockedInterview ? "面试状态请在面试档案中修改" : `${completed ? "取消完成" : "标记完成"}：${item.title}`)}"></label></article>`;
}
function dashboard() {
  const today = agendaDateKey(new Date());
  if (!view.agendaDate || !/^\d{4}-\d{2}-\d{2}$/.test(view.agendaDate)) view.agendaDate = today;
  const days = agendaWeekDays(view.agendaDate);
  const entries = agendaEntries();
  const weekEntries = entries.filter((item) => agendaDateKey(item.startsAt) >= days[0].key && agendaDateKey(item.startsAt) <= days[6].key);
  const visibleDays = [...new Set([today, view.agendaDate, ...entries.map((item) => agendaDateKey(item.startsAt))])]
    .sort().map((key) => ({ key, date: agendaDateFromKey(key) }));
  const monthLabel = `${days[0].date.getFullYear()} 年 ${days[0].date.getMonth() + 1} 月${days[0].date.getMonth() === days[6].date.getMonth() ? "" : ` — ${days[6].date.getMonth() + 1} 月`}`;
  return `<div class="agenda-page"><header class="agenda-header"><div><h1>我的日程</h1><p>把下一场安排进时间里。面试自动收录，训练和重要事项由您安排。</p></div><div class="agenda-header-side"><span>${new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</span></div></header><div class="agenda-overview"><div><strong>${weekEntries.length}</strong><span>本周安排</span></div><div><strong>${weekEntries.filter((item) => item.type === "interview").length}</strong><span>面试</span></div><div><strong>${weekEntries.filter((item) => item.type === "training").length}</strong><span>训练</span></div><a href="#/train">直接进入训练室 ${icon("arrow")}</a></div><div class="page-quick-actions agenda-quick-actions">${btn(icon("plus") + "新增", "agenda-new", "agenda-add-button")}${quickImport("schedules")}</div><section class="agenda-board" aria-label="时间轴日程"><div class="agenda-calendar-controls"><div class="agenda-toolbar"><div><h2>${monthLabel}</h2></div><div class="agenda-toolbar-actions"><button type="button" class="agenda-nav" data-action="agenda-week" data-shift="-7" aria-label="上一周">‹</button><input id="agenda-date" type="date" value="${esc(view.agendaDate)}" aria-label="选择日期"><button type="button" class="agenda-nav" data-action="agenda-week" data-shift="7" aria-label="下一周">›</button>${btn("回到今天", "agenda-today", "small secondary")}</div></div><div class="agenda-week-shell"><div class="agenda-week" role="group" data-week-direction="${view.agendaWeekDirection || ""}" aria-label="选择本周日期，左右滑动切换周">${days.map(({ date, key }) => { const count = weekEntries.filter((item) => agendaDateKey(item.startsAt) === key).length; return `<button type="button" class="agenda-weekday ${key === view.agendaDate ? "is-selected" : ""} ${key === today ? "is-today" : ""}" data-action="agenda-select-date" data-date="${key}" aria-pressed="${key === view.agendaDate}"><span>${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}</span><strong>${date.getDate()}</strong><small>${count ? `${count} 项` : "·"}</small></button>`; }).join("")}</div><p class="agenda-swipe-hint">← 左右滑动切换周 →</p></div></div><div class="agenda-timeline" id="agenda-timeline" tabindex="0" role="region" aria-label="日程列表，向上查看过往，向下查看未来">${visibleDays.map(({ date, key }) => { const rows = entries.filter((item) => agendaDateKey(item.startsAt) === key); return `<section class="agenda-day ${key === view.agendaDate ? "is-selected" : ""}" id="agenda-day-${key}"><div class="agenda-date"><time datetime="${key}"><strong>${agendaPad(date.getDate())}</strong><span>${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}</span></time>${key === today ? '<em>今天</em>' : ""}</div><div class="agenda-day-content">${rows.length ? rows.map(agendaCard).join("") : `<button type="button" class="agenda-empty" data-action="agenda-new" data-date="${key}"><span>＋</span>这天还没有安排，点击添加</button>`}</div></section>`; }).join("")}</div></section></div>`;
}
function closeAgendaDialog() {
  const dialog = $("#agenda-dialog");
  if (dialog) { dialog.close(); dialog.remove(); }
}
function openAgendaDialog(id = "", dateKey = "") {
  closeAgendaDialog();
  const row = (state.scheduleItems || []).find((item) => item.id === id);
  const selected = dateKey || view.agendaDate || agendaDateKey(new Date());
  const nextHour = new Date(Date.now() + 3600000);
  nextHour.setMinutes(0, 0, 0);
  const start = row?.startsAt || (selected === agendaDateKey(new Date()) ? nextHour.toISOString() : new Date(`${selected}T09:00:00`).toISOString());
  const dialog = document.createElement("dialog");
  dialog.id = "agenda-dialog";
  dialog.className = "sheet agenda-dialog";
  dialog.innerHTML = `<header class="sheet-header"><div><h2>${row ? "编辑日程" : "新增日程"}</h2></div><button type="button" class="icon-btn" data-action="agenda-close" aria-label="关闭日程编辑器">${icon("close")}</button></header><form id="agenda-form" data-id="${esc(row?.id || "")}"><div class="sheet-content agenda-form"><div class="form-grid"><label class="full">标题 *<input name="title" required maxlength="120" value="${esc(row?.title || "")}" placeholder="例如：模拟面试 / 梳理项目经历"></label><label>日期与时间 *<input name="startsAt" type="datetime-local" required value="${esc(agendaLocalDateTime(start))}"></label><label>类型<select name="type"><option value="general" ${!row || row.type === "general" ? "selected" : ""}>普通日程</option><option value="training" ${row?.type === "training" ? "selected" : ""}>训练 · 可直达训练室</option><option value="interview-prep" ${row?.type === "interview-prep" ? "selected" : ""}>面试准备 / 约定</option><option value="interview" ${row?.type === "interview" ? "selected" : ""}>面试</option></select></label></div><div class="agenda-links"><h3>关联档案 <small>可选</small></h3><div class="form-grid"><label>单位<select name="companyId">${opts(state.companies, row?.companyId, "name", "不关联单位")}</select></label><label>面试<select name="interviewId"><option value="">不关联面试</option>${state.interviews.map((item) => `<option value="${esc(item.id)}" ${item.id === row?.interviewId ? "selected" : ""}>${esc(companyName(item.companyId))} · ${esc(item.round || "面试")} · ${esc(fmtDate(item.scheduledAt || item.createdAt, true))}</option>`).join("")}</select></label><label>知识库类型<select name="knowledgeKind"><option value="">不关联知识库</option>${[["questions", "面试题库"], ["scripts", "介绍稿"], ["contentCards", "内容卡片"]].map(([key, label]) => `<option value="${key}" ${row?.knowledgeKind === key ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>知识库内容<select name="knowledgeId">${agendaKnowledgeOptions(row?.knowledgeKind, row?.knowledgeId)}</select></label></div></div><label>备注<textarea name="notes" rows="3" maxlength="2000" placeholder="地点、准备事项或想提醒自己的话…">${esc(row?.notes || "")}</textarea></label></div><footer class="sheet-footer"><span class="auto-status">保存在当前本地档案</span>${row ? btn("删除", "agenda-delete", "small danger", `data-id="${esc(row.id)}"`) : ""}<button type="button" class="btn secondary" data-action="agenda-close">取消</button><button type="submit" class="btn">保存日程</button></footer></form>`;
  document.body.append(dialog);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeAgendaDialog(); });
  showUiDialog(dialog, '[name="title"]');
}
async function saveAgenda(form) {
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const local = String(data.get("startsAt") || "");
  const startsAt = new Date(local);
  if (!title || !Number.isFinite(startsAt.getTime()) || !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) throw new Error("请填写日程标题和有效日期时间。");
  const type = String(data.get("type") || "general");
  if (!["general", "training", "interview-prep", "interview"].includes(type)) throw new Error("日程类型无效。");
  const companyId = String(data.get("companyId") || "");
  const interviewId = String(data.get("interviewId") || "");
  const knowledgeKind = String(data.get("knowledgeKind") || "");
  const knowledgeId = knowledgeKind ? String(data.get("knowledgeId") || "") : "";
  if (knowledgeKind && !knowledgeId) throw new Error("选择知识库类型后，请选择具体内容；不需要关联时选「不关联知识库」。");
  const interview = get("interviews", interviewId);
  const company = get("companies", companyId);
  const knowledge = knowledgeKind && knowledgeId ? get(knowledgeKind, knowledgeId) : null;
  const id = form.dataset.id;
  const row = (state.scheduleItems || []).find((item) => item.id === id);
  const patch = { title, startsAt: startsAt.toISOString(), type, completed: row?.completed === true, notes: String(data.get("notes") || "").trim(),
    companyId, companyName: company?.name || "", interviewId, interviewTitle: interview ? `${companyName(interview.companyId)} · ${interview.round || "面试"}` : "",
    knowledgeKind, knowledgeId, knowledgeTitle: knowledge?.title || knowledge?.text || "" };
  const candidate = structuredClone(state);
  candidate.scheduleItems ||= [];
  const index = candidate.scheduleItems.findIndex((item) => item.id === id);
  const record = touch(index < 0 ? { id: uid() } : candidate.scheduleItems[index], patch);
  if (index < 0) candidate.scheduleItems.push(record);
  else candidate.scheduleItems[index] = record;
  validateState(candidate);
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    form.querySelector('button[type="submit"]').disabled = true;
    await saveQueue;
    verifyWorkspaceTask(task);
    await saveState(candidate, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = candidate;
    saveError = false;
    view.agendaDate = agendaDateKey(record.startsAt);
    view.agendaScrollTarget = view.agendaDate;
    closeAgendaDialog();
    render();
    toast(index < 0 ? "日程已添加。" : "日程已更新。");
  } finally {
    endWorkspaceTask(task);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = false;
  }
}
async function setAgendaCompleted(input) {
  const source = input.dataset.source;
  if (!["schedule", "interview"].includes(source)) throw new Error("日程来源无效。");
  const collection = source === "interview" ? "interviews" : "scheduleItems";
  const id = input.dataset.id;
  const current = get(collection, id);
  if (!current) throw new Error("这条日程已不存在，请刷新后重试。");
  if (source === "interview" && current.status === "已取消") throw new Error("已取消的面试不能标记完成。");
  const completed = input.checked;
  if (source === "interview" && !completed) {
    input.checked = true;
    toast("面试完成状态请在面试档案中修改。");
    return;
  }
  const candidate = structuredClone(state);
  const index = candidate[collection].findIndex((item) => item.id === id);
  candidate[collection][index] = touch(candidate[collection][index], source === "interview"
    ? { status: "已完成" }
    : { completed });
  validateState(candidate);
  const task = beginWorkspaceTask();
  if (!task) { input.checked = !completed; return; }
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    await saveState(candidate, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = candidate;
    saveError = false;
    render();
    toast(completed ? "已标记完成。" : "已取消完成标记。");
  } catch (error) {
    input.checked = !completed;
    throw error;
  } finally {
    endWorkspaceTask(task);
  }
}
function sessionRow(s) {
  const rating = s.ratingPercent ?? (s.rating == null ? null : Number(s.rating) * 20);
  return `<div class="row"><div class="grow"><button type="button" class="row-title" data-action="edit" data-kind="sessions" data-id="${esc(s.id)}">${esc(s.title || "面试训练")}</button><br><small>${fmtDate(s.createdAt, true)} · ${fmtSeconds(s.duration || 0)} · 自评 ${esc(rating ?? "未评")}/100</small></div>${badge(s.attachmentIds?.length ? "含录音" : "已完成")}${btn(icon("trash"), "trash-list-record", "small danger", `data-kind="sessions" data-id="${esc(s.id)}" aria-label="删除 ${esc(s.title || "训练记录")}" title="删除"`)}</div>`;
}
document.addEventListener("toggle", (event) => {
  if (event.target.matches?.("[data-knowledge-guide]") && event.target.isConnected) {
    view.guideExpanded = event.target.open;
  }
}, true);

function knowledge() {
  const guideEmpty = state.questions.length === 0;
  if (view.guideEmpty !== guideEmpty) {
    view.guideEmpty = guideEmpty;
    view.guideExpanded = guideEmpty;
  }
  const collection = view.tab === "contentCards" ? "contentCards" : view.tab === "scripts" ? "scripts" : "questions";
  const cards = collection === "contentCards", scripts = collection === "scripts";
  const rows = state[collection] || [];
  const category = (row) => scripts ? row.type : row.category;
  const tagOrder = state.settings.contentCardTagOrder || [];
  const selectedTag = orderedCardTags(rows, tagOrder).includes(view.cardTag) ? view.cardTag : null;
  const displayRows = cards ? filterContentCards(rows, selectedTag, tagOrder) : rows;
  const filtered = displayRows.filter((row) =>
    (!view.search || `${row.title || row.text} ${row.content || row.answer || ""} ${row.variant || ""} ${row.tags?.join(" ") || ""}`.toLowerCase().includes(view.search.toLowerCase())) &&
    (!view.category || category(row) === view.category));
  const categories = [...new Set(rows.map(category).filter(Boolean))];
  const action = cards ? "new-content-card" : scripts ? "new-script" : "new-question";
  const label = cards ? "新增内容卡片" : scripts ? "新增介绍稿" : "新增问题";
  const tabs = [["questions", "面试题库"], ["scripts", "自我 / 项目介绍"], ["contentCards", "内容卡片"]];
  const list = cards
    ? `<div class="content-card-library">${filtered.map((row) => `<article class="content-card-tile">${rowSelect("contentCards", row)}<button type="button" class="row-title content-card-title" data-action="edit" data-kind="contentCards" data-id="${esc(row.id)}">${esc(row.title)}</button><div class="badges">${badge(row.category || "未分类", "neutral")}${row.variant ? badge(row.variant, "neutral") : ""}${(row.tags || []).map((tag) => badge(tag, "neutral")).join("")}</div><p class="content-card-preview">${esc(row.content || "尚未填写内容")}</p><div class="button-row">${btn("编辑卡片", "edit", "small secondary", `data-kind="contentCards" data-id="${esc(row.id)}"`)}${btn(icon("trash"), "trash-list-record", "small danger", `data-kind="contentCards" data-id="${esc(row.id)}" aria-label="删除 ${esc(row.title)}" title="删除"`)}</div></article>`).join("")}</div>`
    : `<div class="list-panel">${filtered.map((row) => `<div class="row">${rowSelect(collection, row)}${collection === "questions" ? `<select class="knowledge-difficulty" data-question-difficulty="${esc(row.id)}" aria-label="${esc(row.text)}的难度"><option value="">${row.difficulty && !QUESTION_DIFFICULTIES.includes(row.difficulty) ? "旧难度待确认" : "选择难度"}</option>${QUESTION_DIFFICULTIES.map((level) => `<option value="${level}" ${row.difficulty === level ? "selected" : ""}>${level}</option>`).join("")}</select>` : ""}<div class="grow"><button type="button" class="row-title" data-action="edit" data-kind="${collection}" data-id="${esc(row.id)}">${esc(row.title || row.text)}</button><div class="badges">${badge(category(row) || "未分类", "neutral")}${!scripts && row.history?.length ? badge(`${row.history.length + 1} 个版本`) : ""}${row.composition?.length ? badge(`${row.composition.length} 段拼接`) : ""}</div><p class="trace">${esc((row.content || row.answer || "尚未填写回答").slice(0, 110))}${(row.content || row.answer || "").length > 110 ? "…" : ""}</p></div><div class="knowledge-tags">${(row.tags || []).map((tag) => badge(tag, "neutral")).join("")}</div><div class="knowledge-row-actions">${btn(icon("play"), "practice", "small secondary", `data-kind="${collection}" data-id="${esc(row.id)}" aria-label="训练 ${esc(row.title || row.text)}"`)}${btn(icon("trash"), "trash-list-record", "small danger", `data-kind="${collection}" data-id="${esc(row.id)}" aria-label="删除 ${esc(row.title || row.text)}" title="删除"`)}</div></div>`).join("")}</div>`;
  return '<section class="knowledge-page">' + pageHead("知识库", "整理问题、介绍稿与可复用的内容卡片，自由拼接不同版本的表达。") + `<div class="page-quick-actions">${btn(icon("plus") + "新增", action, "", `aria-label="${label}"`)}${quickImport(collection === "scripts" ? "introductions" : collection === "contentCards" ? "cards" : "questions")}${cards ? helpTip("把开场、经历、收尾分别存成卡片，也可以标注短版、长版。在问题或介绍稿编辑页中，拖入卡片或点击添加，再调整顺序。", "内容卡片说明") : ""}</div>` +
    `<div class="tabs" role="group" aria-label="知识库类型">${tabs.map(([key, name]) => `<button data-action="knowledge-tab" data-tab="${key}" aria-pressed="${collection === key}" class="${collection === key ? "active" : ""}">${name} <small>${(state[key] || []).length}</small></button>`).join("")}</div>${cards ? cardTagBar(rows, tagOrder, selectedTag, "library", esc) : ""}${collection === "questions" ? knowledgeGuideMarkup({ open: view.guideExpanded, icon, helpTip }) : ""}<div class="toolbar"><div class="field-search">${icon("search")}<input id="knowledge-search" placeholder="${cards ? "搜索卡片、内容、版本、标签…" : "搜索问题、回答、标签…"}" value="${esc(view.search)}" aria-label="搜索知识库"></div><select id="knowledge-category" aria-label="按类别筛选"><option value="">全部类别</option>${categories.map((name) => `<option ${view.category === name ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></div>${bulkToolbar(collection, filtered)}${filtered.length ? list : collection === "questions" && guideEmpty && !view.search ? "" : empty(view.search ? "没有找到匹配内容" : cards ? "把常用表达拆成可复用的片段" : "先留下一份属于您的底稿", view.search ? "试试其他关键词，或切换类别。" : cards ? "例如开场短版、项目经历长版、收尾。建立后可在回答或介绍稿中自由拼接。" : "添加常见问题、自我介绍或项目介绍，再用内容卡片拼接表达。", action, label)}</section>`;
}

function companies() {
  const query = view.search.trim().toLocaleLowerCase();
  const allTags = [...new Set(state.jobs.flatMap((job) => (job.tags || []).map((tag) => typeof tag === "string" ? tag : tag.name).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const rows = state.jobs.filter((job) => {
    const company = get("companies", job.companyId);
    const tags = (job.tags || []).map((tag) => typeof tag === "string" ? tag : tag.name);
    return `${job.title || ""} ${company?.name || ""} ${job.city || ""} ${tags.join(" ")}`.toLocaleLowerCase().includes(query) && (!view.jobTag || tags.includes(view.jobTag));
  }).sort((a, b) => {
    const intent = (job) => opportunityIntentValues(job, scoreJob(job, get("companies", job.companyId), state.settings)).personal;
    return intent(b) - intent(a);
  });
  const importActions = `<div class="page-quick-actions job-import-actions">${btn(icon("plus") + "新增", "new-job", "", 'aria-label="新增岗位"')}${quickImport("jobs")}</div>`;
  return `<section class="jobs-page">${pageHead("岗位档案", "以岗位为中心记录职位、公司、材料与进展。")}${importActions}<div class="toolbar job-toolbar"><div class="field-search">${icon("search")}<input id="company-search" placeholder="搜索岗位、公司或标签…" value="${esc(view.search)}" aria-label="搜索岗位档案"></div><select id="job-tag-filter" aria-label="按岗位标签筛选"><option value="">全部标签</option>${allTags.map((tag) => `<option value="${esc(tag)}" ${view.jobTag === tag ? "selected" : ""}>${esc(tag)}</option>`).join("")}</select></div>${bulkToolbar("jobs", rows)}<div class="opportunity-grid">${rows.map((job) => opportunityCard(job, get("companies", job.companyId), { ...editorContext(false), selectCard: (row) => rowSelect("jobs", row) })).join("") || empty("先添加一个岗位", "可以手动新建，或用 AI 整理模板把招聘资料转换成 JSON 导入。", "new-job", "新增岗位")}</div></section>`;
}
function interviews() {
  const rows = state.interviews
    .filter((i) => !view.company || i.companyId === view.company)
    .sort((a, b) =>
      (b.scheduledAt || b.createdAt).localeCompare(
        a.scheduledAt || a.createdAt,
      ),
    );
  return (
    pageHead(
      "面试档案",
      "按单位和岗位记录面试，企业反馈与考公自评区分保存。",
    ) +
    `<div class="toolbar"><select id="interview-company" aria-label="筛选面试单位">${opts(state.companies, view.company, "name", "全部单位")}</select><span class="muted">共 ${rows.length} 场面试</span></div><div class="page-quick-actions">${btn(icon("plus") + "新增", "new-interview", "archive-gold", 'aria-label="新增面试档案"')}${quickImport("interviews")}</div>${bulkToolbar("interviews", rows)}${rows.length ? `<div class="list-panel">${rows.map((i) => `<div class="row">${rowSelect("interviews", i)}<div class="date-block"><b>${new Date(i.scheduledAt || i.createdAt).getDate()}</b><small>${new Date(i.scheduledAt || i.createdAt).getMonth() + 1} 月</small></div><div class="grow"><button type="button" class="row-title" data-action="edit" data-kind="interviews" data-id="${esc(i.id)}">${esc(companyName(i.companyId))} · ${esc(i.round || "面试")}</button><p class="trace">${esc(jobName(i.jobId))} · ${fmtDate(i.scheduledAt, true)} · ${esc(i.format || "未设置形式")}</p><div class="badges">${badge(i.status === "待确认" ? "旧记录待确认" : i.status || "已完成", i.status === "已完成" ? "neutral" : "")}${badge(`${i.questions?.length || 0} 个现场问题`, "neutral")}${i.attachmentIds?.length ? badge("含附件") : ""}</div></div>${btn("编辑", "edit", "small secondary", `data-kind="interviews" data-id="${esc(i.id)}"`)}${btn(icon("trash"), "trash-list-record", "small danger", `data-kind="interviews" data-id="${esc(i.id)}" aria-label="删除 ${esc(i.round || "面试档案")}" title="删除"`)}</div>`).join("")}</div>` : empty("把面试留在档案里", "关联单位和岗位，记录每轮问题、现场回答与反馈。已完成的面试也可以随时补录。", "new-interview", "记录面试")}`
  );
}
function training() {
  const targetJob = get("jobs", train.jobId);
  const targetOrganization = get("companies", train.companyId);
  const publicTraining = isPublicJob(targetJob, targetOrganization);
  const current = get("questions", train.questionId);
  const script = get("scripts", train.scriptId);
  const prompt = train.mode === "questions"
    ? current?.text || "选择本次训练范围，再抽一道题。"
    : script?.title || `选择一份${train.mode === "self" ? "自我" : "项目"}介绍稿，或直接开始表达。`;
  const draft = train.mode === "questions" ? current?.answer : script?.content;
  const jobs = state.jobs.filter((job) => !train.companyId || job.companyId === train.companyId);
  const tags = [...new Set(state.questions.flatMap((question) => question.tags || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const locked = trainingLocked() ? "disabled" : "";
  return pageHead("训练室", "选好目标，开始训练，结束后记录反馈。") +
    `<div class="training-layout"><section class="training-stage"><div class="tabs" role="group" aria-label="训练方式">${[["questions", "模拟面试"], ["self", "自我介绍"], ["project", "项目介绍"]].map(([mode, label]) => `<button data-action="train-mode" data-mode="${mode}" aria-pressed="${train.mode === mode}" class="${train.mode === mode ? "active" : ""}">${label}</button>`).join("")}</div>
      ${publicTraining ? `<p class="training-context">${esc(trackLabel(targetJob, targetOrganization))} · ${esc(targetJob?.interviewFormat || "按自定题型训练")} · 本次复盘为自评</p>` : ""}
      <div class="timer" id="timer" role="timer" aria-label="训练计时">00:00</div>
      <div class="timer-label" id="timer-label">${train.countdown ? "倒计时" : "正计时"} · 专注本次表达</div>
      <progress class="timer-progress" id="timer-progress" max="1" value="0" aria-label="目标时长进度"></progress>
      <div class="training-question">${esc(prompt)}</div>
      ${train.mode === "questions" && current ? `<div class="badges" style="margin-bottom:20px">${badge(current.category || "未分类")}${current.difficulty ? badge(current.difficulty, "neutral") : ""}${badge(`第 ${train.index + 1} / ${Math.max(1, train.queue.length)} 题`, "neutral")}</div>` : ""}
      <section class="training-draft"><h2>您的表达底稿</h2><p class="details-copy">${esc(draft || (train.mode === "questions" ? "选择题目后，这里会显示知识库中关联的答案。" : "选择介绍稿后，这里会显示关联的自我介绍或项目介绍。"))}</p></section>
      <div class="button-row">${btn(icon(train.running ? "pause" : "play") + (train.running ? "暂停训练" : train.elapsed ? "继续训练" : "开始训练"), "timer-toggle")}${btn(icon("check") + "完成复盘", "finish-training", "secondary")}${train.mode === "questions" ? btn(icon("shuffle") + "下一题", "draw-question", "secondary") : ""}</div>
      <div class="training-controls">${btn(icon("mic") + (train.recording ? "停止录音" : "本地录音"), "record", "small secondary")}${btn(icon("refresh") + "重置计时", "timer-reset", "small secondary")}</div>
      <p class="train-hint">${train.recording ? '<span class="record-dot recording-active"></span>正在本地录音' : "专注表达，结束后再复盘。"}</p>${attachmentsHTML(train.attachmentIds)}</section>
      <aside class="training-side" aria-label="训练配置"><div class="training-config-block"><details class="panel train-config" ${train.configOpen ? "open" : ""}><summary><h2>本次训练</h2></summary><div class="form-stack">
      <label>目标单位<select id="train-company" ${locked}>${opts(state.companies, train.companyId, "name", "通用训练")}</select></label>
      <label>目标岗位<select id="train-job" ${locked}>${opts(jobs, train.jobId, "title", "不限岗位")}</select></label>
      ${train.mode === "questions" ? `<label>训练类别<select id="train-category" ${locked}><option value="">全部类别</option>${TRAINING_MODULES.map((category) => `<option value="${esc(category)}" ${train.category === category ? "selected" : ""}>${esc(category)}</option>`).join("")}</select></label>
      <label>训练难度<select id="train-difficulty" ${locked}><option value="">全部难度</option>${QUESTION_DIFFICULTIES.map((difficulty) => `<option value="${difficulty}" ${train.difficulty === difficulty ? "selected" : ""}>${difficulty}</option>`).join("")}</select></label>
      <details class="train-tag-filter" ${train.tagsOpen ? "open" : ""}><summary>训练标签（可多选）${train.tags.length ? ` · 已选 ${train.tags.length}` : ""}</summary><div>${tags.map((tag) => `<label><input type="checkbox" data-train-tag="${esc(tag)}" ${locked} ${train.tags.includes(tag) ? "checked" : ""}>${esc(tag)}</label>`).join("") || '<span class="trace">题库中暂无标签</span>'}</div></details>` : `<label>使用底稿<select id="train-script" ${locked}>${opts(state.scripts.filter((item) => item.type === (train.mode === "self" ? "自我介绍" : "项目介绍")), train.scriptId, "title", "自由训练")}</select></label>`}
      <div class="form-grid"><label>计时方式<select id="train-clock" ${locked}><option value="up" ${!train.countdown ? "selected" : ""}>正计时</option><option value="down" ${train.countdown ? "selected" : ""}>倒计时</option></select></label><label>目标时长（秒）<input id="train-target" ${locked} type="number" min="10" max="7200" value="${train.target}"></label></div></div></details><span class="training-config-help">${helpTip("训练开始后锁定目标范围，完成复盘后可调整。录音仅保存在此设备。", "训练与录音说明")}</span></div><p class="training-library-hint">${icon("book")}<span>训练室需要先准备好面试题库。您可以前往<a href="#/knowledge">知识库</a>，跟随新手指南，使用 AI 完成首轮训练并导入题目。</span></p></aside></div>
      <section style="margin-top:32px"><div class="section-heading"><h2>训练记录</h2><span class="muted">${state.sessions.length} 次训练</span></div>${state.sessions.length ? `<div class="list-panel">${state.sessions.slice().reverse().slice(0, 12).map(sessionRow).join("")}</div>` : empty("还没有完成的训练", "完成一次训练，留下时长、问题、录音与自我反馈。", "", "", true)}</section>`;
}
function elapsed() {
  return (
    train.elapsed +
    (train.running ? (performance.now() - train.started) / 1000 : 0)
  );
}
function updateTimer() {
  const el = $("#timer");
  if (!el) return;
  const seconds = elapsed();
  const progress = $("#timer-progress");
  if (progress) progress.value = Math.min(1, seconds / train.target);
  el.textContent = fmtSeconds(
    Math.max(0, train.countdown ? train.target - seconds : seconds),
  );
  if (train.countdown && seconds >= train.target && train.running) {
    train.elapsed = seconds;
    train.running = false;
    train.started = null;
    toast("目标时长已到。慢慢收尾，再做一次复盘。");
    render();
  }
}
setInterval(updateTimer, 250);
function questionPool() {
  const pub = isPublicJob(
    get("jobs", train.jobId),
    get("companies", train.companyId),
  );
  let rows = state.questions.filter(
    (q) =>
      (!train.category || trainingModuleForQuestion(q) === train.category) &&
      (!train.difficulty || q.difficulty === train.difficulty) &&
      (!train.tags.length || train.tags.every((tag) => (q.tags || []).includes(tag))) &&
      (!q.scope ||
        q.scope === "common" ||
        q.scope === (pub ? "public" : "enterprise")),
  );
  const job = get("jobs", train.jobId),
    company = get("companies", train.companyId);
  if (job || company) {
    const text = `${job?.jd || ""} ${company?.focus || ""}`.toLowerCase();
    const matched = rows.filter(
      (q) =>
        (q.tags || []).some((t) => text.includes(t.toLowerCase())) ||
        (company?.id &&
          state.interviews.some(
            (i) =>
              i.companyId === company.id &&
              (i.questions || []).some((a) => a.questionId === q.id),
          )),
    );
    if (matched.length) rows = matched;
  }
  return rows;
}
function drawQuestion() {
  const pool = questionPool();
  if (!pool.length) {
    toast("此范围还没有问题，请先在知识库添加。");
    return;
  }
  if (train.questionId && !train.answered.includes(train.questionId))
    train.answered.push(train.questionId);
  if (!train.queue.length || train.index >= train.queue.length - 1) {
    train.queue = pool.map((q) => q.id);
    for (let k = train.queue.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [train.queue[k], train.queue[r]] = [train.queue[r], train.queue[k]];
    }
    train.index = 0;
  } else train.index++;
  train.questionId = train.queue[train.index];
  render();
}
function filteredInterviews() {
  return state.interviews.filter(
    (i) =>
      (!view.company || i.companyId === view.company) &&
      (!view.job || i.jobId === view.job) &&
      (!view.since ||
        new Date(i.scheduledAt || i.createdAt) >= new Date(view.since)),
  );
}
function analytics() {
  const rows = filteredInterviews(),
    actual = rows.flatMap((i) =>
      (i.questions || []).map((q) => ({
        ...q,
        interviewId: i.id,
        companyId: i.companyId,
      })),
    );
  const frequency = new Map();
  for (const q of actual) {
    const key = q.questionId || q.text.trim();
    const old = frequency.get(key) || {
      text: get("questions", q.questionId)?.text || q.text,
      count: 0,
      records: [],
    };
    old.count++;
    old.records.push(q);
    frequency.set(key, old);
  }
  const frequencies = [...frequency.values()].sort((a, b) => b.count - a.count);
  const linked = actual.filter((q) => q.questionId).length;
  const sessions = state.sessions.filter(
    (s) =>
      (!view.company || s.companyId === view.company) &&
      (!view.job || s.jobId === view.job) &&
      (!view.since || new Date(s.createdAt) >= new Date(view.since)),
  );
  const totalMinutes = Math.round(
    sessions.reduce((n, s) => n + (s.duration || 0), 0) / 60,
  );
  const jobs = state.jobs.filter(
    (j) =>
      (!view.company || j.companyId === view.company) &&
      (!view.job || j.id === view.job),
  );
  const keywords = state.settings.keywords;
  const sourceText = [
    ...state.scripts.map((s) => s.content),
    ...state.questions.map((q) => q.answer),
  ].join("\n");
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    const key = date.toLocaleDateString();
    return {
      date,
      n: sessions
        .filter((s) => new Date(s.createdAt).toLocaleDateString() === key)
        .reduce((a, s) => a + (s.duration || 0) / 60, 0),
    };
  });
  const maxMinutes = Math.max(1, ...days.map((d) => d.n));
  return (
    pageHead("成长分析", "查看训练时长、高频问题和岗位匹配记录。") +
    `<div class="toolbar"><select id="analytics-company" aria-label="分析单位筛选">${opts(state.companies, view.company, "name", "全部单位")}</select><select id="analytics-job" aria-label="分析岗位筛选">${opts(
      state.jobs.filter((j) => !view.company || j.companyId === view.company),
      view.job,
      "title",
      "全部岗位",
    )}</select><label style="font-size:12px">起始日期 <input id="analytics-since" type="date" value="${esc(view.since)}"></label></div><div class="analytics-help">${helpTip("机械统计基于保存的原始记录；关键词只做文本与同义词匹配，不代表能力评价。", "成长分析统计说明")}${btn("修改匹配规则", "go-settings", "small secondary")}</div><div class="stats"><div class="stat"><span>筛选范围内的训练</span><strong>${sessions.length}<small>次</small></strong></div><div class="stat"><span>训练时长</span><strong>${totalMinutes}<small>分钟</small></strong></div><div class="stat"><span>实际面试问题</span><strong>${actual.length}<small>次提问</small></strong></div><div class="stat"><span>题库关联命中率</span><strong>${actual.length ? Math.round((linked / actual.length) * 100) : "待统计"}<small>${actual.length ? "%" : "暂无记录"}</small></strong></div></div><div class="insight-grid"><section class="panel"><h2>实际问题出现频率</h2>${
      frequencies
        .slice(0, 8)
        .map(
          (f) =>
            `<div class="bar-row"><button type="button" class="row-title" data-action="trace" data-ids="${esc(JSON.stringify(f.records.map((r) => r.interviewId)))}" style="font-size:12px">${esc(f.text)}</button><div class="bar-track"><div class="bar-fill" style="width:${(f.count / Math.max(...frequencies.map((x) => x.count))) * 100}%"></div></div><span>${f.count} 次</span></div>`,
        )
        .join("") || '<p class="muted">记录实际面试问题后，这里会出现频次。</p>'
    }<p class="trace">相同题库 ID 合并计数；未入库问题按原文完全一致归组。点击问题追溯面试。命中率 = 已关联题库的问题次数 ÷ 实际提问总次数。</p></section><section class="panel"><h2>近七天的训练节奏</h2><div class="timeline">${days.map((d) => `<div class="timeline-day" title="${d.date.toLocaleDateString("zh-CN")} · ${Math.round(d.n)} 分钟"><small>${Math.round(d.n)}m</small><div class="timeline-bar" style="height:${(d.n / maxMinutes) * 95}px"></div><small>${d.date.getMonth() + 1}/${d.date.getDate()}</small></div>`).join("")}</div><p class="trace">仅统计已完成训练。${sessions.length ? btn("查看原始训练", "trace-sessions", "small secondary") : ""}</p></section><section class="panel"><h2>职位要求与准备覆盖</h2>${
      keywords.length
        ? jobs
            .map((j) => {
              const jdKeys = keywordCoverage(
                j.jd || "",
                keywords,
                state.settings.synonyms,
              ).matched;
              const coverage = keywordCoverage(
                sourceText,
                jdKeys,
                state.settings.synonyms,
              );
              return `<div class="row"><div class="grow"><button type="button" class="row-title" data-action="edit" data-kind="jobs" data-id="${esc(j.id)}">${esc(companyName(j.companyId))} · ${esc(j.title)}</button><p class="trace">材料关键词命中 ${jdKeys.length} 项；准备底稿覆盖 ${coverage.matched.length} 项 ${jdKeys.length ? `· ${coverage.percent}%` : "· 无适用关键词"}</p><div class="badges">${coverage.matched.map((k) => badge(k)).join("")}${coverage.missing.map((k) => badge("待覆盖 " + k, "red")).join("")}</div></div></div>`;
            })
            .join("") || '<p class="muted">先添加岗位要求或招录材料。</p>'
        : '<p class="muted">先在设置中定义岗位关键词与同义词。</p>'
    }<p class="trace">先匹配岗位材料中的自定义关键词，再检查知识库回答与介绍稿中的文本覆盖。${btn("查看准备原文", "go-knowledge", "small secondary")}</p></section><section class="panel"><h2>问题关注点与复盘来源</h2>${
      state.companies
        .filter((c) => !view.company || c.id === view.company)
        .map((c) => {
          const evidence = rows.filter((i) => i.companyId === c.id);
          const focus = keywordCoverage(
            evidence
              .flatMap((i) => (i.questions || []).map((q) => q.text))
              .join(" "),
            keywords,
            state.settings.synonyms,
          );
          return `<div class="row"><div class="grow"><button type="button" class="row-title" data-action="edit" data-kind="companies" data-id="${esc(c.id)}">${esc(c.name)}</button><p class="trace">关注点（机械匹配）：${esc(focus.matched.join("、") || "暂无匹配")}</p><p class="trace">${organizationKind(c) === "public" ? "自评优势（非考官评价）" : "明确认可"}：${esc(
            evidence
              .map((i) => i.strengths)
              .filter(Boolean)
              .join("；") ||
              c.strengths ||
              "暂无记录",
          )}</p><p class="trace">${organizationKind(c) === "public" ? "自评待改进" : "明确指出的不足"}：${esc(
            evidence
              .map((i) => i.weaknesses)
              .filter(Boolean)
              .join("；") ||
              c.weaknesses ||
              "暂无记录",
          )}</p><div class="button-row">${evidence.length ? btn("追溯反馈原文", "trace", "small secondary", `data-ids="${esc(JSON.stringify(evidence.map((i) => i.id)))}"`) : ""}</div></div></div>`;
        })
        .join("") || '<p class="muted">完成面试复盘后，反馈会汇总在这里。</p>'
    }<p class="trace">企业评价引用已记录的明确反馈；考公栏目引用个人复盘或注明来源的信息，不推断考官评价。</p></section></div>`
  );
}
function scoringCompany(c) {
  const rows = state.interviews.filter((i) => i.companyId === c.id);
  return {
    ...c,
    strengths: [c.strengths, ...rows.map((i) => i.strengths)]
      .filter(Boolean)
      .join("；"),
    weaknesses: [c.weaknesses, ...rows.map((i) => i.weaknesses)]
      .filter(Boolean)
      .join("；"),
    feedback: [c.feedback, ...rows.map((i) => i.feedback)]
      .filter(Boolean)
      .join("；"),
  };
}
function decision() {
  return decisionMarkup({
    ...editorContext(false),
    extra: { mode: view.decisionTrack },
  });
}
function publicRulesPanel() {
  const dimensions =
    state.settings.publicDimensions || DEFAULT_PUBLIC_DIMENSIONS;
  return `<section class="panel"><h2>考公 / 事业单位规则 ${helpTip("流程分只表示已记录的阶段，不代表成绩、名次或录用概率；自评与反馈不会加减该分。两类考试的映射可分别修改。", "公招规则说明")}</h2><form id="public-rule-form" class="form-stack"><label>个人报考评价维度（稳定 ID, 名称, 权重）<textarea name="publicDimensions">${esc(dimensions.map((d) => `${d.id}, ${d.name}, ${d.weight}`).join("\n"))}</textarea></label>${["civil-service", "public-institution"].map((t) => `<details><summary>${esc(trackLabel(t))} · 进展分</summary><div class="form-grid">${PUBLIC_STATUSES.map((status) => `<label>${status}<input name="${t}-${status}" type="number" min="0" max="100" value="${state.settings.publicStageScores?.[t]?.[status] ?? DEFAULT_PUBLIC_STAGE_SCORES[t][status]}"></label>`).join("")}</div></details>`).join("")}<button type="submit" class="btn">保存公招规则</button></form></section>`;
}

function settings() { return settingsMarkup({ state, pageHead, btn, icon, helpTip, fmtDate, esc, spaceTitle, installPrompt, statuses, publicRulesPanel, get, types, accentPrefs, themeMode }); }
async function storageEstimate() {
  try {
    const est = await navigator.storage.estimate();
    storageInfo = est;
    const text = `已使用 ${((est.usage || 0) / 1024 / 1024).toFixed(2)} MB / 可用配额约 ${((est.quota || 0) / 1024 / 1024).toFixed(0)} MB · ${(await navigator.storage.persisted()) ? "已获持久存储" : "由浏览器管理"}`;
    if ($("#storage-info")) $("#storage-info").textContent = text;
    if ($("#storage-fill"))
      $("#storage-fill").style.width =
        `${Math.max(0.5, ((est.usage || 0) / (est.quota || 1)) * 100)}%`;
  } catch {
    if ($("#storage-info"))
      $("#storage-info").textContent =
        "浏览器未提供存储配额查询，数据仍保存于本机。";
  }
}
function textField(name, label, value = "", type = "text", extra = "") {
  return `<label ${extra.includes("full") ? 'class="full"' : ""}>${label}<input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra.replace("full", "")}></label>`;
}
function area(name, label, value = "", extra = "") {
  return `<label class="full">${label}<textarea name="${esc(name)}" ${extra}>${esc(value)}</textarea></label>`;
}
function selectField(name, label, options) {
  return `<label>${label}<select name="${esc(name)}">${options}</select></label>`;
}
function options(values, value) {
  return values
    .map((v) => `<option ${v === value ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
}
function attachmentsHTML(ids) {
  return (ids || [])
    .map((id) => {
      const a = get("attachments", id);
      if (!a) return "";
      const data = a.data.startsWith("data:")
        ? a.data
        : `data:${a.mime};base64,${a.data}`;
      const safe = /^(audio\/|application\/octet-stream)/.test(a.mime);
      return `<div class="history-entry"><span>${esc(a.name)}</span>${a.mime.startsWith("audio/") ? `<audio controls preload="none" src="${esc(data)}"></audio>` : ""}<button type="button" class="text-btn" data-action="download-attachment" data-id="${esc(a.id)}">下载附件 ${safe ? "" : "（本地文件）"}</button></div>`;
    })
    .join("");
}
function historyHTML(row) {
  return (row.history || [])
    .slice()
    .reverse()
    .map(
      (h) =>
        `<details class="history-entry"><summary>${fmtDate(h.at, true)} · ${esc(h.versionName || "历史版本")}</summary><p>${h.text ? esc(h.text) + "<br>" : ""}${h.title ? esc(h.title) + "<br>" : ""}${esc(h.content || h.answer || "")}</p><button type="button" class="text-btn" data-action="restore-version" data-index="${(row.history || []).indexOf(h)}">将此版本作为当前版本</button></details>`,
    )
    .join("");
}
function editorHTML(kind, row, isNew) {
  const required = "required";
  if (kind === "companies")
    return organizationEditor(row, editorContext(isNew));
  if (kind === "jobs") return jobEditor(row, editorContext(isNew));
  if (kind === "contentCards") return contentCardEditor(row, { textField, area, selectField, options });
  if (kind === "questions")
    return `<div class="form-grid">${textField("text", "面试问题 *", row.text, "text", required + " full")}${selectField("difficulty", "难度 *", `<option value="">${row.difficulty && !QUESTION_DIFFICULTIES.includes(row.difficulty) ? `旧标记 ${esc(row.difficulty)}，建议 ${esc(suggestQuestionDifficulty(row.difficulty) || "重新选择")}` : "请选择难度"}</option>${QUESTION_DIFFICULTIES.map((level) => `<option value="${level}" ${row.difficulty === level ? "selected" : ""}>${level}</option>`).join("")}`)}${selectField("scope", "适用场景", `<option value="common" ${!row.scope || row.scope === "common" ? "selected" : ""}>通用</option><option value="enterprise" ${row.scope === "enterprise" ? "selected" : ""}>企业面试</option><option value="public" ${row.scope === "public" ? "selected" : ""}>考公 / 事业单位</option>`)}${textField("category", "题型 / 类别", row.category, "text", 'list="question-categories"')}<datalist id="question-categories">${[...new Set([...TRAINING_MODULES, ...questionCategoriesFor("enterprise"), ...questionCategoriesFor("civil-service")])].map((c) => `<option value="${esc(c)}">`).join("")}</datalist>${textField("tagText", "标签 / 关键词，逗号分隔", (row.tags || []).join(", "))}${compositionEditor(row, "answer", state.contentCards || [], { esc, icon, btn, area, tagOrder: state.settings.contentCardTagOrder || [], selectedTag: editor?.cardTag || null, undoParts: editor?.undoParts || [] })}${textField("versionName", "当前版本名称", row.versionName || "初稿", "text", "full")}${area("notes", "回答提示与来源", row.notes)}</div><h3 class="subhead">历史回答版本</h3>${historyHTML(row) || '<p class="trace">修改问题或回答时，保留编辑前的快照。</p>'}`;
  if (kind === "scripts")
    return `<div class="form-grid">${textField("title", "介绍稿标题 *", row.title, "text", required + " full")}${selectField("type", "介绍类型", options(["自我介绍", "项目介绍"], row.type || "自我介绍"))}${textField("duration", "目标时长（秒）", row.duration ?? 90, "number", 'min="10" max="7200"')}${textField("versionName", "版本名称", row.versionName || "初稿")}${textField("project", "项目名 / 使用场景", row.project)}${compositionEditor(row, "content", state.contentCards || [], { esc, icon, btn, area, tagOrder: state.settings.contentCardTagOrder || [], selectedTag: editor?.cardTag || null, undoParts: editor?.undoParts || [] })}${textField("tagText", "标签，逗号分隔", (row.tags || []).join(", "), "text", "full")}</div>`;
  if (kind === "interviews") {
    const pub = isPublicJob(
      get("jobs", row.jobId),
      get("companies", row.companyId),
    );
    return `<div class="form-grid">${selectField("companyId", "单位 *", opts(state.companies, row.companyId, "name", "请选择单位"))}${selectField(
      "jobId",
      "岗位 *",
      opts(
        state.jobs.filter(
          (j) => !row.companyId || j.companyId === row.companyId,
        ),
        row.jobId,
        "title",
        "请选择岗位",
      ),
    )}${textField("round", "面试轮次 *", row.round || (isNew ? "" : "第一轮"), "text", "required")}${textField("scheduledAt", "面试时间 *", row.scheduledAt ? new Date(new Date(row.scheduledAt).getTime() - new Date(row.scheduledAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "", "datetime-local", "required")}${selectField("status", "本轮状态", `<option value="待确认" hidden ${row.status === "待确认" ? "selected" : ""}>旧记录待确认</option>${options(["已完成", "已取消"], row.status || "已完成")}`)}${selectField("scheduleId", "关联日程", opts((state.scheduleItems || []).filter((item) => item.type === "interview" && (!row.companyId || !item.companyId || item.companyId === row.companyId)), row.scheduleId, "title", "不关联日程"))}${selectField("format", "面试形式", options(pub ? ["结构化面试", "结构化小组", "无领导小组", "专业测试", "其他"] : ["视频面试", "现场面试", "电话面试", "其他"], row.format || (pub ? "结构化面试" : "视频面试")))}${textField("interviewer", "面试官", row.interviewer)}${textField("meeting", "地点 / 会议链接", row.meeting)}${area("transcript", "面试实录 / 现场记录", row.transcript)}${area("strengths", pub ? "自评优势（非考官评价）" : "招聘方明确认可的优势", row.strengths)}${area("weaknesses", pub ? "自评待改进（非考官评价）" : "招聘方明确指出的不足", row.weaknesses)}${area("feedback", pub ? "可核实信息 / 成绩与反馈来源" : "招聘方反馈与原始来源", row.feedback)}${selectField("feedbackSource", "记录来源", options(pub ? ["个人复盘", "公开信息", "明确反馈"] : ["招聘方明确反馈", "个人复盘"], row.feedbackSource || (pub ? "个人复盘" : "招聘方明确反馈")))}${area("notes", "个人复盘与备注", row.notes)}</div><h3 class="subhead">现场问题与回答</h3><div id="actual-questions">${(row.questions || []).map((q, i) => actualQuestionHTML(q, i)).join("")}</div>${btn(icon("plus") + "添加现场问题", "add-actual", "small secondary")}<h3 class="subhead">本地录音与附件</h3><label class="form-help">选择录音或附件（单个最多 30 MB）<input id="attachment-upload" type="file" multiple style="width:100%;margin-top:10px"></label>${attachmentsHTML(row.attachmentIds)}`;
  }
  if (kind === "sessions")
    return `<div class="note">${esc(row.title)} · ${fmtSeconds(row.duration || 0)} · ${fmtDate(row.createdAt, true)}</div><div class="form-grid" style="margin-top:18px">${textField("ratingPercent", "自评（0 至 100）", row.ratingPercent ?? (row.rating == null ? 60 : Number(row.rating) * 20), "number", 'min="0" max="100"')}${area("notes", "这次哪里更好了？下次想改进什么？", row.notes)}</div><h3 class="subhead">本次题目</h3>${(row.questionIds || []).map((id) => `<div class="row"><button type="button" class="row-title" data-action="edit" data-kind="questions" data-id="${esc(id)}">${esc(get("questions", id)?.text)}</button></div>`).join("") || '<p class="trace">本次为自由表达训练。</p>'}${row.scriptId ? `<p class="trace">使用底稿：${esc(get("scripts", row.scriptId)?.title)}</p>` : ""}<h3 class="subhead">录音回放</h3>${attachmentsHTML(row.attachmentIds) || '<p class="trace">本次未保存录音。</p>'}`;
  return "";
}

function editComposition(action, data) {
  if (!editor || !["questions", "scripts"].includes(editor.kind)) return;
  const patch = collectEditor();
  if (patch) Object.assign(editor.row, patch);
  const contentKey = editor.kind === "questions" ? "answer" : "content";
  let row;
  if (action === "composition-add") {
    const card = get("contentCards", data.card);
    if (!card) throw new Error("此内容卡片已不存在，请重新选择。");
    row = appendCardComposition(editor.row, card, contentKey);
  } else if (action === "composition-remove") {
    const parts = editor.row.composition || [];
    const index = parts.findIndex((part) => part.id === data.part);
    if (index < 0) return;
    editor.undoParts ||= [];
    editor.undoParts.push({ part: structuredClone(parts[index]), index });
    row = removeCompositionPart(editor.row, data.part, contentKey);
  } else if (action === "composition-undo") {
    const removed = editor.undoParts?.pop();
    if (!removed) return;
    row = structuredClone(editor.row);
    if (!row.composition?.length && row[contentKey])
      row.composition = [{ id: uid(), sourceCardId: null, title: "手写内容", text: row[contentKey] }];
    row.composition ||= [];
    if (!row.composition.some((part) => part.id === removed.part.id)) row.composition.splice(Math.min(removed.index, row.composition.length), 0, removed.part);
    row[contentKey] = row.composition.map((part) => part.text).join("\n\n");
  } else {
    const parts = editor.row.composition || [];
    const index = parts.findIndex((part) => part.id === data.part);
    if (index < 0) return;
    const before = action === "composition-up" ? parts[index - 1]?.id : parts[index + 2]?.id || null;
    if (action === "composition-up" && index === 0 || action === "composition-down" && index === parts.length - 1) return;
    row = moveCompositionPart(editor.row, data.part, before, contentKey);
  }
  editor.row = row;
  refreshEditor();
  flushEditor();
}

let tagDrag = null;
let suppressTagClickUntil = 0;
let suppressedTagClick = null;
function cancelTagDrag() {
  const drag = tagDrag;
  tagDrag = null;
  if (!drag) return;
  clearTimeout(drag.timer);
  drag.ghost?.remove();
  document.querySelectorAll(".is-tag-dragging,.is-tag-target").forEach((el) => el.classList.remove("is-tag-dragging", "is-tag-target"));
  if (drag.element.hasPointerCapture?.(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
}
async function saveTagPosition(drag, before) {
  if (workspaceBusy || switchingWorkspace || drag.workspace !== activeWorkspace || drag.state !== state ||
      drag.scope === "composer" && drag.editorId !== editor?.id) return;
  if (editor && !flushEditor(true)) return;
  const saved = (state.settings.contentCardTagOrder || []).map((tag) => tag.trim());
  const order = [...saved, ...orderedCardTags(state.contentCards || [], saved).filter((tag) => !saved.includes(tag))];
  const next = reorderCardTag(order, drag.tag, before);
  if (JSON.stringify(saved) === JSON.stringify(next)) return;
  state.settings.contentCardTagOrder = next;
  await persist();
  if (drag.workspace !== activeWorkspace || drag.scope === "composer" && drag.editorId !== editor?.id) return;
  if (editor) refreshCardLibrary();
  else if (route === "knowledge") render();
}
function refreshCardLibrary() {
  const current = $("#editor-dialog .composition-library");
  if (!editor || !current) return;
  const template = document.createElement("template");
  template.innerHTML = compositionEditor(editor.row, editor.kind === "questions" ? "answer" : "content", state.contentCards || [], {
    esc, icon, btn, area, tagOrder: state.settings.contentCardTagOrder || [], selectedTag: editor.cardTag || null, undoParts: editor.undoParts || [],
  });
  current.replaceWith(template.content.querySelector(".composition-library"));
}
document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("[data-sort-tag]");
  if (!button || !event.isPrimary || event.button !== 0 || workspaceBusy || switchingWorkspace) return;
  cancelTagDrag();
  const drag = { element: button, pointerId: event.pointerId, tag: button.dataset.sortTag, scope: button.dataset.scope,
    workspace: activeWorkspace, state, editorId: editor?.id, x: event.clientX, y: event.clientY, dragging: false, changed: false };
  tagDrag = drag;
  drag.timer = setTimeout(() => {
    if (tagDrag !== drag || drag.workspace !== activeWorkspace || drag.state !== state || !button.isConnected) return;
    drag.dragging = true;
    button.classList.add("is-tag-dragging");
    button.setPointerCapture(event.pointerId);
    const ghost = document.createElement("div");
    ghost.className = "tag-drag-ghost";
    ghost.textContent = drag.tag;
    ghost.style.left = `${drag.x + 12}px`;
    ghost.style.top = `${drag.y + 12}px`;
    (button.closest("dialog") || document.body).append(ghost);
    drag.ghost = ghost;
  }, 350);
});
let agendaSwipe = null;
let suppressAgendaClickUntil = 0;
document.addEventListener("pointerdown", (event) => {
  const week = event.target.closest(".agenda-week");
  if (!week || !event.isPrimary || event.button !== 0 || workspaceBusy || switchingWorkspace) return;
  agendaSwipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
});
document.addEventListener("pointerup", (event) => {
  const swipe = agendaSwipe;
  if (!swipe || swipe.pointerId !== event.pointerId) return;
  agendaSwipe = null;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
  if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
  suppressAgendaClickUntil = performance.now() + 500;
  shiftAgendaWeek(dx < 0 ? 7 : -7);
});
document.addEventListener("pointercancel", () => { agendaSwipe = null; });
document.addEventListener("pointermove", (event) => {
  const drag = tagDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (!drag.dragging) {
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 9) cancelTagDrag();
    return;
  }
  event.preventDefault();
  drag.ghost.style.left = `${event.clientX + 12}px`;
  drag.ghost.style.top = `${event.clientY + 12}px`;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-sort-tag]");
  if (!target || target.dataset.scope !== drag.scope || target === drag.element) return;
  document.querySelectorAll(".is-tag-target").forEach((el) => el.classList.remove("is-tag-target"));
  target.classList.add("is-tag-target");
  const tags = [...target.closest(".card-tag-bar").querySelectorAll("[data-sort-tag]")].filter((el) => el.dataset.sortTag !== drag.tag);
  const index = tags.indexOf(target), rect = target.getBoundingClientRect();
  drag.before = event.clientX < rect.x + rect.width / 2 ? target.dataset.sortTag : tags[index + 1]?.dataset.sortTag || null;
  drag.changed = true;
});
document.addEventListener("pointerup", (event) => {
  const drag = tagDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (drag.dragging) {
    suppressTagClickUntil = performance.now() + 600;
    suppressedTagClick = { tag: drag.tag, scope: drag.scope };
  }
  cancelTagDrag();
  if (drag.dragging && drag.changed) saveTagPosition(drag, drag.before).catch((error) => toast(`标签排序未保存：${error.message}`));
});
document.addEventListener("pointercancel", cancelTagDrag);
document.addEventListener("contextmenu", (event) => {
  if (event.target.closest("[data-sort-tag]")) event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  const button = event.target.closest("[data-sort-tag]");
  if (!button || !event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const order = orderedCardTags(state.contentCards || [], state.settings.contentCardTagOrder || []);
  const index = order.indexOf(button.dataset.sortTag);
  const before = event.key === "ArrowLeft" ? order[index - 1] : order[index + 2] || null;
  if (event.key === "ArrowLeft" && index === 0 || event.key === "ArrowRight" && index === order.length - 1) return;
  saveTagPosition({ tag: button.dataset.sortTag, scope: button.dataset.scope, workspace: activeWorkspace, state, editorId: editor?.id }, before).catch((error) => toast(error.message));
});

let compositionDrag = null;
document.addEventListener("dragstart", (event) => {
  const source = event.target.closest("[data-content-card], [data-composition-part]");
  if (!source || !editor || workspaceBusy || !source.closest("#editor-dialog")) return;
  if (event.target.closest("textarea, input, button")) { event.preventDefault(); return; }
  compositionDrag = {
    type: source.hasAttribute("data-content-card") ? "card" : "part",
    id: source.dataset.contentCard || source.dataset.compositionPart,
    workspace: activeWorkspace,
    editorId: editor.id,
  };
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("application/x-nextround-composition", compositionDrag.id);
  source.classList.add("is-dragging");
});
document.addEventListener("dragover", (event) => {
  const target = event.target.closest("[data-composition-drop]");
  if (!target || !compositionDrag || !editor || compositionDrag.workspace !== activeWorkspace || compositionDrag.editorId !== editor.id || workspaceBusy) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = compositionDrag.type === "card" ? "copy" : "move";
  target.classList.add("is-drag-over");
});
document.addEventListener("dragleave", (event) => {
  const target = event.target.closest("[data-composition-drop]");
  if (target && !target.contains(event.relatedTarget)) target.classList.remove("is-drag-over");
});
document.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-composition-drop]");
  const drag = compositionDrag;
  compositionDrag = null;
  document.querySelectorAll(".is-drag-over,.is-dragging").forEach((el) => el.classList.remove("is-drag-over", "is-dragging"));
  if (!target || !drag || !editor || workspaceBusy || switchingWorkspace || drag.workspace !== activeWorkspace || drag.editorId !== editor.id) return;
  event.preventDefault();
  try {
    const patch = collectEditor();
    if (patch) Object.assign(editor.row, patch);
    const contentKey = editor.kind === "questions" ? "answer" : "content";
    const before = target.dataset.compositionDrop || null;
    if (drag.type === "card") {
      const card = get("contentCards", drag.id);
      if (!card) throw new Error("此内容卡片已不存在，请重新选择。");
      editor.row = appendCardComposition(editor.row, card, contentKey);
      if (before) editor.row = moveCompositionPart(editor.row, editor.row.composition.at(-1).id, before, contentKey);
    } else editor.row = moveCompositionPart(editor.row, drag.id, before, contentKey);
    refreshEditor();
    flushEditor();
  } catch (error) { toast(error.message); }
});
document.addEventListener("dragend", () => {
  compositionDrag = null;
  document.querySelectorAll(".is-drag-over,.is-dragging").forEach((el) => el.classList.remove("is-drag-over", "is-dragging"));
});

function actualQuestionHTML(q, i) {
  return `<section class="editor-section" data-actual-index="${i}"><div class="form-stack"><label>问题 ${i + 1}<input name="actual-${i}-text" value="${esc(q.text)}" placeholder="面试官问了什么？"></label><label>现场回答<textarea name="actual-${i}-answer">${esc(q.answer)}</textarea></label><label>优化版回答<textarea name="actual-${i}-improved">${esc(q.improved)}</textarea></label><label>关联题库<select name="actual-${i}-questionId">${opts(state.questions, q.questionId, "text", "尚未入库")}</select></label></div><div class="button-row" style="margin-top:12px">${btn(q.questionId ? "更新题库回答并保留版本" : "并入题库 / 自动去重", "merge-question", "small secondary", `data-index="${i}"`)}</div></section>`;
}
function openEditor(kind, id = "", defaults = {}) {
  if (switchingWorkspace) return;
  closeHelpTips();
  if (editor) {
    if (!flushEditor(true)) return;
    $("#editor-dialog")?.close();
    $("#editor-dialog")?.remove();
    editor = null;
  }
  const existing = get(kind, id);
  if (kind === "interviews" && !state.companies.length) {
    toast("先添加岗位并填写公司或招录单位名称，再记录面试。");
    openEditor("jobs");
    return;
  }
  if (kind === "interviews" && !state.jobs.length) {
    toast("先为单位添加岗位或招录职位，再记录面试。");
    openEditor("jobs");
    return;
  }
  const row = existing
    ? structuredClone(existing)
    : touch({ id: uid() }, defaults);
  if (kind === "interviews" && !existing) {
    row.companyId = defaults.companyId || state.companies[0]?.id;
    row.jobId =
      defaults.jobId ||
      state.jobs.find((j) => j.companyId === row.companyId)?.id ||
      "";
    row.questions = [];
    row.attachmentIds = [];
    row.status = "已完成";
  }
  if (kind === "jobs" && !existing)
    row.companyId = defaults.companyId || "";
  editor = {
    workspace: activeWorkspace,
    kind,
    id: row.id,
    row,
    isNew: !existing,
    baseline: structuredClone(row),
    historyAdded: false,
    undoParts: [],
    cardTag: null,
    saved: false,
  };
  const d = document.createElement("dialog");
  d.id = "editor-dialog";
  d.className = "sheet";
  d.innerHTML = `<header class="sheet-header"><div><h2>${existing ? "编辑" : "新增"}${types[kind] || "记录"}</h2><p class="auto-status">${existing ? "修改将自动保存" : "填写必填信息后自动保存"}</p></div><button type="button" class="icon-btn" data-action="close-editor" aria-label="关闭编辑器">${icon("close")}</button></header><form id="entity-form"><div class="sheet-content">${editorHTML(kind, row, !existing)}<p id="form-error" data-form-error tabindex="-1" class="trace" role="alert"></p></div><footer class="sheet-footer"><span class="auto-status">${existing ? "已保存到本机" : "填写必填信息后自动保存"}</span>${btn("删除", "trash-record", "small danger")}<button type="submit" class="btn">${icon("check")}完成</button></footer></form>`;
  document.body.append(d);
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeEditor();
  });
  showUiDialog(d, "input:not([type=hidden]),textarea,select");
}
function collectEditor() {
  if (!editor) return null;
  const form = $("#entity-form");
  if (!form) return null;
  const fd = new FormData(form);
  const p = {};
  for (const [k, v] of fd) {
    if (
      !k.startsWith("actual-") &&
      !k.startsWith("rating-") &&
      !k.startsWith("jobTag") &&
      !["tagText", "tagRules"].includes(k)
    )
      p[k] = String(v);
  }
  const { kind } = editor;
  for (const key of [
    "salaryMonthly",
    "salaryMin",
    "salaryMax",
    "months",
    "hoursWeek",
    "duration",
    "rating",
    "ratingPercent",
    "examYear",
    "writtenScore",
    "interviewScore",
    "finalScore",
    "rank",
    "vacancies",
  ])
    if (fd.has(key)) {
      const raw = fd.get(key);
      p[key] = raw === "" ? null : Number(raw);
      if (p[key] !== null && (!Number.isFinite(p[key]) || p[key] < 0))
        throw new Error("数字必须为有效的非负数");
    }
  if (
    kind === "sessions" &&
    p.ratingPercent !== null &&
    p.ratingPercent > 100
  )
    throw new Error("自评范围为 0 至 100");
  if (kind === "jobs" && (p.salaryMin == null) !== (p.salaryMax == null))
    throw new Error("请同时填写月薪上下限");
  if (kind === "jobs" && p.salaryMin != null && p.salaryMax != null && p.salaryMax < p.salaryMin)
    throw new Error("月薪上限不能低于下限");
  if (kind === "jobs") p.salaryMonthly = null;
  if (fd.has("tagText"))
    p.tags = String(fd.get("tagText"))
      .split(/[,，\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  if (kind === "questions" && !p.difficulty && editor.row.difficulty) p.difficulty = editor.row.difficulty;
  if (kind === "jobs") {
    p.tags = parseEditableJobTags(fd, editableJobTags(editor.row), uid);
    p.conditionTagsMigrated = true;
  }
  if (["companies", "jobs"].includes(kind)) {
    const publicMode =
      kind === "companies"
        ? p.kind === "public"
        : isPublicJob(p, get("companies", p.companyId));
    const dims = publicMode
      ? state.settings.publicDimensions || DEFAULT_PUBLIC_DIMENSIONS
      : state.settings.dimensions;
    p.ratings = { ...editor.row.ratings };
    let hasRating = false;
    for (const dim of dims) {
      const raw = fd.get("rating-" + dim.id);
      if (raw !== null && raw !== "") {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > 10)
          throw new Error("评分范围为 0 至 10");
        p.ratings[dim.id] = n;
        hasRating = true;
      }
    }
    if (kind === "jobs" && !hasRating && !editor.row.ratings) delete p.ratings;
    if (kind === "companies")
      p.tags = String(fd.get("tagRules") || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [name, color, weight, veto] = s
            .split(/[,，]/)
            .map((v) => v.trim());
          if (
            !name ||
            !["green", "red", "yellow", "blue"].includes(color) ||
            (weight !== undefined && (!Number.isFinite(Number(weight)) || Number(weight) < 0))
          )
            throw new Error(
              "标签格式：名称, green/red/yellow/blue, 非负分值（可选）, veto（可选）",
            );
          const existing = (editor.row.tags || []).find((tag) => tag.name === name);
          if (existing?.id) return { ...existing, name, color, ...(weight === undefined ? {} : { weight: Number(weight) }), ...(existing.veto !== undefined || veto ? { veto: color === "red" && veto === "veto" } : {}) };
          if (weight === undefined) return { id: uid(), name, color, ...(veto ? { veto: color === "red" && veto === "veto" } : {}) };
          if (!["red", "green"].includes(color)) return { id: uid(), name, color, weight: Number(weight), veto: false };
          return { name, color, weight: Number(weight), veto: color === "red" && veto === "veto" };
        });
  }
  if (kind === "interviews") {
    p.questions = [];
    for (const el of form.querySelectorAll("[data-actual-index]")) {
      const i = Number(el.dataset.actualIndex),
        previous = editor.row.questions?.[i] || {};
      p.questions.push({
        ...previous,
        id: previous.id || uid(),
        text: String(fd.get(`actual-${i}-text`) || ""),
        answer: String(fd.get(`actual-${i}-answer`) || ""),
        improved: String(fd.get(`actual-${i}-improved`) || ""),
        questionId: String(fd.get(`actual-${i}-questionId`) || ""),
      });
    }
    if (
      p.companyId &&
      p.jobId &&
      get("jobs", p.jobId)?.companyId !== p.companyId
    )
      p.jobId = "";
  }
  if (["questions", "scripts"].includes(kind)) p.composition = structuredClone(editor.row.composition || []);
  return p;
}
function hasInterviewDraftDetails(row, baseline) {
  const textFields = ["scheduledAt", "interviewer", "meeting", "transcript", "strengths", "weaknesses", "feedback", "notes"];
  return textFields.some((field) => String(row[field] || "").trim()) ||
    (row.questions || []).some((question) => ["text", "answer", "improved"].some((field) => String(question[field] || "").trim())) ||
    String(row.round || "第一轮").trim() !== "第一轮" ||
    row.status !== "待确认" ||
    row.companyId !== baseline.companyId ||
    row.jobId !== baseline.jobId ||
    row.format !== (isPublicJob(get("jobs", row.jobId), get("companies", row.companyId)) ? "结构化面试" : "视频面试");
}
function flushEditor(showError = false) {
  clearTimeout(editTimeout);
  if (!editor) return true;
  if (editor.workspace !== activeWorkspace) {
    if (showError) toast("编辑器所属档案已变化，请关闭后在当前档案重新打开记录。");
    return false;
  }
  try {
    const p = collectEditor();
    if (!p) return true;
    const { kind, id, baseline } = editor;
    const requiredName = {
      companies: "name",
      jobs: "title",
      questions: "text",
      scripts: "title",
      contentCards: "title",
    }[kind];
    if (requiredName && !p[requiredName]?.trim()) {
      if (showError && !editor.isNew) throw fieldError("名称不能为空", requiredName);
      if (showError && editor.isNew) {
        toast("尚未填写名称，空白草稿未加入档案。");
        return true;
      }
      return false;
    }
    let newCompany = null;
    if (kind === "jobs") {
      const enteredName = String(p.companyName || "").trim();
      if (!enteredName) {
        if (showError) throw fieldError("请填写公司或招录单位名称", "companyName");
        return false;
      }
      const selected = get("companies", p.companyId);
      const company = selected?.name === enteredName ? selected : state.companies.find((row) => row.name === enteredName && (row.kind === "public") === (p.track !== "enterprise"));
      if (company) p.companyId = company.id;
      else {
        newCompany = touch({ id: uid() }, { name: enteredName, kind: p.track === "enterprise" ? "enterprise" : "public", tags: [] });
        p.companyId = newCompany.id;
      }
      p.companyName = enteredName;
    }
    if (kind === "interviews" && !p.companyId) {
      if (showError) throw fieldError("请选择所属单位", "companyId");
      return false;
    }
    if (kind === "interviews" && !p.jobId) {
      if (showError) throw fieldError("请选择此单位的岗位", "jobId");
      return false;
    }
    if (kind === "questions" && editor.isNew && !QUESTION_DIFFICULTIES.includes(p.difficulty)) {
      if (showError) throw fieldError("请选择题目难度：天堂、人间或地狱", "difficulty");
      return false;
    }
    if (kind === "interviews" && editor.isNew && !editor.saved && !p.round?.trim() && !p.scheduledAt) {
      if (showError) toast("请填写面试轮次和时间；空白面试未加入档案。");
      return true;
    }
    if (kind === "interviews" && editor.isNew && (!p.round?.trim() || !p.scheduledAt)) {
      if (showError) throw fieldError("面试轮次与时间均为必填", ["round", "scheduledAt"].filter(name => !p[name]));
      return false;
    }
    const previous = get(kind, id) || editor.row;
    if (
      kind === "jobs" &&
      previous.companyId &&
      previous.companyId !== p.companyId &&
      (state.interviews.some((i) => i.jobId === id) ||
        state.sessions.some((i) => i.jobId === id))
    )
      throw new Error(
        "此岗位已关联面试或训练，请为另一个单位新建岗位以保留原始关联。",
      );
    if (kind === "scripts") p.history = [];
    if (kind === "questions") {
      const contentKey = "answer";
      if (
        !editor.isNew &&
        !editor.historyAdded &&
        (p[contentKey] !== baseline[contentKey] ||
          (kind === "questions" && p.text !== baseline.text) ||
          (kind === "scripts" && p.title !== baseline.title))
      ) {
        p.history = [
          ...(previous.history || []),
          {
            at: baseline.updatedAt,
            content: baseline.content || "",
            answer: baseline.answer || "",
            text: baseline.text || "",
            title: baseline.title || "",
            versionName: baseline.versionName || "历史版本",
            composition: structuredClone(baseline.composition || []),
          },
        ];
        editor.historyAdded = true;
      }
    }
    if (kind === "questions" && !p.category)
      p.category =
        (state.settings.classifiers || []).find((r) =>
          r.keywords.some((k) => `${p.text} ${p.answer}`.includes(k)),
        )?.name || "未分类";
    if (
      kind === "jobs" &&
      (previous.status !== p.status || !previous.history?.length)
    )
      p.history = [
        ...(previous.history || []),
        { at: new Date().toISOString(), status: p.status },
      ];
    if (kind === "questions") p.category = p.category || "未分类";
    const meaningful = Object.keys(p).some(
      (k) => JSON.stringify(previous[k]) !== JSON.stringify(p[k]),
    );
    if (!meaningful && get(kind, id)) {
      editor.saved = true;
      return true;
    }
    const row = touch(previous, p);
    const candidate = structuredClone(state);
    if (newCompany) candidate.companies.push(newCompany);
    const index = candidate[kind].findIndex((r) => r.id === id);
    if (index < 0) candidate[kind].push(row);
    else candidate[kind][index] = row;
    validateState(candidate);
    if (newCompany) state.companies.push(newCompany);
    if (!get(kind, id)) state[kind].push(row);
    else state[kind][state[kind].findIndex((r) => r.id === id)] = row;
    editor.row = structuredClone(row);
    editor.saved = true;
    if (kind === "interviews") {
      const j = get("jobs", row.jobId);
      if (j && ["关注", "沟通", "待面试"].includes(j.status)) {
        const status = row.status === "已完成" ? "面试中" : j.status;
        if (status !== j.status)
          update("jobs", j.id, {
            status,
            history: [
              ...(j.history || []),
              { at: new Date().toISOString(), status },
            ],
          });
      }
    }
    reportFormError($("#entity-form"));
    persist();
    return true;
  } catch (e) {
    reportFormError($("#entity-form"), e.message, e.fields || [], showError);
    if (showError) toast(e.message);
    return false;
  }
}
function closeEditor() {
  closeHelpTips();
  if (editor && editor.workspace !== activeWorkspace) {
    clearTimeout(editTimeout);
    editor = null;
  }
  // An incomplete new record has no persisted draft to protect; closing must
  // always be possible. A valid new record still gets its final autosave.
  if (editor?.isNew) flushEditor(false);
  else if (!flushEditor(true)) return;
  clearTimeout(editTimeout);
  const saved = editor?.saved;
  $("#editor-dialog")?.close();
  $("#editor-dialog")?.remove();
  editor = null;
  render();
  if (saved && saveError) toast("内容尚未成功写入，请前往设置导出备份。");
}
function refreshEditor() {
  if (!editor) return;
  const old = $(".sheet-content")?.scrollTop || 0;
  $(".sheet-content").innerHTML =
    editorHTML(editor.kind, editor.row, editor.isNew) +
    `<p id="form-error" data-form-error tabindex="-1" class="trace" role="alert"></p>`;
  $(".sheet-content").scrollTop = old;
}
async function mergeActual(index) {
  if (!flushEditor(true)) return;
  const q = editor.row.questions[index];
  if (!q.text.trim()) {
    toast("先填写问题原文。");
    return;
  }
  let target =
    get("questions", q.questionId) ||
    state.questions.find(
      (x) => x.text.replace(/\s/g, "") === q.text.replace(/\s/g, ""),
    );
  if (target) {
    const answer = q.improved || q.answer;
    if (answer && answer !== target.answer) {
      target = update("questions", target.id, {
        answer,
        composition: [],
        history: [
          ...(target.history || []),
          {
            at: target.updatedAt,
            answer: target.answer || "",
            text: target.text,
            composition: structuredClone(target.composition || []),
            versionName: target.versionName || "合并前",
          },
        ],
        versionName: "面试复盘优化",
      });
    }
  } else {
    const category =
      (state.settings.classifiers || []).find((r) =>
        r.keywords.some((k) => q.text.includes(k)),
      )?.name || "面试实录";
    target = create("questions", {
      text: q.text,
      answer: q.improved || q.answer,
      scope: isPublicJob(
        get("jobs", editor.row.jobId),
        get("companies", editor.row.companyId),
      )
        ? "public"
        : "enterprise",
      category,
      tags: [],
      history: [],
      versionName: "面试复盘",
      notes: `来自 ${companyName(editor.row.companyId)} · ${editor.row.round || "面试"}`,
    });
  }
  editor.row.questions[index].questionId = target.id;
  update("interviews", editor.id, { questions: editor.row.questions });
  await persist();
  refreshEditor();
  toast("已关联题库；相同问题复用原 ID，回答历史已保留。");
}
async function toggleRecording() {
  if (train.recording) {
    await stopRecording();
    render();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast("当前环境不支持录音，请在 localhost 或 HTTPS 的现代浏览器使用。");
    return;
  }
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    verifyWorkspaceTask(task);
    recordChunks = [];
    recorder = new MediaRecorder(recordStream);
    recordPromise = new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) recordChunks.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(recordChunks, {
            type: recorder.mimeType || "audio/webm",
          });
          const data = await readDataURL(blob);
          const a = create("attachments", {
            name: `训练录音-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${blob.type.includes("mp4") ? "m4a" : "webm"}`,
            mime: blob.type,
            data,
          });
          train.attachmentIds.push(a.id);
          recordStream?.getTracks().forEach((t) => t.stop());
          train.recording = false;
          setRecordingActive(false);
          state.settings.trainingDraft = {
            attachmentIds: [...train.attachmentIds],
            title: "未完成的训练录音",
          };
          await persist();
          resolve(a.id);
        } catch (e) {
          recordStream?.getTracks().forEach((t) => t.stop());
          train.recording = false;
          setRecordingActive(false);
          reject(e);
        }
      };
      recorder.onerror = (e) => {
        recordStream?.getTracks().forEach((t) => t.stop());
        train.recording = false;
        setRecordingActive(false);
        reject(e.error || new Error("录音意外停止"));
      };
    });
    recordPromise.catch((e) => toast(`录音保存失败：${e.message}`));
    recorder.start(1000);
    setRecordingActive(true);
    train.recording = true;
    if (!train.running) {
      train.started = performance.now();
      train.running = true;
      trainingStartedAt ||= new Date().toISOString();
    }
    render();
  } catch (e) {
    recordStream?.getTracks().forEach((t) => t.stop());
    setRecordingActive(false);
    toast(
      `无法录音：${e.name === "NotAllowedError" ? "麦克风未授权，可以继续无录音训练。" : e.message}`,
    );
  } finally {
    endWorkspaceTask(task);
  }
}
function readDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}
async function stopRecording() {
  if (recorder?.state === "recording" || recorder?.state === "paused")
    recorder.stop();
  if (recordPromise) await recordPromise;
}
async function finishTraining() {
  const task = beginWorkspaceTask();
  if (!task) return;
  const duration = Math.round(elapsed());
  const completedAt = new Date().toISOString();
  // Freeze the completion instant before recording/queue/storage awaits.
  train.elapsed = duration;
  train.running = false;
  train.started = null;
  try {
    if (train.recording) await stopRecording();
    verifyWorkspaceTask(task);
    await saveQueue;
    verifyWorkspaceTask(task);
    if (duration === 0 && !train.attachmentIds.length) {
      toast("先开始训练，再留下您的复盘。");
      return;
    }
    const questionIds = [
      ...new Set([
        ...train.answered,
        ...(train.questionId ? [train.questionId] : []),
      ]),
    ];
    const title =
      train.mode === "questions"
        ? "模拟面试"
        : train.mode === "self"
          ? "自我介绍训练"
          : "项目介绍训练";
    const session = touch({ id: uid() }, {
      title,
      duration,
      ratingPercent: train.ratingPercent,
      notes: "",
      companyId: train.companyId,
      jobId: train.jobId,
      questionIds: train.mode === "questions" ? questionIds : [],
      scriptId:
        train.mode === "self" || train.mode === "project" ? train.scriptId : "",
      attachmentIds: [...train.attachmentIds],
      startedAt: trainingStartedAt || completedAt,
      endedAt: completedAt,
    });
    // Commit a candidate before releasing the training draft or its workspace lease.
    const candidate = structuredClone(state);
    candidate.sessions.push(session);
    delete candidate.settings.trainingDraft;
    await saveState(candidate, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = candidate;
    train.elapsed = 0;
    train.running = false;
    train.started = null;
    train.answered = [];
    train.attachmentIds = [];
    trainingStartedAt = null;
    saveError = false;
    render();
    openEditor("sessions", session.id);
    toast("训练已保存，可以补充自评和改进方向。");
  } catch (e) {
    if (task.workspace === activeWorkspace && task.state === state) {
      saveError = true;
      setSave(saveLabel());
    }
    toast(`训练保存未完成：${e.message}。请保留训练内容，重试或先导出备份。`);
  } finally {
    endWorkspaceTask(task);
  }
}

function beginWorkspaceTask() {
  if (workspaceBusy || switchingWorkspace) {
    toast("请等待当前文件操作完成。");
    return null;
  }
  const task = { workspace: activeWorkspace, state };
  workspaceBusy = task;
  document.querySelector("#app").inert = true;
  document.querySelector("#app").setAttribute("aria-busy", "true");
  return task;
}
function verifyWorkspaceTask(task) {
  if (
    workspaceBusy !== task ||
    task.workspace !== activeWorkspace ||
    task.state !== state
  )
    throw new Error("档案空间已变化，本次操作已取消。");
}
function endWorkspaceTask(task) {
  if (workspaceBusy !== task) return;
  workspaceBusy = false;
  document.querySelector("#app").inert = false;
  document.querySelector("#app").removeAttribute("aria-busy");
}
async function uploadAttachments(files) {
  if (
    workspaceBusy ||
    switchingWorkspace ||
    !editor ||
    editor.kind !== "interviews"
  )
    return;
  if (!flushEditor(true) || !editor.saved) {
    toast("先完成单位与岗位信息。");
    return;
  }
  const interviewId = editor.id,
    task = beginWorkspaceTask();
  if (!task) return;
  try {
    for (const file of files) {
      if (file.size > 30 * 1024 * 1024) {
        toast(`${file.name} 超过 30 MB，请先压缩。`);
        continue;
      }
      const data = await readDataURL(file);
      verifyWorkspaceTask(task);
      const interview = get("interviews", interviewId);
      if (!interview) throw new Error("原面试记录已变化，附件未写入。");
      const attachment = create("attachments", {
        name: file.name,
        mime: file.type || "application/octet-stream",
        data,
      });
      const attachmentIds = [...(interview.attachmentIds || []), attachment.id];
      update("interviews", interviewId, { attachmentIds });
      if (editor?.kind === "interviews" && editor.id === interviewId)
        editor.row.attachmentIds = attachmentIds;
      await persist();
    }
    if (editor?.kind === "interviews" && editor.id === interviewId)
      refreshEditor();
    toast("附件已保存到本机。");
  } finally {
    endWorkspaceTask(task);
  }
}
async function exportAll() {
  if (workspaceBusy || switchingWorkspace) {
    toast("请等待当前文件操作完成。");
    return;
  }
  if (editor && !flushEditor(true)) return;
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    const snapshot = structuredClone(state);
    snapshot.settings.lastBackup = new Date().toISOString();
    const blob = exportBackup(snapshot, { workspace: task.workspace });
    download(
      blob,
      `nextround-${task.workspace}-backup-${new Date().toLocaleDateString("en-CA")}.json`,
    );
    verifyWorkspaceTask(task);
    state.settings.lastBackup = snapshot.settings.lastBackup;
    await persist();
    if (route === "settings") render();
    toast("备份已发起下载，请确认文件已保存。");
  } catch (e) {
    toast(`无法导出：${e.message}`);
  } finally {
    endWorkspaceTask(task);
  }
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function importAll(file, mode = "merge") {
  if (workspaceBusy || switchingWorkspace) {
    toast("请等待当前文件操作完成。");
    return;
  }
  if (trainingLocked()) {
    toast("请先结束本次训练，再导入档案。");
    return;
  }
  if (editor && !flushEditor(true)) return;
  if (editor) closeEditor();
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    const merged = await importBackup(file, state, {
      workspace: task.workspace,
      mode,
    });
    verifyWorkspaceTask(task);
    if (mode === "replace" && !window.confirm(
      `替换导入到${spaceTitle()}？\n\n文件：${file.name || "所选备份"}\n将导入 ${merged.report.added} 条记录（含附件）。\n当前空间的全部记录、附件、设置、冲突版本和垃圾箱将被替换，无法撤销。建议先导出完整备份。\n另一空间不受影响。`,
    )) return;
    verifyWorkspaceTask(task);
    await saveState(merged.state, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = merged.state;
    saveError = false;
    if (mode === "replace") {
      Object.assign(train, { companyId: "", jobId: "", questionId: "", scriptId: "", queue: [], answered: [], attachmentIds: [...(state.settings.trainingDraft?.attachmentIds || [])], elapsed: 0, started: null });
      Object.assign(view, { company: "", job: "", search: "", category: "" });
    }
    render();
    toast(mode === "replace" ? "替换导入完成，当前空间已使用备份中的完整数据。" :
      `增量导入完成：新增 ${merged.report.added}，保留冲突 ${merged.report.conflicts}。`,
    );
  } catch (e) {
    toast(`导入未写入：${e.message}`);
  } finally {
    endWorkspaceTask(task);
  }
}
async function importJobsV4(file) {
  if (workspaceBusy || switchingWorkspace) return toast("请等待当前文件操作完成。");
  if (trainingLocked()) return toast("请先结束本次训练，再导入岗位。");
  if (editor && !flushEditor(true)) return;
  if (editor) closeEditor();
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    const content = await file.text();
    const merged = mergeV4Import(content, state);
    verifyWorkspaceTask(task);
    await saveState(merged.state, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = merged.state;
    saveError = false;
    render();
    toast(`岗位导入完成：新增 ${merged.report.added}，已有 ${merged.report.unchanged}，冲突 ${merged.report.conflicts}。`);
  } catch (error) {
    toast(`岗位未导入：${error.message}`);
  } finally {
    endWorkspaceTask(task);
  }
}
const unifiedStatusLabels = { new: "待新增", duplicate: "重复跳过", conflict: "内容冲突", invalid: "待补充 / 无效", excluded: "本次排除" };
function closeUnifiedPreview() {
  const dialog = document.querySelector("#unified-import-dialog");
  if (dialog?.open) dialog.close();
  dialog?.remove();
  unifiedImportDraft = null;
}
function renderUnifiedPreview() {
  const focused = rememberUiFocus();
  const draft = unifiedImportDraft;
  if (!draft) return;
  const preview = previewUnifiedImport(draft.parsed, state, draft.options);
  draft.preview = preview;
  let dialog = document.querySelector("#unified-import-dialog");
  const fresh = !dialog;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "unified-import-dialog";
    dialog.className = "sheet unified-import-sheet";
    document.body.append(dialog);
    dialog.addEventListener("close", () => { if (unifiedImportDraft === draft) unifiedImportDraft = null; dialog.remove(); });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeUnifiedPreview(); });
  }
  const moduleCards = preview.modules.map((module) => `<label class="unified-module${draft.entry === module.id ? " is-entry" : ""}"><input type="checkbox" data-unified-module="${module.id}" ${module.selected ? "checked" : ""}><span><strong>${esc(module.label)}</strong><small>${module.total} 条 · 新增 ${module.added} · 重复 ${module.unchanged} · 冲突 ${module.conflicts} · 待补充 ${module.invalid}</small></span></label>`).join("");
  const rows = preview.rows.map((row) => `<article class="unified-row unified-${row.status}"><label class="unified-row-head"><input type="checkbox" data-unified-row="${esc(row.key)}" ${row.selected ? "checked" : ""}><span><strong>${esc(row.title)}</strong><small>${esc(preview.modules.find(module => module.id === row.module)?.label)} · ${esc(unifiedStatusLabels[row.status])}${row.records.length > 1 ? ` · ${row.records.length} 个独立版本` : ""}</small></span></label>${row.status === "conflict" ? `<label class="unified-decision">同 ID 内容不同<select data-unified-decision="${esc(row.key)}"><option value="skip" ${row.decision !== "update" ? "selected" : ""}>保留本机，跳过</option><option value="update" ${row.decision === "update" ? "selected" : ""}>采用导入版，保留旧快照</option></select></label>` : ""}${row.issues.length || row.warnings.length ? `<ul>${[...row.issues.map(message => `<li class="unified-error">${esc(message)}</li>`), ...row.warnings.map(message => `<li>${esc(message)}</li>`)].join("")}</ul>` : ""}</article>`).join("");
  dialog.innerHTML = `<header class="sheet-header"><div><h2>导入 JSON · 先预览</h2><p class="auto-status">${esc(draft.fileName)} · ${esc(preview.schemaVersion)} · 当前${spaceTitle()}</p></div><button type="button" class="icon-btn" data-action="close-unified-import" aria-label="关闭导入预览">${icon("close")}</button></header><div class="sheet-content"><p class="muted">仅导入勾选的模块与条目；空数组不会清空本机记录。冲突默认保留本机。内容只在当前设备处理。</p><div class="unified-modules">${moduleCards}</div><label class="unified-local-reference"><input type="checkbox" data-unified-local-references ${draft.options.confirmLocalReferences ? "checked" : ""}>确认将文件中的引用关联到本机已有公司或岗位</label>${preview.warnings?.length ? `<p class="trace">${preview.warnings.map(esc).join("；")}</p>` : ""}${preview.errors.length ? `<div class="unified-summary-error" role="alert">${preview.errors.length} 项需要修正或取消勾选。未确认前不会写入。</div>` : ""}<div class="unified-rows">${rows || '<p class="muted">文件中没有可导入的记录。</p>'}</div></div><footer class="sheet-footer"><span class="auto-status">待新增 ${preview.modules.reduce((sum, module) => sum + module.added, 0)} · 重复 ${preview.modules.reduce((sum, module) => sum + module.unchanged, 0)} · 冲突 ${preview.report.conflicts} · 待补充 ${preview.report.invalid}</span><button type="button" class="btn secondary" data-action="close-unified-import">取消</button><button type="button" class="btn" data-action="confirm-unified-import" ${preview.canImport ? "" : "disabled"}>确认导入</button></footer>`;
  if (fresh) showUiDialog(dialog, '[data-action="close-unified-import"]');
  else restoreUiFocus(focused, dialog);
}
async function prepareUnifiedImport(file, entry = "") {
  if (workspaceBusy || switchingWorkspace) return toast("请等待当前文件操作完成。");
  if (trainingLocked()) return toast("请先结束本次训练，再导入档案。");
  if (editor && !flushEditor(true)) return;
  if (editor) closeEditor();
  if (file.size > MAX_IMPORT_BYTES) return toast("JSON 文件超过 10 MB，请拆分后导入。");
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    const parsed = parseUnifiedImport(await file.text());
    verifyWorkspaceTask(task);
    unifiedImportDraft = { parsed, fileName: file.name || "所选 JSON", entry, workspace: task.workspace, baseline: state, options: { modules: [...UNIFIED_MODULES], excludedIds: [], decisions: {}, confirmLocalReferences: false } };
    renderUnifiedPreview();
  } catch (error) { toast(error.message); }
  finally { endWorkspaceTask(task); }
}
async function commitUnifiedImport() {
  const draft = unifiedImportDraft;
  if (!draft) return;
  if (draft.workspace !== activeWorkspace || draft.baseline !== state) return toast("档案已变化，请重新选择 JSON 预览。");
  const task = beginWorkspaceTask();
  if (!task) return;
  try {
    await saveQueue;
    verifyWorkspaceTask(task);
    const before = structuredClone(state);
    const merged = mergeUnifiedImport(draft.parsed, before, draft.options);
    verifyWorkspaceTask(task);
    await saveState(merged.state, { workspace: task.workspace });
    verifyWorkspaceTask(task);
    state = merged.state;
    saveError = false;
    closeUnifiedPreview();
    render();
    toast(`导入完成：新增 ${merged.report.added}，更新 ${merged.report.updated}，重复 ${merged.report.unchanged}，冲突跳过 ${merged.report.skipped}。`);
  } catch (error) { toast(`导入未写入：${error.message}`); }
  finally { endWorkspaceTask(task); }
}
function showTrace(ids, sessions = false) {
  if (editor && !flushEditor(true)) return;
  const rows = (sessions ? state.sessions : state.interviews).filter((i) =>
    ids.includes(i.id),
  );
  const d = document.createElement("dialog");
  d.className = "sheet";
  d.id = "trace-dialog";
  d.innerHTML = `<header class="sheet-header"><h2>统计来源 · 原始记录</h2><button type="button" class="icon-btn" data-action="close-trace" aria-label="关闭来源">${icon("close")}</button></header><div class="sheet-content">${rows.map((i) => `<div class="row"><div class="grow"><button type="button" class="row-title" data-action="trace-open" data-kind="${sessions ? "sessions" : "interviews"}" data-id="${esc(i.id)}">${esc(i.title || `${companyName(i.companyId)} · ${i.round || "面试"}`)}</button><p class="trace">${fmtDate(i.scheduledAt || i.createdAt, true)}</p>${sessions ? "" : `<p class="details-copy">${esc((i.questions || []).map((q) => q.text).join("\n"))}</p><p class="trace">优势：${esc(i.strengths || "未记录")}<br>${organizationKind(get("companies", i.companyId)) === "public" ? "自评待改进" : "明确指出的不足"}：${esc(i.weaknesses || "未记录")}<br>反馈：${esc(i.feedback || "未记录")}</p>`}</div></div>`).join("") || '<p class="muted">没有符合当前范围的记录。</p>'}</div>`;
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  showUiDialog(d, '[data-action="close-trace"]');
}
function createDemoState() {
  const demoState = blankState();
  const make = (id, p) => touch({ id: "demo-" + id }, p);
  const c1 = make("company-1", {
    name: "观山设计",
    industry: "数字产品与体验",
    location: "上海 · 徐汇",
    facts: "【演示】官网介绍：专注数字产品与品牌体验。",
    claims: "【演示】HR 表示团队双休、弹性工作。",
    assumptions: "【演示】团队规模较小，可能有较多跨职能协作。",
    focus: "项目管理、沟通、用户体验",
    strengths: "【演示】面试官认可案例表达清晰。",
    weaknesses: "",
    ratings: { salary: 8, balance: 8.5, growth: 9 },
    tags: [
      { name: "双休", color: "green", weight: 3, veto: false },
      { name: "通勤适中", color: "green", weight: 2, veto: false },
    ],
    decision: "优先选择",
    decisionNotes: "【演示】继续了解团队合作方式。",
  });
  const c2 = make("company-2", {
    name: "青禾科技",
    industry: "生活方式与科技",
    location: "上海 · 浦东",
    facts: "【演示】产品聚焦日常生活服务。",
    claims: "【演示】每年 14 薪，需结合 Offer 确认。",
    focus: "数据分析、跨团队协作",
    ratings: { salary: 9, balance: 6, growth: 8 },
    tags: [
      { name: "薪酬有竞争力", color: "green", weight: 4, veto: false },
      { name: "通勤较远", color: "red", weight: 5, veto: false },
    ],
    decision: "还在考虑",
  });
  demoState.companies = [c1, c2];
  demoState.jobs = [
    make("job-1", {
      companyId: c1.id,
      title: "高级产品设计师",
      status: "待面试",
      jd: "【演示】关注用户体验，具备项目管理能力与跨团队沟通经验。",
      salaryMonthly: 25000,
      months: 13,
      hoursWeek: 40,
      schedule: "10:00–19:00 · 双休",
      benefits: "【演示】社保公积金基数待确认。",
      history: [{ at: new Date().toISOString(), status: "待面试" }],
    }),
    make("job-2", {
      companyId: c2.id,
      title: "体验设计师",
      status: "Offer",
      jd: "【演示】关注数据分析、用户体验和跨团队协作。",
      salaryMonthly: 28000,
      months: 14,
      hoursWeek: 45,
      offerNotes: "【演示】等待核对薪酬构成与入职时间。",
    }),
  ];
  demoState.questions = [
    make("q-1", {
      text: "请介绍一个您推动落地的代表项目。",
      category: "项目经历",
      tags: ["项目管理", "用户体验"],
      answer:
        "先交代项目背景与目标，再说明自己负责的部分、关键决策和协作过程，最后回到结果与复盘。",
      history: [],
      versionName: "结构提纲",
    }),
    make("q-2", {
      text: "您如何处理跨团队意见不一致？",
      category: "协作沟通",
      tags: ["沟通"],
      answer:
        "用一个具体场景说明分歧来源，展示如何对齐目标、补充事实并推动协作。",
      history: [],
    }),
    make("q-3", {
      text: "为什么选择我们公司？",
      category: "求职动机",
      tags: ["职业规划"],
      answer: "从公司的实际业务、岗位需要和自己的经验出发，表达具体的连接点。",
      history: [],
    }),
    make("q-4", {
      text: "您如何衡量一次设计改进是否有效？",
      category: "专业能力",
      tags: ["数据分析", "用户体验"],
      answer: "区分目标、指标和观察周期；结合行为数据与用户反馈判断。",
      history: [],
    }),
  ];
  demoState.scripts = [
    make("script-1", {
      title: "90 秒 · 从经历到价值",
      type: "自我介绍",
      duration: 90,
      versionName: "简洁版",
      content:
        "您好，我想从三个部分介绍自己：\n\n我过去主要做什么，形成了怎样的专业能力。\n我最有代表性的项目是什么，在其中解决了什么问题。\n为什么希望加入这个团队，以及我的经验如何帮助这个岗位。\n\n【演示底稿】请替换成自己的真实经历与成果。",
      tags: ["沟通"],
    }),
    make("script-2", {
      title: "用一个项目，讲清自己的贡献",
      type: "项目介绍",
      duration: 180,
      versionName: "完整提纲",
      content:
        "【演示】背景与目标 → 用户体验问题 → 自己的职责 → 项目管理与关键行动 → 可验证的结果 → 复盘与改进。",
      tags: ["项目管理"],
    }),
  ];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 30, 0, 0);
  demoState.interviews = [
    make("interview-2", {
      companyId: c2.id,
      jobId: "demo-job-2",
      round: "第一轮 · 专业面",
      scheduledAt: new Date(Date.now() - 3 * 86400000)
        .toISOString()
        .slice(0, 16),
      format: "视频面试",
      status: "已完成",
      strengths: "【演示】能够清楚说明项目决策与跨团队沟通。",
      weaknesses: "【演示】数据分析案例可以补充具体指标。",
      feedback: "【演示】进入后续 Offer 沟通。",
      questions: [
        {
          id: "demo-actual-1",
          text: demoState.questions[0].text,
          questionId: "demo-q-1",
          answer: "【演示】介绍了项目背景与个人行动。",
          improved: "",
        },
        {
          id: "demo-actual-2",
          text: demoState.questions[3].text,
          questionId: "demo-q-4",
          answer: "【演示】提到用户反馈，指标还不够具体。",
          improved: "",
        },
      ],
      attachmentIds: [],
    }),
  ];
  demoState.scheduleItems = [make("interview-plan-1", {
    title: "第二轮 · 业务面",
    type: "interview",
    startsAt: tomorrow.toISOString(),
    companyId: c1.id,
    notes: "【演示】视频面试 · 设计负责人",
    completed: false,
  })];
  demoState.sessions = Array.from({ length: 4 }, (_, i) => {
    const date = new Date(Date.now() - (4 - i) * 86400000).toISOString();
    return {
      ...make(`session-${i}`, {
        title: i % 2 ? "自我介绍训练" : "模拟面试",
        duration: 180 + i * 75,
        rating: 3 + (i % 2),
        notes: "【演示】表达更清晰了，下次补充具体结果。",
        companyId: c1.id,
        jobId: "demo-job-1",
        questionIds: i % 2 ? [] : ["demo-q-1", "demo-q-2"],
        attachmentIds: [],
      }),
      createdAt: date,
    };
  });
  demoState.settings = {
    ...demoState.settings,
    keywords: ["用户体验", "项目管理", "沟通", "数据分析"],
    synonyms: { 沟通: ["跨团队协作", "表达"] },
    classifiers: [{ name: "项目经历", keywords: ["项目", "落地"] }],
    demo: true,
  };
  const publicUnit = make("public-unit", {
    name: "【演示】公共服务单位",
    kind: "public",
    location: "示例地区",
    facts: "【演示】用于展示招录职位与面试复盘，不对应实际公告。",
    ratings: { fit: 8, location: 7, stability: 8 },
  });
  demoState.companies.push(publicUnit);
  demoState.jobs.push(
    make("public-job", {
      companyId: publicUnit.id,
      title: "【演示】综合管理职位",
      track: "civil-service",
      status: "待面试",
      examName: "【演示】招录训练",
      examYear: new Date().getFullYear(),
      positionCode: "DEMO-001",
      vacancies: 2,
      jd: "【演示】组织协调、公共服务与沟通表达。",
      eligibility: "【演示】资格条件请按自己的材料填写。",
      interviewFormat: "结构化面试",
      writtenScore: 132.5,
      rank: 3,
    }),
  );
  demoState.questions.push(
    make("public-q", {
      text: "服务窗口出现排队争议，您会如何处理？",
      category: "应急应变",
      scope: "public",
      answer: "【演示】先识别现场风险与诉求，再组织分流、沟通与后续反馈。",
    }),
  );
  return demoState;
}
async function demo() {
  if (!(await switchWorkspace("demo"))) return;
  if (
    !state.companies.length &&
    !state.jobs.length &&
    !state.questions.length &&
    !state.sessions.length
  ) {
    state = createDemoState();
    await persist();
    render();
  }
  toast("已进入独立演示空间，正式档案不受影响。");
}

function saveAccentChoice() {
  try { saveAccentPrefs(accentPrefs); }
  catch { toast("颜色已在当前页面生效，但此浏览器未能保存偏好。"); }
}
function syncAccentSettings() {
  const panel = document.querySelector("[data-accent-panel]");
  if (!panel) return;
  const color = accentColorFor(accentPrefs, themeMode);
  const picker = panel.querySelector("[data-accent-picker]");
  const hex = panel.querySelector("[data-accent-hex]");
  if (picker) { picker.value = color; picker.setAttribute("aria-label", `打开调色板，设置${themeMode === "light" ? "开灯版" : "关灯版"}强调色`); }
  if (hex) { hex.value = color.toUpperCase(); hex.setAttribute("aria-label", `${themeMode === "light" ? "开灯版" : "关灯版"}强调色 HEX 代码`); }
  panel.querySelectorAll('[data-action="accent-mode"]').forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === themeMode)));
  const pin = panel.querySelector('[data-action="accent-pin"]');
  if (pin) {
    const count = accentPrefs.pinned.filter(Boolean).length;
    const exists = accentPrefs.pinned.includes(color);
    pin.disabled = exists || count === PINNED_ACCENT_COUNT;
    pin.textContent = exists ? "当前颜色已固定" : count === PINNED_ACCENT_COUNT ? "已固定 7 色" : "固定当前颜色";
  }
}
function setCurrentAccent(color) {
  const normalized = normalizeAccentColor(color);
  if (!normalized) return false;
  accentPrefs = { ...accentPrefs, [themeMode]: normalized };
  saveAccentChoice();
  applyAccentPrefs(accentPrefs, themeMode);
  syncAccentSettings();
  return true;
}
document.addEventListener("click", async (event) => {
  if (mobileNavOpen && event.target.closest(".sidebar .nav a[href]")) setMobileNavigation(false);
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const a = target.dataset.action;
  if (switchingWorkspace || workspaceBusy) {
    event.preventDefault();
    toast("请等待当前档案操作完成。");
    return;
  }
  if (a === "expand-brand-nav") {
    if (window.matchMedia("(max-width:780px)").matches && !mobileNavOpen) {
      event.preventDefault();
      setMobileNavigation(true);
      $(".shell-brand")?.focus();
      return;
    }
  }
  if (a === "toggle-nav") {
    setMobileNavigation(!mobileNavOpen);
    return;
  }
  try {
    if (a === "toggle-theme") {
      themeMode = themeMode === "dark" ? "light" : "dark";
      try { localStorage.setItem("nextround-theme", themeMode); } catch {}
      applyTheme();
      target.setAttribute("aria-label", themeMode === "light" ? "关灯，切换地狱主题" : "开灯，切换天堂主题");
      target.setAttribute("aria-pressed", String(themeMode === "light"));
      syncAccentSettings();
      return;
    }
    if (a === "accent-mode") {
      const mode = target.dataset.mode;
      if (!["light", "dark"].includes(mode)) return;
      themeMode = mode;
      try { localStorage.setItem("nextround-theme", themeMode); } catch {}
      applyTheme();
      syncAccentSettings();
      return;
    }
    if (a === "accent-reset") {
      accentPrefs = { ...accentPrefs, [themeMode]: null };
      saveAccentChoice();
      applyAccentPrefs(accentPrefs, themeMode);
      syncAccentSettings();
      return;
    }
    if (a === "accent-pin") {
      const result = pinAccent(accentPrefs, accentColorFor(accentPrefs, themeMode));
      if (result.status !== "added") { toast(result.status === "full" ? "最多可固定 7 个颜色，请先移除一个。" : "这个颜色已固定。"); return; }
      accentPrefs = result.prefs;
      saveAccentChoice();
      render();
      document.querySelector(`[data-action="accent-apply"][data-slot="${result.index}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (a === "accent-apply") {
      const color = accentPrefs.pinned[Number(target.dataset.slot)];
      if (color) { setCurrentAccent(color); render(); }
      return;
    }
    if (a === "accent-remove") {
      accentPrefs = unpinAccent(accentPrefs, Number(target.dataset.slot));
      saveAccentChoice();
      render();
      document.querySelector('[data-action="accent-pin"]')?.focus({ preventScroll: true });
      return;
    }
    if (a === "job-tag-add") {
      const list = target.closest("#entity-form")?.querySelector("[data-job-tag-list]");
      if (list) list.insertAdjacentHTML("beforeend", jobTagInputRow({}, esc));
      return;
    }
    if (a === "job-tag-remove") {
      target.closest("[data-job-tag-row]")?.remove();
      flushEditor();
      return;
    }
    if (
      ["train-mode", "company-train", "prep", "practice"].includes(a) &&
      trainingLocked()
    ) {
      toast("本次训练尚未结束，请先完成复盘；没有录音时也可暂停后重置。");
      return;
    }
    if (a === "open-formal") {
      event.preventDefault();
      return await switchWorkspace("formal");
    }
    if (a === "formal") return await switchWorkspace("formal");
    if (a === "clear-current-archive") return await clearCurrentArchive();
    if (a === "guide-copy") {
      const text = GUIDE_COMMANDS[target.dataset.guideCommand];
      if (!text) return;
      try { await navigator.clipboard.writeText(text); toast("指令已复制，可粘贴到您选择的 AI 对话中。"); }
      catch { window.prompt("复制指令，粘贴到您选择的 AI 对话中", text); }
      return;
    }
    if (a === "open-ai-settings") {
      view.settingsSection = "ai";
      if (route === "settings") render();
      else location.hash = "/settings";
      return;
    }
    if (a === "trash") return showTrash();
    if (a === "delete-conflict") {
      const conflict = state.conflicts.find((row) => row.id === target.dataset.id);
      if (!conflict || !window.confirm("删除这份保留的冲突版本？当前正式记录不会改变，此操作无法撤销。")) return;
      const candidate = structuredClone(state);
      candidate.conflicts = candidate.conflicts.filter((row) => row.id !== conflict.id);
      validateState(candidate);
      state = candidate;
      await persist();
      render();
      toast("冲突版本已删除，当前档案保持原样。");
      return;
    }
    if (a === "reset-opportunity-score") {
      const field = target.dataset.field;
      const id = target.dataset.jobId;
      if (!["personalIntent", "employerIntent"].includes(field) || !get("jobs", id)) return;
      const candidate = structuredClone(state);
      const row = candidate.jobs.find((job) => job.id === id);
      delete row[field];
      row.updatedAt = new Date().toISOString();
      row.revision++;
      validateState(candidate);
      state = candidate;
      await persist();
      render();
      return;
    }
    if (a === "close-trash") return $("#trash-dialog")?.close();
    if (a === "bulk-trash") return await trashSelected(target.dataset.kind);
    if (["trash-record", "trash-list-record", "restore-trash", "delete-trash", "empty-trash"].includes(a))
      return await changeTrash(a, target.dataset.id, target.dataset.kind);
    if (a === "decision-track") {
      view.decisionTrack = target.dataset.track;
      render();
      return;
    }
    if (a === "pipeline-track") {
      view.pipelineTrack = target.dataset.track;
      render();
      return;
    }
    if (a === "demo") return await demo();
    if (a === "agenda-new") return openAgendaDialog("", target.dataset.date || view.agendaDate);
    if (a === "agenda-edit") return openAgendaDialog(target.dataset.id);
    if (a === "agenda-close") return closeAgendaDialog();
    if (a === "agenda-delete") {
      await changeTrash("trash-list-record", target.dataset.id, "scheduleItems");
      if (!get("scheduleItems", target.dataset.id)) closeAgendaDialog();
      return;
    }
    if (a === "agenda-select-date" || a === "agenda-today" || a === "agenda-week") {
      if (a === "agenda-select-date" && performance.now() < suppressAgendaClickUntil) {
        event.preventDefault();
        return;
      }
      if (a === "agenda-week") return shiftAgendaWeek(Number(target.dataset.shift || 0));
      view.agendaDate = a === "agenda-select-date" ? target.dataset.date : agendaDateKey(new Date());
      view.agendaScrollTarget = view.agendaDate;
      render();
      return;
    }
    if (a === "agenda-open-link") {
      if (get(target.dataset.kind, target.dataset.id)) return openEditor(target.dataset.kind, target.dataset.id);
      toast("关联档案已不在当前空间，可编辑日程更新关联。");
      return;
    }
    if (a === "agenda-train") {
      const item = get("scheduleItems", target.dataset.id);
      if (!item) return;
      train.companyId = get("companies", item.companyId)?.id || "";
      train.jobId = state.jobs.find((job) => job.companyId === train.companyId)?.id || "";
      if (item.knowledgeKind === "questions" && get("questions", item.knowledgeId)) {
        train.mode = "questions"; train.questionId = item.knowledgeId; train.queue = [item.knowledgeId]; train.index = 0;
      } else if (item.knowledgeKind === "scripts" && get("scripts", item.knowledgeId)) {
        const script = get("scripts", item.knowledgeId);
        train.mode = script.type === "项目介绍" ? "project" : "self";
        train.scriptId = script.id; train.target = script.duration || 90;
      } else if (item.interviewId && get("interviews", item.interviewId)) {
        const interview = get("interviews", item.interviewId);
        train.mode = "prep"; train.companyId = interview.companyId; train.jobId = interview.jobId;
      } else train.mode = "questions";
      location.hash = "/train";
      return;
    }
    if (a === "edit") return openEditor(target.dataset.kind, target.dataset.id);
    if (a.startsWith("new-")) {
      const kind = {
        "new-job": "jobs",
        "new-question": "questions",
        "new-script": "scripts",
        "new-content-card": "contentCards",
        "new-interview": "interviews",
      }[a];
      if (kind)
        return openEditor(kind, "", {
          companyId: target.dataset.company || "",
        });
    }
    if (a === "manage-content-cards") {
      if (editor && !flushEditor(true)) return;
      if (editor) closeEditor();
      view.tab = "contentCards";
      view.search = "";
      view.category = "";
      if (route === "knowledge") render();
      else location.hash = "/knowledge";
      return;
    }
    if (a === "filter-card-tag") {
      if (performance.now() < suppressTagClickUntil && suppressedTagClick?.tag === target.dataset.tag && suppressedTagClick?.scope === target.dataset.scope) { event.preventDefault(); return; }
      if (target.dataset.scope === "composer" && editor) {
        const patch = collectEditor();
        if (patch) Object.assign(editor.row, patch);
        editor.cardTag = target.dataset.tag || null;
        refreshCardLibrary();
      } else {
        view.cardTag = target.dataset.tag || null;
        render();
      }
      return;
    }
    if (a.startsWith("composition-")) return editComposition(a, target.dataset);
    if (a === "close-editor") return closeEditor();
    if (a === "close-trace") {
      return $("#trace-dialog")?.close();
    }
    if (a === "trace-open") {
      $("#trace-dialog")?.close();
      return openEditor(target.dataset.kind, target.dataset.id);
    }
    if (a === "knowledge-tab") {
      view.tab = target.dataset.tab;
      view.category = "";
      return render();
    }
    if (a === "search") {
      view.search = "";
      view.tab = "questions";
      location.hash = "/search";
      setTimeout(() => $("#global-search")?.focus(), 30);
      return;
    }
    if (a === "go-train") return (location.hash = "/train");
    if (a === "go-settings") return (location.hash = "/settings");
    if (a === "go-knowledge") return (location.hash = "/knowledge");
    if (a === "company-train") {
      train.companyId = target.dataset.id;
      train.jobId = target.dataset.job || state.jobs.find((j) => j.companyId === train.companyId)?.id || "";
      train.queue = [];
      train.questionId = "";
      location.hash = "/train";
      return;
    }
    if (a === "prep") {
      const i = get("interviews", target.dataset.id);
      train.mode = "questions";
      train.companyId = i.companyId;
      train.jobId = i.jobId;
      location.hash = "/train";
      return;
    }
    if (a === "practice") {
      train.mode =
        target.dataset.kind === "questions"
          ? "questions"
          : get("scripts", target.dataset.id)?.type === "项目介绍"
            ? "project"
            : "self";
      if (train.mode === "questions") {
        train.questionId = target.dataset.id;
        train.queue = [target.dataset.id];
        train.index = 0;
      } else {
        train.scriptId = target.dataset.id;
        train.target = get("scripts", target.dataset.id)?.duration || 90;
      }
      location.hash = "/train";
      return;
    }
    if (a === "train-mode") {
      train.mode = target.dataset.mode;
      train.answered = [];
      train.queue = [];
      train.questionId = "";
      train.scriptId = "";
      render();
      return;
    }
    if (a === "timer-toggle") {
      if (!train.running && train.mode === "questions" && !train.questionId) {
        const pool = questionPool();
        if (!pool.length) {
          toast("请先添加题目，或切换自我介绍进行自由训练。");
          return;
        }
        drawQuestion();
      }
      if (train.running) {
        train.elapsed = elapsed();
        train.running = false;
        train.started = null;
      } else {
        train.running = true;
        train.started = performance.now();
        trainingStartedAt ||= new Date().toISOString();
      }
      render();
      return;
    }
    if (a === "timer-reset") {
      if (train.running) {
        toast("请先暂停训练，再重置计时。");
        return;
      }
      if (train.attachmentIds.length) {
        toast("本次含已保存录音，请先完成复盘再开始新训练。");
        return;
      }
      train.elapsed = 0;
      train.answered = [];
      train.started = null;
      trainingStartedAt = null;
      render();
      return;
    }
    if (a === "draw-question") return drawQuestion();
    if (a === "record") return await toggleRecording();
    if (a === "finish-training") return await finishTraining();
    if (a === "add-actual") {
      if (!flushEditor(true) || !editor.saved) {
        toast("先选择单位与岗位。");
        return;
      }
      editor.row.questions = [
        ...(editor.row.questions || []),
        { id: uid(), text: "", answer: "", improved: "", questionId: "" },
      ];
      update("interviews", editor.id, { questions: editor.row.questions });
      await persist();
      refreshEditor();
      const fields = $$("#actual-questions input");
      fields.at(-1)?.focus();
      return;
    }
    if (a === "merge-question")
      return await mergeActual(Number(target.dataset.index));
    if (a === "restore-version") {
      if (editor.kind === "scripts") return;
      const h = editor.row.history[Number(target.dataset.index)];
      const contentKey = editor.kind === "questions" ? "answer" : "content";
      $("#entity-form").elements[contentKey].value =
        h[contentKey] || h.content || h.answer || "";
      if (editor.kind === "questions" && h.text)
        $("#entity-form").elements.text.value = h.text;
      if (editor.kind === "scripts" && h.title)
        $("#entity-form").elements.title.value = h.title;
      editor.row.composition = structuredClone(h.composition || []);
      if (h.versionName)
        $("#entity-form").elements.versionName.value = h.versionName;
      flushEditor(true);
      refreshEditor();
      toast("历史内容已成为当前版本，原有快照仍保留。");
      return;
    }
    if (a === "export") return await exportAll();
    if (a === "import-unified") {
      const input = $("#unified-import-file");
      input.dataset.entry = target.dataset.module || "";
      input.click();
      return;
    }
    if (a === "close-unified-import") return closeUnifiedPreview();
    if (a === "confirm-unified-import") return await commitUnifiedImport();
    if (a === "import-v4") return $("#v4-import-file")?.click();
    if (a === "import" || a === "import-replace") {
      const input = $("#import-file");
      input.dataset.mode = a === "import-replace" ? "replace" : "merge";
      input.click();
      return;
    }
    if (a === "persistent") {
      const supported = !!navigator.storage?.persist;
      const result = supported && (await navigator.storage.persist());
      toast(
        result
          ? "浏览器已允许持久存储。"
          : "浏览器暂未授予持久存储，定期导出备份仍然重要。",
      );
      storageEstimate();
      return;
    }
    if (a === "install") {
      if (installPrompt) {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        render();
      } else toast("请在浏览器菜单中选择「安装应用」或「添加到主屏幕」。");
      return;
    }
    if (a === "download-attachment") {
      const file = get("attachments", target.dataset.id);
      const data = file.data.startsWith("data:")
        ? file.data.split(",")[1]
        : file.data;
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      download(new Blob([bytes], { type: file.mime }), file.name);
      return;
    }
    if (a === "trace") return showTrace(JSON.parse(target.dataset.ids));
    if (a === "trace-sessions")
      return showTrace(
        state.sessions
          .filter(
            (s) =>
              (!view.company || s.companyId === view.company) &&
              (!view.job || s.jobId === view.job) &&
              (!view.since || new Date(s.createdAt) >= new Date(view.since)),
          )
          .map((s) => s.id),
        true,
      );
    if (a === "company-evidence") {
      const ids = state.interviews
        .filter((i) => i.companyId === target.dataset.id)
        .map((i) => i.id);
      if (ids.length) showTrace(ids);
      else openEditor("companies", target.dataset.id);
      return;
    }
    if (a === "resolve-conflict") {
      const candidate = structuredClone(state);
      const conflict = candidate.conflicts.find((c) => c.id === target.dataset.id);
      if (!conflict) throw new Error("此冲突版本已不存在，请刷新后重试。");
      const current = conflict.collection === "settings"
        ? candidate.settings
        : candidate[conflict.collection].find((row) => row.id === conflict.entityId);
      if (!current) throw new Error("原记录已不在当前档案，请先在垃圾箱恢复记录再处理冲突。");
      const saved = structuredClone(current);
      if (conflict.collection === "settings") candidate.settings = structuredClone(conflict.incoming);
      else {
        const index = candidate[conflict.collection].findIndex((row) => row.id === conflict.entityId);
        candidate[conflict.collection][index] = touch(conflict.incoming);
      }
      conflict.incoming = saved;
      conflict.createdAt = new Date().toISOString();
      validateState(candidate);
      const task = beginWorkspaceTask();
      if (!task) return;
      try {
        await saveQueue;
        verifyWorkspaceTask(task);
        await saveState(candidate, { workspace: task.workspace });
        verifyWorkspaceTask(task);
        state = candidate;
        saveError = false;
        render();
        toast("已采用导入版本；替换前的本机快照仍在冲突区。");
      } finally {
        endWorkspaceTask(task);
      }
      return;
    }
  } catch (e) {
    toast(e.message);
  }
});
const $$ = (s) => Array.from(document.querySelectorAll(s));
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.matches("[data-accent-picker]")) { setCurrentAccent(el.value); return; }
  if (el.matches("[data-accent-hex]")) { el.setCustomValidity(""); return; }
  if (el.matches("[data-opportunity-score]")) {
    const field = el.dataset.opportunityScore;
    const id = el.dataset.jobId;
    const card = el.closest("[data-opportunity-card]");
    const output = [...(card?.querySelectorAll("[data-opportunity-output]") || [])].find((node) => node.dataset.opportunityOutput === field && node.dataset.jobId === id);
    if (output) output.value = el.value;
    return;
  }
  if (el.closest("#entity-form")) {
    if (editor?.kind === "jobs" && ["salaryMin", "salaryMax", "months"].includes(el.name)) {
      el.dataset.manuallyEdited = "true";
      (editor.manualSalaryFields ||= new Set()).add(el.name);
    }
    if (editor?.kind === "jobs" && el.name === "jd") {
      const min = el.form?.elements.salaryMin, max = el.form?.elements.salaryMax, months = el.form?.elements.months;
      const line = el.value.split(/\r?\n|；/).find((text) => /薪资|薪酬|月薪|工资|待遇/.test(text));
      const range = parseSalaryRange(line?.replace(/^.*?(?:薪资|薪酬|月薪|工资|待遇)\s*[:：]?\s*/, "").trim() || "");
      if (range && min && max && !min.value && !max.value && min.dataset.manuallyEdited !== "true" && max.dataset.manuallyEdited !== "true" && !editor.manualSalaryFields?.has("salaryMin") && !editor.manualSalaryFields?.has("salaryMax")) {
        min.value = String(range.salaryMin);
        max.value = String(range.salaryMax);
      }
      if (range?.months != null && months && editor.baseline.months == null && months.dataset.manuallyEdited !== "true" && !editor.manualSalaryFields?.has("months")) {
        months.value = String(range.months);
      }
    }
    if (editor && el.matches("[data-composition-text]")) {
      try {
        const patch = collectEditor();
        if (patch) Object.assign(editor.row, patch);
        const contentKey = editor.kind === "questions" ? "answer" : "content";
        editor.row = updateCompositionPart(editor.row, el.dataset.compositionText, el.value, contentKey);
        $("#entity-form").elements[contentKey].value = editor.row[contentKey];
      } catch (error) { toast(error.message); return; }
    } else if (editor && el.matches("[data-composition-full]") && editor.row.composition?.length) {
      editor.row.composition = [];
      editor.undoParts = [];
      $(".composition-undo")?.remove();
      const list = $("[data-composition-list]");
      if (list) list.innerHTML = '<p class="form-help">当前为手写全文。添加卡片时会保留这段内容，再追加新的分段。</p>';
      const count = $("[data-composition-count]");
      if (count) count.textContent = "0 段";
    }
    clearTimeout(editTimeout);
    setSave("正在编辑…");
    editTimeout = setTimeout(() => flushEditor(), 400);
    return;
  }
  if (
    el.id === "knowledge-search" ||
    el.id === "company-search" ||
    el.id === "global-search"
  ) {
    const pos = el.selectionStart,
      id = el.id;
    view.search = el.value;
    render();
    const field = $("#" + id);
    field?.focus();
    field?.setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  try {
    if (el.matches("[data-accent-hex]")) {
      if (!setCurrentAccent(el.value)) {
        el.setCustomValidity("请输入 #RRGGBB 格式的颜色代码。");
        el.reportValidity();
      }
      return;
    }
    if (el.matches("[data-bulk-select]")) {
      bulkSelection.kind = el.dataset.bulkSelect;
      bulkSelection.ids.clear();
      if (el.checked) document.querySelectorAll(`[data-row-select="${bulkSelection.kind}"]`).forEach((input) => bulkSelection.ids.add(input.value));
      render();
      return;
    }
    if (el.matches("[data-row-select]")) {
      if (bulkSelection.kind !== el.dataset.rowSelect) { bulkSelection.kind = el.dataset.rowSelect; bulkSelection.ids.clear(); }
      if (el.checked) bulkSelection.ids.add(el.value); else bulkSelection.ids.delete(el.value);
      render();
      return;
    }
    if (el.matches("[data-question-difficulty]")) {
      if (!QUESTION_DIFFICULTIES.includes(el.value)) return;
      update("questions", el.dataset.questionDifficulty, { difficulty: el.value });
      await persist();
      render();
      return;
    }
    if (el.matches("[data-train-tag]")) {
      if (trainingLocked()) return render();
      const tag = el.dataset.trainTag;
      train.tags = el.checked ? [...new Set([...train.tags, tag])] : train.tags.filter((value) => value !== tag);
      train.queue = [];
      train.questionId = "";
      render();
      return;
    }
    if (el.closest("#unified-import-dialog") && unifiedImportDraft) {
      const options = unifiedImportDraft.options;
      if (el.matches("[data-unified-module]")) {
        options.modules = el.checked ? [...new Set([...options.modules, el.dataset.unifiedModule])] : options.modules.filter(module => module !== el.dataset.unifiedModule);
      } else if (el.matches("[data-unified-row]")) {
        options.excludedIds = el.checked ? options.excludedIds.filter(key => key !== el.dataset.unifiedRow) : [...new Set([...options.excludedIds, el.dataset.unifiedRow])];
      } else if (el.matches("[data-unified-decision]")) {
        options.decisions[el.dataset.unifiedDecision] = el.value;
      } else if (el.matches("[data-unified-local-references]")) {
        options.confirmLocalReferences = el.checked;
      }
      renderUnifiedPreview();
      return;
    }
    if (el.id === "unified-import-file") {
      if (el.files[0]) await prepareUnifiedImport(el.files[0], el.dataset.entry || "");
      el.value = "";
      return;
    }
    if (el.matches("[data-opportunity-score]")) {
      const field = el.dataset.opportunityScore;
      const id = el.dataset.jobId;
      const value = Number(el.value);
      if (!["personalIntent", "employerIntent"].includes(field) || !get("jobs", id) || !Number.isInteger(value) || value < 0 || value > 100) throw new Error("意向分必须为 0—100");
      const candidate = structuredClone(state);
      const index = candidate.jobs.findIndex((job) => job.id === id);
      candidate.jobs[index] = touch(candidate.jobs[index], { [field]: value });
      validateState(candidate);
      state = candidate;
      await persist();
      render();
      return;
    }
    if (el.classList.contains("agenda-complete")) { await setAgendaCompleted(el); return; }
    if (el.id === "agenda-date") {
      view.agendaDate = el.value || agendaDateKey(new Date());
      view.agendaScrollTarget = view.agendaDate;
      render();
      return;
    }
    if (el.name === "knowledgeKind" && el.closest("#agenda-form")) {
      el.form.elements.knowledgeId.innerHTML = agendaKnowledgeOptions(el.value);
      return;
    }
    if (el.name === "interviewId" && el.closest("#agenda-form") && el.value && !el.form.elements.companyId.value) {
      el.form.elements.companyId.value = get("interviews", el.value)?.companyId || "";
      return;
    }
    if (el.id === "import-file") {
      if (el.files[0]) await importAll(el.files[0], el.dataset.mode || "merge");
      el.value = "";
      return;
    }
    if (el.id === "v4-import-file") {
      if (el.files[0]) await importJobsV4(el.files[0]);
      el.value = "";
      return;
    }
    if (el.id === "attachment-upload") {
      await uploadAttachments([...el.files]);
      return;
    }
    if (el.closest("#entity-form")) {
      if (["kind", "track", "companyId", "jobId"].includes(el.name)) {
        clearTimeout(editTimeout);
        if (editor.kind === "jobs" && el.name === "companyId" && el.value) {
          const selected = get("companies", el.value);
          if (selected) el.form.elements.companyName.value = selected.name;
        }
        const patch = collectEditor();
        if (editor.kind === "jobs") {
          const org = get("companies", patch.companyId);
          if (el.name === "companyId" && org)
            patch.track =
              organizationKind(org) === "public"
                ? "civil-service"
                : "enterprise";
          if (!statusesFor(patch, org).includes(patch.status))
            patch.status = statusesFor(patch, org)[0];
        }
        if (editor.kind === "interviews" && el.name === "companyId")
          patch.jobId = "";
        Object.assign(editor.row, patch);
        refreshEditor();
        flushEditor();
        return;
      }
      if (
        el.name === "companyId" &&
        editor.kind === "jobs" &&
        editor.row.companyId &&
        el.value !== editor.row.companyId &&
        (state.interviews.some((i) => i.jobId === editor.id) ||
          state.sessions.some((i) => i.jobId === editor.id))
      ) {
        el.value = editor.row.companyId;
        toast("此岗位已有关联记录，请为另一个单位新建岗位。");
        return;
      }
      if (el.name === "companyId" && editor.kind === "interviews") {
        const select = $('#entity-form select[name="jobId"]');
        select.innerHTML = opts(
          state.jobs.filter((j) => j.companyId === el.value),
          "",
          "title",
          "请选择岗位",
        );
      }
      flushEditor();
      return;
    }
    const value = el.value;
    if (
      [
        "train-company",
        "train-job",
        "train-category",
        "train-difficulty",
        "train-script",
        "train-clock",
        "train-target",
      ].includes(el.id) &&
      trainingLocked()
    ) {
      toast("本次训练尚未结束，请先完成复盘再调整范围。");
      render();
      return;
    }
    if (el.id === "knowledge-category") {
      view.category = value;
      render();
    }
    if (el.id === "job-tag-filter") {
      view.jobTag = value;
      render();
    }
    if (el.id === "interview-company") {
      view.company = value;
      render();
    }
    if (el.id === "analytics-company") {
      view.company = value;
      view.job = "";
      render();
    }
    if (el.id === "analytics-job") {
      view.job = value;
      render();
    }
    if (el.id === "analytics-since") {
      view.since = value;
      render();
    }
    if (el.id === "train-company") {
      train.companyId = value;
      train.jobId = "";
      train.queue = [];
      train.questionId = "";
      train.answered = [];
      render();
    }
    if (el.id === "train-job") {
      train.jobId = value;
      if (value)
        train.companyId = get("jobs", value)?.companyId || train.companyId;
      train.queue = [];
      train.questionId = "";
      train.answered = [];
      render();
    }
    if (el.id === "train-category") {
      train.category = value;
      train.queue = [];
      train.questionId = "";
      train.answered = [];
      render();
    }
    if (el.id === "train-difficulty") {
      train.difficulty = value;
      train.queue = [];
      train.questionId = "";
      train.answered = [];
      render();
    }
    if (el.id === "train-script") {
      train.scriptId = value;
      train.target = get("scripts", value)?.duration || train.target;
      render();
    }
    if (el.id === "train-clock") {
      train.countdown = value === "down";
      render();
    }
    if (el.id === "train-target") {
      train.target = Math.max(10, Math.min(7200, Number(value) || 180));
      render();
    }
    if (el.dataset.prep !== undefined) {
      train.prepChecks = train.prepChecks || [];
      const i = Number(el.dataset.prep);
      train.prepChecks = el.checked
        ? [...new Set([...train.prepChecks, i])]
        : train.prepChecks.filter((n) => n !== i);
    }
  } catch (e) {
    toast(e.message);
  }
});
document.addEventListener("toggle", (event) => {
  if (event.target.matches("details.train-config") && event.target.isConnected) train.configOpen = event.target.open;
  if (event.target.matches("details.train-tag-filter") && event.target.isConnected) train.tagsOpen = event.target.open;
}, true);
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === "agenda-form") { await saveAgenda(form); return; }
    if (form.id === "entity-form") {
      if (!form.reportValidity() || !flushEditor(true)) return;
      await saveQueue;
      closeEditor();
      return;
    }
    if (form.id === "rule-form") {
      const f = new FormData(form),
        synonyms = Object.create(null);
      for (const line of String(f.get("synonyms"))
        .split("\n")
        .filter((x) => x.trim())) {
        const [key, rest] = line.split("=");
        if (["__proto__", "constructor", "prototype"].includes(key?.trim()))
          throw new Error("关键词不能使用保留字段名");
        if (!key?.trim() || !rest?.trim())
          throw new Error("同义词每行格式：关键词 = 同义词 | 同义词");
        synonyms[key.trim()] = rest
          .split("|")
          .map((x) => x.trim())
          .filter(Boolean);
      }
      const classifiers = String(f.get("classifiers"))
        .split("\n")
        .filter((x) => x.trim())
        .map((line) => {
          const [name, keys] = line.split("=");
          if (!name?.trim() || !keys?.trim())
            throw new Error("分类规则每行格式：类别 = 关键词 | 关键词");
          return {
            name: name.trim(),
            keywords: keys
              .split("|")
              .map((x) => x.trim())
              .filter(Boolean),
          };
        });
      state.settings.keywords = [
        ...new Set(
          String(f.get("keywords"))
            .split(/[,，\n]/)
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ];
      state.settings.synonyms = synonyms;
      state.settings.classifiers = classifiers;
      await persist();
      toast("匹配规则已保存。");
      return;
    }
    if (form.id === "public-rule-form") {
      const f = new FormData(form),
        dimensions = String(f.get("publicDimensions"))
          .split("\n")
          .filter((x) => x.trim())
          .map((line) => {
            const [id, name, w] = line.split(/[,，]/).map((x) => x.trim());
            return { id, name, weight: Number(w) };
          });
      const candidate = structuredClone(state);
      candidate.settings.publicDimensions = dimensions;
      candidate.settings.publicStageScores = Object.fromEntries(
        ["civil-service", "public-institution"].map((track) => [
          track,
          Object.fromEntries(
            PUBLIC_STATUSES.map((status) => [
              status,
              Number(f.get(`${track}-${status}`)),
            ]),
          ),
        ]),
      );
      validateState(candidate);
      state = candidate;
      await persist();
      toast("公招规则已保存。");
      return;
    }
    if (form.id === "dimension-form") {
      const f = new FormData(form),
        dimensions = String(f.get("dimensions"))
          .split("\n")
          .filter((s) => s.trim())
          .map((line) => {
            const [id, name, w] = line.split(/[,，]/).map((x) => x.trim());
            const weight = Number(w);
            if (!id || !name || !Number.isFinite(weight) || weight < 0)
              throw new Error("评分维度格式：稳定 ID, 名称, 非负权重");
            return { id, name, weight };
          });
      if (!dimensions.length || !dimensions.some((d) => d.weight > 0))
        throw new Error("请至少保留一个权重大于 0 的维度");
      if (new Set(dimensions.map((d) => d.id)).size !== dimensions.length)
        throw new Error("维度 ID 不能重复");
      const stageScores = Object.fromEntries(
        statuses.map((s) => [s, Number(f.get("stage-" + s))]),
      );
      const tagColorScores = Object.fromEntries(["green", "red", "yellow", "blue"].map((color) => [color, Number(f.get("tag-" + color))]));
      const candidate = structuredClone(state);
      candidate.settings = {
        ...candidate.settings,
        dimensions,
        stageScores,
        tagColorScores,
        tagScoreDefaultsVersion: 2,
        positiveFeedbackPoints: Number(f.get("positive")),
        negativeFeedbackPoints: Number(f.get("negative")),
      };
      validateState(candidate);
      state = candidate;
      await persist();
      toast("评分规则已保存。");
      return;
    }
  } catch (e) {
    toast(e.message);
  }
});
window.addEventListener("storage", event => {
  if (event.key !== ACCENT_STORAGE_KEY) return;
  accentPrefs = loadAccentPrefs();
  applyAccentPrefs(accentPrefs, themeMode);
  if (state && route === "settings") render();
});
window.matchMedia("(max-width:780px)").addEventListener("change", () => {
  mobileNavOpen = false;
  if (!state || route === "/") return;
  render();
});
window.addEventListener("hashchange", () => {
  // start() reads the final URL once the local archive is available.
  if (!state) return;
  mobileNavOpen = false;
  if (editor) closeEditor();
  closeAgendaDialog();
  const next = location.hash.replace(/^#\/?/, "") || "/";
  if (next !== route) {
    view.search = "";
    view.category = "";
    view.company = "";
    view.job = "";
    view.since = "";
    if (next === "dashboard") {
      view.agendaDate = agendaDateKey(new Date());
      view.agendaScrollTarget = view.agendaDate;
    }
  }
  route = next;
  render();
  window.scrollTo(0, 0);
});
window.addEventListener("resize", () => {
  if (route === "dashboard") requestAnimationFrame(sizeAgendaTail);
}, { passive: true });
window.addEventListener("keydown", (e) => {
  if (!state || document.documentElement.hasAttribute("data-starting")) return;
  if (e.key === "Escape" && mobileNavOpen) {
    setMobileNavigation(false);
    $(".shell-brand")?.focus();
    return;
  }
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement?.tagName,
    ) &&
    !editor
  ) {
    e.preventDefault();
    view.tab = "questions";
    location.hash = "/search";
    setTimeout(() => $("#global-search")?.focus(), 30);
  }
});
window.addEventListener("beforeunload", (e) => {
  if (editor) flushEditor();
  if (train.recording || train.running || saveError) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && editor) flushEditor();
});
function releaseStartupFallback() {
  document.querySelector("#startup-loading")?.remove();
  delete document.documentElement.dataset.starting;
  const app = $("#app");
  app.inert = false;
  app.removeAttribute("aria-hidden");
  app.removeAttribute("aria-busy");
}
async function start() {
  try {
    initHelpTips();
    initCornerControls({ toast });
    window.nextRoundStartup?.modulesReady();
    state = await loadState({ workspace: activeWorkspace });
    if (state.settings.trainingDraft?.attachmentIds?.length)
      train.attachmentIds = state.settings.trainingDraft.attachmentIds;
    window.nextRoundStartup?.archiveReady();
    route = location.hash.replace(/^#\/?/, "") || "/";
    render();
    if (window.nextRoundStartup) window.nextRoundStartup.reveal();
    else releaseStartupFallback();
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("./sw.js");
      } catch (e) {
        toast("离线资源准备失败，请保留网络并刷新重试。");
      }
    }
  } catch (e) {
    if (window.nextRoundStartup) { window.nextRoundStartup.fail(e); return; }
    releaseStartupFallback();
    $("#app").innerHTML =
      `<div class="boot"><h1>本地档案暂时无法打开</h1><p class="trace">${esc(e.message)}</p><p class="trace">请保留浏览器数据，关闭其他旧窗口后重试。</p><button type="button" class="btn" onclick="location.reload()">重新打开</button></div>`;
  }
}
start();
function globalSearch() {
  const term = view.search.toLowerCase();
  const sections = [
    [
      "companies",
      "关联公司信息",
      (r) => `${r.name} ${r.facts || ""} ${r.claims || ""}`,
    ],
    [
      "jobs",
      "岗位档案",
      (r) => `${r.title} ${r.jd || ""} ${companyName(r.companyId)}`,
    ],
    [
      "questions",
      "面试题库",
      (r) => `${r.text} ${r.answer || ""} ${(r.tags || []).join(" ")}`,
    ],
    ["scripts", "介绍底稿", (r) => `${r.title} ${r.content || ""}`],
    [
      "interviews",
      "面试档案",
      (r) =>
        `${companyName(r.companyId)} ${jobName(r.jobId)} ${r.transcript || ""} ${r.feedback || ""} ${(r.questions || []).map((q) => q.text).join(" ")}`,
    ],
    ["sessions", "训练记录", (r) => `${r.title} ${r.notes || ""}`],
  ];
  return (
    pageHead(
      "搜索您的档案",
      "单位、岗位材料、题库、底稿与复盘，在当前档案空间内关联。",
    ) +
    `<div class="toolbar"><div class="field-search">${icon("search")}<input id="global-search" placeholder="输入单位、职位、问题或关键词…" aria-label="搜索所有档案" value="${esc(view.search)}"></div></div>${
      term
        ? sections
            .map(([kind, title, text]) => {
              const rows = state[kind].filter((r) =>
                text(r).toLowerCase().includes(term),
              );
              return rows.length
                ? `<section style="margin-top:25px"><div class="section-heading"><h2>${title}</h2><span class="muted">${rows.length} 条</span></div><div class="list-panel">${rows.map((r) => `<div class="row"><div class="grow"><button type="button" class="row-title" data-action="edit" data-kind="${kind}" data-id="${esc(r.id)}">${esc(r.name || r.title || r.text || `${companyName(r.companyId)} · ${r.round || "面试"}`)}</button><p class="trace">${esc(text(r).slice(0, 120))}</p></div>${icon("arrow")}</div>`).join("")}</div></section>`
                : "";
            })
            .join("") || empty("没有匹配的档案", "尝试其他关键词。")
        : empty("从一个关键词开始", "搜索内容完全在本机处理。")
    }`
  );
}

function trainingLocked() {
  return train.running || train.elapsed > 0 || train.attachmentIds.length > 0;
}
