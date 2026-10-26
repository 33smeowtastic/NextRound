import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { chromium, baseUrl, testOutput } from "./browser-support.mjs";
const require = createRequire(import.meta.url);
const output = await testOutput(import.meta.url);
const report = { checks: [], axe: [], errors: [], manualReviewRequired: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ["--disable-gpu", "--mute-audio"] });
const check = (value, label) => { assert.ok(value, label); report.checks.push(label); };
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await context.addInitScript(theme => localStorage.setItem("nextround-theme", theme), theme);
    await page.goto(new URL("#/dashboard", baseUrl).href);
    await page.locator("html:not([data-starting])").waitFor();
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const axe = async label => {
      const result = await page.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
        return { violations: result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })), incomplete: result.incomplete.map(item => item.id) };
      });
      report.axe.push({ theme, label, ...result });
      for (const id of result.incomplete) report.manualReviewRequired.push(`${theme}/${label}/${id}`);
      check(result.violations.length === 0, `${theme}: ${label} has no automatic A/AA violations`);
    };
    check(await page.locator(".agenda-week").getAttribute("role") === "group", `${theme}: weekly date navigation has a nameable group role`);
    const hoverContrast = async (control, label) => {
      await control.hover();
      const ratio = await control.evaluate(element => {
        const color = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => { const n = channel / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        const luminance = rgb => rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        const style = getComputedStyle(element), a = luminance(color(style.color)), b = luminance(color(style.backgroundColor));
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      check(ratio >= 4.5, `${theme}: ${label} hover text contrast is at least 4.5:1`);
    };
    const date = page.locator("#agenda-date");
    await date.click();
    let popup = page.locator(".themed-date-popup");
    await popup.waitFor();
    check(await date.getAttribute("aria-expanded") === null, `${theme}: native date input has no prohibited aria-expanded`);
    check(await date.getAttribute("aria-haspopup") === "dialog", `${theme}: native date input identifies its popup type`);
    check(await date.evaluate(element => { const popup = document.getElementById(element.getAttribute("aria-controls")); return popup?.getAttribute("role") === "dialog" && popup.getClientRects().length > 0; }), `${theme}: the native date control references a live visible dialog (manual ARIA idref check)`);
    check(await popup.locator('[role="row"]').count() === 6 && await popup.locator('[role="gridcell"]').count() === 42, `${theme}: date grid has six accessible seven-day rows`);
    await axe("day calendar");
    await hoverContrast(popup.locator("[data-calendar-mode]"), "calendar heading");
    const focusedDay = () => page.evaluate(() => document.activeElement?.dataset.date);
    const original = await focusedDay();
    await page.keyboard.press("ArrowRight");
    check(await focusedDay() !== original, `${theme}: date arrows move the real focused day`);
    await page.keyboard.press("PageDown");
    check(await popup.locator('[data-date][tabindex="0"]').count() === 1, `${theme}: month navigation preserves exactly one date tab stop`);
    await popup.locator("[data-calendar-mode]").click();
    check(await popup.locator('[data-calendar-choice][aria-pressed="true"]').count() === 1, `${theme}: month choices expose their selected state as buttons`);
    await axe("month calendar");
    await popup.locator("[data-calendar-mode]").click();
    await axe("year calendar");
    await page.keyboard.press("Escape");
    check(await date.evaluate(element => document.activeElement === element), `${theme}: Escape returns focus to the original date control`);
    check(await date.getAttribute("aria-haspopup") === null, `${theme}: closing restores the trigger's original attributes`);
    await page.locator('[data-action="agenda-new"]').first().click();
    const form = page.locator("#agenda-form");
    await form.waitFor();
    const datetime = form.locator('[name="startsAt"]');
    await datetime.click();
    popup = page.locator(".themed-datetime-local-popup");
    await popup.waitFor();
    await axe("datetime calendar inside native editor dialog");
    await hoverContrast(popup.locator("[data-calendar-clear]"), "calendar secondary action");
    await hoverContrast(popup.locator("[data-calendar-apply]"), "calendar primary action");
    if (theme === "light") check(await popup.locator("[data-calendar-apply]").evaluate(element => { const [red, green] = getComputedStyle(element).backgroundColor.match(/[\d.]+/g).map(Number); return red >= green; }), "Light datetime apply action follows the gold world instead of green");
    await popup.locator('[data-date][tabindex="0"]').focus();
    await page.keyboard.press("Tab");
    check(await popup.locator("[data-time-hour]").evaluate(element => document.activeElement === element), `${theme}: Tab reaches the hour field without closing the picker`);
    await page.keyboard.press("Tab");
    check(await popup.locator("[data-time-minute]").evaluate(element => document.activeElement === element), `${theme}: Tab reaches the minute field`);
    await page.keyboard.press("Shift+Tab");
    check(await popup.locator("[data-time-hour]").evaluate(element => document.activeElement === element), `${theme}: Shift+Tab returns to the hour field`);
    await popup.locator("[data-time-hour]").fill("10");
    await popup.locator("[data-time-minute]").fill("17");
    await popup.locator("[data-calendar-apply]").click();
    check((await datetime.inputValue()).endsWith("T10:17"), `${theme}: the actual native datetime field receives the selected time`);
    check(await datetime.evaluate(element => document.activeElement === element), `${theme}: time commit restores focus within the editor`);
    await datetime.click(); await page.keyboard.press("Escape");
    check((await datetime.inputValue()).endsWith("T10:17"), `${theme}: Escape does not clear or alter the selected value`);
    await page.locator('[data-action="agenda-close"]').first().click();
    // Exercise the shared native time chooser without persisting a business fixture.
    await page.evaluate(() => {
      const label = document.createElement("label"); label.textContent = "时间控件回归";
      const input = document.createElement("input"); input.id = "standards-time-fixture"; input.type = "time"; input.value = "09:00";
      label.append(input); document.querySelector("main").prepend(label);
    });
    const time = page.locator("#standards-time-fixture");
    await time.click(); popup = page.locator(".themed-time-popup"); await popup.waitFor();
    await axe("native time picker");
    await popup.locator("[data-time-hour]").focus(); await page.keyboard.press("Tab");
    check(await popup.locator("[data-time-minute]").evaluate(element => document.activeElement === element), `${theme}: time-only picker allows keyboard access to minutes`);
    await page.keyboard.press("Escape");
    check(await time.inputValue() === "09:00" && await time.evaluate(element => document.activeElement === element), `${theme}: time-only Escape preserves value and returns focus`);
    await context.close();
  }
  check(report.errors.length === 0, "No browser runtime errors");
  report.result = "PASS";
} catch (error) { report.result = "FAIL"; report.failure = error.stack; throw error; }
finally { await writeFile(new URL("VERIFICATION.json", output), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ result: report.result, checks: report.checks.length, axeScans: report.axe.length, errors: report.errors, failure: report.failure })); }
