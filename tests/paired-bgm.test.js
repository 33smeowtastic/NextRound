import test from "node:test";
import assert from "node:assert/strict";
import { PairedBgm } from "../paired-bgm.js";

class FakeParam {
  value = 1;
  events = [];
  setValueAtTime(value, time) { this.value = value; this.events.push(["set", value, time]); }
  cancelScheduledValues(time) { this.events.push(["cancel", time]); }
  linearRampToValueAtTime(value, time) { this.events.push(["ramp", value, time]); }
}
function buffer(length, rate = 100) {
  const data = [Float32Array.from({ length }, (_, i) => (i + 1) / length)];
  return { length, duration: length / rate, sampleRate: rate, numberOfChannels: 1, getChannelData: (i) => data[i] };
}
function setup({ failOnce = false, deferred } = {}) {
  const contexts = [], requests = [];
  class Context {
    constructor() { this.currentTime = 5; this.sampleRate = 100; this.state = "suspended"; this.destination = {}; this.sources = []; this.gains = []; contexts.push(this); }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    createGain() { const node = { gain: new FakeParam(), connect() {} }; this.gains.push(node); return node; }
    createBuffer(channels, length, rate) {
      const b = buffer(length, rate); b.getChannelData(0).fill(0); return b;
    }
    createBufferSource() {
      const node = { playbackRate: { value: 1 }, starts: [], connect() {}, start(...args) { this.starts.push(args); }, stop() {}, disconnect() {} };
      this.sources.push(node); return node;
    }
    async decodeAudioData(data) { return buffer(data.byteLength === 2 ? 100 : 96); }
  }
  let failed = false;
  const fetch = async (url) => {
    requests.push(url);
    if (deferred) await deferred.promise;
    if (failOnce && !failed) { failed = true; return { ok: false, status: 503 }; }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(url.includes("heaven") ? 2 : 1) };
  };
  const music = new PairedBgm({ AudioContext: Context, fetch, fadeSeconds: 1 });
  return { music, contexts, requests };
}

test("both stems start at one timestamp and preserve their samples and native speed through a shared padded loop", async () => {
  const { music, contexts, requests } = setup();
  assert.equal(contexts.length, 0);
  assert.equal(requests.length, 0);
  await music.play();
  const ctx = contexts[0], [heaven, hell] = ctx.sources;
  assert.equal(ctx.sources.length, 2);
  assert.equal(requests.length, 2);
  assert.deepEqual(heaven.starts, hell.starts);
  assert.equal(heaven.loopEnd, 1);
  assert.equal(hell.loopEnd, 1);
  assert.equal(heaven.buffer.length, hell.buffer.length);
  assert.equal(hell.buffer.getChannelData(0)[95], 1);
  assert.equal(hell.buffer.getChannelData(0)[96], 0);
  assert.equal(hell.buffer.getChannelData(0)[99], 0);
  assert.equal(heaven.playbackRate.value, 1);
  assert.equal(hell.playbackRate.value, 1);
  assert.equal(ctx.gains[0].gain.value, 0);
  assert.equal(ctx.gains[1].gain.value, 0.35);
});

test("a rapid reversed crossfade holds the actual in-flight gain, including the compatibility fallback", async () => {
  const { music, contexts } = setup();
  await music.play();
  const ctx = contexts[0];
  music.setTheme("light");
  ctx.currentTime = 5.4;
  music.setTheme("dark");
  for (const [index, current, target] of [[0, 0.14, 0], [1, 0.21, 0.35]]) {
    const events = ctx.gains[index].gain.events;
    const held = events.at(-2);
    assert.equal(held[0], "set");
    assert.ok(Math.abs(held[1] - current) < 1e-9);
    assert.equal(held[2], 5.4);
    assert.deepEqual(events.at(-1), ["ramp", target, 6.4]);
  }
  assert.equal(ctx.sources.length, 2);
});

test("suspending and resuming retains the same running sources and phase", async () => {
  const { music, contexts, requests } = setup();
  await music.play();
  const ctx = contexts[0], starts = ctx.sources.map((s) => s.starts.slice());
  await music.pause();
  assert.equal(ctx.state, "suspended");
  assert.equal(music.paused, true);
  music.setTheme("light");
  await music.play();
  assert.equal(ctx.state, "running");
  assert.equal(contexts.length, 1);
  assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.sources.map((s) => s.starts), starts);
  assert.equal(requests.length, 2);
  assert.equal(ctx.gains[0].gain.value, 0.35);
});

test("pausing while decode is pending never starts either stem later", async () => {
  let resolve;
  const deferred = { promise: new Promise((r) => { resolve = r; }) };
  const { music, contexts } = setup({ deferred });
  const pending = music.play();
  await music.pause();
  resolve();
  await pending;
  assert.equal(contexts[0].sources.length, 0);
  assert.equal(contexts[0].state, "suspended");
  await music.play();
  assert.equal(contexts[0].sources.length, 2);
});

test("failed loading is retryable without creating a second context or leaving a single audible stem", async () => {
  const { music, contexts } = setup({ failOnce: true });
  await assert.rejects(music.play(), /503/);
  assert.equal(contexts[0].sources.length, 0);
  await music.pause();
  await music.play();
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].sources.length, 2);
});
