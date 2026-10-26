import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ["--disable-gpu", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
await context.addInitScript(() => {
  localStorage.setItem("nextround-theme", "dark");
  const Native = window.AudioContext;
  window.__bgmContexts = [];
  window.AudioContext = class extends Native {
    constructor(...args) { super(...args); this.__sources = []; this.__gains = []; this.__decoded = []; window.__bgmContexts.push(this); }
    decodeAudioData(...args) {
      return super.decodeAudioData(...args).then((buffer) => {
        this.__decoded.push({ frames: buffer.length, duration: buffer.duration, rate: buffer.sampleRate }); return buffer;
      });
    }
    createBufferSource() {
      const source = super.createBufferSource(), start = source.start.bind(source);
      source.__starts = [];
      source.start = (...args) => { source.__starts.push(args); return start(...args); };
      this.__sources.push(source); return source;
    }
    createGain() { const node = super.createGain(); this.__gains.push(node); return node; }
  };
});
const page = await context.newPage();
const errors = [], requests = [], checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => { if (/hermetic-geometry-(heaven|hell)\.mp3/.test(request.url())) requests.push(request.url()); });
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); };
const state = () => page.evaluate(() => {
  const context = window.__bgmContexts[0];
  return context && { state: context.state, time: context.currentTime, decoded: context.__decoded, stems: context.__sources.map((source) => ({ duration: source.buffer.duration, length: source.buffer.length, rate: source.playbackRate.value, loop: source.loop, end: source.loopEnd, start: source.__starts })), gains: context.__gains.map((node) => node.gain.value) };
});
try {
  await page.goto(new URL("#/", baseUrl).href);
  await page.locator("html:not([data-starting])").waitFor();
  check(await page.evaluate(() => window.__bgmContexts.length === 0) && requests.length === 0, "No context or stem request before the user's sound click");
  let releaseRequests, markRequested, delayedRequests = 0;
  const gate = new Promise((resolve) => { releaseRequests = resolve; });
  const requested = new Promise((resolve) => { markRequested = resolve; });
  await page.route("**/assets/audio/hermetic-geometry-*.mp3", async (route) => {
    if (++delayedRequests === 2) markRequested();
    await gate; await route.continue();
  });
  await page.locator("[data-corner-sound]").click();
  await requested;
  check(await page.locator("[data-corner-sound]").getAttribute("aria-pressed") === "true", "Sound intent is visible immediately while both real audio requests are pending");
  await page.locator("[data-corner-sound]").click();
  check(await page.locator("[data-corner-sound]").getAttribute("aria-pressed") === "false", "A second click cancels playback during download instead of being ignored");
  await page.locator("[data-corner-sound]").click();
  await page.locator("[data-corner-sound]").click();
  releaseRequests();
  await page.waitForFunction(() => { const c = window.__bgmContexts[0]; return c?.__decoded.length === 2 && c.state === "suspended"; });
  check(await page.evaluate(() => window.__bgmContexts[0].__sources.length === 0), "Repeated on/off clicks during loading never cause a late audible start after cancellation");
  await page.unroute("**/assets/audio/hermetic-geometry-*.mp3");
  await page.locator("[data-corner-sound]").click();
  await page.waitForFunction(() => { const c = window.__bgmContexts[0]; return c?.__sources.length === 2 && c.currentTime > c.__sources[0].__starts[0][0] + 0.1; });
  check(delayedRequests === 2 && await page.evaluate(() => window.__bgmContexts.length === 1), "Playback resumes from the already decoded pair with no duplicate fetch or context");
  const initial = await state();
  assert.deepEqual(initial.stems[0].start, initial.stems[1].start);
  assert.equal(initial.stems[0].length, initial.stems[1].length);
  assert.equal(initial.stems[0].end, initial.stems[1].end);
  check(initial.stems.every((s) => s.rate === 1 && s.loop && s.duration > 120), "Actual MP3s decode, start together, and loop at the same sample boundary without changing speed");
  check(initial.gains[0] === 0 && Math.abs(initial.gains[1] - 0.35) < 1e-6, "Dark theme begins with only the hell stem audible");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("nextround:themechange", { detail: { theme: "light" } })));
  await page.waitForTimeout(320);
  const towardLight = await state();
  check(towardLight.gains[0] > 0 && towardLight.gains[0] < 0.35 && Math.abs(towardLight.gains.reduce((a, b) => a + b) - 0.35) < 1e-5, "Native AudioParam automation crossfades both playing stems while keeping their total gain steady");
  const reversal = await page.evaluate(() => {
    const c = window.__bgmContexts[0], before = c.__gains.map((n) => n.gain.value);
    window.dispatchEvent(new CustomEvent("nextround:themechange", { detail: { theme: "dark" } }));
    return { before, after: c.__gains.map((n) => n.gain.value) };
  });
  check(reversal.after.every((value, i) => Math.abs(value - reversal.before[i]) < 0.01), "A rapid reversal begins at the current native gains without jumping to either endpoint");
  await page.waitForTimeout(1350);
  const reversed = await state();
  check(reversed.gains[0] < 1e-5 && Math.abs(reversed.gains[1] - 0.35) < 1e-5, "The reversed fade completes on the hell stem");
  await page.evaluate(() => { location.hash = "/dashboard"; });
  await page.locator(".shell").waitFor();
  const routed = await state();
  check(routed.time >= reversed.time && routed.stems.length === 2 && routed.stems.every((s) => s.start.length === 1), "Routing keeps the same two sources and advancing clock");
  await page.evaluate(async () => (await import("./corner-ui.js")).setRecordingActive(true));
  await page.waitForFunction(() => window.__bgmContexts[0].state === "suspended");
  const paused = await state();
  await page.waitForTimeout(150);
  const pausedLater = await state();
  check(paused.time === pausedLater.time && await page.locator("[data-corner-sound]").getAttribute("aria-pressed") === "true", "Recording suspension freezes the shared clock while preserving the enabled sound intent");
  await page.evaluate(async () => (await import("./corner-ui.js")).setRecordingActive(false));
  await page.waitForFunction(() => window.__bgmContexts[0].state === "running");
  await page.evaluate(async () => {
    const audio = new Audio(new URL("./assets/audio/hermetic-geometry-heaven.mp3",location.href).href);
    document.body.append(audio); window.__foregroundTestAudio = audio; await audio.play();
  });
  await page.waitForFunction(() => window.__bgmContexts[0].state === "suspended");
  check(true, "Real foreground HTML audio playback suspends both BGM stems");
  await page.evaluate(() => window.__foregroundTestAudio.pause());
  await page.waitForFunction(() => window.__bgmContexts[0].state === "running");
  await page.evaluate(() => window.__foregroundTestAudio.remove());
  await page.locator("[data-corner-sound]").click();
  await page.waitForFunction(() => window.__bgmContexts[0].state === "suspended");
  await page.locator("[data-corner-sound]").click();
  await page.waitForFunction(() => window.__bgmContexts[0].state === "running");
  check((await state()).stems.every((s) => s.start.length === 1) && await page.evaluate(() => window.__bgmContexts.length === 1), "Sound off/on and foreground pause/resume reuse one context and never restart either stem");
  await page.locator("[data-corner-sound]").click();
  const rendered = await page.evaluate(async () => {
    const { PairedBgm } = await import("./paired-bgm.js");
    const offline = new OfflineAudioContext(2, 48000 * 0.8, 48000);
    let decodeIndex = 0;
    const buffers = [0, 1].map((channel) => {
      const buffer = offline.createBuffer(2, 4800, 48000);
      buffer.getChannelData(channel).fill(0.5); return buffer;
    });
    const facade = {
      get currentTime() { return offline.currentTime; }, get state() { return "running"; },
      destination: offline.destination, resume: async () => {}, suspend: async () => {},
      createBuffer: offline.createBuffer.bind(offline), createGain: offline.createGain.bind(offline),
      createBufferSource: offline.createBufferSource.bind(offline), decodeAudioData: async () => buffers[decodeIndex++],
    };
    const music = new PairedBgm({ AudioContext: class { constructor() { return facade; } }, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }), fadeSeconds: 0.2 });
    await music.play();
    const first = offline.suspend(0.2).then(() => { music.setTheme("light"); return offline.resume(); });
    const reverse = offline.suspend(0.3).then(() => { music.setTheme("dark"); return offline.resume(); });
    const result = await offline.startRendering(); await Promise.all([first, reverse]);
    const a = result.getChannelData(0), b = result.getChannelData(1);
    let maxSumError = 0, maxGainStep = 0;
    for (let i = 1600; i < a.length; i++) {
      maxSumError = Math.max(maxSumError, Math.abs(a[i] + b[i] - 0.175));
      maxGainStep = Math.max(maxGainStep, Math.abs(a[i] - a[i - 1]), Math.abs(b[i] - b[i - 1]));
    }
    return { maxSumError, maxGainStep, finalHeaven: a.at(-1), finalHell: b.at(-1), frames: a.length };
  });
  check(rendered.maxSumError < 1e-6 && rendered.maxGainStep < 0.0001 && rendered.finalHeaven < 1e-6 && Math.abs(rendered.finalHell - 0.175) < 1e-6, "Real offline audio rendering shows sample-continuous reversed crossfades and repeated loops without a gap or volume jump");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", checks, sourceDecoded: initial.decoded, aligned: initial.stems, rendered, errors }, null, 2));
} finally {
  await browser.close();
}
