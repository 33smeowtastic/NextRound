import { readFile, readdir, mkdir, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { SEO_PUBLIC_FILES } from "./seo.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const publicDocs = ["docs/ASSETS.md", "docs/DATA-MODEL.md", "docs/UI-VERIFICATION.md", "docs/UI-STANDARDS.md", "docs/TESTING.md", "docs/OPEN-SOURCE.md", "docs/SEO.md", "docs/RELEASE-AUDIT.md", "docs/DEPLOYMENT.md", "docs/releases/v1.0.0.md"];
export const releaseScripts = ["scripts/release-files.mjs", "scripts/build-public.mjs", "scripts/build-source.mjs", "scripts/browser-tests.mjs", "scripts/run-browser-tests.mjs", "scripts/seo.mjs"];
export const rootDocs = [".gitattributes", ".gitignore", "README.md", "AGENTS.md", "DESIGN.md", "PRODUCT.md", "LICENSE", "ASSET-LICENSE.md", "THIRD-PARTY-NOTICES.md", "package.json", "package-lock.json", "server.mjs", "seo.config.json", "CHANGELOG.md", "RELEASE-NOTES.md"];

export async function runtimeFiles() {
  const sw = await readFile(path.join(root, "sw.js"), "utf8");
  const list = sw.match(/const FILES = \[([\s\S]*?)\];/);
  if (!list) throw new Error("Missing service-worker runtime list");
  const files = new Set(["404.html", "sw.js", "LICENSE", "ASSET-LICENSE.md", "THIRD-PARTY-NOTICES.md", ...SEO_PUBLIC_FILES]);
  for (const [, entry] of list[1].matchAll(/^\s*"([^"\n]+)"\s*,?\s*$/gm)) {
    if (entry === "./") continue;
    const relative = entry.replace(/^\.\//, "").split("?")[0];
    if (relative.includes("\\") || relative.split("/").some(part => !part || part.startsWith(".")) || path.isAbsolute(relative)) throw new Error("Invalid public path");
    files.add(relative);
  }
  if (!files.has("index.html") || !files.has("app.js")) throw new Error("Incomplete runtime list");
  async function licenses(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error("Symlink assets are not eligible for release");
      if (entry.isDirectory()) await licenses(relative);
      else if (/\.txt$/i.test(entry.name) && /OFL|LICENSE/i.test(entry.name)) files.add(relative);
    }
  }
  await licenses("assets");
  return [...files].sort();
}

export async function sourceFiles() {
  const { BROWSER_TESTS } = await import("./browser-tests.mjs");
  const files = new Set([...await runtimeFiles(), ...rootDocs, ...publicDocs, ...releaseScripts,
    ".github/workflows/checks.yml", ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/ISSUE_TEMPLATE/feature_request.yml", ".github/ISSUE_TEMPLATE/config.yml",
    "tests/browser-support.mjs", "tests/workspaces-browser.js",
    // This immutable historical template is a regression fixture, not a candidate image.
    "assets/NextRound_AI整理与一键导入通用模板_V1.2_仅面试后复盘.md"]);
  for (const test of BROWSER_TESTS) files.add(typeof test === "string" ? `tests/${test}` : test.file);
  for (const entry of await readdir(path.join(root, "tests"), { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith(".test.js")) files.add(`tests/${entry.name}`);
  return [...files].sort();
}

export function assertPublishable(relative, bytes) {
  const text = bytes.toString("utf8");
  if (/[A-Z]:[\\/](?:Users|Coding)[\\/]|\/(?:Users|home)\/[^/\s]+\//i.test(text)) throw new Error(`Private machine path in ${relative}`);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bAKIA[0-9A-Z]{16}\b/.test(text)) throw new Error(`Credential signature in ${relative}`);
}

export async function writeSnapshot(target, files, format, overrides = new Map()) {
  const items = [];
  for (const relative of [...new Set(files)].sort()) {
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || (await lstat(file)).isSymbolicLink()) throw new Error("Unsafe release file");
    const bytes = overrides.get(relative) || await readFile(file);
    assertPublishable(relative, bytes);
    items.push({ relative, bytes });
  }
  // Refuse all existing targets: never silently retain stale private files.
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(target);
  const sw = await readFile(path.join(root, "sw.js"), "utf8");
  const manifest = { format, createdAt: new Date().toISOString(), cache: sw.match(/const CACHE = "([^"]+)"/)[1], files: [] };
  for (const item of items) {
    const destination = path.join(target, item.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, item.bytes);
    manifest.files.push({ path: item.relative, bytes: item.bytes.length, sha256: createHash("sha256").update(item.bytes).digest("hex") });
  }
  await writeFile(path.join(target, format === "NextRound-source" ? "source-manifest.json" : "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { directory: target, files: manifest.files.length, bytes: manifest.files.reduce((sum, item) => sum + item.bytes, 0) };
}
