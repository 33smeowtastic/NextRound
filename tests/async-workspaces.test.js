import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function original(name) {
  const start = source.search(
    new RegExp("^(?:async )?function " + name + "\\(", "m"),
  );
  assert.notEqual(start, -1);
  const next = source.slice(start + 1).search(/^(?:async )?function\s/m);
  return source.slice(start, next < 0 ? undefined : start + 1 + next);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const turn = () => new Promise(setImmediate);
function fixture() {
  const app = { inert: false, setAttribute() {}, removeAttribute() {} },
    dialogs = [],
    writes = [],
    notices = [],
    downloads = [];
  const state = {
    marker: "formal",
    settings: {},
    companies: [
      { id: "enterprise", kind: "enterprise" },
      { id: "public", kind: "public" },
    ],
    interviews: [
      {
        id: "first",
        companyId: "enterprise",
        attachmentIds: [],
        questions: [],
        weaknesses: "enterprise evidence",
      },
      {
        id: "second",
        companyId: "public",
        attachmentIds: [],
        questions: [],
        weaknesses: "public self review",
      },
    ],
    sessions: [],
    attachments: [],
  };
  const c = {
    state,
    activeWorkspace: "formal",
    workspaceBusy: false,
    switchingWorkspace: false,
    recordStream: null,
    editor: null,
    saveQueue: Promise.resolve(),
    saveError: false,
    train: { recording: false },
    view: {},
    route: "dashboard",
    location: { href: "http://localhost/#/dashboard" },
    history: { replaceState() {} },
    mobileNavOpen: false,
    structuredClone,
    Blob,
    URL,
    Date,
    Promise,
    window: { confirm: () => true },
    spaceTitle: () => "正式档案",
    document: {
      querySelector: () => app,
      body: { append: (d) => dialogs.push(d) },
      createElement: () => ({
        innerHTML: "",
        addEventListener() {},
        remove() {},
        showModal() {
          this.shown = true;
        },
      }),
    },
    toast: (m) => notices.push(m),
    render() {},
    showUiDialog: (dialog) => dialog.showModal(),
    setRecordingActive() {},
    trainingLocked: () => false,
    flushEditor: () => true,
    closeEditor: () => {
      c.editor = null;
    },
    persist: async () => {},
    loadState: async () => ({ marker: "demo", settings: {} }),
    saveState: async (value, options) =>
      writes.push({ value, workspace: options.workspace }),
    exportBackup: () => new Blob(["backup"]),
    download: (...a) => downloads.push(a),
    importBackup: async (file, local) => {
      await file.text();
      return {
        state: { ...local, imported: true },
        report: { added: 1, conflicts: 0 },
      };
    },
    get: (kind, id) => c.state[kind].find((i) => i.id === id),
    create: (kind, p) => {
      const r = { id: "attachment-" + c.state[kind].length, ...p };
      c.state[kind].push(r);
      return r;
    },
    update: (kind, id, p) =>
      Object.assign(
        c.state[kind].find((i) => i.id === id),
        p,
      ),
    refreshEditor() {},
    readDataURL: async () => "",
    esc: (v) => String(v ?? ""),
    icon: () => "",
    companyName: (id) => id,
    fmtDate: () => "",
    organizationKind: (o) => o?.kind || "enterprise",
  };
  vm.createContext(c);
  for (const name of [
    "beginWorkspaceTask",
    "verifyWorkspaceTask",
    "endWorkspaceTask",
    "switchWorkspace",
    "importAll",
    "exportAll",
    "uploadAttachments",
    "showTrace",
    "toggleRecording",
  ])
    vm.runInContext(original(name), c);
  return { c, app, dialogs, writes, notices, downloads };
}
test("overlapping export cannot release import lease; switching remains blocked", async () => {
  const { c, app, writes, downloads } = fixture(),
    read = deferred();
  const operation = c.importAll({ text: () => read.promise });
  await turn();
  const lease = c.workspaceBusy;
  assert.ok(lease);
  assert.equal(app.inert, true);
  await c.exportAll();
  assert.equal(c.workspaceBusy, lease);
  assert.equal(downloads.length, 0);
  assert.equal(await c.switchWorkspace("demo"), false);
  assert.equal(c.activeWorkspace, "formal");
  read.resolve("{}");
  await operation;
  assert.equal(c.state.imported, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].workspace, "formal");
  assert.equal(c.workspaceBusy, false);
  assert.equal(app.inert, false);
});
test("stale import completion cannot apply to changed workspace", async () => {
  const { c, writes } = fixture(),
    read = deferred();
  const operation = c.importAll({ text: () => read.promise });
  await turn();
  const demo = { marker: "demo", settings: {} };
  c.activeWorkspace = "demo";
  c.state = demo;
  read.resolve("{}");
  await operation;
  assert.equal(c.state, demo);
  assert.equal(writes.length, 0);
  assert.equal(c.workspaceBusy, false);
});
for (const next of ["closed", "other"])
  test(
    "attachment retains original interview when editor is " + next,
    async () => {
      const { c } = fixture(),
        read = deferred();
      c.editor = {
        kind: "interviews",
        saved: true,
        id: "first",
        row: { attachmentIds: [] },
      };
      c.readDataURL = () => read.promise;
      const operation = c.uploadAttachments([
        { name: "private.webm", type: "audio/webm", size: 1 },
      ]);
      assert.ok(c.workspaceBusy);
      assert.equal(await c.switchWorkspace("demo"), false);
      c.editor =
        next === "closed"
          ? null
          : {
              kind: "interviews",
              saved: true,
              id: "second",
              row: { attachmentIds: [] },
            };
      read.resolve("data:audio/webm;base64,QQ==");
      await operation;
      assert.equal(c.activeWorkspace, "formal");
      assert.equal(c.state.attachments.length, 1);
      assert.equal(c.state.interviews[0].attachmentIds.length, 1);
      assert.equal(c.state.interviews[1].attachmentIds.length, 0);
      if (c.editor) assert.equal(c.editor.row.attachmentIds.length, 0);
      assert.equal(c.workspaceBusy, false);
    },
  );
test("interview trace resolves each organization without undefined lookup", () => {
  const { c, dialogs } = fixture();
  assert.doesNotThrow(() => c.showTrace(["first", "second"]));
  assert.equal(dialogs.length, 1);
  assert.equal(dialogs[0].shown, true);
  for (const value of [
    "enterprise evidence",
    "public self review",
    "自评待改进",
    "明确指出的不足",
  ])
    assert.ok(dialogs[0].innerHTML.includes(value));
});
test("microphone permission holds lease and rejection releases it", async () => {
  const { c, app } = fixture(),
    permission = deferred();
  c.navigator = { mediaDevices: { getUserMedia: () => permission.promise } };
  c.window = { MediaRecorder: function () {} };
  const operation = c.toggleRecording();
  assert.ok(c.workspaceBusy);
  assert.equal(await c.switchWorkspace("demo"), false);
  permission.reject(
    Object.assign(new Error("permission denied"), { name: "NotAllowedError" }),
  );
  await operation;
  assert.equal(c.activeWorkspace, "formal");
  assert.equal(c.workspaceBusy, false);
  assert.equal(app.inert, false);
});


test("replacement waits for the complete validated file before confirmation and writes only after approval", async () => {
  const { c, app, writes } = fixture(), read = deferred(), originalState = c.state;
  const confirmations = [];
  const parse = c.importBackup;
  let capturedMode;
  c.importBackup = async (file, local, options) => {
    capturedMode = options.mode;
    return parse(file, local);
  };
  c.window.confirm = (message) => {
    confirmations.push(message);
    assert.equal(writes.length, 0);
    assert.equal(c.state, originalState);
    assert.equal(app.inert, true);
    return true;
  };
  const operation = c.importAll({ name: "replacement.json", text: () => read.promise }, "replace");
  await turn();
  assert.equal(confirmations.length, 0);
  assert.equal(writes.length, 0);
  assert.equal(c.state, originalState);
  read.resolve("{}");
  await operation;
  assert.equal(capturedMode, "replace");
  assert.equal(confirmations.length, 1);
  assert.match(confirmations[0], /replacement.json/);
  assert.match(confirmations[0], /垃圾箱.*替换/);
  assert.equal(writes.length, 1);
  assert.equal(c.state.imported, true);
  assert.equal(c.workspaceBusy, false);
  assert.equal(app.inert, false);
});

test("cancelling replacement after validation leaves memory and persistence untouched and releases the lease", async () => {
  const { c, app, writes, notices } = fixture(), originalState = c.state;
  const before = structuredClone(originalState);
  let confirmed = 0;
  c.window.confirm = () => { confirmed++; return false; };
  await c.importAll({ name: "cancelled.json", text: async () => "{}" }, "replace");
  assert.equal(confirmed, 1);
  assert.equal(c.state, originalState);
  assert.deepEqual(c.state, before);
  assert.equal(writes.length, 0);
  assert.equal(c.workspaceBusy, false);
  assert.equal(app.inert, false);
  assert.ok(!notices.some((message) => message.includes("完成")));
});

test("invalid replacement is rejected before confirmation and before any write", async () => {
  const { c, writes } = fixture(), originalState = c.state;
  let confirmed = 0;
  c.importBackup = async () => { throw new Error("引用不存在"); };
  c.window.confirm = () => { confirmed++; return true; };
  await c.importAll({ name: "invalid.json", text: async () => "{}" }, "replace");
  assert.equal(confirmed, 0);
  assert.equal(writes.length, 0);
  assert.equal(c.state, originalState);
  assert.equal(c.workspaceBusy, false);
});

function trainingFixture() {
  const f = fixture(), c = f.c;
  c.train = { mode: "self", recording: false, running: true, elapsed: 4, started: 1, answered: [], questionId: "", companyId: "", jobId: "", scriptId: "", attachmentIds: [], ratingPercent: 60 };
  c.trainingStartedAt = "2026-10-26T00:00:00.000Z";
  c.setSave = () => {}; c.saveLabel = () => "save status";
  c.elapsed = () => c.train.elapsed;
  c.uid = () => "finished-session";
  c.touch = (row, patch) => ({ ...row, ...patch });
  c.validateState = () => true;
  c.openEditor = (kind, id) => { c.editor = { kind, id, workspace: c.activeWorkspace }; };
  c.stopRecording = async () => { c.train.recording = false; };
  vm.runInContext(original("finishTraining"), c);
  return f;
}

test("training completion holds its workspace through slow saving and blocks repeat completion", async () => {
  const { c, app, writes } = trainingFixture(), saving = deferred();
  c.saveState = async (value, options) => { await saving.promise; writes.push({ value, workspace: options.workspace }); };
  c.persist = () => saving.promise;
  const operation = c.finishTraining(); await turn();
  assert.ok(c.workspaceBusy); assert.equal(app.inert, true);
  assert.equal(await c.switchWorkspace("demo"), false);
  await c.finishTraining(); assert.equal(c.activeWorkspace, "formal");
  saving.resolve(); await operation;
  assert.equal(writes.length, 1); assert.equal(writes[0].workspace, "formal");
  assert.equal(c.state.sessions.length, 1); assert.equal(c.editor.id, "finished-session");
  assert.equal(c.workspaceBusy, false); assert.equal(app.inert, false);
});

test("training completion holds its lease while stopping recording and does not duplicate attachments", async () => {
  const { c, writes } = trainingFixture(), stopping = deferred();
  c.train.recording = true; c.train.attachmentIds = ["recording"];
  c.stopRecording = async () => { await stopping.promise; c.train.recording = false; };
  const operation = c.finishTraining(); await turn();
  assert.ok(c.workspaceBusy); assert.equal(writes.length, 0);
  assert.equal(await c.switchWorkspace("demo"), false);
  stopping.resolve(); await operation;
  assert.equal(writes.length, 1); assert.deepEqual([...c.state.sessions[0].attachmentIds], ["recording"]);
  assert.equal(c.train.attachmentIds.length, 0);
});

test("failed training save preserves the original state and retryable training without a success editor", async () => {
  const { c, notices } = trainingFixture(), before = structuredClone(c.state);
  c.train.attachmentIds = ["recording"]; c.state.settings.trainingDraft = { attachmentIds: ["recording"] };
  const originalTrain = structuredClone(c.train), originalDraft = structuredClone(c.state.settings.trainingDraft);
  c.saveState = async () => { throw new Error("storage failed"); };
  c.persist = async () => { throw new Error("storage failed"); };
  await c.finishTraining();
  assert.equal(c.state.sessions.length, before.sessions.length);
  assert.deepEqual(c.train, { ...originalTrain, running: false, started: null }); assert.deepEqual(c.state.settings.trainingDraft, originalDraft);
  assert.equal(c.editor, null); assert.equal(c.workspaceBusy, false);
  assert.ok(!notices.some(message => message.includes("训练已保存")));
  assert.ok(notices.some(message => message.includes("storage failed")));
});

test("stale training save never opens an old editor or applies its candidate after the workspace changes", async () => {
  const { c } = trainingFixture(), saving = deferred();
  c.saveState = () => saving.promise; c.persist = () => saving.promise;
  const operation = c.finishTraining(); await turn();
  const demo = { marker: "demo", settings: {}, sessions: [] };
  c.activeWorkspace = "demo"; c.state = demo;
  saving.resolve(); await operation;
  assert.equal(c.state, demo); assert.equal(c.state.sessions.length, 0); assert.equal(c.editor, null);
  assert.equal(c.workspaceBusy, false);
});

test("completion refuses to start while a workspace switch is already pending", async () => {
  const { c, writes } = trainingFixture(); c.switchingWorkspace = true;
  await c.finishTraining();
  assert.equal(writes.length, 0); assert.equal(c.state.sessions.length, 0); assert.equal(c.editor, null);
});

test("stale editor cannot flush a record into another workspace even when its ID is absent there", () => {
  const { c, writes, notices } = fixture(); c.editTimeout = null; c.clearTimeout = clearTimeout;
  c.editor = { workspace: "formal", kind: "sessions", id: "private-session", row: { id: "private-session" }, baseline: {} };
  c.activeWorkspace = "demo";
  let collected = false;
  c.$ = () => null;
  c.collectEditor = () => { collected = true; return {}; };
  vm.runInContext(original("flushEditor"), c);
  assert.equal(c.flushEditor(true), false);
  assert.equal(collected, false); assert.equal(writes.length, 0); assert.equal(c.state.sessions.length, 0);
  assert.ok(notices.some(message => message.includes("档案")));
});


test("training completion freezes elapsed time before a delayed save queue", async () => {
  const { c } = trainingFixture(), queued = deferred();
  let currentElapsed = 4;
  c.elapsed = () => currentElapsed;
  c.saveQueue = queued.promise;
  const operation = c.finishTraining();
  assert.equal(c.train.running, false);
  assert.equal(c.train.started, null);
  assert.equal(c.train.elapsed, 4);
  currentElapsed = 34;
  queued.resolve(); await operation;
  assert.equal(c.state.sessions[0].duration, 4);
});
