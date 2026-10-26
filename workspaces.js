import { COLLECTIONS, validateState, normalizeState, isWeakScheduleReference } from "./core.js";

export const WORKSPACES = Object.freeze({
  formal: "nextround-local",
  demo: "nextround-demo",
});
export const LEGACY_RECOVERY_KEY = "legacy-recovery-v1";
const SEED_IDS = new Set([
  "demo-company-1",
  "demo-company-2",
  "demo-job-1",
  "demo-job-2",
  "demo-q-1",
  "demo-q-2",
  "demo-q-3",
  "demo-q-4",
  "demo-script-1",
  "demo-script-2",
  "demo-interview-1",
  "demo-interview-2",
  "demo-interview-plan-1",
  "demo-session-0",
  "demo-session-1",
  "demo-session-2",
  "demo-session-3",
  "demo-public-unit",
  "demo-public-job",
  "demo-public-q",
]);
/** Drop only conflicts tied to the original demonstration seed; formal records stay intact. */
export function stripLegacyDemoConflicts(state) {
  if (!Array.isArray(state?.conflicts)) return state;
  const retained = state.conflicts.filter((conflict) =>
    !SEED_IDS.has(conflict.entityId) &&
    !SEED_IDS.has(conflict.incoming?.id) &&
    !(conflict.collection === "settings" && conflict.incoming?.demo === true));
  return retained.length === state.conflicts.length ? state : { ...state, conflicts: retained };
}
export function workspaceName(options = {}) {
  const name = options?.workspace ?? "formal";
  if (!Object.hasOwn(WORKSPACES, name))
    throw new Error("未知的档案空间，请选择正式档案或演示空间。");
  return name;
}
export function hasLegacyDemo(state) {
  return (
    state?.settings?.demo === true ||
    COLLECTIONS.some((name) =>
      state?.[name]?.some((record) => SEED_IDS.has(record.id)),
    )
  );
}
/** Preserve personal records plus transitive references; no text or history is rewritten. */
export function separateLegacyState(legacy) {
  validateState(legacy);
  legacy = normalizeState(legacy);
  const state = structuredClone(legacy);
  const records = new Map(
    COLLECTIONS.flatMap((name) =>
      legacy[name].map((record) => [record.id, record]),
    ),
  );
  const keep = new Set([...records.keys()].filter((id) => !SEED_IDS.has(id)));
  const pending = [...keep];
  const scheduleIds = new Set(legacy.scheduleItems.map((record) => record.id));
  const referenced = (value, collection = null) => {
    if (Array.isArray(value)) {
      for (const child of value) referenced(child, collection);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (
        key !== "sourceCardId" && !isWeakScheduleReference(collection, key) && key.endsWith("Id") &&
        typeof item === "string" &&
        records.has(item) &&
        !keep.has(item)
      ) {
        keep.add(item);
        pending.push(item);
      } else if (key.endsWith("Ids") && Array.isArray(item))
        for (const id of item)
          if (typeof id === "string" && records.has(id) && !keep.has(id)) {
            keep.add(id);
            pending.push(id);
          }
      if (item && typeof item === "object") referenced(item, collection);
    }
  };
  for (let index = 0; index < pending.length; index++)
    referenced(records.get(pending[index]), scheduleIds.has(pending[index]) ? "scheduleItems" : null);
  for (const name of COLLECTIONS)
    state[name] = state[name].filter((record) => keep.has(record.id));
  // Preserve custom matching/scoring rules and backup reminders; only the incorrect mode flag is removed.
  delete state.settings.demo;
  validateState(state);
  const removed = [...records.keys()].filter((id) => !keep.has(id));
  const retainedDependencies = [...keep].filter((id) => SEED_IDS.has(id));
  return {
    state,
    report: {
      removedSeedIds: removed,
      retainedDependencyIds: retainedDependencies,
      personalRecords: [...keep].filter((id) => !SEED_IDS.has(id)).length,
    },
  };
}
/** Prepare a demo-free formal export without editing the live archive or its historical backups.
 * A personal dependency cannot safely be guessed, erased or replaced with a fictional placeholder.
 * Such an archive must be relinked explicitly before a formal export may be created.
 */
export function prepareFormalBackup(state) {
  validateState(state);
  const next = normalizeState(state), dependencies = [], removed = { active: [], conflicts: [], trash: [] };
  const fields = new Set(["companyId", "jobId", "questionId", "scriptId", "interviewId", "sessionId", "attachmentId", "knowledgeId"]);
  const arrays = new Set(["companyIds", "jobIds", "questionIds", "attachmentIds", "relatedIntroductionIds"]);
  function dependency(seedId, context, field) {
    if (!SEED_IDS.has(seedId)) return;
    if (!dependencies.some(item => item.seedId === seedId && item.location === context.location && item.field === field)) dependencies.push({ ...context, field, seedId });
  }
  function references(value, context, path = "", recursive = false) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach((child, index) => references(child, context, path + "[" + index + "]", recursive)); return; }
    for (const [key, child] of Object.entries(value)) {
      const field = path ? path + "." + key : key;
      if (fields.has(key) && typeof child === "string") dependency(child, context, field);
      if (arrays.has(key) && Array.isArray(child)) for (const id of child) if (typeof id === "string") dependency(id, context, field);
      if (child && typeof child === "object" && (recursive || context.collection === "interviews" && key === "questions")) references(child, context, field, recursive);
    }
  }
  for (const collection of COLLECTIONS) {
    next[collection] = next[collection].filter(record => {
      if (SEED_IDS.has(record.id)) { removed.active.push({ collection, id: record.id }); return false; }
      references(record, { collection, id: record.id, location: collection + ":" + record.id });
      return true;
    });
  }
  if (next.settings.trainingDraft) references(next.settings.trainingDraft, { collection: "settings", id: "trainingDraft", location: "settings.trainingDraft" }, "", true);
  next.conflicts = next.conflicts.filter(conflict => {
    const seedEntity = SEED_IDS.has(conflict.entityId), seedIncoming = SEED_IDS.has(conflict.incoming?.id);
    if (seedEntity && seedIncoming || conflict.collection === "settings" && conflict.incoming?.demo === true) { removed.conflicts.push(conflict.id); return false; }
    if (seedEntity || seedIncoming) dependency(seedEntity ? conflict.entityId : conflict.incoming.id, { collection: conflict.collection, id: conflict.entityId, location: "conflicts:" + conflict.id }, seedEntity ? "entityId" : "incoming.id");
    references(conflict.incoming, { collection: conflict.collection, id: conflict.entityId, location: "conflicts:" + conflict.id });
    return true;
  });
  next.trash = next.trash.filter(entry => {
    const records = ["records", "dependencies"].flatMap(key => COLLECTIONS.flatMap(collection => (entry[key]?.[collection] || []).map(record => ({ collection, record }))));
    const isPureDemo = SEED_IDS.has(entry.entityId) && records.length > 0 && records.every(({ record }) => SEED_IDS.has(record.id)) && (entry.conflicts || []).every(conflict => SEED_IDS.has(conflict.entityId) || SEED_IDS.has(conflict.incoming?.id)) && !entry.trainingDraft;
    if (isPureDemo) { removed.trash.push(entry.id); return false; }
    if (SEED_IDS.has(entry.entityId)) dependency(entry.entityId, { collection: entry.collection, id: entry.entityId, location: "trash:" + entry.id }, "entityId");
    for (const { collection, record } of records) {
      const context = { collection, id: record.id, location: "trash:" + entry.id + ":" + collection + ":" + record.id };
      dependency(record.id, context, "id"); references(record, context, "", true);
    }
    for (const conflict of entry.conflicts || []) {
      const context = { collection: conflict.collection, id: conflict.entityId, location: "trash:" + entry.id + ":conflict:" + conflict.id };
      dependency(conflict.entityId, context, "entityId"); dependency(conflict.incoming?.id, context, "incoming.id"); references(conflict.incoming, context, "", true);
    }
    if (entry.trainingDraft) references(entry.trainingDraft, { collection: "settings", id: entry.id, location: "trash:" + entry.id + ":trainingDraft" }, "", true);
    return true;
  });
  if (dependencies.length) throw Object.assign(new Error("正式备份未生成：个人记录或可恢复历史仍关联旧演示条目，请先将这些关联改为自己的真实条目，再重新导出。当前档案及已有备份未改变。"), { code: "FORMAL_BACKUP_DEMO_DEPENDENCY", dependencies });
  validateState(next);
  return { state: next, report: { removed } };
}

export function backupWorkspace(payload, incoming) {
  if (payload?.workspace !== undefined) {
    if (!Object.hasOwn(WORKSPACES, payload.workspace))
      throw new Error(
        "此文件属于已停用的历史混合恢复包或未知空间，不能导入当前档案。",
      );
    // Legacy demo flags always win over a misleading envelope.
    return incoming?.settings?.demo === true ? "demo" : payload.workspace;
  }
  return hasLegacyDemo(incoming) ? "demo" : "formal";
}
