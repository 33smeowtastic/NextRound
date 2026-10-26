# 前端界面规范与验证边界

本轮在已有双主题与古典海报方向内规范化工作区，保留用户提供的天使/堕天使原图和 Brothforge 页脚原文、链接、字形与位置。设计规范用于提高可用性与一致性，不替换既定的视觉世界。

## 采用的依据

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)：以适用的 A/AA 条款作为无障碍检查依据。
- [目标尺寸 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)：24×24 CSS px 是适用条款的最低目标尺寸；符合间距、行内等例外也可满足该条款。44×44 是更宽裕的触控设计目标，不把它误写成所有网页控件的 AA 强制要求。
- [Reflow 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)：320 CSS px 等效宽度下内容重排，必要的二维内容按条款例外处理。
- [WAI-ARIA 弹窗模式](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)：名称、初始焦点、Tab/Shift+Tab、Escape 和关闭后的焦点归还。

## 项目中的应用

- 主内容、导航和侧栏提供可识别的语义与名称；标题按内容层级组织。
- 对话框使用原生 `dialog`，提供可访问名称；重绘和关闭弹窗后恢复对应控件或合理的页面焦点，不把焦点丢到页面起点。
- 互斥选择与筛选按钮暴露选中状态；帮助按钮与折叠标题分别操作，避免在 `summary` 中嵌套另一个交互控件。
- 焦点轮廓使用各主题下可辨认的语义颜色；正文、表单、占位文字、错误与禁用态保持可读。
- 将常用间距、圆角、控件高度和焦点值集中为可复用令牌，工作区与编辑面板采用一致的状态和布局规则；小屏文本输入保持合适字号与点击区域。
- 长内容可换行，工具栏允许重排；正文滚动为固定页脚留出空间，使键盘焦点不被页脚遮住。受保护页脚只修正必要的可访问语义，不改其视觉几何。
- 保留关闭动效与减少动态的行为；雕像、光门及水线继续使用共同坐标，不随规范化更改图像内容。

## 可复现检查

```sh
npm ci
npx playwright install chromium
npm run test:browser -- ui-standards chooser-standards portal-registration
```

`ui-standards` 与 `chooser-standards` 使用开发依赖 axe-core，并配合真实键盘、焦点、弹窗、表单与几何检查。检查器及测试代码不进入站点运行包；产物写入忽略的 `test-results/`。完整命令见 [测试说明](TESTING.md)。

自动检查不能证明完整 WCAG 符合性。颗粒/图片背景下的对比度、真实屏幕阅读器体验、真实手机输入与系统安装仍需要对应人工或真机检查；`incomplete` 项不能当成自动通过。日期弹层的 `aria-controls` 在工具中可能需要人工判断；回归另行核对它确实指向同一页面中可见的 `role="dialog"`，不为消除工具未决项而删去有效关系。颜色数值、命中区域和焦点以实际渲染为准，不以 CSS 中出现某个声明作为通过证据。
