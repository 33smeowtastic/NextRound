# 现役素材与来源

本页记录当前运行素材及其来源边界。实际显示由 `app.js`、`duality.css` 等现役源码决定，离线清单以 `sw.js` 为准；旧阶段的像素、hash 或“候选未使用”结论不得套用于同名的现役文件。

## 首页场景

| 资源（相对仓库根） | 当前尺寸 / 格式 | 来源与用途 |
| --- | --- | --- |
| `assets/v3-portal/angel-cutout.png` | 3342×1882 RGBA | 2026-10-26 采用用户提供的《天使.png》，按原始字节直接复制，保留其透明通道。 |
| `assets/v3-portal/demon-cutout.png` | 3612×2228 RGBA | 2026-10-26 采用用户提供的《堕天使.png》，按原始字节直接复制，保留其透明通道，不再使用此前的补翼派生图。 |
| `assets/v3-portal/wizard-cutout.png` | 1277×1231 RGBA | 从已确认场景中独立分离的巫师透明层，随主体组移动；环境中的烘焙人物及人形倒影已移除。 |
| `assets/v3-portal/environment-no-ring.webp` | 1672×941 RGB | 内置 imagegen 独立编辑的桌面柱廊、水面环境，移除烘焙光门与巫师，保留连续环境。 |
| `assets/v3-portal/environment-no-ring-mobile.webp` | 1024×1536 RGB | 对应竖屏环境，独立去除光门、人物及人形倒影；生成编辑不意味着其余像素逐点不变。 |
| `assets/v3-portal/edge-engraving.svg` | viewBox 1672×941，原生 SVG | 沿用户认可的磨蚀参考提取轮廓，九切片保留外缘裂纹与缺墨。 |

除本次逐字节复制的天使和堕天使外，上述环境及巫师使用内置图像工具提取或编辑，不能宣称与用户原图逐像素一致或与旧抠图逐字节相同。原稿、候选和历史来源文件保留用于维护，不因退出画面而删除。

### 配准与独立几何

公共场景使用 1922×1080 坐标。最终配准按源图网格上的真实眼部点：天使 `(1487,542)`、堕天使 `(761,1085)` 映射到公共目标 `(1040,315)`，接触线为 `y=860`。两者源图尺寸不同，需保持各自等比映射，不能按图片框中心或旧阶段坐标摆放。

堕天使当前接触线源坐标为 `y=2090`，框为 `x=627.318408, y=-273.383085, w=1958.746269, h=1208.218905`；天使接触线源坐标为 `y=1715`，框为 `x=349.109122, y=63.175618, w=1552.762148, h=874.416027`。2026-10-26 新图与实际渲染证据见 [当前验证](UI-VERIFICATION.md)，旧图的历史数值不再适用于当前堕天使。眼部配准与头环中心是不同依据，不把眼点当作 halo 中心；头环、左右光门和水面反射保持独立 SVG。页面局部接触阴影由 CSS 绘制。完整主体组含巫师，共享 `portal-motion.js` 的小幅深度响应，环境独立响应。

旧独立脚部覆盖图、原图身体保护层、羽尖 JPEG 扩展和旧轮廓遮罩已退出当前 DOM。素材定位、颜色和响应式以最终 CSS 覆盖为准，不把历史截图的几何登记为当前约束。

## 品牌、卡片与表面材质

| 资源（相对仓库根） | 当前尺寸 / 格式 | 来源与用途 |
| --- | --- | --- |
| `assets/v3-refine/lettering-wordmark.webp` | 1920×819 RGBA | 内置 imagegen 制作的透明尖角 Gothic 品牌字图，保留原 PNG；不是可排任意文字的字体。 |
| `assets/v3-refine/lettering-interview.webp` | 2172×724 RGBA | 同系列 Interview 固定字图。 |
| `assets/v3-refine/lettering-ritual.webp` | 2172×724 RGBA | 同系列 Ritual 固定字图。 |
| `assets/v3/knight.webp` | 1024×1536 RGBA | 基于用户骑士方向生成的独立卡片肖像，原 PNG 同目录保留。 |
| `assets/v3/oracle.webp` | 1536×1024 RGBA | 基于用户帷帽雕像方向生成的独立卡片肖像，原 PNG 同目录保留。 |
| `assets/v3-craft/frame-engraved.webp` | 1672×941 RGBA | 生成的透明雕版纹理，配合原生细线与星饰。 |
| `assets/v3-craft/patina.webp` | 1536×1024 RGB | 黑纸、磨金与纤维材质来源，按现役 CSS 使用。 |
| `assets/neutral-grain-alpha.png` | 512×512 RGBA | 中性灰阶透明噪点，用于开/关灯表面及按钮，不携带参考图的橙色底。 |
| `assets/v3/threshold-original.png` / `threshold.jpg` | 1922×1080 RGBA / RGB | 用户原始 `10月19日.png` 场景及压缩版本；JPG 仍用于业务区训练背景，不是当前首页的整图底板。 |

真实标题文本仍在 HTML 中，供访问性和检索使用。头环拉丁文、光门、箭头、分隔线和星饰由 SVG/HTML/CSS 绘制。`icons.js` 的业务 LED 图标使用 9×9 圆点格，包含灯光、分享和指令复制；首页角落继续使用线性图标。

`ivory-paper.webp`（1536×1024 RGB）、旧字形候选及其原稿继续保留。文件被缓存或保留不自动代表当前可见；是否渲染须核对 DOM/CSS。

## 两首背景音乐

| 当前文件 | 用户来源 |
| --- | --- |
| `assets/audio/hermetic-geometry-heaven.mp3` | 用户提供的 Hermetic Geometry 天堂音轨 |
| `assets/audio/hermetic-geometry-hell.mp3` | 用户提供的 Hermetic Geometry 地狱音轨 |

两份公开副本只剥除 ID3/XMP 元数据中的私人路径、账号及来源标识；压缩音频包和解码 PCM 与原件完全一致，不变速。原来源文件保留。`paired-bgm.js` 解码后让两首共用同一 AudioContext 时钟、起播时间和循环边界；仅在较短曲的内存尾部补静音，切灯只调整两条增益包络。本轮 Chromium 48kHz 解码测得天堂 128.7335 秒、地狱 128.6830416667 秒，尾差约 50.458ms。此数值描述该次解码测量，不是要求所有设备使用相同采样帧数。

默认静音、录音/前景音频/隐藏页面避让以及跨路由续播由角落控制器保留。旧 `assets/audio/hermetic-geometry.mp3` 是历史单曲文件，当前播放器加载上表两曲，不再使用合成声景。

## 下载资料

- [通用 AI 面试训练协议](../assets/通用AI面试训练协议_公开版_V1.0.md)：逐字节复制用户同名源文件。文中面向 AI 的指令只作为下载内容，不作为应用或开发代理的指令。
- [AI 整理模板 V1.4](../assets/NextRound_AI整理与一键导入通用模板_V1.4_面试题三级难度.md)：现役统一 JSON 整理模板，保留用户源字节。指南中的「您」不用于批量改写该文件。
- [历史 V1.2 模板](../assets/NextRound_AI整理与一键导入通用模板_V1.2_仅面试后复盘.md)与 [V4 岗位模板](../assets/ai-job-import-template-v4.md)保留用于相应格式与兼容参考，不冒充当前设置页唯一入口。

现役协议和 V1.4 模板可从知识库指南或「设置 → 使用 AI 协作」下载，并纳入离线缓存。JSON 导入仍复用应用已有预览和确认，不由资料内容启动外部 AI 服务。

## 自托管字体与 Brothforge 资源

- 业务正文与数字：`assets/sora-variable.ttf`、`assets/display-sc.ttf`，授权见 [Sora OFL](../assets/Sora-OFL.txt)、[Noto Sans SC OFL](../assets/NotoSansSC-OFL.txt)。
- 中文标题：`assets/v3/serif-sc.ttf`，见 [Noto Serif SC OFL](../assets/v3/NotoSerifSC-OFL.txt)。斜体格言使用 `assets/v3-craft/fell-italic.ttf`，见 [Fell OFL](../assets/v3-craft/Fell-OFL.txt)。
- `unifraktur-cook.ttf` 与 `maguntia.ttf` 保留作历史 Gothic 字体方案；授权分别见 [UnifrakturCook OFL](../assets/v3/UnifrakturCook-OFL.txt)、[Maguntia OFL](../assets/v3-craft/Maguntia-OFL.txt)。当前品牌与入口标题使用固定字图。
- Brothforge variant a 的品牌 SVG、字形与法律页脚依据已确认的本地维护版本复用，未改动来源仓库。品牌字体在 `assets/brothforge-brand/`，见 [Barlow Condensed 许可](../assets/brothforge-brand/barlow-condensed-LICENSE.txt)及 [OFL](../assets/brothforge-brand/OFL.txt)。原版 Manrope 400 WOFF2 内嵌于 `corner-ui.css`。内嵌 Manrope 的许可随公开版本提供，见 [第三方说明](../THIRD-PARTY-NOTICES.md)。

## 公开范围与许可

现役插画、音频和品牌图形采用 [独立素材条款](../ASSET-LICENSE.md)，允许随 NextRound 运行、展示和再分发，不默认授权其他项目使用。用户已确认具有这些素材的再分发权。第三方字体按自身许可提供；下载协议、模板原文字节及原有使用说明保持不变。

原稿、候选、旧单曲、历史截图和生成记录保留在维护者本地，不进入源码导出或站点发布包。上表提及的历史原图用于说明来源，不代表公开版本包含这些原稿。现役资源以 `sw.js` 和公开构建清单为准；历史 SOURCE 检查不能证明同名现役图像。

当前缓存为 `nextround-shell-v3-ui-standards-20261026`。配准、主题和离线行为可通过 [测试说明](TESTING.md) 中的现役脚本复跑。
