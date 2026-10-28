import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import { ACCENT_STORAGE_KEY } from "../theme-accent.js";

const out = await testOutput(import.meta.url);
const report = { checks: [], errors: [] };
const check = (condition, label) => { assert.ok(condition, label); report.checks.push(label); };
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ["--disable-gpu", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
const panel = page.locator('.settings-panel[data-section="accent"]');
const picker = panel.locator("[data-accent-picker]");
const hex = panel.locator("[data-accent-hex]");
const pinned = panel.locator('[data-action="accent-apply"]');
const ready = () => page.locator('html:not([data-starting])').waitFor();
try {
  await page.goto(new URL("core.js", baseUrl).href);
  check(await page.evaluate(async () => (await indexedDB.databases()).length) === 0, "theme test starts in disposable empty storage");
  await page.goto(new URL("#/settings", baseUrl).href);
  await ready();
  await panel.locator("summary").click();
  check(await picker.inputValue() === "#d1b98d" && await panel.locator(".accent-slot").count() === 7, "default light accent and seven empty slots are visible");
  await picker.fill("#4e70d2");
  check(await page.locator("body").getAttribute("data-user-accent") === "light" && await hex.inputValue() === "#4E70D2", "native color picker applies a light accent immediately");
  check(await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const active = document.querySelector('.accent-mode-switch button[aria-pressed="true"]');
    return body.getPropertyValue("--signal").trim() === body.getPropertyValue("--user-accent-fill").trim()
      && getComputedStyle(active).backgroundColor !== "rgba(0, 0, 0, 0)";
  }), "selected controls use the chosen accent token");
  await hex.fill("#234e91");
  await hex.press("Tab");
  check(await picker.inputValue() === "#234e91", "typing a valid HEX color updates the palette");
  const colors = ["#234e91", "#a64e68", "#27827a", "#7b5fc2", "#a56b24", "#4282ba", "#91528b"];
  for (const color of colors) {
    await picker.fill(color);
    await panel.locator('[data-action="accent-pin"]').click();
  }
  check(await pinned.count() === 7 && await panel.locator('[data-action="accent-pin"]').isDisabled(), "seven distinct colors can be pinned and an eighth is blocked");
  await pinned.first().click();
  check(await picker.inputValue() === colors[0], "clicking a pinned color applies it to the current theme");
  await panel.locator('[data-action="accent-remove"][data-slot="6"]').click();
  check(await pinned.count() === 6, "a pinned color can be removed without shifting other slots");
  await page.screenshot({ path: artifactPath("accent-light-desktop.png", out) });
  await panel.locator('[data-action="accent-mode"][data-mode="dark"]').click();
  check(await page.locator("body.theme-dark").count() === 1 && await picker.inputValue() === "#bff55c", "dark theme keeps an independent default accent");
  await picker.fill("#ad43db");
  check(await page.evaluate(() => {
    const badge = document.createElement("span"); badge.className = "badge green";
    document.querySelector(".shell").append(badge);
    const color = getComputedStyle(badge).color; badge.remove();
    return color === "rgb(191, 245, 92)";
  }), "semantic green tags remain green under a custom dark accent");
  await page.screenshot({ path: artifactPath("accent-dark-desktop.png", out) });
  await panel.locator('[data-action="accent-mode"][data-mode="light"]').click();
  check(await picker.inputValue() === colors[0], "switching back restores the separate light accent");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), ACCENT_STORAGE_KEY);
  check(saved.light === colors[0] && saved.dark === "#ad43db" && saved.pinned.filter(Boolean).length === 6, "both theme choices and fixed slots persist locally");
  await page.reload(); await ready(); await panel.locator("summary").click();
  check(await picker.inputValue() === colors[0] && await pinned.count() === 6, "reload restores current color and pinned slots");
  await panel.locator('[data-action="accent-reset"]').click();
  check(await picker.inputValue() === "#d1b98d" && await page.locator("body[data-user-accent]").count() === 0, "reset restores the original light palette without residual overrides");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: artifactPath("accent-light-mobile.png", out) });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "palette and seven slots fit a mobile viewport");
  await page.goto(new URL("#/", baseUrl).href); await ready();
  await page.evaluate(() => localStorage.setItem("nextround-theme", "dark"));
  await page.reload(); await ready();
  check(await page.locator("body[data-user-accent=dark]").count() === 1 && await page.locator(".portal-aura").first().evaluate(node => { const swatch = document.createElement("span"); swatch.style.color = "var(--user-portal-accent)"; document.body.append(swatch); const expected = getComputedStyle(swatch).color; swatch.remove(); return getComputedStyle(node).stroke === expected; }), "custom dark accent also reaches the homepage portal glow");
  const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const offlinePage = await offlineContext.newPage();
  offlinePage.on("pageerror", error => report.errors.push(error.message));
  await offlinePage.goto(new URL("#/settings", baseUrl).href);
  await offlinePage.locator('html:not([data-starting])').waitFor();
  await offlinePage.locator('.settings-panel[data-section="accent"] summary').click();
  await offlinePage.locator("[data-accent-picker]").fill("#6543ab");
  await offlinePage.evaluate(() => navigator.serviceWorker.ready);
  await offlinePage.waitForFunction(() => !!navigator.serviceWorker.controller);
  await offlineContext.setOffline(true);
  await offlinePage.reload();
  await offlinePage.locator('html:not([data-starting])').waitFor();
  await offlinePage.locator('.settings-panel[data-section="accent"] summary').click();
  check(await offlinePage.locator("[data-accent-picker]").inputValue() === "#6543ab"
    && await offlinePage.locator("body[data-user-accent=light]").count() === 1,
    "cached theme scripts and styles restore the chosen accent after an offline reload");
  await offlineContext.close();  assert.deepEqual(report.errors, []);
  report.result = "PASS";
} catch (error) { report.result = "FAIL"; report.failure = error.stack; throw error; }
finally { await writeFile(new URL("VERIFICATION.json", out), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report)); }
