---
name: "下一场 · NextRound"
description: "古典神秘主义海报与现代本地面试备考工作区"
colors:
  primary: "#c8ac7e"
  brand-threshold-light: "#bff55c"
  brand-outline: "#ffffff"
  brand-base: "#12110f"
  brand-threshold-dark: "#bff55c"
  paper: "#f2eee5"
  surface: "#fbf9f3"
  ink: "#39352f"
  muted: "#6a6258"
  line: "#d3cbbb"
  wash: "#ece4d7"
  red: "#a33d42"
  shell: "#f9f8f7"
  charcoal: "#29251f"
  poster-black: "#090908"
  poster-ivory: "#e9d9ba"
  entry-ivory: "#ead9bb"
typography:
  headline:
    fontFamily: "NextRoundSerifSC, Georgia, \"Noto Serif SC\", serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title:
    fontFamily: "NextRoundSerifSC, Georgia, \"Noto Serif SC\", serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Sora, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Sora, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  caption-italic:
    fontFamily: "NextRoundAntiqua, Georgia, serif"
    fontSize: "clamp(14px, 1.15vw, 21px)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.17em"
  entry-status:
    fontFamily: "Sora, \"Segoe UI\", \"Microsoft YaHei\", sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.02em"
  footer-original:
    fontFamily: "Manrope, \"Microsoft YaHei\", sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  badge: "4px"
  input: "7px"
  button: "8px"
  nav: "9px"
  panel: "12px"
spacing:
  compact: "8px"
  small: "12px"
  row: "16px"
  inset: "20px"
  panel: "22px"
  section: "24px"
  group: "28px"
components:
  button-primary:
    backgroundColor: "#d6bd92"
    textColor: "#372b1b"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "10px 17px"
    height: "39px"
  button-primary-hover:
    backgroundColor: "#e3cca6"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "#66533a"
    rounded: "{rounded.button}"
    padding: "10px 17px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.red}"
    rounded: "{rounded.button}"
    padding: "10px 17px"
  nav-active:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.entry-ivory}"
    rounded: "{rounded.nav}"
    padding: "11px 14px"
  chip:
    backgroundColor: "#eee4d4"
    textColor: "#755a32"
    rounded: "{rounded.badge}"
    padding: "2px 7px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "10px 11px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "22px"
  portal-entrance:
    backgroundColor: "#100f0d"
    textColor: "{colors.poster-ivory}"
    rounded: "0"
    padding: "25px 31px 25px 0"
  portal-footer:
    typography: "{typography.footer-original}"
    backgroundColor: "transparent"
    textColor: "#aaa"
    height: "44px"
    padding: "0"
  corner-control:
    backgroundColor: "transparent"
    textColor: "#ddd"
    size: "44px"
    padding: "0"
---

# Design System: 下一场 · NextRound

以实际页面为准，更新于 2026-10-26。本页描述现役界面；先前阶段的完整文档保存在 本地历史快照。历史截图、候选与 SOURCE-PIXELS 只证明各自构建。

## 方向与主题

品牌 logo 在两种主题中均保持白色轮廓＋绿色高亮，沿用应用图标深色底以保持识别；不随主题染成金色或黑色。加载进度条与高亮同用 `#bff55c`。

首次访问（无有效主题偏好）默认天堂/开灯；显式保存的地狱或天堂偏好继续生效。HTML 在首帧绘制前读取应用主题；加载页始终为暗底＋绿色，浏览器 theme-color 在加载时固定暗色，加载结束才跟随应用主题。

古典神秘主义海报作为入口，纸面工作区承载本地面试准备。首页以 Gothic 固定字图、宋体中文、Fell 斜体、柱廊水面、透明雕像、独立光门及磨蚀外缘构成；业务页保持清晰紧凑的层级。

- 默认开灯：天堂，冷白大理石、银色机械羽翼、象牙文字与克制的古金细线；工作区为暖纸面、炭黑正文、古金动作。品牌 logo 固定白框＋绿色高亮（表示通行/通过），加载进度条同用绿色；其余 UI 和文字不使用绿色。
- 默认关灯：地狱，黑铬机械雕像、舒展金属羽翼、冷白与绿色反光；工作区为黑灰、近白和绿色动作。UI、文字和图标不使用金色。
- 两版均有中性细噪点；噪点不能破坏正文、按钮和表单的清晰度。状态不只依赖颜色。
- 设置中的自选强调色分别保存开灯版与关灯版颜色，可自由选色，并固定七个颜色快速切换；只替换动作、选中态与光门细节。状态标签、品牌 logo 和固定的暗底绿色加载页保持原有语义与配色。
- 格言：开灯 `Invenies Occultum Lapidem`；关灯 `Solve et Coagula`。中文副标题与分隔星共享视觉中线。

前置令牌列出通用/浅色基础；最终颜色取实际 CSS 级联。深色工作区核心值：背景 `#000`、表面 `#10110f`、正文 `#f4f6ef`、辅助 `#bbc1b4`、分隔 `#3a4233`、信号 `#bff55c`。浅色最终主题覆盖位于 `duality.css`；指南/设置精修位于 `review-ui.css`，侧栏定位位于 `chrome-review.css`。

## 素材与场景配准

[素材清单](docs/ASSETS.md) 为来源入口。天使 `angel-cutout.png`（3342×1882）、堕天使 `demon-cutout.png`（3612×2228）、巫师 `wizard-cutout.png`（1277×1231）各为独立透明层。环境已移除烘焙的巫师及其反光，右侧水面以接触阴影收住，不留矩形底色。

堕天使采用用户于 2026-10-26 提供的《堕天使.png》，原始字节与透明通道直接用于现役素材，取代此前补翼派生图。其脸、机械伸手与选定姿态是当前依据。天使同样使用本日用户提供的《天使.png》原始字节，保留原图衣袍与羽翼。

两种雕像在公共 1922×1080 坐标中按实际可见眼部配准，禁止用任意框中心代替头部位置。当前源图眼部点：天使 (1487,542)，堕天使 (761,1085)；映射至同一 (1040,315)，下缘贴合水线 y=860。共用头环中心 (1070,300)，并不与眼部点重合。光门前后半圈及倒影共同右移 60 个场景单位。两版切换保持头部、光门与水线一致；翅膀自然延伸至画面边缘。

天使框：x=349.109122、y=63.175618、w=1552.762148、h=874.416027；堕天使框：x=627.318408、y=-273.383085、w=1958.746269、h=1208.218905。这些数值对应当前素材，替换文件后须重新检查实际面部与透明边界。

环境、巫师、雕像、头环和光门共用相应配准坐标。光门后半圈 z=1，主体/巫师 z=3，前半圈 z=6，保留手臂与门圈穿插关系。窄屏重排头部文字与卡片，内部自然滚动；卡片可完整到达页脚上方。

## 字体、图标与控件

- `assets/v3-refine/lettering-*.webp` 是 NextRound / Interview / Ritual 的透明固定字图；保留真实 h1/h2 文本和可访问名称，不用截图替代交互。
- 中文标题：本地 NextRoundSerifSC；正文与数字：本地 Sora / 系统中文无衬线；格言：NextRoundAntiqua（Fell）；复用页脚：本地 Manrope 400。
- 首页右上顺序：开关灯、分享、礼物、动效、声音；开关灯在首次渲染即使用当前太阳/月亮，悬停有区别背景。
- 内页侧栏下方顺序：开关灯、分享、设置、返回；使用同风格 LED 点阵。内页顶栏不再重复提供分享。
- 四个侧栏工具作为整体下移，窄屏每个点击区 44px，短屏沿用侧栏滚动，展开/收起导航不跳位。
- Brothforge 原版页脚的文案、链接、字形与响应式保留；本地原始对照只作为复用来源，不代表所有最新控件均与旧截图相同。
- Ritual 保持禁用，写明「建设中，敬请期待」。

## 指南与设置

知识库题目为空时默认展开指南，四步骤默认收起；每个收缩标题仅显示步骤名，简介与完整操作放在展开内容中。存在题目后指南自动收起；搜索无匹配不冒充空题库。

首轮训练与整理题库的指令框右侧使用可访问的 LED 复制图标，复制完整原文。两份 .md 下载按钮右侧紧邻说明小图标，支持点击、悬停及键盘；用途和「设置 → 使用 AI 协作」位置仅在该说明中展示。通用 .md 小提示使用指南外独立框。称呼使用「您」。

设置的「使用 AI 协作」集中提供原始面试训练协议、AI 整理模板及统一 JSON 导入；本节不重复显示其自身的位置说明。资源文件保持原文，指南润色不得改写协议字节。导入沿用预览、选择、校验和明确确认流程。

训练「本次训练」的摘要与设置折叠条同高：桌面58px，≤560px为54px。帮助标识紧邻左侧标题；题库准备说明位于配置之后，并能跳往知识库，不阻止独立介绍稿训练。

设置设备工具区与上方备份操作组两端对齐：「申请持久存储」和「安装到设备」同排等宽，垃圾箱下方独占整宽一行；窄屏保持两列，必要时文字换行，按钮至少44px高。垃圾箱弹窗标题旁为带名称的清空图标，关闭回到标准右上位置。「清空当前档案」为独立危险操作，必须明确确认，且不影响另一空间。

## 动效与声音

`portal-motion.js` 参考 CreativeFolio 的分层体验，仅在本项目实现：环境、主体、文字组与卡片采用不同小幅偏移。鼠标与手机倾斜先校准再平滑；巫师、雕像、光门与头环作为配准组同步移动。基础布局 transform 与动态 translate 分离，避免替换原有排版。关闭动态、减少动态效果、隐藏页面或离开首页时归零并清理监听；iOS 传感器授权只在用户明确启用动作中请求。

`paired-bgm.js` 在同一 Web Audio 时钟同步循环两首用户提供的完整曲目。开灯天堂、关灯地狱；主题变化仅做1.2秒增益交叉渐变，不重启、不变速。短曲解码尾部补静音以统一循环长度；暂停、录音与前景音频让两轨共享时钟暂停。首次默认静音。

## 维护与验证

加载顺序以 `index.html` 为准：基础/海报/业务样式之后依次为 `duality.css`、`review-ui.css`、`chrome-review.css`。不得继续在文档声称 duality 是最终加载文件。缓存以 `sw.js` 的 CACHE 与 FILES 为唯一清单。

本轮当前证据入口为 [UI 验证索引](docs/UI-VERIFICATION.md)。历史 v3、context、loading 等目录继续保留。浏览器检查使用隔离档案及禁用 GPU 的短时预览，不接触真实用户数据。手机重力已完成模拟输入验证；真实手机传感器、真实麦克风听感与操作系统安装确认尚未验证。

## 2026-10-26 交互与可访问规范

`ui-standards.css` 是现役工作区/弹窗的共用规范层，按最后加载的实际级联生效，保持首页美术和原版页脚几何。

- 共用目标：最低 24px；触控推荐值 44px，兼顾行内与间距例外。间距令牌为 8/12/16px；字段标签 13px，小屏文本输入 16px、最低 44px 高。
- 焦点：浅色普通表面使用 `#755729`，深色表面使用 `#bff55c`；浅色世界保留的深色训练板使用局部 `#d6bd92`。轮廓 2px，偏移 3px；颜色遵从实际相邻底色，不能全页套同一个金色。
- 分组选择暴露 pressed 状态，主导航提供 current；所有原生弹窗有名称，保留初始焦点、Tab 首尾约束及关闭后的逻辑焦点归还。重绘不依赖用户可变文案匹配控件身份。
- 字段错误关联到相应控件；帮助按钮与折叠标题分别操作。正文为固定页脚预留滚动空间，不移动页脚来掩盖遮挡。
- 日期网格包含行角色和一个活动 Tab 日期；月份/年份按钮用 pressed，日期/时间原生输入不使用不适用的 expanded 属性。时间选择器允许 Tab 到小时、分钟和提交，Escape 还原焦点并保留已有值。

依据、自动检查和人工/真机边界见 [前端规范](docs/UI-STANDARDS.md)。
