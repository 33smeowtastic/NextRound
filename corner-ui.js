import { PairedBgm } from "./paired-bgm.js";

const pauseIcon = '<path d="M8 5v14M16 5v14"/>';
const playIcon = '<path d="m9 5 11 7-11 7V5Z"/>';
let initialized = false;
let soundWanted = false;
let shareBusy = false;
let backgroundAudio;
let pendingPlay;
let audioRevision = 0;
let recordingActive = false;
let pageActive = true;
const foregroundAudio = new Set();
let notify = () => {};
let motionChanged = () => {};

export function cornerMarkup({ includeTheme = false, includeShare = true } = {}) {
  const light = typeof document !== "undefined" && document.body.classList.contains("theme-light");
  const themeLabel = light ? "关灯，切换地狱主题" : "开灯，切换天堂主题";
  // The initial markup depicts the current world, exactly as app.themeIcon()
  // does on subsequent toggles: heaven is a sun, hell is a crescent moon.
  const themeShape = light
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M19.07 4.93l-1.42 1.42M6.35 17.65l-1.42 1.42"/>'
    : '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/>';
  return `<nav class="site-controls" aria-label="页面控制">
    ${includeTheme ? `<button class="theme-toggle icon-button" data-action="toggle-theme" type="button" aria-label="${themeLabel}" aria-pressed="${light}" title="${themeLabel}"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">${themeShape}</svg></button>` : ""}
    ${includeShare ? `<button class="icon-button share-toggle" data-corner-share type="button" aria-label="分享下一场" title="分享下一场"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 16C7.8 9.6 11.8 6 17 6V2.5L23 8.5L17 14.5V11C12.5 11 9.7 12.7 7 16Z" fill="currentColor" stroke="none"/></svg></button>` : ""}
    <a class="icon-button gift-link" href="https://www.brothforge.com/faq/feedback.html#feedback-q01" target="_blank" rel="noopener noreferrer" aria-label="填写反馈赢「月度共创礼」"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13"/><path d="M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/></svg><span class="gift-tip" aria-hidden="true">填写反馈赢「月度共创礼」</span></a>
    <button class="icon-button motion-toggle" data-corner-motion type="button" aria-label="暂停环境动效" aria-pressed="false" title="暂停环境动效"><svg viewBox="0 0 24 24" aria-hidden="true">${pauseIcon}</svg><span class="sr-only">动态开启</span></button>

    <button class="sound-toggle" data-corner-sound type="button" aria-label="播放背景音乐" aria-pressed="false" title="播放背景音乐"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path class="sound-toggle__waves" d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-toggle__mute" d="m17 9 5 6m0-6-5 6"/></svg><span class="sr-only">声音关闭</span></button>
  </nav>
  <footer class="site-legal" aria-label="版权、AI、规则与联系"><a class="legal-item" target="_top" href="https://www.brothforge.com/faq/copyright" title="© 2026 Brothforge" aria-label="版权与使用说明 · © 2026 Brothforge"><span class="legal-full">© 2026 Brothforge</span><span class="legal-short" aria-hidden="true">©</span><span class="legal-tip" aria-hidden="true">© 2026 Brothforge</span></a><span class="legal-dot" aria-hidden="true">|</span><span class="legal-item" role="note" tabindex="0" title="含 AI 生成/辅助内容" aria-label="含 AI 生成/辅助内容"><span class="legal-full">含 AI 生成/辅助内容</span><span class="legal-short" aria-hidden="true">AI</span><span class="legal-tip" aria-hidden="true">含 AI 生成/辅助内容</span></span><span class="legal-dot" aria-hidden="true">|</span><a class="legal-item" target="_top" href="https://www.brothforge.com/faq/service-privacy" title="服务与隐私" aria-label="服务与隐私"><span class="legal-full">服务与隐私</span><span class="legal-short" aria-hidden="true">规则</span><span class="legal-tip" aria-hidden="true">服务与隐私</span></a><span class="legal-dot" aria-hidden="true">|</span><a class="legal-item" target="_top" href="https://www.brothforge.com/faq/policy.html#policy-q01" title="联系店长" aria-label="联系店长"><span class="legal-full">联系店长</span><span class="legal-short" aria-hidden="true">联系</span><span class="legal-tip" aria-hidden="true">联系店长</span></a></footer>`;
}

// Reuse the exact portal controls, links and labels in the operating workspace.
export function workspaceCornerMarkup() {
  return cornerMarkup({ includeShare: false });
}

// Share the application entrance, without workspace, record or search state.
export async function shareNextRound(feedback = notify) {
  const url = new URL("./", window.location.href);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || url.hostname.endsWith(".localhost");
  const link = url.href;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "下一场 · NextRound", url: link });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    feedback(local ? "本地预览链接已复制，仅本机可打开。" : "链接已复制。");
  } catch {
    window.prompt(local ? "复制本地预览链接（仅本机可打开）" : "复制下一场链接", link);
  }
}

function createBackgroundAudio() {
  backgroundAudio = new PairedBgm({ theme: document.body.classList.contains("theme-light") ? "light" : "dark" });
}

function foregroundIsPlaying() {
  for (const audio of foregroundAudio) {
    if (!audio.isConnected || audio.paused || audio.ended) {
      // A rerender can remove a playing attachment without dispatching pause.
      if (!audio.isConnected) audio.pause();
      foregroundAudio.delete(audio);
    }
  }
  return foregroundAudio.size > 0;
}

function mayPlay() {
  return (
    soundWanted &&
    pageActive &&
    !document.hidden &&
    !recordingActive &&
    !foregroundIsPlaying() &&
    !!document.querySelector("[data-corner-sound]")
  );
}

function playbackFailed(error) {
  soundWanted = false;
  audioRevision++;
  backgroundAudio?.pause();
  notify(error?.name === "NotAllowedError"
    ? "浏览器未允许播放背景音乐，请再次点击声音按钮。"
    : "背景音乐暂时无法播放，请点击声音按钮重试。");
  syncCornerControls();
}

function updateAudio() {
  if (!backgroundAudio) return Promise.resolve();
  if (!mayPlay()) {
    audioRevision++;
    backgroundAudio.pause();
    return Promise.resolve();
  }
  if (pendingPlay) return pendingPlay;
  if (!backgroundAudio.paused) return Promise.resolve();
  const revision = audioRevision;
  let playback;
  try {
    playback = backgroundAudio.play();
  } catch (error) {
    playbackFailed(error);
    return Promise.resolve();
  }
  const operation = Promise.resolve(playback)
    .then(() => {
      if (!mayPlay()) backgroundAudio.pause();
    })
    .catch((error) => {
      // A deliberate pause may abort an outstanding play; preserve the user's intent.
      if (revision === audioRevision && mayPlay()) playbackFailed(error);
    })
    .finally(() => {
      if (pendingPlay === operation) pendingPlay = null;
      if (revision !== audioRevision && mayPlay()) updateAudio();
    });
  pendingPlay = operation;
  return operation;
}

// Call on actual recorder start and on every stop/error cleanup path.
export function setRecordingActive(active) {
  recordingActive = Boolean(active);
  updateAudio();
}

function syncSoundControl() {
  const sound = document.querySelector("[data-corner-sound]");
  if (sound) {
    const label = soundWanted ? "暂停背景音乐" : "播放背景音乐";
    sound.setAttribute("aria-pressed", String(soundWanted));
    sound.setAttribute("aria-label", label);
    sound.title = label;
    sound.querySelector(".sr-only").textContent = soundWanted
      ? "声音开启"
      : "声音关闭";
  }
}

export function syncCornerControls() {
  const paused = document.documentElement.dataset.motion === "off";
  const motion = document.querySelector("[data-corner-motion]");
  if (motion) {
    const label = paused ? "开启环境动效" : "暂停环境动效";
    motion.setAttribute("aria-pressed", String(paused));
    motion.setAttribute("aria-label", label);
    motion.title = label;
    motion.querySelector("svg").innerHTML = paused ? playIcon : pauseIcon;
    motion.querySelector(".sr-only").textContent = paused
      ? "动态关闭"
      : "动态开启";
  }
  syncSoundControl();
  updateAudio();
}

export function initCornerControls({ toast, onMotionChange } = {}) {
  if (typeof toast === "function") notify = toast;
  if (typeof onMotionChange === "function") motionChanged = onMotionChange;
  if (initialized) return;
  initialized = true;
  if (!document.documentElement.dataset.motion) {
    document.documentElement.dataset.motion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
      ? "off"
      : "on";
  }
  document.addEventListener("click", async (event) => {
    const share = event.target.closest("[data-corner-share]");
    if (share) {
      if (shareBusy) return;
      shareBusy = true;
      share.disabled = true;
      try {
        await shareNextRound();
      } finally {
        shareBusy = false;
        share.disabled = false;
      }
      return;
    }
    const motion = event.target.closest("[data-corner-motion]");
    if (motion) {
      const enabled = document.documentElement.dataset.motion === "off";
      document.documentElement.dataset.motion = enabled ? "on" : "off";
      motionChanged(enabled);
      syncCornerControls();
      return;
    }
    if (!event.target.closest("[data-corner-sound]")) return;
    try {
      if (!backgroundAudio) createBackgroundAudio();
      soundWanted = !soundWanted;
      // Honour a second click even while the pair is still loading/decoding.
      syncSoundControl();
      await updateAudio();
    } catch (error) {
      playbackFailed(error);
    } finally {
      syncCornerControls();
    }
  });
  window.addEventListener("nextround:themechange", (event) => {
    backgroundAudio?.setTheme(event.detail?.theme);
  });
  document.addEventListener("visibilitychange", updateAudio);
  for (const eventName of ["play", "playing", "pause", "ended", "emptied", "error"]) {
    document.addEventListener(eventName, (event) => {
      const audio = event.target;
      if (audio?.tagName !== "AUDIO") return;
      if (["play", "playing"].includes(eventName)) foregroundAudio.add(audio);
      else foregroundAudio.delete(audio);
      updateAudio();
    }, true);
  }
  window.addEventListener("pagehide", () => {
    pageActive = false;
    updateAudio();
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    updateAudio();
  });
  syncCornerControls();
}
