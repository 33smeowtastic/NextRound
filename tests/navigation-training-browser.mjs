import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
// launch + newContext creates disposable storage, never a persistent user profile.
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ["--disable-gpu", "--mute-audio"] });
const out = await testOutput(import.meta.url); await mkdir(out, { recursive: true });
const evidence = { date: new Date().toISOString(), checks: [], errors: [], layouts: [] };
const check = (value, label) => { assert.ok(value, label); evidence.checks.push(label); };
async function fresh(width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", serviceWorkers: "block", storageState: { cookies: [], origins: [] } });
  await context.addInitScript(() => { localStorage.setItem("nextround-theme", "dark"); window.__shared = []; Object.defineProperty(navigator, "share", { configurable: true, value: async (data) => { window.__shared.push(data); } }); });
  const page = await context.newPage(); page.on("pageerror", (error) => evidence.errors.push(error.message));
  // Refuse to run any application action unless this context has no databases.
  await page.goto(new URL("core.js", baseUrl).href);
  assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0, "Disposable browser context must start with no existing databases");
  return { context, page };
}
const ready = async (page) => page.locator("html:not([data-starting])").waitFor();
async function controls(page, width, height) {
  const result = await page.evaluate(() => ({ actions: [...document.querySelector(".side-utilities").children].map((node) => ({
    action: node.dataset.action || (node.hasAttribute("data-corner-share") ? "share" : node.getAttribute("href")),
    dots: node.querySelectorAll("svg.led-icon circle").length,
    y: node.getBoundingClientRect().y, x: node.getBoundingClientRect().x, width: node.getBoundingClientRect().width,
  })), cornerShares: document.querySelectorAll(".shell .site-controls [data-corner-share]").length, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
  assert.deepEqual(result.actions.map((a) => a.action), ["toggle-theme", "share", "#/settings", "#/"]);
  check(result.actions.every((a, i) => a.dots > 5 && (i === 0 || a.y > result.actions[i - 1].y)), `Four LED sidebar actions follow light/share/settings/home order at ${width}px`);
  check(result.cornerShares === 0 && !result.overflow, `Workspace corner has no duplicate share and no horizontal overflow at ${width}px`);
  const theme = page.locator(".side-utilities [data-action=toggle-theme]"); await theme.click();
  check(await theme.locator("svg.led-icon circle").count() > 5 && await theme.locator(".nav-label").count() === 1, `Theme toggling keeps LED artwork and its navigation label at ${width}px`);
  await page.locator(".side-utilities [data-corner-share]").click();
  check(await page.evaluate(expected => window.__shared.at(-1)?.url === expected, baseUrl), `Sidebar share exposes only the application entrance at ${width}px`);
  evidence.layouts.push({ width, height, ...result });
}
try {
  for (const [width, height] of [[390, 844], [320, 740], [1440, 900]]) {
    const { context, page } = await fresh(width, height);
    await page.goto(new URL("#/", baseUrl).href); await ready(page);
    const order = await page.locator(".portal .site-controls").evaluate((node) => [...node.children].map((button) => button.dataset.action || (button.hasAttribute("data-corner-share") ? "share" : button.className)));
    check(order[0] === "toggle-theme" && order[1] === "share", `Homepage theme control is first and share remains next at ${width}px`);
    assert.equal(await page.locator(".poster-motto").textContent(), "Solve et Coagula");
    await page.locator(".portal [data-action=toggle-theme]").hover();
    const lampHover = await page.locator(".portal [data-action=toggle-theme]").evaluate((node) => getComputedStyle(node).backgroundColor);
    await page.locator(".portal [data-corner-share]").hover();
    const shareHover = await page.locator(".portal [data-corner-share]").evaluate((node) => getComputedStyle(node).backgroundColor);
    check(lampHover === shareHover, `Homepage lamp hover matches its neighbouring controls at ${width}px`);
    await page.locator(".portal [data-action=toggle-theme]").click(); assert.equal(await page.locator(".poster-motto").textContent(), "Invenies Occultum Lapidem");
    await page.locator(".portal [data-action=toggle-theme]").hover();
    const lightLampHover = await page.locator(".portal [data-action=toggle-theme]").evaluate((node) => getComputedStyle(node).backgroundColor);
    await page.locator(".portal [data-corner-share]").hover();
    check(lightLampHover === await page.locator(".portal [data-corner-share]").evaluate((node) => getComputedStyle(node).backgroundColor), `Light homepage lamp hover also matches its neighbours at ${width}px`);
    await page.locator(".portal [data-action=toggle-theme]").click(); assert.equal(await page.locator(".poster-motto").textContent(), "Solve et Coagula");
    check(true, `Both homepage mottoes update immediately at ${width}px`);
    await page.locator('.entry-cta[href="#/dashboard"]').click(); await page.locator(".shell").waitFor(); await controls(page, width, height);
    await page.locator('.sidebar>.nav a[href="#/train"]').click(); await page.locator(".training-layout").waitFor();
    check(await page.locator(".train-config[open]").count() === 1 && await page.locator("#train-difficulty").count() === 1, `Formal entry reaches a complete training room after workspace reset at ${width}px`);
    await page.locator('[data-action=train-mode][data-mode=self]').click(); assert.equal(await page.locator("#train-script option").count(), 1);
    await page.locator('[data-action=timer-toggle]').click(); await page.waitForFunction(() => document.querySelector('[data-action="timer-toggle"]')?.textContent.includes("暂停训练"));
    await page.locator('[data-action=timer-toggle]').click(); await page.locator('[data-action=timer-reset]').click();
    check(true, `An empty formal profile supports free introduction training without jobs or scripts at ${width}px`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: artifactPath(`training-formal-${width}.png`, out), fullPage: true });
    await page.locator('.side-utilities [data-action=toggle-theme]').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: artifactPath(`training-formal-dark-${width}.png`, out), fullPage: true });
    await page.locator('.side-utilities a[href="#/"]').click(); await page.locator("[data-action=demo]").click();
    await page.locator('.sidebar>.nav a[href="#/train"]').click(); await page.locator(".training-layout").waitFor(); await page.locator('[data-action=draw-question]').click();
    check(!(await page.locator(".training-question").textContent()).includes("选择本次训练范围"), `Demo entry reaches training and draws a real question at ${width}px`);
    await context.close();
  }
  const { context, page } = await fresh();
  await page.goto(new URL("#/", baseUrl).href); await ready(page); await page.locator('.entry-cta[href="#/dashboard"]').click();
  await page.locator('.sidebar>.nav a[href="#/knowledge"]').click(); await page.locator('[data-tab=scripts]').click(); await page.locator('[data-action=new-script]').first().click();
  await page.locator('#entity-form [name=title]').fill("独立测试介绍稿"); await page.locator('#entity-form [name=content]').fill("通过正常编辑器创建的正文保持完整");
  await page.locator('#entity-form button[type=submit]').click(); await page.locator('#editor-dialog').waitFor({ state: 'detached' });
  const before = await page.evaluate(async () => (await (await import('./db.js')).loadState()).scripts);
  await page.locator('.side-utilities a[href="#/"]').click(); await page.locator('.entry-cta[href="#/dashboard"]').click();
  await page.locator('.sidebar>.nav a[href="#/train"]').click(); await page.locator(".training-layout").waitFor(); await page.locator('[data-action=train-mode][data-mode=self]').click();
  check(await page.locator('#train-script option').filter({ hasText: '独立测试介绍稿' }).count() === 1, 'A script created through the normal editor remains selectable after homepage re-entry');
  const after = await page.evaluate(async () => (await (await import('./db.js')).loadState()).scripts);
  assert.deepEqual(after, before); check(true, 'Training reset preserves the saved script and all its original fields'); await context.close();
  assert.deepEqual(evidence.errors, []); evidence.result = "PASS";
} catch (error) { evidence.result = "FAIL"; evidence.failure = error.stack; throw error; }
finally { await writeFile(new URL("VERIFICATION.json", out), JSON.stringify(evidence, null, 2)); await browser.close(); console.log(JSON.stringify(evidence, null, 2)); }
