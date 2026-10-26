import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seoArtifacts, productionUrl } from "../scripts/seo.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("SEO artifacts expose matching, script-free bilingual descriptions and real application facts", async () => {
  const files = await seoArtifacts(root);
  for (const [relative, language] of [["about/index.html", "zh-CN"], ["en/index.html", "en"]]) {
    const html = files.get(relative).toString();
    assert.ok(html.includes(`lang="${language}"`));
    assert.ok(html.includes('<link rel="canonical"'));
    for (const lang of ["zh-CN", "en", "x-default"]) assert.ok(html.includes(`hreflang="${lang}"`));
    assert.ok(html.includes("examples/interview-prep.json"));
    assert.ok(!/<script(?![^>]*type="application\/ld\+json")/i.test(html));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema["@type"], "SoftwareApplication");
    assert.equal(schema.softwareVersion, JSON.parse(await readFile(path.join(root, "package.json"))).version);
    assert.equal(schema.inLanguage, "zh-CN");
    assert.equal(schema.aggregateRating, undefined);
  }
});

test("search is allowed while explicitly chosen training bots are restricted", async () => {
  const files = await seoArtifacts(root), robots = files.get("robots.txt").toString();
  for (const bot of ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"]) assert.ok(robots.includes(`User-agent: ${bot}\nDisallow: /`));
  assert.ok(robots.includes("User-agent: *\nAllow: /"));
  for (const bot of ["OAI-SearchBot", "Claude-SearchBot", "Googlebot", "bingbot", "Baiduspider"]) assert.ok(!robots.includes(`User-agent: ${bot}\nDisallow: /`));
  const sitemap = files.get("sitemap.xml").toString();
  assert.equal((sitemap.match(/<loc>/g) || []).length, 3);
  assert.ok(!sitemap.includes("#/"));
  assert.ok(!sitemap.includes("space=demo"));
});

test("SEO directory validation rejects insecure, credentialed and private development origins", () => {
  for (const value of ["http://example.org/", "https://user:password@example.org/", "https://example.org/?private=1", "https://example.org/#/private", "https://localhost/", "https://127.0.0.1/"]) assert.throws(() => productionUrl(value));
  assert.equal(productionUrl("https://example.org/project").href, "https://example.org/project/");
});

test("build SEO is deterministic and does not alter the application document", async () => {
  const before = await readFile(path.join(root, "index.html"));
  const first = await seoArtifacts(root), second = await seoArtifacts(root);
  for (const [relative, bytes] of first) assert.deepEqual(bytes, second.get(relative), relative);
  assert.deepEqual(await readFile(path.join(root, "index.html")), before);
  assert.equal((first.get("index.html").toString().match(/rel="canonical"/g) || []).length, 1);
});
