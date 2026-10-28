# 开发与测试

运行应用只需 Node.js 20+，不依赖 Playwright，也不需安装开发依赖。以下安装只为贡献代码及运行浏览器回归。

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:browser
```

`npm ci` 使用锁定的 Playwright 1.62.1 与 axe-core 4.14.0。Linux 环境可使用 `npx playwright install --with-deps chromium` 安装浏览器与系统依赖；该命令是否需要系统权限由运行环境决定。

## 浏览器回归

runner 自动选择空闲 loopback 端口、启动本仓库静态服务、等待就绪、顺序执行现役 suite 并关闭自己启动的服务，不依赖维护者已有的 4173 服务。每个 suite 创建非持久化浏览器上下文，涉及数据写入前校验测试档案，不读写真实用户档案。测试浏览器默认禁用 GPU，音频输出静音；录音检查使用虚拟设备。

```sh
npm run test:browser -- --list
npm run test:browser -- training-finish-workspace import-security portal-registration
```

现役清单定义在 `scripts/browser-tests.mjs`，覆盖训练保存空间隔离、导入安全、配准/离线、UI 语义/焦点/对比度、知识指南、设置与清空、首页运动/巫师、常驻控件、训练导航、双曲音频、标签撤回/录音、垃圾箱/档案隔离、日程滚动。历史 V3 整图和旧控件脚本保留本地，不列为现役验收，也不进入公开源码。

结果、日志和截图写到忽略的 `test-results/<suite>/`，汇总为 `test-results/browser-results.json`；这些产物不进入源码导出或站点发布包。测试失败应看退出码和对应 stderr/stdout，不以旧报告替代。

可设置 `NEXTROUND_BASE_URL` 复用一个应用来源（如验证已生成的站点包），此时 runner 不启动或关闭外部服务。仍使用新上下文。支持根路径和以斜杠结尾的应用目录 URL。`NEXTROUND_BROWSER` 可指定已安装 Chromium；`NEXTROUND_PLAYWRIGHT` 可指定独立模块或 file URL。它们均为可选项，默认命令不依赖维护者的环境变量或磁盘布局。

指南与设置测试从仓库 `assets/` 读取协议和模板，并校验不可改写的协议 hash；不再读取仓库外的源文件。历史 V1.2 模板因导入兼容回归而额外收录，应用现役下载入口仍为当前模板。

`navigation-training` 对比首页实际图片来源，覆盖320/390/1440px训练室天堂→地狱→天堂即时切换；`portal-registration` 在断网后解码两张主题图片，并检查最新缓存不含旧统一插画。

GitHub CI 的当前浏览器组为 `release-onboarding`、`ui-standards`、`chooser-standards`、`portal-registration`、`seo-visibility`、`navigation-training`，配置以 `.github/workflows/checks.yml` 为准。正式1.0.2另在正式域名执行后三组及旧缓存升级检查。CI或浏览器检查通过后，仍须按[部署流程](DEPLOYMENT.md)等待用户亲自线上验收，才能合并main。

## 两种构建与复现

```sh
npm run build
npm run build:source
```

前者生成静态站点目录；后者生成可以独立安装开发依赖、运行上述检查及再次构建的源码目录。两者只按白名单写出全新的目录，不包含 Git、测试输出或本机历史资料。公开源码中的 Markdown 相对链接及必需夹具有回归检查。

单元测试不依赖真实浏览器或个人档案。浏览器 suite 只证明对应环境中的页面、交互、离线与数据边界；不代替真实手机传感器、真实麦克风/听感、操作系统安装、生产 HTTPS/响应头和配额耗尽验证。

## 开源首用与静态可读性

`release-onboarding` 通过仓库的虚构 JSON 完成导入、异常拒绝、重复/增量、编辑、三级抽题、手动自评、重开及备份恢复；`seo-visibility` 在关闭 JavaScript 的真实浏览器中读取中英介绍，并检查公开 HTTP 状态/MIME和模拟检索UA的一致内容。模拟UA不证明真实搜索引擎已抓取。

构建CLI回归使用异步子进程并隔离内部 Node 测试/IPC环境；拒绝复用输出目录必须因 EEXIST 失败，不能把超时当成正常拒绝。

`salary-months` 在独立空档案中通过正常岗位编辑器粘贴薪资原文，检查月薪区间与明确月数自动识别、卡片展示、手动覆盖保护和刷新持久化，并验证决定状态块移除后编辑字段仍存在。`portal-registration` 额外阻塞应用初始化，检查无偏好、保存深色、保存浅色、非法偏好四种首帧及最终主题；`settings-ai-archive` 覆盖双主题下320/390/505/507/1440px设备工具区对齐。
