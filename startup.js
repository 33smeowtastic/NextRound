/* A small independent boot surface also survives failure of the app module. */
(() => {
  const screen = document.querySelector("#startup-loading");
  const app = document.querySelector("#app");
  if (!screen || !app) return;
  const message = screen.querySelector("[data-startup-message]");
  const progress = screen.querySelector('[role="progressbar"]');
  const fill = screen.querySelector("[data-startup-fill]");
  const number = screen.querySelector("[data-startup-percent]");
  const note = screen.querySelector("[data-startup-note]");
  const retry = screen.querySelector("[data-startup-retry]");
  const proceed = screen.querySelector("[data-startup-continue]");
  const detail = screen.querySelector("[data-startup-detail]");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let finished = false,
    failed = false,
    appReady = false,
    departing = false;
  let value = 0,
    departureTimer,
    slowTimer;

  function update(percent, text) {
    if (finished || failed) return;
    value = Math.max(value, Math.min(100, Math.round(percent)));
    fill.style.transform = `scaleX(${value / 100})`;
    progress.setAttribute("aria-valuenow", String(value));
    number.textContent = `${value}%`;
    if (message.textContent !== text) message.textContent = text;
  }
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(slowTimer);
    clearTimeout(departureTimer);
    window.removeEventListener("error", onError, true);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pageshow", onPageShow);
    motion.removeEventListener?.("change", onMotion);
    app.inert = false;
    app.removeAttribute("aria-busy");
    app.removeAttribute("aria-hidden");
    delete document.documentElement.dataset.starting;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", document.documentElement.dataset.theme === "dark" ? "#12110f" : "#f2eee7");
    if (screen.contains(document.activeElement)) {
      const heading = app.querySelector("h1");
      if (heading) {
        const previous = heading.getAttribute("tabindex");
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
        heading.addEventListener(
          "blur",
          () =>
            previous === null
              ? heading.removeAttribute("tabindex")
              : heading.setAttribute("tabindex", previous),
          { once: true },
        );
      }
    }
    screen.remove();
  }
  function leave() {
    if (finished || departing || !appReady) return;
    clearTimeout(slowTimer);
    departing = true;
    screen.classList.add("is-departing");
    if (motion.matches || document.documentElement.dataset.motion === "off") {
      finish();
      return;
    }
    screen.addEventListener("transitionend", (event) => {
      if (event.target === screen && event.propertyName === "opacity") finish();
    });
    departureTimer = setTimeout(finish, 650);
  }
  function fail(error, archive = false) {
    if (finished || failed) return;
    failed = true;
    clearTimeout(slowTimer);
    screen.classList.add("has-error");
    progress.hidden = true;
    number.hidden = true;
    message.textContent = archive
      ? "本地档案暂时无法打开"
      : "页面暂时未能完成加载";
    note.textContent = archive
      ? "请保留浏览器数据，关闭其他旧窗口后重试。"
      : "请检查本地服务或网络，再重新打开。";
    detail.textContent = error?.message || "";
    detail.hidden = !detail.textContent;
    retry.hidden = false;
    proceed.hidden = true;
  }
  function onError(event) {
    if (event.target?.tagName === "SCRIPT" || event.target === window)
      fail(event.error);
  }
  function onRejection(event) {
    fail(event.reason);
  }
  function onPageShow(event) {
    if (event.persisted && departing) finish();
  }
  function onMotion() {
    if (motion.matches && departing) finish();
  }
  retry.addEventListener("click", () => location.reload());
  proceed.addEventListener("click", leave);
  window.addEventListener("error", onError, true);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pageshow", onPageShow);
  motion.addEventListener?.("change", onMotion);
  slowTimer = setTimeout(() => {
    if (finished || failed) return;
    note.textContent = appReady
      ? "画面仍在准备中，您可以继续等待或先进入。"
      : "准备时间较长，可以继续等待或重新打开。";
    retry.hidden = false;
    proceed.hidden = !appReady;
  }, 10000);

  function imageReady(image) {
    const loaded = image.complete
      ? Promise.resolve(image.naturalWidth > 0)
      : new Promise((resolve) => {
          const settle = () => {
            image.removeEventListener("load", settle);
            image.removeEventListener("error", settle);
            resolve(image.naturalWidth > 0);
          };
          image.addEventListener("load", settle);
          image.addEventListener("error", settle);
          // Catch a cached image that completed between inspection and subscription.
          if (image.complete) settle();
        });
    return loaded.then(async (available) => {
      if (!available) return false;
      try {
        await image.decode?.();
        return true;
      } catch {
        return false;
      }
    });
  }
  async function reveal() {
    if (finished || failed) return;
    appReady = true;
    const tasks = [...app.querySelectorAll("img")].map((image) =>
      imageReady(image),
    );
    const ornaments = new Set();
    for (const element of app.querySelectorAll(
      ".poster-frame,.poster-patina,.poster-ground,.entrance,.entry-ornament,.training-stage",
    )) {
      const style = getComputedStyle(element);
      for (const source of [style.backgroundImage, style.borderImageSource]) {
        for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/g))
          ornaments.add(match[1]);
      }
    }
    for (const source of ornaments) {
      const image = new Image();
      image.src = source;
      tasks.push(imageReady(image));
    }
    // Fonts and the first rendered image set belong to this route, not a timed counter.
    if (document.fonts?.ready)
      tasks.push(document.fonts.ready.then(() => true));
    let completed = 0;
    update(40, "正在准备画面");
    const results = await Promise.all(
      tasks.map(async (task) => {
        const result = await task.catch(() => false);
        completed++;
        update(
          40 + (60 * completed) / Math.max(1, tasks.length),
          "正在准备画面",
        );
        return result;
      }),
    );
    if (finished || failed) return;
    if (results.some((result) => !result)) {
      clearTimeout(slowTimer);
      message.textContent = "部分画面未能加载";
      note.textContent = "档案已打开，可重试加载画面或先进入。";
      retry.hidden = false;
      proceed.hidden = false;
      return;
    }
    update(100, "准备就绪");
    requestAnimationFrame(() => requestAnimationFrame(leave));
  }
  window.nextRoundStartup = {
    modulesReady: () => update(15, "正在打开本地档案"),
    archiveReady: () => update(40, "正在准备画面"),
    reveal,
    fail: (error) => fail(error, true),
  };
})();
