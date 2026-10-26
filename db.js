import { blankState, mergeData, validateState, COLLECTIONS, upgradeLegacyTagColorDefaults, upgradeLegacyInterviewStatuses } from "./core.js";
import {
  WORKSPACES,
  LEGACY_RECOVERY_KEY,
  workspaceName,
  hasLegacyDemo,
  separateLegacyState,
  stripLegacyDemoConflicts,
  backupWorkspace,
  prepareFormalBackup,
} from "./workspaces.js";

import { hasScriptHistory, stripScriptHistory } from "./script-history.js";

const STORE = "state";
const spaces = new Map();
function space(workspace) {
  if (!spaces.has(workspace))
    spaces.set(workspace, {
      openPromise: null,
      loadedVersion: null,
      generation: 0,
      pending: Promise.resolve(),
      pendingGeneration: null,
    });
  return spaces.get(workspace);
}
function database(workspace) {
  const slot = space(workspace);
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error("当前浏览器不支持 IndexedDB，请使用现代浏览器打开本地应用。"),
    );
  if (!slot.openPromise)
    slot.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(WORKSPACES[workspace], 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          slot.openPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        slot.openPromise = null;
        reject(request.error);
      };
      request.onblocked = () => {
        slot.openPromise = null;
        reject(new Error("数据库升级被其他窗口阻挡，请关闭旧窗口后重试。"));
      };
    });
  return slot.openPromise;
}
function mismatch(source, target) {
  return Object.assign(
    new Error(
      source === "demo"
        ? "这是演示空间或旧版混合演示备份，不能导入正式档案。请进入演示空间查看；正式档案未改变。"
        : "这是正式档案备份，不能自动合入演示空间。请切换到正式档案后导入；现有数据未改变。",
    ),
    {
      code: "WORKSPACE_MISMATCH",
      sourceWorkspace: source,
      targetWorkspace: target,
    },
  );
}
/** Remove obsolete mixed archives and migrate active personal records atomically. */
export async function loadState(options = {}) {
  const workspace = workspaceName(options),
    slot = space(workspace),
    db = await database(workspace);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite"),
      store = transaction.objectStore(STORE);
    let snapshot, failure;
    if (workspace === "formal") {
      const archives = store.openCursor();
      archives.onsuccess = () => {
        const cursor = archives.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(LEGACY_RECOVERY_KEY) ||
            cursor.value?.format === "NextRoundLegacyRecovery") cursor.delete();
        cursor.continue();
      };
    }
    const request = store.get("current");
    request.onsuccess = () => {
      try {
        snapshot = request.result || { version: 0, state: blankState() };
        validateState(snapshot.state);
        let changed = false, stateChanged = false;
        if (workspace === "formal" && snapshot.workspaceMigration !== 1 && hasLegacyDemo(snapshot.state)) {
          snapshot = {
            ...snapshot,
            state: separateLegacyState(snapshot.state).state,
            workspaceMigration: 1,
          };
          stateChanged = true;
        }
        if (workspace === "formal") {
          const cleaned = stripLegacyDemoConflicts(snapshot.state);
          if (cleaned !== snapshot.state) {
            snapshot = { ...snapshot, state: cleaned };
            stateChanged = true;
          }
        }
        if (hasScriptHistory(snapshot.state)) {
          snapshot = { ...snapshot, state: stripScriptHistory(snapshot.state) };
          stateChanged = true;
        }
        const currentTagDefaults = upgradeLegacyTagColorDefaults(snapshot.state);
        if (currentTagDefaults !== snapshot.state) {
          snapshot = { ...snapshot, state: currentTagDefaults };
          stateChanged = true;
        }
        const currentInterviews = upgradeLegacyInterviewStatuses(snapshot.state);
        if (currentInterviews !== snapshot.state) {
          snapshot = { ...snapshot, state: currentInterviews };
          stateChanged = true;
        }
        if (stateChanged) {
          snapshot = { ...snapshot, version: (snapshot.version || 0) + 1, savedAt: new Date().toISOString(), workspace };
          changed = true;
        }
        if (workspace === "formal" && Object.hasOwn(snapshot, "legacyRecoveryId")) {
          delete snapshot.legacyRecoveryId;
          changed = true;
        }
        if (changed) store.put(snapshot, "current");
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => {
      slot.loadedVersion = snapshot.version || 0;
      slot.generation++;
      resolve(stripScriptHistory(snapshot.state));
    };
    transaction.onerror = () => reject(failure || transaction.error || new Error("读取失败"));
    transaction.onabort = () => reject(failure || transaction.error || new Error("读取事务已中止，原始数据未改变。"));
  });
}
/** Workspace, snapshot and version lineage are captured now, before either queue can change. */
export function saveState(state, options = {}) {
  let snapshot, workspace;
  try {
    workspace = workspaceName(options);
    validateState(state);
    if (workspace === "formal" && state.settings.demo === true)
      throw mismatch("demo", "formal");
    snapshot = stripScriptHistory(upgradeLegacyInterviewStatuses(state));
  } catch (error) {
    return Promise.reject(error);
  }
  const slot = space(workspace),
    capturedVersion = slot.loadedVersion,
    generation = slot.generation;
  const predecessor = slot.pending,
    predecessorGeneration = slot.pendingGeneration;
  const operation = predecessor
    .then(
      (result) => ({ result }),
      (error) => ({ error }),
    )
    .then(async (previous) => {
      // Only our own successful predecessor from the same load may advance the expected version.
      // A failed predecessor blocks its dependent snapshots until the caller explicitly reloads.
      if (predecessorGeneration === generation && previous.error)
        throw previous.error;
      const expectedVersion =
        predecessorGeneration === generation && previous.result
          ? previous.result.version
          : capturedVersion;
      const db = await database(workspace);
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite"),
          store = transaction.objectStore(STORE);
        let failure, nextVersion;
        const request = store.get("current");
        request.onsuccess = () => {
          const current = request.result,
            version = current?.version || 0;
          if (expectedVersion === null || expectedVersion !== version) {
            failure = Object.assign(
              new Error(
                "此空间已被另一窗口更新。当前内容尚未写入，请先导出当前内容，再重新载入并增量导入。",
              ),
              {
                code: "CONCURRENT_WRITE",
                workspace,
                currentVersion: version,
                expectedVersion,
              },
            );
            transaction.abort();
            return;
          }
          nextVersion = version + 1;
          store.put(
            {
              ...current,
              ...(workspace === "formal" ? { workspaceMigration: 1 } : {}),
              version: nextVersion,
              savedAt: new Date().toISOString(),
              workspace,
              state: snapshot,
            },
            "current",
          );
        };
        transaction.oncomplete = () => {
          if (slot.generation === generation) slot.loadedVersion = nextVersion;
          resolve({
            state: snapshot,
            version: nextVersion,
            workspace,
            report: { added: 0, unchanged: 0, conflicts: 0 },
          });
        };
        transaction.onerror = () =>
          reject(failure || transaction.error || new Error("保存失败"));
        transaction.onabort = () =>
          reject(
            failure ||
              transaction.error ||
              new Error("保存事务已中止；原数据未改变"),
          );
      });
    });
  slot.pending = operation;
  slot.pendingGeneration = generation;
  return operation;
}
export function exportBackup(state, options = {}) {
  const workspace = workspaceName(options);
  validateState(state);
  if (workspace === "formal" && state.settings.demo === true)
    throw mismatch("demo", "formal");
  const snapshot = workspace === "formal" ? prepareFormalBackup(state).state : state;
  return new Blob(
    [
      JSON.stringify(
        {
          format: "NextRound",
          workspace,
          exportedAt: new Date().toISOString(),
          state: stripScriptHistory(upgradeLegacyInterviewStatuses(snapshot)),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
}
/** File imports never write by themselves and never cross workspace boundaries. */
export async function importBackup(file, state, options = {}) {
  const workspace = workspaceName(options);
  let payload;
  try {
    payload =
      typeof file === "string"
        ? JSON.parse(file)
        : typeof file?.text === "function"
          ? JSON.parse(await file.text())
          : structuredClone(file);
  } catch {
    throw new Error("无法读取备份：文件不是有效的 JSON。现有数据未改变。");
  }
  if (payload?.format === "NextRoundLegacyRecovery")
    throw new Error(
      "这是已停用的旧版混合恢复包，不能作为正式或演示备份导入。现有数据未改变。",
    );
  if (payload?.format !== undefined && payload.format !== "NextRound")
    throw new Error("备份格式不属于 NextRound。");
  const incoming = payload?.format === "NextRound" ? payload.state : payload;
  const sourceWorkspace = backupWorkspace(payload, incoming);
  if (sourceWorkspace !== workspace) throw mismatch(sourceWorkspace, workspace);
  const mode = options.mode ?? "merge";
  if (!["merge", "replace"].includes(mode)) throw new Error("未知的导入方式。");
  if (mode === "replace") {
    // Replacement must be self-contained: local references cannot repair an incomplete file.
    validateState(incoming);
    return {
      state: stripScriptHistory(upgradeLegacyInterviewStatuses(incoming)),
      report: { added: COLLECTIONS.reduce((n, key) => n + (incoming[key] || []).length, 0), unchanged: 0, conflicts: incoming.conflicts.length },
    };
  }
  // Validate original snapshots before stripping, so invalid historical payloads still fail.
  validateState(state);
  validateState(incoming, state);
  const merged = mergeData(stripScriptHistory(state), stripScriptHistory(incoming));
  return { ...merged, state: stripScriptHistory(merged.state) };
}
