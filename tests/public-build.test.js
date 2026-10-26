import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// CLI subprocesses are not nested Node test workers. Do not inherit test/IPC context.
const cliEnvironment = { ...process.env };
for (const key of ["NODE_TEST_CONTEXT", "NODE_CHANNEL_FD", "NODE_CHANNEL_SERIALIZATION_MODE"]) delete cliEnvironment[key];
const cliOptions = { env: cliEnvironment, timeout: 30000 };
const runCli = promisify(execFile);

test("public package contains the offline runtime and font licenses, without maintenance or stale files", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "nextround-public-test-"));
  const target = path.join(temp, "public");
  try {
    await runCli(process.execPath, [path.join(root, "scripts/build-public.mjs"), target], cliOptions);
    const manifest = JSON.parse(await readFile(path.join(target, "release-manifest.json")));
    const names = manifest.files.map(file => file.path);
    for (const required of ["404.html", "index.html", "sw.js", "app.js", "assets/v3-portal/demon-cutout.png", "assets/audio/hermetic-geometry-hell.mp3", "assets/Sora-OFL.txt"]) assert.ok(names.includes(required), required);
    assert.ok(names.every(name => !/^(docs|tests|artifacts|scripts|\.git)\//.test(name)));
    assert.ok(!names.includes("README.md") && !names.includes("server.mjs"));
    for (const file of manifest.files) {
      const bytes = await readFile(path.join(target, file.path));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
    }
    await assert.rejects(runCli(process.execPath, [path.join(root, "scripts/build-public.mjs"), target], cliOptions), error => /EEXIST/.test(error.stderr), "Refuse reusing an existing directory for the actual EEXIST reason");
    assert.equal((await readdir(target)).filter(name => name === "release-manifest.json").length, 1);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
