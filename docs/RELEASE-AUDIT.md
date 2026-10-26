# NextRound 开源发布前审计与验收报告

审计日期：2026-10-26。应用版本：`1.0.0`。范围：当前公开源码白名单、静态运行包、数据安全与首次使用链路、文档及发布材料；不扩展产品功能。

**结论：代码已就绪，仍有明确的人工授权或操作待完成。**

本轮未执行 stage、commit、push、merge、Tag、公开 Release、部署或搜索平台提交。前序已确认代码采用 MIT、版权主体 Brothforge；素材独立条款及再分发权沿用用户决定。本地候选和历史证据保留，精简发布表示排除于公开包，不表示删除本地文件。

以下 A–C 保留首轮审计与干净源码复现的证据（当时 212 项单元测试、17 组浏览器测试）；当前 `1.0.0` 的新增改动和最新验收，以末尾「首发版本确认与分支流程补记」为准。

## A. 逐项状态

“原有状态”以本轮清单开始时的工作副本为准：前序隐私、安全和 UI 修复已在其中，不重复宣称为本轮新改动。所有“通过”均限下列实际检查范围，不等于对全部潜在问题的保证。

| 条目 | 原有状态 | 实际发现、对应路径与本轮处理 | 验证与当前状态 | 对公开发布的影响 |
| --- | --- | --- | --- | --- |
| P0-01 私人数据、凭证及 Git 历史 | 部分完成 | 前序已清理两首 BGM 的私人标签，保留音频数据；候选、历史机器路径和内部证据仍只留本地。复查 `scripts/release-files.mjs`、`.gitignore` 以及全部公开集合；新增文件同样纳入白名单和路径/凭证检查。 | 公开源码 165 文件、运行包 92 文件；Git 可收录集合严格等于源码白名单。独立复核公开文本、17 张位图元数据、2 首音频标签，未发现须继续修复的私人资料或凭证。Git refs、提交、对象、reflog 为空，`git fsck --full --no-reflogs` 无历史对象可供清理。 | 在当前拟发布集合内未发现阻断；不得递归上传整个本地目录或旧测试目录。隐私扫描不能证明所有未知风险均不存在。 |
| P0-02 许可及素材权利 | 已完成 | `LICENSE` 为 MIT / Copyright 2026 Brothforge；`ASSET-LICENSE.md` 为项目范围素材条款，允许随 NextRound 及其衍生版本运行、展示、再分发；字体许可在 `THIRD-PARTY-NOTICES.md` 及字体目录保留。下载协议/模板保留原文。 | 用户已确认素材有权再分发；两类构建均包含必要许可。前序 MP3 音频包和解码 PCM 一致性证据保留。 | 无新增许可决定；素材不自动获得供任意其他项目使用的 MIT 权利。 |
| P0-03 README 与使用说明 | 部分完成 | `README.md` 补齐完整中文、完整英文两部分和稳定语言锚点；包含安装、用途、外部 AI 流程、导入、训练、备份、限制、示例和许可。未虚构公开仓库地址或已上线 Demo。 | 源码构建测试检查文档相对链接；真实首用回归可找到模板并完成导入到备份。当前应用界面仍以中文为主，英文文档不代表完整英文 UI。 | 已满足首版说明要求。 |
| P0-04 示例与模板兼容 | 缺失 | 新增 `examples/interview-prep.json` 和双语说明：三道完全虚构题，覆盖天堂/人间/地狱、分类及完整答案；不含真实简历、公司、面试或联系方式。采用现有 `next-round-unified-1.2`、`version: "4.0.1"`，七个模块完整。未改写现有下载模板。 | 新增 `tests/release-onboarding.test.js`；示例+统一导入专项 27/27，包含在最终 212 项测试中；浏览器实际文件输入导入成功。 | 已补齐，无 Schema 迁移。 |
| P0-05 核心使用链路 | 部分完成 | 新增 `tests/release-onboarding-browser.mjs`，补齐首次使用、真实示例导入、搜索/编辑、三难度抽题、手动自评、重开与完整备份恢复；保留现役其他回归。 | 首用专项 34 个检查通过。工作副本与干净源码各 17/17 浏览器 suite；独立静态运行包的首用/SEO/配准/UI 四组再次通过。 | 已验证当前链路；不宣称有独立熟练度算法、SRS 或模型评分。 |
| P0-06 数据、隐私和备份说明 | 部分完成 | README、`RELEASE-NOTES.md`、中英静态介绍说明 IndexedDB 的浏览器/来源隔离；清站点数据、隐私模式、换设备/域名的风险；完整 JSON 备份未加密，包含录音/附件；用户主动给外部 AI 的资料受外部服务规则约束。 | `workspaces`、导入、首用及录音/备份回归通过；运行期网络独立抽查为同源资源请求，无自动外发业务记录。统一 JSON 的 10MB/10,000 行限制未误写为完整备份的统一上限，完整备份仍受设备内存和配额影响。 | 文档已补齐；生产来源改变前需用户自行导出并核验备份。 |
| P0-07 输入、安全与依赖 | 部分完成 | 前序修复不可信 ID/评分/追溯/冲突字段转义、跨空间异步保存及编辑器失效、训练结束计时；本轮补测错误 JSON、缺模块/字段、未知 Schema、重复/增量导入和确认前不写入，未改业务解析规则。新增 SEO HTTP 精确公开路径，维护配置和未知路径不被服务。 | `npm audit --json --registry=https://registry.npmjs.org` 为 0 漏洞；核心安全子集 75/75；最终导入安全浏览器 suite PASS。四个 SEO 单元测试及 HTTP 穿越/未知路径复核通过；无生产第三方运行依赖。 | 当前范围未发现代码阻断。依赖审计是执行时快照，不保证未来仍无公告。 |
| P0-08 干净安装、运行和构建 | 部分完成 | 公开源码增加可直接运行的示例、SEO生成器及测试；修复构建测试的同步子进程阻塞，使用异步 CLI、隔离 Node 测试 IPC 环境、超时和明确 EEXIST 断言。新增最小 `.github/workflows/checks.yml`，固定 action 提交，只读权限，无发布步骤。 | 全新源码目录 `npm ci`、`npm run check`、`npm test`、`npm run test:browser`、两种构建均成功。源码重建逐文件路径/大小/hash一致；运行包实际提供静态 HTTP 后四组浏览器检查通过。 | 本地可独立复现。GitHub CI 定义已提供，尚未在 GitHub 执行；Linux/真实设备仍须按目标环境核验。 |
| P0-09 版本及发布材料 | 部分完成 | 新增 `CHANGELOG.md`、双语 `RELEASE-NOTES.md`；区分应用 1.0.0、状态 Schema 1、统一导入契约 1.0/1.1/1.2、来源格式 4.0.1 和 SW CACHE。准备源码/运行目录及 ZIP；首发 Tag 定为 `v1.0.0`，未实际创建。 | 两类 manifest 记录相对路径、大小、SHA-256，不含本机路径。正式域名仅标记为计划地址，未声称 Demo 已在线或与产物一致。 | 材料已准备，实际公开仓库、Tag/Release/托管操作仍需具体授权。 |
| P1-01 反馈入口 | 缺失 | 新增 `.github/ISSUE_TEMPLATE/bug_report.yml`、`feature_request.yml`、`config.yml`；收集复现、预期/实际、环境，提醒勿公开简历、面试原文、备份、录音或凭证。 | 双语表单结构和必填隐私提示已检查；`blank_issues_enabled: false`；未假造尚不存在的 GitHub Issues URL。 | 仓库公开且启用 Issues 后可用；真实 GitHub 表单渲染尚待仓库建立。 |
| P1-02 限制与项目状态 | 部分完成 | README、发布说明和静态介绍写明未内置 AI/Agent/RAG、账号、云同步/远程数据库、独立 SRS，Ritual 仍在建设；说明当前内部验证与尚未实测范围。 | 30 次 axe A/AA 自动扫描无自动违规，仍保留对比度、ARIA 与真实辅助技术的人工判断边界。 | 不以“0 自动违规”宣称完整 WCAG 认证，也不编造用户、留存或模型质量数据。 |
| P1-03 文档和目录精简 | 部分完成 | 公开文档集中于 README、PRODUCT、DESIGN、许可和选定 `docs/`；新增 `docs/SEO.md`、本报告，更新 TESTING/OPEN-SOURCE。候选图、历史草稿、测试输出与内部操作脚本排除，未删除重要记录。 | 两种发布白名单、Git 可收录集合、manifest 及源码链接回归一致。公开运行包不包含维护文档、测试、SEO 构建配置。 | 已达到精简公开目录目标；本地完整工作副本不能替代运行发布目录。 |

### 追加要求：SEO 与 AI 检索

已在上线前完成：`seo.config.json` 配置正式 HTTPS 来源；`scripts/seo.mjs` 可重建元信息；应用入口的 canonical、分享信息、JSON-LD，以及无需 JavaScript 的 `about/index.html`（中文）和 `en/index.html`（英文）；对应语言替代链接、`sitemap.xml`、`robots.txt`。静态介绍不读取个人 IndexedDB，不索引用户档案或伪造评分/使用量。

策略按用户确认：开放搜索和 AI 检索，限制已知模型训练爬虫 GPTBot、ClaudeBot、Google-Extended、CCBot；其他检索机器人通过默认 Allow 访问公开资源。Google-Extended 同时涉及部分 Gemini 训练与 grounding，用此 token 无法分别允许，可能限制部分 Gemini 场景，不影响 Google Search 的常规索引。robots 是自愿遵守的公开抓取偏好，不是鉴权，也不能保证所有服务的后续用途、收录或 AI 引用。

本地 27 个 SEO 浏览器检查通过：关闭 JavaScript 仍可读中英文内容、390px 无溢出、真实示例链接、robots/sitemap 的状态/MIME、模拟 Google/Bing/Baidu/OAI/Claude UA 返回一致公开页面。模拟 UA 不是真实爬虫到访证据。

正式来源为 `https://nextround.apps.brothforge.com/`。本轮环境对 HTTP 探测返回 503，HTTPS 握手失败；这只说明本次探测未成功，未据此判断具体根因。上线后仍需核实 DNS/TLS、HTTP→HTTPS、目录索引、MIME、缓存/响应头及 CDN/WAF 对实际爬虫的访问，再验证 Google Search Console、Bing Webmaster Tools、百度搜索资源平台并提交可用入口。未操作生产配置或账户。官方依据与步骤见 [SEO 说明](SEO.md)。

## B. 修改汇总

以下为本轮清单补齐相对于“前序 UI 规范化已完成、源码 144 文件”的内容差异；无删除文件。前序换图、元数据清理、安全及 UI 修复已随本轮整体验证，不把它们计为此次再次修改。

### 新增 21 文件

| 文件 | 原因 |
| --- | --- |
| `.github/ISSUE_TEMPLATE/bug_report.yml`、`.github/ISSUE_TEMPLATE/config.yml`、`.github/ISSUE_TEMPLATE/feature_request.yml` | 双语反馈表单及隐私提示。 |
| `.github/workflows/checks.yml` | 最小只读 CI，不包含部署。 |
| `CHANGELOG.md`、`RELEASE-NOTES.md` | 版本关系、公开发布草稿和限制。 |
| `about/index.html`、`en/index.html`、`seo.css` | 不依赖 JavaScript 的双语公开产品介绍。 |
| `robots.txt`、`sitemap.xml`、`scripts/seo.mjs`、`seo.config.json` | 可配置发现信息与经确认的检索/训练策略。 |
| `examples/interview-prep.json`、`examples/interview-prep.md` | 可导入的完全虚构示例及说明。 |
| `tests/release-onboarding-browser.mjs`、`tests/release-onboarding.test.js` | 真实首用与示例契约回归。 |
| `tests/seo-visibility-browser.mjs`、`tests/seo.test.js` | 无 JS 可读性、HTTP 访问及确定性生成验证。 |
| `docs/SEO.md`、`docs/RELEASE-AUDIT.md` | 上线前后分工、抓取限制和本次证据。 |

### 修改 13 文件

| 文件 | 原因 |
| --- | --- |
| `.gitignore` | 与 165 个公开源码文件的白名单同步。 |
| `README.md` | 完整中文与英文说明、状态/隐私/示例/安装/许可。 |
| `docs/OPEN-SOURCE.md`、`docs/TESTING.md` | 公开范围、现役检查、SEO及审计入口一致。 |
| `index.html` | SEO head 和无脚本时的静态介绍入口，保留产品界面结构。 |
| `package.json` | 增加 SEO 命令及语法检查；版本和依赖不变。 |
| `scripts/browser-tests.mjs` | 注册首用与 SEO suite，共 17 组。 |
| `scripts/build-public.mjs`、`scripts/build-source.mjs`、`scripts/release-files.mjs` | 白名单收录及内存生成 SEO，构建不改工作副本。 |
| `server.mjs` | 公开介绍的目录路由、robots/sitemap 的 MIME 和精确文件可见性。 |
| `tests/public-build.test.js`、`tests/source-build.test.js` | 修复测试子进程阻塞，明确验证已有目标因 EEXIST 被拒绝。 |

### 前序已完成且本轮保留的改动

- `assets/v3-portal/angel-cutout.png`、`demon-cutout.png` 使用用户给定原图；配准及双主题表现有浏览器回归。
- 不可信导入显示转义、空间异步保护、编辑器失效保护及训练完成计时冻结。
- 两首 MP3 去除私人 ID3/XMP；保留音频内容，未改业务数据。
- UI 语义、焦点、键盘、错误关联、日期时间控件和响应式规范；保留原品牌世界、交互和 Brothforge 页脚内容/位置。
- MIT、独立素材条款、第三方字体许可和公开构建白名单。

## C. 质量验证

执行环境：Windows、Node.js `v24.18.0`、npm `11.16.0`；锁定 Playwright `1.62.1` 和 axe-core `4.14.0`。浏览器使用临时新上下文、虚构档案、禁用 GPU；录音测试使用虚拟设备，未访问真实用户档案。

| 实际执行 | 结果与边界 |
| --- | --- |
| 工作副本 `npm run check`、`npm test`、`npm run test:browser` | 语法通过；**212/212 单元测试，17/17 浏览器 suite**。 |
| 新导出的源码目录 `npm ci --registry=https://registry.npmjs.org` | 从仅含公开源码的目录独立安装，0 漏洞；浏览器复用已安装的 Chromium，不声称在全新操作系统重新下载浏览器。 |
| 新源码目录 `npm run check`、`npm test`、`npm run test:browser` | 再次全部通过：**212/212、17/17**，未使用仓库外业务夹具或机器路径覆盖。 |
| 新源码目录 `npm run build`、`npm run build:source` | 成功导出运行 92 文件、源码 165 文件；重建文件路径/大小/hash 与其输入源码对应构建一致。数量不含各自的 manifest。 |
| 独立运行包，`NEXTROUND_BASE_URL` 指向临时静态服务，运行 `portal-registration ui-standards release-onboarding seo-visibility` | **4/4**，覆盖资源、离线刷新、首用/导入/编辑/训练/恢复和无 JS 说明；无真实生产环境声明。 |
| `ui-standards` / `chooser-standards` | 20+10 次自动扫描无自动 A/AA 违规；UI 186 个检查、日期时间 54 个检查通过。自动待人工项目仍记录在结果中；不构成完整 WCAG 认证。 |
| `release-onboarding` / `seo-visibility` | 分别 34 / 27 个实际浏览器检查通过。 |
| `npm audit --json --registry=https://registry.npmjs.org` | 0 漏洞（含 high/critical 0）；第三方依赖仅用于开发检查。 |
| 独立安全复核 | 核心子集 75/75；公开集合、Git 历史、元数据、白名单、构建域名覆盖、同源网络及 HTTP 非公开路径复核无新增实质问题。 |
| 静态介绍视觉复核 | 中文/英文、390/1440px 四张实际截图；抽看窄屏中文及桌面英文，排版可读、无页面横向溢出。 |
| CI / Issue 表单 | 本地结构审阅；尚未在真实 GitHub 仓库运行或渲染，不能报告远程 CI 已绿。 |
| 正式生产来源 | 本次 HTTP 503 / HTTPS 握手失败；部署后访问、真实爬虫及收录未验证。 |

可复现命令与 suite 定义见 [TESTING](TESTING.md)。详细日志、截图和本机 ZIP 哈希作为维护者本地证据保留，不收入公开源码；源码包含复跑所需的现役测试。最终归档仅按 manifest 打包，禁止将已安装 `node_modules/` 和产生 `test-results/` 的验证目录整体压缩。

人工/目标环境待测：真实手机传感器、真人麦克风与听感、操作系统安装、真实辅助技术及自动检查无法判定的对比度/ARIA情况、存储配额耗尽、生产 HTTPS/缓存/安全响应头、实际搜索抓取和收录。上述事项不阻止当前源码开放，但不能被描述为已通过。

## D. 仍需人工决定或操作

| 事项 | 当前状态与最少后续动作 |
| --- | --- |
| 代码许可证 | **已决定：MIT，Brothforge。** 不需再次选择。 |
| 素材再分发权 | **用户已确认，采用独立素材条款。** 字体沿用第三方许可，不擅自扩大授权。 |
| 疑似私人资料 | 当前公开集合没有发现未处理命中；本地候选和内部记录不进入发布。未来暂存/加入新文件时仍需审阅。 |
| Git 历史处理 | 当前无提交/对象历史，无需重写或清理；未来初始化公开仓库时审阅暂存集合。 |
| 域名和抓取策略 | **已决定：`https://nextround.apps.brothforge.com/`；搜索与 AI 检索开放、已知训练爬虫受限。** Google-Extended 的混合用途限制已说明。 |
| 仓库公开与 Release | 公开仓库 owner/name/远程地址未指定；仍需授权具体 Git 提交/推送、公开可见性、Tag及Release。首发确定为 `1.0.0` / `v1.0.0`，产物已准备，不替用户公开。 |
| 上线与站长验证 | 需完成获准的生产部署、DNS/TLS/重定向/CDN配置并验证；之后以账户权限核验 Google/Bing/百度及提交 sitemap。没有可自动保证收录的步骤。 |

从产品经理应聘证据看，现有项目能展示产品取舍、外部 AI 到本地可复练资产的流程、协议设计、数据边界及可交付实现；当前仍缺真实用户研究/反馈及正式的 AI 流程质量对照证据。按本轮要求留待开源和招募测试之后开展，不伪造转化率、留存或 AI 效果，也不为作品集新增系统。

## E. 发布结论

**代码已就绪，仍有明确的人工授权或操作待完成。**

当前拟公开源码与运行包未发现仍需修复的代码阻断项。剩余明确事项为公开仓库/Release 的具体授权、生产站点上线与真实环境验证；不能将本报告等同于已公开发布、线上可用、全 WCAG 认证或搜索引擎已收录。


## 首发版本确认与分支流程补记

用户于 2026-10-26 确认首个正式发布版本为 `1.0.0`。此前 `0.3.0` 为开发阶段版本号，没有对外发布。已统一 package/lock、README、CHANGELOG、发布说明、SEO 生成页面与离线 CACHE；不修改业务数据 Schema、导入契约或用户原始协议。上文干净源码复现先于本次变更完成；本次对当前工作副本重新执行完整 `npm run check`、`npm test` 和 `npm run test:browser`：语法通过，**216/216 单元测试、18/18 浏览器 suite 通过**。最终导出文件另经白名单、hash 和 ZIP 校验，未把原先干净源码目录的安装记录冒充新包重装记录。

GitHub 仓库在上线时创建。后续更新在对应版本分支开发、构建并上线验证，确认无问题后再合并 GitHub `main`，Tag / Release 对应已验证提交。当前没有创建仓库、提交、Tag、Release或部署。此前的开发版本 ZIP 为历史证据，正式上线应使用按 `1.0.0` 重新生成的包。

本次补记同时包含用户浏览器反馈的最小修整：

- `app.js`、`index.html`、`startup.css`、`manifest.webmanifest`、`sw.js`：无有效偏好时默认天堂，加载首帧与已保存主题一致；不更改用户业务档案。
- `settings-ui.js`、`review-ui.css`：持久存储与安装同排两列、两端对齐上方按钮组，垃圾箱独占下方整宽一行；双主题×五个宽度，共10组布局、63项检查通过。
- `opportunity.js`、`opportunity-ui.js`、`v4-import.js`、`app.js`：识别并显示明确的 ×13个月 等薪资后缀，旧解析回退保留，已保存/手改薪资月数不被JD覆盖；删除决策卡片的整个决定状态展示区域，保留原数据及编辑字段。
- 对应三项单元测试文件补充4项回归；新增 `tests/salary-months-browser.mjs` 并注册，配套更新 `.gitignore`；两个原有深色测试改为显式深色测试档案，不再依赖旧默认值。当前公开源码166文件、运行包92文件（不含manifest）；原有源码165文件和212/17结果仅为首轮历史证据。
- `package.json`、`package-lock.json`、生成的中英介绍和入口SEO、README、CHANGELOG、RELEASE-NOTES、Issue版本示例均使用1.0.0；AGENTS/OPEN-SOURCE记录上线时建仓库及版本分支验证后合main的流程。

此次未新增账号、AI服务、云端存储或用户埋点，未执行Git写入或生产变更。应用/锁文件版本、公开集合、构建和ZIP清单一致；新包取代此前开发版本包作为待上线材料，旧包及历史证据保留本地。

### 品牌配色确认

用户进一步确认 logo 固定为白色轮廓＋绿色高亮，绿色表示通行/通过，加载进度条同用绿色。两主题统一使用应用图标的深色底承载白框；移除浅色主题对品牌绿色的金色覆盖，其余浅色交互配色保持现状。已同步AGENTS、DESIGN和发布说明；未改数据逻辑。

本次语法检查与216/216单元测试通过；受影响的 `portal-registration`、`ui-standards` 两组浏览器检查通过，并在现役配准suite加入品牌颜色断言。真实加载进度49%时的双主题画面和浅色顶栏logo已查看：轮廓为白、绿色高亮和进度均为 `#bff55c`。此前18组整体回归的其他未受影响证据继续保留，本次不冒称重新跑过全部18组。

### 加载页固定暗色

按用户最新确认，加载页整体固定暗底＋绿色，不再根据应用主题区分；logo继续保持白框＋绿色高亮。启动阶段的浏览器theme-color及安装启动底色使用暗色，加载完成后浏览器chrome才随应用主题变化。首次默认天堂、保存的应用偏好及用户档案均保留。该条取代此前“加载画面跟随主题”的描述。

本次216/216单元测试、语法检查及两组受影响浏览器回归（配准/加载/离线与UI规范）通过；四种应用主题偏好均保持暗色加载，完成后再恢复应用主题。已查看真实加载49%时的暗色画面。

## 执行首发发布

用户已授权公开仓库和1.0.0生产部署；首发main与版本分支使用同一提交，后续才在线上验收后合main。公开仓库已创建为 `33smeowtastic/NextRound`。部署前按Cloudflare Pages的实际路由规则补入顶层404.html，避免未知/维护路径200回退首页，并提供[部署说明](DEPLOYMENT.md)。前述未授权、未建仓库等状态为审计时点历史，不代表后续远程状态。实际DNS/TLS和部署验收以发布记录为准。
