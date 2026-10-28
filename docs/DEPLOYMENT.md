# NextRound 部署与版本 / Deployment and versions

- 公开源码 / Source: [33smeowtastic/NextRound](https://github.com/33smeowtastic/NextRound)
- 正式来源 / Production origin: [nextround.apps.brothforge.com](https://nextround.apps.brothforge.com/)
- 当前版本 / Current version: `1.1.0`, version branch `codex/release-v1.1.0`.
- 首发 / Initial release: `1.0.0`, tag `v1.0.0`.
- 首发版本分支 / Initial version branch: `codex/release-v1.0.0`.
- Cloudflare Pages project: `nextround`, provider origin `nextround-b7z.pages.dev`.

## 发布状态 / Release status

截至 2026-10-26，`main`、`codex/release-v1.0.2` 与 `v1.0.2` 对应提交 `85a56146d6333b5e3e3a7c6fc00a238d4946db0f`；Cloudflare Pages 生产部署为 `df4a1825-c9a6-4bc5-b102-237c9f83fd01`。正式产物与校验元数据见 [v1.0.2 Release](https://github.com/33smeowtastic/NextRound/releases/tag/v1.0.2)。

As of 2026-10-26, main, the version branch and tag identify the commit above. The production deployment and downloadable assets are recorded in the release metadata.

本版已有证据：219项单元测试、[版本分支CI](https://github.com/33smeowtastic/NextRound/actions/runs/40296731154)的6组浏览器检查、正式域名3组回归、旧缓存升级与离线主题图片解码通过；92个运行文件、171个源码文件及6个下载附件分别完成哈希核对。 / Evidence covers 219 tests, six CI suites, three production suites, cache upgrade and offline artwork, plus runtime/source/export hashes.

截至 2026-10-28，用户已验收 `69a5cf8` 的线上功能候选，`main` 随后快进到该提交。候选包含自选主题强调色、AI 模板与界面调整，以及浅色工作区礼物提示修复；[候选代码的 CI](https://github.com/33smeowtastic/NextRound/actions/runs/40701871103)通过语法、223 项单元测试、两种构建和 6 组浏览器检查，正式域名另通过 `portal-registration`、`seo-visibility`、`theme-accent`、`chrome-review` 4 组隔离档案浏览器检查。1.1.0 在已验收功能上同步版本、SEO、缓存和发布文档；正式提交、部署 ID、产物哈希和最终验证见 [v1.1.0 Release](https://github.com/33smeowtastic/NextRound/releases/tag/v1.1.0) 的 `release-metadata.json`。

As of 2026-10-28, the user accepted the deployed feature candidate at `69a5cf8`, and `main` was fast-forwarded to that commit. Version 1.1.0 synchronizes release metadata, SEO, cache identity and documentation on the accepted functionality. Its exact commit, production deployment, artifacts and checks are recorded in the [v1.1.0 Release](https://github.com/33smeowtastic/NextRound/releases/tag/v1.1.0).

## 后续版本流程 / Subsequent releases

以下用户验收要求在1.0.2发布后明确，适用于后续版本，不改变既有发布记录。 / The user acceptance requirement below was clarified after 1.0.2 and applies to subsequent versions.

首次发布的 `main` 与版本分支指向同一首发提交。后续版本从对应版本分支开发、验证并部署。Codex 完成线上检查后，提供正式站点验收入口、检查结果及已知限制，等待用户亲自验证并明确确认本次版本验收通过，再合并 GitHub `main`，随后发布对应 Tag / Release。自动检查通过或一般的部署上线授权不能代替用户验收；用户未确认时，保留在线版本分支，不合并 main。Tag、Release 产物及部署元数据应对应双方验收的提交。

The initial `main` and version branch identify the same release commit. For subsequent versions, develop, test and deploy the version branch. After Codex verifies production, provide the acceptance URL, results and known limitations, then wait for the user to personally test and explicitly accept that deployed version before merging into GitHub `main` and publishing its Tag / Release. Automated checks or general deployment authorization do not replace user acceptance. Until accepted, retain the deployed version branch without merging main. Release assets and metadata must match the commit accepted by both parties.

## 仅部署运行包 / Deploy only the runtime

执行 `npm run build`，只上传新生成的 `dist/nextround-public-<UTC timestamp>/`。不要上传仓库根目录、源码包或安装过开发依赖的目录。运行包包含 `404.html`，用于禁用 Pages 对未知路径的默认首页回退；应用本身使用 hash 路由。

Run `npm run build` and upload only the new runtime directory. Do not upload the repository root, source package or a directory containing development dependencies. The runtime's top-level `404.html` preserves real HTTP 404 responses; the app uses hash routes.

Wrangler 的 Pages 命令可能在新版本中迁移或自动改写项目配置。先检查当前 CLI 帮助和目标项目；在仓库外的部署工作目录运行，显式指定已核验的运行目录、Pages 项目、版本分支和提交 SHA，避免让自动检测把整个工作副本作为站点上传。无需把 Wrangler 加入应用依赖。

New Wrangler versions may migrate Pages commands or rewrite configuration. Check the current CLI and target project first. Run outside the source repository and explicitly select the verified runtime directory, project, version branch and commit SHA. Wrangler is not an application dependency.

## 域名与验证 / Domain and verification

此子域使用 DNSPod：在 `brothforge.com` 添加 CNAME，主机记录 `nextround.apps`，目标 `nextround-b7z.pages.dev`；同时在该 Pages 项目关联完整域名。不要修改根域名或其他应用的解析。本次 DNS/TLS 已激活并完成验证，见[首发记录](releases/v1.0.0.md)。

For this subdomain, add the CNAME at DNSPod and associate the full hostname with the Pages project. Do not change the apex or other applications' records. DNS/TLS is active and verified for this release.

部署后检查 HTTPS、应用默认天堂/暗色加载、静态中英文说明、资源完整性、离线刷新、robots/sitemap 的 MIME 与策略，以及未知资源/维护路径的真实 404。详细抓取与平台提交步骤见 [SEO](SEO.md)。生产验证仅用隔离虚构档案，不访问用户真实 IndexedDB。

After deployment, verify HTTPS, the default Heaven theme and dark loading screen, bilingual static descriptions, asset integrity, offline refresh, robots/sitemap and genuine 404s. Use disposable fictional archives for browser checks. See [SEO](SEO.md) for discovery validation; indexing is not guaranteed.

Direct Upload 不自动监听 GitHub main。上线新版本前，将 Pages 的生产分支明确设为对应版本分支，部署命令的 `--branch` 与之匹配；其他分支上传属于预览，不代表正式域名已更新。完成 Codex 线上验证并获得用户明确的线上验收通过确认后，再合并main。 / Direct Upload does not automatically deploy GitHub main. Set the Pages production branch to the version branch being released and match `--branch` when deploying; other branches are previews. Merge main only after Codex production verification and explicit user acceptance of that deployed version.
