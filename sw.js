const CACHE = "nextround-shell-v1.1.0-release-20261028";
const FILES = [
  "./",
  "./index.html",
  "./startup.js",
  "./startup.css",
  "./style.css?v=grain-4",
  "./ui-refinements.css?v=gift-tip-light-20261028",
  "./unified-import.css?v=unified-1",
  "./themed-controls.js?v=unified-1",
  "./poster.css?v=guide-polish-20261025",
  "./duality.css?v=guide-polish-20261025",
  "./review-ui.css?v=guide-polish-20261025",
  "./chrome-review.css?v=guide-polish-20261025",
  "./ui-standards.css?v=ui-standards-20261026",
  "./theme-accent.css?v=accent-20261028",
  "./theme-accent.js",
  "./knowledge-guide.js",
  "./assets/通用AI面试训练协议_公开版_V1.0.md",
  "./assets/v3-portal/environment-no-ring.webp",
  "./assets/v3-portal/environment-no-ring-mobile.webp",
  "./assets/v3-portal/edge-engraving.svg",
  "./assets/v3-portal/angel-cutout.png",
  "./assets/v3-portal/demon-cutout.png",
  "./assets/v3-portal/wizard-cutout.png",
  "./assets/v3-refine/lettering-wordmark.webp",
  "./assets/v3-refine/lettering-interview.webp",
  "./assets/v3-refine/lettering-ritual.webp",
  "./assets/v3-craft/frame-engraved.webp",
  "./assets/v3-craft/patina.webp",
  "./assets/v3-craft/ivory-paper.webp",
  "./assets/v3-craft/maguntia.ttf",
  "./assets/v3-craft/fell-italic.ttf",
  "./assets/neutral-grain-alpha.png",
  "./training-modules.js",
  "./app.js?v=guide-polish-20261025",
  "./core.js",
  "./v4-import.js",
  "./unified-import.js",
  "./settings-ui.js",
  "./assets/ai-job-import-template-v4.md",
  "./assets/NextRound_AI整理与一键导入通用模板_V1.5.md",
  "./db.js",
  "./trash.js",
  "./content-cards.js",
  "./card-tags.js",
  "./script-history.js",
  "./assets/audio/hermetic-geometry-heaven.mp3",
  "./assets/audio/hermetic-geometry-hell.mp3",
  "./knowledge-ui.js",
  "./knowledge-ui.css?v=job-v4-2",
  "./shell-ui.js",
  "./shell-ui.css?v=grain-4",
  "./help-ui.js",
  "./help-ui.css?v=job-v4-2",
  "./assets/brothforge-brand/barlow-condensed-latin-500-normal.woff2",
  "./assets/brothforge-brand/barlow-condensed-latin-600-normal.woff2",
  "./assets/brothforge-brand/noto-sans-sc-display.ttf",
  "./workspaces.js",
  "./opportunity.js",
  "./opportunity-ui.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./icons.js",
  "./assets/sora-variable.ttf",
  "./assets/display-sc.ttf",
  "./corner-ui.js",
  "./paired-bgm.js",
  "./portal-motion.js?v=guide-polish-20261025",
  "./corner-ui.css?v=guide-polish-20261025",
  "./assets/v3/knight.webp",
  "./assets/v3/oracle.webp",
  "./assets/v3/unifraktur-cook.ttf",
  "./assets/v3/serif-sc.ttf",
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("nextround-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== self.location.origin
  )
    return;
  const url = new URL(e.request.url);
  const base = new URL("./", self.location);
  const cacheable = FILES.some(
    (p) => new URL(p, base).pathname === url.pathname,
  );
  if (!cacheable) return;
  e.respondWith(
    fetch(e.request)
      .then(async (res) => {
        if (res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(e.request, res.clone());
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || Response.error()),
      ),
  );
});
