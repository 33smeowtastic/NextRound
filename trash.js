/** Record-sized, offline trash packages. All operations leave the input untouched. */
import { COLLECTIONS, uid, validateState, normalizeState, isWeakScheduleReference } from "./core.js";

const ROOTS = ["companies", "jobs", "questions", "scripts", "interviews", "sessions", "contentCards", "scheduleItems"];
const SINGLE = { companyId: "companies", jobId: "jobs", questionId: "questions", scriptId: "scripts", interviewId: "interviews", sessionId: "sessions", attachmentId: "attachments" };
const MANY = { companyIds: "companies", jobIds: "jobs", questionIds: "questions", attachmentIds: "attachments" };
const bundle = () => Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
const key = (collection, id) => `${collection}:${id}`;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function references(value, collection = null) {
  const found = [];
  function walk(item, source) {
    if (!item || typeof item !== "object") return;
    for (const [field, child] of Object.entries(item)) {
      if (SINGLE[field] && !isWeakScheduleReference(source, field) && typeof child === "string" && child) found.push([SINGLE[field], child]);
      else if (MANY[field] && Array.isArray(child)) for (const id of child) if (typeof id === "string" && id) found.push([MANY[field], id]);
      if (child && typeof child === "object") walk(child, field === "scheduleItems" ? field : source);
    }
  }
  walk(value, collection);
  return found;
}
function entryFor(state, id) {
  const entry = (state.trash || []).find((item) => item.id === id);
  if (!entry) throw new Error("垃圾箱记录不存在，请刷新后重试。");
  return entry;
}
function assertResult(state) {
  try { validateState(state); }
  catch (cause) { throw new Error(`操作无法完成，关联数据需要先处理：${cause.message}`, { cause }); }
  return state;
}

/** Company/job removal includes dependent jobs/interviews/sessions, never shared knowledge. */
export function moveToTrash(state, collection, id) {
  validateState(state);
  state = normalizeState(state);
  if (!ROOTS.includes(collection)) throw new Error("此类记录不能单独移入垃圾箱；附件请随所属记录处理。");
  const root = state[collection].find((record) => record.id === id);
  if (!root) throw new Error("记录不存在，请刷新后重试。");
  const removed = new Set([key(collection, id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of ["jobs", "interviews", "sessions"])
      for (const record of state[name]) {
        if (removed.has(key(name, record.id))) continue;
        if (references(record, name).some(([target, targetId]) => ["companies", "jobs", "interviews", "sessions"].includes(target) && removed.has(key(target, targetId)))) {
          removed.add(key(name, record.id));
          changed = true;
        }
      }
  }
  const draft = state.settings.trainingDraft;
  const removeDraft = draft && references(draft).some(([name, targetId]) => removed.has(key(name, targetId)));
  const records = bundle(), dependencies = bundle();
  for (const name of COLLECTIONS)
    for (const record of state[name])
      if (removed.has(key(name, record.id))) records[name].push(structuredClone(record));
      else if (name !== "attachments" && references(record, name).some(([target, targetId]) => removed.has(key(target, targetId))))
        throw new Error("此记录仍被正式档案引用，请先解除关联后再移入垃圾箱。");
  // Conflicting versions travel with the record, including alternatives that refer
  // to a removed entity. Iterate because newly exclusive attachments can have conflicts too.
  const movedConflicts = new Set();
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const conflict of state.conflicts)
      if (!movedConflicts.has(conflict.id) && (
        removed.has(key(conflict.collection, conflict.entityId)) ||
        references(conflict.incoming, conflict.collection).some(([name, targetId]) => removed.has(key(name, targetId)))
      )) {
        movedConflicts.add(conflict.id);
        expanded = true;
      }
    const alternatives = state.conflicts.filter((conflict) => movedConflicts.has(conflict.id));
    const attachments = new Set([
      ...references(records), ...alternatives.flatMap((conflict) => references(conflict.incoming, conflict.collection)),
      ...(removeDraft ? references(draft) : []),
    ].filter(([name]) => name === "attachments").map(([, targetId]) => targetId));
    const retainedRefs = [
      ...COLLECTIONS.flatMap((name) => name === "attachments" ? [] : state[name].filter((record) => !removed.has(key(name, record.id))).flatMap((record) => references(record, name))), ...(!removeDraft ? references(draft) : []),
      ...state.conflicts.filter((conflict) => !movedConflicts.has(conflict.id)).flatMap((conflict) => references(conflict.incoming, conflict.collection)),
    ];
    for (const attachment of state.attachments)
      if (!removed.has(key("attachments", attachment.id)) && attachments.has(attachment.id) &&
          !retainedRefs.some(([name, targetId]) => name === "attachments" && targetId === attachment.id)) {
        records.attachments.push(structuredClone(attachment));
        removed.add(key("attachments", attachment.id));
        expanded = true;
      }
  }
  const conflicts = state.conflicts.filter((conflict) => movedConflicts.has(conflict.id));
  const captured = new Set(removed);
  const pending = [
    ...references(records), ...conflicts.flatMap((conflict) => references(conflict.incoming, conflict.collection)),
    ...(removeDraft ? references(draft) : []),
    ...conflicts.filter((conflict) => COLLECTIONS.includes(conflict.collection) && state[conflict.collection].some((record) => record.id === conflict.entityId)).map((conflict) => [conflict.collection, conflict.entityId]),
  ];
  while (pending.length) {
    const [name, targetId] = pending.shift();
    if (captured.has(key(name, targetId))) continue;
    const record = state[name].find((item) => item.id === targetId);
    if (!record) throw new Error("记录的关联数据不存在，无法安全移入垃圾箱。");
    captured.add(key(name, targetId));
    dependencies[name].push(structuredClone(record));
    pending.push(...references(record, name));
  }
  const next = structuredClone(state);
  next.trash ||= [];
  next.trash.push({ id: uid(), collection, entityId: id, label: root.name || root.title || root.text || root.question || "未命名记录", deletedAt: new Date().toISOString(), records, dependencies, conflicts: structuredClone(conflicts), ...(removeDraft ? { trainingDraft: structuredClone(draft) } : {}) });
  for (const name of COLLECTIONS) next[name] = next[name].filter((record) => !removed.has(key(name, record.id)));
  next.conflicts = next.conflicts.filter((conflict) => !movedConflicts.has(conflict.id));
  if (removeDraft) delete next.settings.trainingDraft;
  return assertResult(next);
}

/** Restore is atomic: deleted-record conflicts reject the entire operation. */
export function restoreTrash(state, id) {
  validateState(state);
  state = normalizeState(state);
  const entry = entryFor(state, id), next = structuredClone(state);
  for (const name of COLLECTIONS) {
    for (const record of entry.records[name]) {
      const active = next[name].find((item) => item.id === record.id);
      if (active && !equal(active, record)) throw new Error("恢复失败：正式档案已存在同 ID 的不同内容；垃圾箱原记录已保留。");
      if (!active) next[name].push(structuredClone(record));
    }
    for (const record of entry.dependencies[name]) {
      const active = next[name].find((item) => item.id === record.id);
      // Current parent metadata wins; changed knowledge/audio cannot silently substitute the saved version.
      if (active && ["questions", "scripts", "attachments"].includes(name) && !equal(active, record))
        throw new Error("恢复失败：关联题目、介绍稿或附件存在同 ID 的不同内容；垃圾箱原记录已保留。");
      if (!active) next[name].push(structuredClone(record));
    }
  }
  for (const conflict of entry.conflicts || []) {
    if (next.conflicts.some((active) => active.collection === conflict.collection && active.entityId === conflict.entityId && equal(active.incoming, conflict.incoming))) continue;
    next.conflicts.push({ ...structuredClone(conflict), id: next.conflicts.some((active) => active.id === conflict.id) ? uid() : conflict.id });
  }
  if (entry.trainingDraft && !next.settings.trainingDraft) next.settings.trainingDraft = structuredClone(entry.trainingDraft);
  next.trash = next.trash.filter((item) => item.id !== id);
  return assertResult(next);
}

export function deleteTrash(state, id) {
  validateState(state);
  state = normalizeState(state);
  entryFor(state, id);
  const next = structuredClone(state);
  next.trash = next.trash.filter((item) => item.id !== id);
  return next;
}
export function emptyTrash(state) {
  validateState(state);
  state = normalizeState(state);
  return { ...structuredClone(state), trash: [] };
}
