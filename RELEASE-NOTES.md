# NextRound 1.0.0 — Release Notes / 发布说明

**首发标题 / First-release title:** `NextRound v1.0.0 — Local-first interview preparation`

**发布版本 / Release version:** `1.0.0`，对应 `v1.0.0`。公开源码为 [33smeowtastic/NextRound](https://github.com/33smeowtastic/NextRound)。生产接入及验证说明见 [DEPLOYMENT](docs/DEPLOYMENT.md)。 / Version `1.0.0` corresponds to tag `v1.0.0`. The public repository is linked above; see deployment documentation for production setup and checks.

## 发布内容 / Highlights

NextRound 是适用于企业求职、公务员与事业单位招录的本地面试训练与准备工作区。外部 AI 完成首轮训练与资料整理，NextRound 负责本地导入校验、可复练题库、录音、自评、面试复盘及可追溯决策资料。 / NextRound is a local interview-practice and preparation workspace for enterprise and public-sector recruitment. External AI handles initial training and organization; NextRound provides local import validation, reusable questions, recordings, self-assessment, reviews and traceable decision evidence.

- 正式与演示档案隔离；业务数据在浏览器 IndexedDB，包含完整备份、增量／确认替换导入、冲突与垃圾箱。 / Isolated formal/demo archives in IndexedDB, with full backups, incremental/confirmed replacement import, conflicts and trash.
- 题库的分类与天堂／人间／地狱难度、介绍稿及内容卡片、练习计时与本地录音。 / Categorized Heaven/Earth/Hell questions, scripts/cards, timers and local recording.
- 双主题首次默认天堂并保留保存的应用偏好，加载页固定暗底＋绿色；离线资源及前端可访问性规范化；Ritual 仍明确为建设中。 / Dual themes default to Heaven with retained application preferences and a consistently dark/green loading screen; offline resources and frontend accessibility work; Ritual remains under construction.
- 不可信内容转义、跨空间异步保护、完成计时冻结及公开资料隐私清理。 / Untrusted-content escaping, cross-space async guards, completion-time freezing and private-data cleanup for public materials.
- 完整双语说明、虚构导入样例、问题模板及可独立复现的源码构建。 / Complete bilingual instructions, fictional import samples, issue forms and reproducible source builds.

- 中英文静态产品介绍、可配置 canonical/hreflang/分享元信息、sitemap 与已确认的检索/训练抓取策略；生产索引仍待上线验证。 / Static Chinese/English product descriptions, configurable discovery metadata and the approved crawler policy; production indexing remains unverified.

- 设置页的存储/安装操作同排对齐，垃圾箱独占一行；移除决策卡片决定状态块但保留编辑与数据；明确的薪资月数（如 ×13个月）参与识别及展示，手动字段保留。 / Aligned storage/install controls and a separate trash row; removed the decision-status block while retaining editing/data; explicit pay-month suffixes are parsed and displayed without overwriting manual values.

- Logo 在两种主题下保持白框与绿色高亮，加载进度条同用绿色。 / Preserve the logo's white outline and green highlight, with green loading progress in both themes.

## 应附产物 / Proposed assets

| 产物 / Asset | 用途 / Purpose |
| --- | --- |
| `nextround-source-<UTC时间>/` 或对应 ZIP | 开源源码：代码、文档、示例、测试、锁文件和许可。可独立运行开发检查。 / Source: editable code, docs, examples, tests, lockfile and licenses for independent development checks. |
| `nextround-public-<UTC时间>/` 或对应 ZIP | 静态运行包：用于 HTTPS 托管，不含测试、历史资料或私人记录。 / Runtime: for static HTTPS hosting, without tests, maintenance history or personal records. |
| `source-manifest.json` / `release-manifest.json` | 对应产物内的文件相对路径、大小和 hash。 / Relative file paths, sizes and hashes for that asset. |

目录时间戳表示构建时间，不替代应用版本。最终资产文件名、hash 和当前执行结果应在实际发布时从已验证产物填写，不在草稿中捏造。 / Directory timestamps identify builds, not the application version. Fill final asset names, hashes and execution results from verified artifacts when publishing; this draft invents none.

## 版本与数据兼容 / Version and data compatibility

- 应用 / Application: `1.0.0` (`package.json`).
- 本地状态／完整备份中的状态 / Local state and state inside full backups: `schemaVersion: 1` (`core.js`).
- 当前统一导入契约 / Current unified-import contract: `next-round-unified-1.2`; parser also accepts `next-round-unified-1.0` and `next-round-unified-1.1` (`unified-import.js`).
- AI 整理模板中的来源格式 / Source-format version in the AI template: `version: "4.0.1"`; it is not the application release version.
- 离线 `CACHE` 由 `sw.js` 定义，仅用于资源更新；不改变已保存档案的数据 Schema。 / The offline `CACHE` in `sw.js` updates resources and does not change the stored data schema.

用户应先导出并确认备份，再更换来源、设备或执行替换导入。完整备份为未加密 JSON。跨空间备份不自动合并；清空档案／垃圾箱是需确认的破坏性操作。 / Export and verify a backup before changing origins/devices or replacing an archive. Full backups are unencrypted JSON. Cross-space backups are not merged automatically. Clearing archives/trash is a confirmed destructive action.

## 验证与限制 / Verification and limitations

发布前从干净源码目录执行并记录以下实际结果： / Run these commands from a clean source directory and record their actual results before publication:

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:browser
npm run build
npm run build:source
```

完整验收结论以本轮审计报告为准，不复制旧测试数量或把自动扫描零违规称为完整 WCAG 认证。 / Use the current audit report; do not copy historic test counts or describe zero automated violations as complete WCAG certification.

没有内置模型、账号、云同步、远程数据库或独立 SRS。外部 AI 输出和用户自行提交给外部服务的资料由对应流程负责。真实手机传感器、真实麦克风／听感、系统安装确认、存储配额耗尽及真实搜索收录尚须按目标环境核验；生产 HTTPS 和基础响应头已检查。 / No built-in model, accounts, cloud sync, remote database or independent SRS. External AI outputs and materials deliberately submitted to external providers remain outside the local app's guarantees. Real-device sensors/microphones/listening, OS installation, storage-quota exhaustion and actual indexing require target-environment checks; production HTTPS and basic headers have been checked.

正式站点为 [https://nextround.apps.brothforge.com/](https://nextround.apps.brothforge.com/)，DNS/TLS及关键链路已验证，见[首发记录](docs/releases/v1.0.0.md)。抓取策略为开放搜索和 AI 检索、限制模型训练爬虫；不保证所有爬虫遵守规则，不承诺收录或 AI 引用。参见 [SEO 说明](docs/SEO.md)。 / The production site is the URL above, with DNS/TLS and core flows verified in the initial release record. The crawler policy permits search/AI retrieval and restricts model-training crawlers; it cannot guarantee compliance, indexing or AI citations. See the SEO documentation.

## 许可与反馈 / Licenses and feedback

代码采用 [MIT](LICENSE)，版权主体 Brothforge；视觉、BGM 和品牌采用[独立素材条款](ASSET-LICENSE.md)，字体保留[第三方许可](THIRD-PARTY-NOTICES.md)。 / Code is MIT, copyright Brothforge; visuals, BGM and branding use independent asset terms, and fonts retain third-party licenses.

通过[公开仓库 Issues](https://github.com/33smeowtastic/NextRound/issues/new/choose)提交反馈，优先使用虚构示例。不要公开上传简历、面试原文、联系方式、完整备份、录音或未脱敏日志。 / Report issues in the public repository using fictional examples. Do not upload résumés, interview transcripts, contact details, full backups, recordings or unredacted logs.

## 首发与后续更新 / Initial release and future updates

本次已获用户授权：建立公开仓库，以 `codex/release-v1.0.0` 部署首发，`main` 与该版本分支使用同一首发提交。后续版本才执行“对应版本分支开发和上线验证，确认无问题后合并GitHub main”；Tag、Release和产物保持提交一致。

This initial release is authorized to use the same commit for `main` and `codex/release-v1.0.0`. Future versions are developed and deployed from their corresponding version branches, verified online, then merged into GitHub `main`. Tags, Release assets and deployments must identify the validated commit.
