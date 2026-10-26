# NextRound 1.0.2 — 训练室主题插画 / Themed training artwork

- 正式站点 / Site: https://nextround.apps.brothforge.com/
- 版本分支 / Version branch: `codex/release-v1.0.2`.
- 天堂训练室使用当前首页的天使，地狱使用当前堕天使，切换主题即时更换背景，无需刷新。 / Training uses the current homepage angel in Heaven and fallen angel in Hell; switching themes updates the artwork immediately.
- 旧统一插画不再被运行样式或离线预缓存引用，更新缓存版本；精简发布目录不包含旧图。 / Retire the unified illustration from runtime CSS and precaching, with a new cache identity; the slim deployment excludes it.
- 桌面/手机宽度回归对比首页真实图片来源；断网后验证两种图片均可解码。 / Desktop/mobile checks compare actual homepage sources; offline tests decode both themed images.
- 发布顺序为版本分支测试、部署、正式域名验证，再合并main及发布标签。旧版本保留。 / Test and deploy the version branch, validate production, then merge main and publish the tag; prior versions remain available.

[本版记录 / Details](docs/releases/v1.0.2.md) · [上版记录 / Previous release](docs/releases/v1.0.1.md)

代码采用MIT（Brothforge），插画、品牌、音频和字体保留原有独立许可。 / Code is MIT, copyright Brothforge; illustrations, branding, audio and fonts retain their existing separate terms.
