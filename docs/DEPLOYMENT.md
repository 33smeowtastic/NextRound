# NextRound 部署与版本 / Deployment and versions

- 公开源码 / Source: [33smeowtastic/NextRound](https://github.com/33smeowtastic/NextRound)
- 正式来源 / Production origin: [nextround.apps.brothforge.com](https://nextround.apps.brothforge.com/)
- 首发 / Initial release: `1.0.0`, tag `v1.0.0`.
- 首发版本分支 / Initial version branch: `codex/release-v1.0.0`.
- Cloudflare Pages project: `nextround`, provider origin `nextround-b7z.pages.dev`.

首次发布的 `main` 与版本分支指向同一首发提交。后续版本从对应版本分支开发、验证并部署，线上检查通过后再合并 GitHub `main`；不要把后续版本直接推到生产或提前合并。Tag、Release 产物及部署元数据应对应已验证提交。

The initial `main` and version branch identify the same release commit. For subsequent versions, develop, validate and deploy from the corresponding version branch, verify the live site, then merge into GitHub `main`. Tags, Release assets and deployment metadata must match the validated commit.

## 仅部署运行包 / Deploy only the runtime

执行 `npm run build`，只上传新生成的 `dist/nextround-public-<UTC timestamp>/`。不要上传仓库根目录、源码包或安装过开发依赖的目录。运行包包含 `404.html`，用于禁用 Pages 对未知路径的默认首页回退；应用本身使用 hash 路由。

Run `npm run build` and upload only the new runtime directory. Do not upload the repository root, source package or a directory containing development dependencies. The runtime's top-level `404.html` preserves real HTTP 404 responses; the app uses hash routes.

Wrangler 的 Pages 命令可能在新版本中迁移或自动改写项目配置。先检查当前 CLI 帮助和目标项目；在仓库外的部署工作目录运行，显式指定已核验的运行目录、Pages 项目、版本分支和提交 SHA，避免让自动检测把整个工作副本作为站点上传。无需把 Wrangler 加入应用依赖。

New Wrangler versions may migrate Pages commands or rewrite configuration. Check the current CLI and target project first. Run outside the source repository and explicitly select the verified runtime directory, project, version branch and commit SHA. Wrangler is not an application dependency.

## 域名与验证 / Domain and verification

此子域使用 DNSPod：在 `brothforge.com` 添加 CNAME，主机记录 `nextround.apps`，目标 `nextround-b7z.pages.dev`；同时在该 Pages 项目关联完整域名。不要修改根域名或其他应用的解析。DNS/TLS 激活前不能把正式域名标记为验证通过。

For this subdomain, add the CNAME at DNSPod and associate the full hostname with the Pages project. Do not change the apex or other applications' records. DNS/TLS activation must complete before production availability is verified.

部署后检查 HTTPS、应用默认天堂/暗色加载、静态中英文说明、资源完整性、离线刷新、robots/sitemap 的 MIME 与策略，以及未知资源/维护路径的真实 404。详细抓取与平台提交步骤见 [SEO](SEO.md)。生产验证仅用隔离虚构档案，不访问用户真实 IndexedDB。

After deployment, verify HTTPS, the default Heaven theme and dark loading screen, bilingual static descriptions, asset integrity, offline refresh, robots/sitemap and genuine 404s. Use disposable fictional archives for browser checks. See [SEO](SEO.md) for discovery validation; indexing is not guaranteed.
