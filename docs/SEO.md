# SEO、AI 检索与上线验证

## 当前方案

正式来源按用户确认的 `https://nextround.apps.brothforge.com/` 准备；`seo.config.json` 是配置依据。生产域名和抓取策略已确认，DNS/TLS、部署和公开抓取入口已验证，见[首发记录](releases/v1.0.0.md)；站长平台账户验证及收录提交不由部署自动完成。

应用仍位于根路径，视觉与业务交互不变。`/about/` 提供中文静态产品说明，`/en/` 提供对等英文说明；两者无需 JavaScript、账号或浏览器数据库即可阅读。它们准确说明 AI 发生在用户选择的外部工具中，应用负责本地沉淀、校验和复练。应用界面主要使用中文，不将英文说明页写成完整英文界面已实现。

每份公开介绍有独立 title、description、canonical、互指 hreflang、Open Graph 和真实 SoftwareApplication 资料；没有虚构评分、用户量、认证或收益。根页面有 canonical/分享元信息及无需 JavaScript 的产品介绍入口。`sitemap.xml` 只列应用入口和两份介绍，不列个人记录、演示参数或 hash 业务路由。个人业务数据在浏览器 IndexedDB 中，站点构建不导出它们。

## 上线前准备

```sh
npm run seo
npm run build
npm run build:source
```

`npm run seo` 将配置生成到工作副本；两种构建都在内存中生成同样的 SEO 文件后写入新快照，不修改源工作副本，避免并行测试相互覆盖。默认配置为上述正式来源。分支部署到其他 HTTPS 目录时，可修改 `seo.config.json` 或设置 `NEXTROUND_SITE_URL`；地址不得包含凭证、query/hash 或开发 loopback 来源。源码导出会携带生效的配置，便于再次复现。

这些工作适合上线前完成。上线后再验证真实请求、抓取、索引与分享展示；公开 URL 可访问也不保证被收录、排名或被 AI 引用。

## 已选定的抓取策略

用户选择开放普通搜索与 AI 检索，限制模型训练用途。robots 通用规则允许检索访问，明确限制 `GPTBot`、`ClaudeBot`、`Google-Extended` 与 `CCBot`。

- OpenAI 的 `OAI-SearchBot` 与 `GPTBot` 可分别设置；前者用于搜索，后者涉及模型训练。用户主动发起的 `ChatGPT-User` 请求不等同于自动搜索爬取。[OpenAI 官方](https://developers.openai.com/api/docs/bots)
- Anthropic 区分 `Claude-SearchBot`、`Claude-User` 和训练用途 `ClaudeBot`，本配置只限制后者。[Claude 官方](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- `Google-Extended` 同时涉及部分 Gemini 训练与 grounding，无法用这个 token 拆开。按限制训练的选择禁止它，会限制部分 Gemini Apps/Vertex 用途；不阻止 `Googlebot`，也不据此声称影响 Google Search 排名。[Google 爬虫官方说明](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)
- 普通 Google/Bing/Baidu 检索及未单独列出的检索 agent 适用通用允许规则。robots 是偏好协议，不是访问鉴权或对所有模型训练的技术保证；未知、混用、伪装或不遵守规则的机器人无法仅靠这个文件保证用途。

机器人是否能访问还取决于真实网络、CDN/WAF、证书、状态码和页面内容。不要仅凭伪造 User-Agent 的一次成功请求就宣称官方机器人已经正常抓取。

## 上线后的验证与提交

1. 验证 DNS、TLS、HTTP→HTTPS 跳转和根目录；首页、`/about/`、`/en/`、robots、sitemap 及公开示例应返回正确状态与 MIME。未知资源应保持 404，不能将所有路径都回退成应用首页。
2. 在禁用 JavaScript 的浏览器或直接 HTTP 响应中读到完整两种语言的说明；canonical/hreflang/sitemap 使用同一正式 HTTPS 来源。
3. 检查 CDN/WAF 是否给正常检索机器人返回验证码、403/429 或空页面。若要调整生产安全策略，先明确规则对象和影响；本轮没有修改这些设置。
4. 由站点所有者在 Google Search Console、Bing Webmaster Tools 和百度搜索资源平台完成验证，并通过账号可用入口提交/诊断。百度权限与提交入口按账号实际可见为准，不假定所有账号都有相同 sitemap 权限。
5. 监测抓取诊断、索引状态和服务端请求；Bing 可按需要再配置 IndexNow，不在本轮自动向外部平台提交 URL。无法保证各引擎抓取时间、收录或生成式答案引用。

发布前的只读探测曾观察到 HTTP 503 和 HTTPS 握手失败；正式部署后 DNS/TLS 已生效，HTTP 跳转 HTTPS，公开页面/robots/sitemap 已通过验证。历史失败不代表当前状态。

## 官方依据

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)：抓取、渲染与索引是不同阶段，初始空壳需要后续渲染。
- [Google AI features](https://developers.google.com/search/docs/appearance/ai-features)：公开网页仍需满足可访问、可索引等基础条件，不保证被展示。
- [Bing sitemap 与 AI 搜索](https://blogs.bing.com/webmaster/2025/7/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search/)：sitemap 与站长工具用于发现和检查 URL。
- [百度官方指南](https://ziyuan.baidu.com/doc)：站点验证、robots、普通收录、抓取诊断及异常检查入口。
- [Common Crawl CCBot](https://commoncrawl.org/ccbot)：通用公开数据采集爬虫及 robots 管理说明。

`llms.txt` 或单一 robots 文件不能替代可读内容、真实抓取与索引验证。本轮没有新增模型调用、用户埋点或远程业务数据上传。
