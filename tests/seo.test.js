import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seoArtifacts, productionUrl, verificationMetadata } from "../scripts/seo.mjs";
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

test("public ownership tags use fixed provider names and omit unconfigured providers", () => {
  assert.equal(verificationMetadata(), "");
  assert.equal(verificationMetadata({}), "");
  assert.equal(verificationMetadata({ bing: "Bing_123", google: "Google-123" }), '<meta name="google-site-verification" content="Google-123"><meta name="msvalidate.01" content="Bing_123">');
  assert.equal(verificationMetadata({ baidu: "codeva-123" }), '<meta name="baidu-site-verification" content="codeva-123">');
});

test("ownership metadata rejects unsupported fields and malformed token values", () => {
  for (const value of [null, [], "google", { apiToken: "not-a-real-api-token" }, { google: 'token"><script>alert(1)</script>' }, { bing: "has spaces" }, { baidu: "" }, { google: "x".repeat(257) }, { bing: 123 }, { google: null }, JSON.parse('{"__proto__":"not-a-provider"}'), Object.create({ google: "inherited" })]) assert.throws(() => verificationMetadata(value), /verification/);
});

test("configured ownership tags are generated only in the homepage head without mutating inputs", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "nextround-seo-verification-"));
  try {
    const original = '<!doctype html><html><head><title>Fixture</title></head><body>Fixture</body></html>';
    const config = { siteUrl: "https://example.org/", searchAccess: "allow", trainingAccess: "disallow", verification: { google: "Google-123", bing: "Bing_123", baidu: "codeva-123" } };
    await Promise.all([
      writeFile(path.join(directory, "index.html"), original),
      writeFile(path.join(directory, "package.json"), JSON.stringify({ version: "1.0.0" })),
      writeFile(path.join(directory, "seo.config.json"), JSON.stringify(config)),
    ]);
    const files = await seoArtifacts(directory), second = await seoArtifacts(directory);
    const html = files.get("index.html").toString();
    for (const name of ["google-site-verification", "msvalidate.01", "baidu-site-verification"]) {
      assert.equal((html.match(new RegExp(`name="${name.replaceAll(".", "\\.")}"`, "g")) || []).length, 1);
      assert.ok(html.indexOf(`name="${name}"`) < html.indexOf("</head>"));
      assert.ok(!files.get("about/index.html").toString().includes(`name="${name}"`));
      assert.ok(!files.get("en/index.html").toString().includes(`name="${name}"`));
    }
    for (const [relative, bytes] of files) assert.deepEqual(bytes, second.get(relative), relative);
    assert.equal(await readFile(path.join(directory, "index.html"), "utf8"), original);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, "seo.config.json"), "utf8")), config);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
