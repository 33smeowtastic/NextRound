import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.NEXTROUND_BROWSER,
  args: ["--disable-gpu", "--mute-audio"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: "reduce",
});
const page = await context.newPage();
const out = await testOutput(import.meta.url);
await mkdir(out, { recursive: true });
const artifact = (name) => artifactPath(name, out);
const report = { date: new Date().toISOString(), checks: [], errors: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
const check = (value, label) => { assert.ok(value, label); report.checks.push(label); };
const state = () => page.evaluate(async () => (await import("./db.js")).loadState({ workspace: "formal" }));
const at = (offset, hour) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

try {
  await page.goto(new URL("core.js", baseUrl).href);
  await page.evaluate(async (records) => {
    const core = await import("./core.js"), db = await import("./db.js");
    await db.loadState({ workspace: "formal" });
    const archive = core.blankState();
    archive.companies = [core.touch({ id: "company" }, { name: "测试单位" })];
    archive.jobs = [core.touch({ id: "job" }, { companyId: "company", title: "设计师", status: "待面试" })];
    archive.interviews = [core.touch({ id: "interview" }, {
      companyId: "company", jobId: "job", round: "一面", status: "待面试",
      scheduledAt: records.interview, questions: [],
    })];
    archive.scheduleItems = [
      core.touch({ id: "past" }, { title: "过去的准备", type: "general", startsAt: records.past, notes: "" }),
      core.touch({ id: "today" }, { title: "今天的训练", type: "training", startsAt: records.today, notes: "" }),
      core.touch({ id: "future" }, { title: "后续复盘", type: "general", startsAt: records.future, notes: "" }),
    ];
    await db.saveState(archive, { workspace: "formal" });
  }, { past: at(-3, 9), today: at(0, 14), future: at(10, 15), interview: at(1, 11) });

  await page.goto(new URL("#/dashboard", baseUrl).href);
  await page.locator("#agenda-timeline").waitFor();
  await page.waitForFunction(() => {
    const list = document.querySelector("#agenda-timeline"), today = list?.querySelector(".agenda-day:has(em)");
    return list && today && Math.abs(today.getBoundingClientRect().top - list.getBoundingClientRect().top) < 5;
  });
  const layout = await page.evaluate(() => {
    const list = document.querySelector("#agenda-timeline"), week = document.querySelector(".agenda-week");
    const days = [...list.querySelectorAll(".agenda-day")].map((node) => node.textContent);
    return { days, overflow: getComputedStyle(list).overflowY, scrollable: list.scrollHeight > list.clientHeight,
      weekTop: week.getBoundingClientRect().top, windowY: scrollY };
  });
  check(layout.days.findIndex((text) => text.includes("过去的准备")) < layout.days.findIndex((text) => text.includes("今天的训练")), "Past schedule precedes today");
  check(layout.scrollable && ["auto", "scroll"].includes(layout.overflow), "Timeline is independently scrollable");
  const listBounds = await page.locator("#agenda-timeline").boundingBox();
  const beforeWheel = await page.locator("#agenda-timeline").evaluate((list) => list.scrollTop);
  const wheelPoint = { x: listBounds.x + listBounds.width / 2, y: listBounds.y + Math.min(40, listBounds.height / 2) };
  check(await page.evaluate(({x,y}) => !!document.elementFromPoint(x,y)?.closest('#agenda-timeline'), wheelPoint), "The wheel gesture targets the visible timeline rather than the fixed footer");
  await page.mouse.move(wheelPoint.x, wheelPoint.y);
  await page.mouse.wheel(0, -200);
  await page.waitForFunction((before) => document.querySelector("#agenda-timeline").scrollTop < before, beforeWheel);
  const stationary = await page.evaluate(() => ({
    weekTop: document.querySelector(".agenda-week").getBoundingClientRect().top,
    windowY: scrollY,
  }));
  check(Math.abs(stationary.weekTop - layout.weekTop) < 1 && stationary.windowY === layout.windowY, "Week calendar stays fixed while schedule list scrolls");

  const initialDate = await page.locator("#agenda-date").inputValue();
  const week = await page.locator(".agenda-week").boundingBox();
  await page.mouse.move(week.x + week.width * .78, week.y + week.height / 2);
  await page.mouse.down();
  await page.mouse.move(week.x + week.width * .22, week.y + week.height / 2, { steps: 6 });
  await page.mouse.up();
  const nextDate = await page.locator("#agenda-date").inputValue();
  check(Math.round((new Date(nextDate) - new Date(initialDate)) / 86400000) === 7, "Swipe left advances one week");
  await page.mouse.move(week.x + week.width * .22, week.y + week.height / 2);
  await page.mouse.down();
  await page.mouse.move(week.x + week.width * .78, week.y + week.height / 2, { steps: 6 });
  await page.mouse.up();
  check(await page.locator("#agenda-date").inputValue() === initialDate, "Swipe right returns to prior week");
  const touch = await context.newCDPSession(page);
  const touchY = Math.round(week.y + week.height / 2);
  const touchStartX = Math.round(week.x + week.width * .78);
  const touchEndX = Math.round(week.x + week.width * .22);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchStartX, y: touchY }] });
  for (let step = 1; step <= 6; step++) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: Math.round(touchStartX + (touchEndX - touchStartX) * step / 6), y: touchY }],
    });
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  check(Math.round((new Date(await page.locator("#agenda-date").inputValue()) - new Date(initialDate)) / 86400000) === 7, "Touch swipe advances one week");
  await page.locator('[data-action="agenda-today"]').click();

  const manual = page.locator('.agenda-complete[data-source="schedule"][data-id="today"]');
  await manual.scrollIntoViewIfNeeded();
  await manual.check();
  await page.waitForFunction(async () => {
    const archive = await (await import("./db.js")).loadState({ workspace: "formal" });
    return archive.scheduleItems.find((row) => row.id === "today")?.completed === true;
  });
  check(await page.locator(".agenda-item.is-complete").filter({ hasText: "今天的训练" }).count() === 1, "Checking marks schedule complete and strikes its card");
  const strike = await page.locator(".agenda-item.is-complete .agenda-title-button").first().evaluate((node) => getComputedStyle(node).textDecorationLine);
  check(strike.includes("line-through"), "Completed title visibly uses line-through");
  await page.reload();
  check(await page.locator('.agenda-complete[data-id="today"]').isChecked(), "Completion persists after reload");

  const interview = page.locator('.agenda-complete[data-source="interview"][data-id="interview"]');
  await interview.scrollIntoViewIfNeeded();
  await interview.check();
  await page.waitForFunction(async () => (await (await import("./db.js")).loadState({ workspace: "formal" })).interviews[0].status === "已完成");
  check(true, "Auto-added interview checkbox updates its interview status");
  await page.waitForFunction(() => document.querySelector('.agenda-complete[data-source="interview"][data-id="interview"]')?.disabled);
  check(await interview.isChecked() && await interview.isDisabled(), "Completed interviews stay checked and locked; status edits belong to the interview archive");
  await page.reload();
  await page.locator('html:not([data-starting])').waitFor();
  check(await interview.isChecked() && await interview.isDisabled() && (await state()).interviews[0].status === "已完成", "Reload preserves completed interview status and its locked calendar checkbox");
  await page.screenshot({ path: artifact("agenda-mobile.png") });
  await page.setViewportSize({ width: 320, height: 568 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Agenda fits 320px viewport");
  check(report.errors.length === 0, "No uncaught page errors");
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.failure = error.stack;
  await page.screenshot({ path: artifact("failure.png") });
  throw error;
} finally {
  await writeFile(new URL("VERIFICATION.json", out), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report));
}
