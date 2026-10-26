import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (["/about", "/en"].includes(pathname)) {
        res.writeHead(301, { Location: pathname + "/" }); res.end(); return;
      }
      const relative = pathname === "/" ? "index.html" : ["/about/", "/en/"].includes(pathname) ? pathname.slice(1) + "index.html" : pathname.slice(1);
      const publicDocument = ["about/index.html", "en/index.html", "examples/interview-prep.json", "examples/interview-prep.md", "LICENSE", "ASSET-LICENSE.md", "THIRD-PARTY-NOTICES.md"].includes(relative);
      const file = path.resolve(root, relative);
      if (
        !file.startsWith(root + path.sep) ||
        relative.split(/[\\/]/).some((s) => s.startsWith(".")) ||
        !publicDocument && ![
          "index.html",
          "404.html",
          "startup.js",
          "startup.css",
          "style.css",
          "ui-refinements.css",
          "unified-import.css",
          "themed-controls.js",
          "poster.css",
          "duality.css",
          "review-ui.css",
          "chrome-review.css",
          "ui-standards.css",
          "knowledge-guide.js",
          "app.js",
          "icons.js",
          "corner-ui.js",
          "paired-bgm.js",
          "portal-motion.js",
          "corner-ui.css",
          "core.js",
          "v4-import.js",
          "unified-import.js",
          "settings-ui.js",
          "training-modules.js",
          "db.js",
          "trash.js",
          "content-cards.js",
          "card-tags.js",
          "script-history.js",
          "knowledge-ui.js",
          "knowledge-ui.css",
          "shell-ui.js",
          "shell-ui.css",
          "help-ui.js",
          "help-ui.css",
          "workspaces.js",
          "opportunity.js",
          "opportunity-ui.js",
          "sw.js",
          "manifest.webmanifest",
          "seo.css",
          "robots.txt",
          "sitemap.xml",
          "assets",
        ].includes(relative.split("/")[0])
      ) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      await stat(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`NextRound → http://localhost:${port}`),
  );
