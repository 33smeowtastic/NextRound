# Changelog / 更新记录

本文件记录版本内容；应用版本来自 `package.json`。公开源码、标签与部署应以各自实际提交及验收记录为准。

This file records version changes. The application version comes from `package.json`; use actual commits and validation records for repository, tag and deployment identity.

## 1.0.1

- 首页输出 Google/Bing 公开所有权验证标签，支持严格校验的可选百度标签；不添加统计脚本或业务数据上传。 / Publish Google/Bing ownership tags, with strictly validated optional Baidu support; no analytics or business-data upload.
- 上线后复核搜索/AI检索可访问性，保留训练爬虫限制。百度提交按维护者选择暂缓实名认证。 / Recheck search/AI retrieval access and retain training restrictions; Baidu submission is deferred at the maintainer's choice.
- 按版本分支部署验收后合并main；首发v1.0.0保留。 / Verify the deployed version branch before merging main; preserve v1.0.0.

## 1.0.0

### 功能 / Features

- 本地优先的岗位准备、知识库、介绍稿和内容卡片、训练、面试档案、成长分析和决策工作区。 / A local-first workspace for jobs, knowledge, scripts/cards, practice, interviews, analysis and decisions.
- 企业、公务员与事业单位的关联数据、差异化字段和透明规则分。 / Linked enterprise/public-recruitment data, type-specific fields and transparent rule scores.
- 外部 AI 协议与整理模板、结构化导入预览、冲突保留、完整备份及空间独立垃圾箱。 / External-AI protocol/templates, structured import previews, preserved conflicts, full backups and space-specific trash.
- 双主题分层场景，首次默认天堂并保留用户保存的应用主题，加载页固定暗底＋绿色；用户指定天使／堕天使素材、离线资源和默认关闭的同钟双曲 BGM。 / Layered dual-theme scenes default to Heaven on first use, retain saved preferences and use a consistently dark/green loading screen; supplied angel/fallen-angel assets, offline resources and synchronized BGM that starts muted.

### 修复与规范 / Fixes and quality work

- 对不可信导入内容进行上下文转义，保持原 ID 和引用，防止 HTML/脚本注入。 / Escape untrusted imported content while retaining IDs and references to prevent HTML/script injection.
- 完成训练的异步保存持有空间任务锁，编辑器校验归属；完成时刻冻结，保存排队不增加训练时长。 / Hold a workspace lease across training completion, reject stale editors and freeze completion time before storage waits.
- 删除公开音频中的私人元数据，保持压缩音频与解码内容；历史资料和机器操作工件保留本地。 / Remove private audio metadata without changing encoded/decoded audio; retain maintenance history locally.
- 统一键盘焦点、弹窗、表单反馈、触控尺寸、对比度和响应式行为；自动检查不宣称完整无障碍认证。 / Standardize keyboard focus, dialogs, form feedback, target sizing, contrast and responsive behavior without claiming complete accessibility certification.

- 设备存储与安装操作同排对齐、垃圾箱独占下一行；移除决策卡片的决定状态展示，保留编辑与数据。 / Align storage/install controls in one row, place trash on its own row, and remove the decision-status display while preserving editing and data.
- 识别并展示明确的月薪月数后缀（如 `25k~50k×13个月`）；JD 填写不会覆盖已保存或手动修改的薪资月数。 / Parse and display explicit pay-month multipliers such as `25k~50k×13个月`; JD detection preserves saved or manually edited pay-month values.

- 品牌 logo 固定白色轮廓＋绿色通行高亮，加载进度条保持绿色，不随天堂/地狱主题改色。 / Keep the logo's white outline and green passage highlight, with a green loading progress bar in both themes.

### 开源交付 / Source delivery

- MIT 代码许可、独立素材条款、第三方字体说明和固定开发依赖。 / MIT code, independent asset terms, third-party font notices and locked development dependencies.
- 独立站点／源码白名单构建、隐私特征防回归、可复跑浏览器入口。 / Separate allowlisted runtime/source builds, private-data signature regression checks and a reproducible browser-test entry point.
- 完整中英 README、虚构示例、问题模板和发布材料。 / Complete bilingual README, fictional examples, issue forms and release materials.
- 正式站点为 `nextround.apps.brothforge.com`；HTTPS、93个运行资源及关键链路已验证，公开源码位于 [33smeowtastic/NextRound](https://github.com/33smeowtastic/NextRound)。 / The production domain is `nextround.apps.brothforge.com`; HTTPS, 93 runtime resources and core flows have been verified, and the public repository is [33smeowtastic/NextRound](https://github.com/33smeowtastic/NextRound).

### 兼容与已知限制 / Compatibility and limitations

- 本地状态 `schemaVersion: 1`；统一导入支持 `next-round-unified-1.0`、`1.1`、`1.2`，现模板使用 `1.2` 与 V4 来源版本 `4.0.1`。 / State schema 1; unified import 1.0/1.1/1.2, with template 1.2 and V4 source version 4.0.1.
- 没有内置模型、账号、云同步或独立 SRS。真实设备及生产来源的未验边界见 [README](README.md)。 / No built-in model, accounts, cloud sync or independent SRS. Real-device/production verification boundaries are listed in the README.

执行结果以本次实际检查记录为准，不在本文件沿用旧测试计数。 / Use the current execution record rather than historic test counts.
