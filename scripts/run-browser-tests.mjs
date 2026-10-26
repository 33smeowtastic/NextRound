import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { BROWSER_TESTS } from "./browser-tests.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const requested = process.argv.slice(2);
if (requested.includes("--help")) {
  console.log("Usage: node scripts/run-browser-tests.mjs [suite ...]\n--list lists current suites. With no suite names, runs every current suite.\nNEXTROUND_BASE_URL reuses an existing application; otherwise a disposable loopback server is started.\nInstall the locked dev dependencies and Playwright Chromium before running; the runner never downloads them.");
  process.exit(0);
}
if (requested.includes("--list")) {
  console.log(BROWSER_TESTS.map(test => test.name).join("\n"));
  process.exit(0);
}
const unknown = requested.filter(name => !BROWSER_TESTS.some(test => test.name === name));
if (unknown.length) throw new Error(`Unknown browser suite: ${unknown.join(", ")}. Use --list.`);
const selected = requested.length ? BROWSER_TESTS.filter(test => requested.includes(test.name)) : BROWSER_TESTS;
const outputRoot = path.join(root, "test-results");
await mkdir(outputRoot, { recursive: true });
let server, runningTest, serverOutput = "";
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  interrupted = true;
  runningTest?.kill();
  server?.kill();
});

async function freePort() {
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
  const { port } = reservation.address();
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}
async function ready(baseUrl) {
  const deadline = Date.now() + 15000;
  let reason;
  while (Date.now() < deadline && !interrupted) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`Test server exited: ${serverOutput}`);
    try {
      const response = await fetch(new URL("index.html", baseUrl), { signal: AbortSignal.timeout(1000) });
      if (response.ok && /NextRound/.test(await response.text())) return;
      reason = `HTTP ${response.status}: expected the NextRound application index`;
    } catch (error) { reason = error.message; }
    await delay(100);
  }
  throw new Error(`Application was not ready at ${baseUrl}: ${reason || "interrupted"}`);
}
async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise(resolve => server.once("exit", resolve));
  server.kill();
  await Promise.race([exited, delay(3000)]);
  if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
}
const results = [];
try {
  let baseUrl = process.env.NEXTROUND_BASE_URL;
  if (!baseUrl) {
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}/`;
    server = spawn(process.execPath, [path.join(root, "server.mjs")], {
      cwd: root, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", chunk => { serverOutput += chunk; });
    server.stderr.on("data", chunk => { serverOutput += chunk; });
    server.on("error", error => { serverOutput += error.stack; });
  }
  const target = new URL(baseUrl);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("NEXTROUND_BASE_URL must be an HTTP(S) directory URL");
  target.search = ""; target.hash = "";
  if (!target.pathname.endsWith("/")) target.pathname += "/";
  baseUrl = target.href;
  await ready(baseUrl);
  console.log(`Browser target: ${baseUrl}`);
  for (const test of selected) {
    if (interrupted) break;
    const out = path.join(outputRoot, test.name);
    await mkdir(out, { recursive: true });
    const started = Date.now();
    console.log(`RUN ${test.name}`);
    let stdout = "", stderr = "";
    runningTest = spawn(process.execPath, [path.join(root, test.file)], {
      cwd: root, env: { ...process.env, NEXTROUND_BASE_URL: baseUrl }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    runningTest.stdout.on("data", chunk => { stdout += chunk; });
    runningTest.stderr.on("data", chunk => { stderr += chunk; });
    const exit = await new Promise(resolve => {
      runningTest.once("error", error => { stderr += error.stack; resolve({ code: 1, signal: null }); });
      runningTest.once("close", (code, signal) => resolve({ code, signal }));
    });
    runningTest = null;
    const result = { suite: test.name, result: exit.code === 0 ? "PASS" : "FAIL", exitCode: exit.code, signal: exit.signal, elapsedMs: Date.now() - started, baseUrl };
    results.push(result);
    await Promise.all([
      writeFile(path.join(out, "stdout.log"), stdout),
      writeFile(path.join(out, "stderr.log"), stderr),
      writeFile(path.join(out, "result.json"), JSON.stringify(result, null, 2) + "\n"),
    ]);
    console.log(`${result.result} ${test.name} (${result.elapsedMs} ms)`);
    if (result.result === "FAIL") console.error((stderr || stdout).slice(-6000));
  }
  await writeFile(path.join(outputRoot, "browser-results.json"), JSON.stringify({ date: new Date().toISOString(), baseUrl, results }, null, 2) + "\n");
  const failures = results.filter(result => result.result !== "PASS").length;
  console.log(`Browser suites: ${results.length - failures}/${selected.length} passed; evidence: test-results/`);
  if (failures || interrupted || results.length !== selected.length) process.exitCode = 1;
} finally {
  runningTest?.kill();
  await stopServer();
}
