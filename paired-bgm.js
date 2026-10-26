const TRACK_URLS = [
  new URL("./assets/audio/hermetic-geometry-heaven.mp3", import.meta.url).href,
  new URL("./assets/audio/hermetic-geometry-hell.mp3", import.meta.url).href,
];

// Both complete stems share a sample clock. Theme changes touch gains only.
export class PairedBgm {
  constructor({
    AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext,
    fetch = globalThis.fetch?.bind(globalThis),
    theme = "dark",
    volume = 0.35,
    fadeSeconds = 1.2,
  } = {}) {
    this.Context = AudioContext;
    this.fetch = fetch;
    this.theme = theme === "light" ? "light" : "dark";
    this.volume = volume;
    this.fadeSeconds = fadeSeconds;
    this.context = null;
    this.sources = [];
    this.gains = [];
    this.ramps = [];
    this.buffers = null;
    this.loading = null;
    this.wanted = false;
  }

  get paused() {
    return !this.wanted || !this.sources.length || this.context?.state !== "running";
  }

  async play() {
    this.wanted = true;
    if (!this.context) {
      if (!this.Context) throw new Error("Web Audio is unavailable");
      // Construct and unlock in the user's click, before awaiting network/decoding.
      this.context = new this.Context();
    }
    const context = this.context;
    try {
      await Promise.all([context.resume(), this.load()]);
      if (!this.wanted) {
        await context.suspend();
        return;
      }
      if (!this.sources.length) this.startTogether();
      if (context.state !== "running") await context.resume();
      if (!this.wanted) await context.suspend();
    } catch (error) {
      // A failed pair must never leave one stem playing on its own.
      await context.suspend().catch(() => {});
      throw error;
    }
  }

  pause() {
    this.wanted = false;
    if (!this.context || this.context.state === "closed") return Promise.resolve();
    // Suspending the one clock preserves the exact phase of both stems.
    return this.context.suspend().catch(() => {});
  }

  load() {
    if (this.buffers) return Promise.resolve();
    if (this.loading) return this.loading;
    const operation = Promise.all(TRACK_URLS.map(async (url) => {
      const response = await this.fetch(url);
      if (!response.ok) throw new Error(`BGM request failed: ${response.status}`);
      return this.context.decodeAudioData(await response.arrayBuffer());
    })).then((decoded) => {
      const rate = decoded[0].sampleRate;
      if (decoded.some((buffer) => buffer.sampleRate !== rate)) {
        throw new Error("BGM stems use different decoded sample rates");
      }
      const length = Math.max(...decoded.map((buffer) => buffer.length));
      this.buffers = decoded.map((buffer) => {
        if (buffer.length === length) return buffer;
        // MP3 encoders can leave slightly different tails. Pad only the shorter
        // decoded tail, retaining every original sample and playbackRate=1.
        const padded = this.context.createBuffer(buffer.numberOfChannels, length, rate);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          padded.getChannelData(channel).set(buffer.getChannelData(channel));
        }
        return padded;
      });
    }).finally(() => {
      if (this.loading === operation) this.loading = null;
    });
    this.loading = operation;
    return operation;
  }

  startTogether() {
    const context = this.context;
    const targets = this.targets();
    const gains = this.buffers.map((_, index) => {
      const node = context.createGain();
      node.gain.setValueAtTime(targets[index], context.currentTime);
      node.connect(context.destination);
      return node;
    });
    const sources = this.buffers.map((buffer, index) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
      source.playbackRate.value = 1;
      source.connect(gains[index]);
      return source;
    });
    const when = context.currentTime + 0.03;
    try {
      // One scheduled timestamp prevents separate play() calls drifting apart.
      for (const source of sources) source.start(when, 0);
    } catch (error) {
      for (const source of sources) {
        try { source.stop(); } catch {}
        source.disconnect();
      }
      for (const gain of gains) gain.disconnect();
      throw error;
    }
    this.sources = sources;
    this.gains = gains;
    this.ramps = targets.map((value) => ({ from: value, to: value, start: when, end: when }));
  }

  targets() {
    return this.theme === "light" ? [this.volume, 0] : [0, this.volume];
  }

  setTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    if (this.theme === next) return;
    this.theme = next;
    if (!this.gains.length) return;
    const now = this.context.currentTime;
    const targets = this.targets();
    const duration = this.wanted && this.context.state === "running" ? this.fadeSeconds : 0;
    this.gains.forEach((node, index) => {
      const ramp = this.ramps[index];
      const fraction = ramp.end > ramp.start
        ? Math.min(1, Math.max(0, (now - ramp.start) / (ramp.end - ramp.start))) : 1;
      const current = ramp.from + (ramp.to - ramp.from) * fraction;
      const param = node.gain;
      if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
      else param.cancelScheduledValues(now);
      // The tracked linear envelope supplies the true current gain even on
      // engines without cancelAndHoldAtTime, including a rapid reversal.
      param.setValueAtTime(current, now);
      if (duration > 0) param.linearRampToValueAtTime(targets[index], now + duration);
      else param.setValueAtTime(targets[index], now);
      this.ramps[index] = { from: current, to: targets[index], start: now, end: now + duration };
    });
  }
}
