import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { root, assertPublishable, sourceFiles } from "../scripts/release-files.mjs";

// CLI subprocesses are not nested Node test workers. Do not inherit test/IPC context.
const cliEnvironment = { ...process.env };
for (const key of ["NODE_TEST_CONTEXT", "NODE_CHANNEL_FD", "NODE_CHANNEL_SERIALIZATION_MODE"]) delete cliEnvironment[key];
const cliOptions = { env: cliEnvironment, timeout: 30000 };
const runCli = promisify(execFile);

test("public source includes runnable tests, immutable fixtures and licenses, excludes local artifacts", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "nextround-source-test-"));
  try {
    const target = path.join(temp, "source");
    await runCli(process.execPath, [path.join(root, "scripts/build-source.mjs"), target], cliOptions);
    const manifest = JSON.parse(await readFile(path.join(target, "source-manifest.json"), "utf8"));
    const names = manifest.files.map(file => file.path);
    for (const required of ["app.js", "server.mjs", "package-lock.json", "LICENSE", "ASSET-LICENSE.md", "THIRD-PARTY-NOTICES.md", "scripts/build-source.mjs", "scripts/run-browser-tests.mjs", "tests/unified-import.test.js", "tests/training-finish-workspace-browser.mjs", "assets/NextRound_AI整理与一键导入通用模板_V1.2_仅面试后复盘.md"]) assert.ok(names.includes(required), required);
    assert.deepEqual(names, await sourceFiles());
    assert.ok(names.every(name => !/^(artifacts|\.impeccable|dist|\.git)\//.test(name)));
    assert.ok(!names.some(name => /original\.(png|jpg)$|extraction-candidate|shutdown|workspaces-browser-results\.json/.test(name)));
    for (const relative of names.filter(name => /\.md$/.test(name))) {
      const content = await readFile(path.join(target, relative), "utf8");
      for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const link = match[1];
        if (/^(?:[a-z]+:|#)/i.test(link)) continue;
        const destination = path.resolve(path.dirname(path.join(target, relative)), decodeURIComponent(link.split("#")[0]));
        assert.ok(destination.startsWith(target + path.sep), `${relative}: link escapes source`);
        await assert.doesNotReject(stat(destination), `${relative}: missing linked file ${link}`);
      }
    }
    await assert.rejects(runCli(process.execPath, [path.join(root, "scripts/build-source.mjs"), target], cliOptions), error => /EEXIST/.test(error.stderr));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("release scanner fails on private machine paths and credential signatures, without logging their contents", () => {
  const privatePath = ["C:", "Users", "example", "private"].join(String.fromCharCode(92));
  assert.throws(() => assertPublishable("notes.md", Buffer.from(privatePath)), /Private machine path in notes.md/);
  const secret = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  assert.throws(() => assertPublishable("secret.txt", Buffer.from(secret)), /Credential signature in secret.txt/);
  assert.doesNotThrow(() => assertPublishable("README.md", Buffer.from("Copyright Brothforge; https://example.org")));
});
