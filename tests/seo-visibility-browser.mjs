import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium, baseUrl, testOutput } from "./browser-support.mjs";
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ["--disable-gpu", "--mute-audio"] });
const output = await testOutput(import.meta.url), report = { checks: [], errors: [], network: [] };
const check = (value, label) => { assert.ok(value, label); report.checks.push(label); };
const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
const page = await context.newPage(); page.on("pageerror", error => report.errors.push(error.message));page.on("request", request => report.network.push(request.url()));
try {
  for (const [route, language, headline] of [["about/", "zh-CN", "让面试准备"], ["en/", "en", "Keep interview preparation"]]) {
    await page.goto(new URL(route, baseUrl).href);
    check((await page.locator("h1").textContent()).includes(headline), `${language}: full heading is visible without JavaScript`);
    check(await page.locator("html").getAttribute("lang") === language, `${language}: document language is declared`);
    check(await page.locator("main section").count() >= 5, `${language}: complete product, workflow, privacy and limitation content is static`);
    check(await page.locator('a[href="../examples/interview-prep.json"]').isVisible(), `${language}: the real fictional example is reachable`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}: mobile description has no horizontal page overflow`);
    const original = await (await context.request.get(new URL(route, baseUrl).href)).text();
    for (const agent of ["Googlebot", "bingbot", "Baiduspider", "OAI-SearchBot", "Claude-SearchBot"]) {
      const response = await context.request.get(new URL(route, baseUrl).href, { headers: { "User-Agent": agent } });
      check(response.status() === 200 && await response.text() === original, `${language}: simulated ${agent} gets the same public HTML`);
    }
  }
  for (const [resource, mime] of [["robots.txt", "text/plain"], ["sitemap.xml", "application/xml"], ["examples/interview-prep.json", "application/json"]]) {
    const response = await context.request.get(new URL(resource, baseUrl).href);
    check(response.status() === 200 && response.headers()["content-type"]?.includes(mime), `${resource}: actual HTTP status and MIME are correct`);
  }
  check((await context.request.get(new URL("docs/RELEASE-AUDIT.md", baseUrl).href)).status() === 404, "Private maintenance documentation remains outside the site server boundary");
  await page.goto(baseUrl);
  await page.locator('noscript a[href="./about/"]').click();
  check((await page.locator("h1").textContent()).includes("让面试准备"), "The no-JavaScript application fallback leads to readable product information");
  check(report.network.every(url => new URL(url).origin === new URL(baseUrl).origin), "Static descriptions load no automatic third-party resources");
  check(report.errors.length === 0, "No browser runtime errors");
  report.result = "PASS";
} catch (error) { report.result = "FAIL"; report.failure = error.stack; throw error; }
finally { await writeFile(new URL("VERIFICATION.json", output), JSON.stringify(report, null, 2)); await context.close(); await browser.close(); console.log(JSON.stringify({ result: report.result, checks: report.checks.length, errors: report.errors, failure: report.failure })); }
