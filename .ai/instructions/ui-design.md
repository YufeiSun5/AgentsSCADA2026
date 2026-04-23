---
description: "Use when: 编写或修改样式、创建 UI 组件、调整布局、选择颜色/间距/圆角/阴影等视觉属性"
applyTo: "frontend/src/**/*.tsx,frontend/src/**/*.ts,frontend/src/**/*.css"
---

# UI 设计规范 — GitHub Primer 风格

本项目 UI 整体采用 **GitHub Primer** 设计语言，追求干净、扁平、信息密度高、视觉噪音低。
禁止使用渐变背景、磨砂玻璃（backdrop-filter: blur）、大圆角卡片、霓虹光效等装饰性样式。

---

## 设计原则

1. **内容优先**：UI 是内容的容器，不是主角。去掉一切不传递信息的装饰。
2. **边框驱动**：用 1px 实线边框划分区域，而非阴影或渐变。
3. **留白克制**：间距紧凑统一，不大面积留白。
4. **扁平朴素**：无渐变、无模糊、无动画光效。交互反馈用颜色变化即可。

---

## 色彩体系

### 亮色模式（默认）

| 用途 | 变量名建议 | 色值 |
|------|-----------|------|
| 页面背景 | `--color-canvas-default` | `#ffffff` |
| 次级背景 / 侧栏 | `--color-canvas-subtle` | `#f6f8fa` |
| 深层嵌套背景 | `--color-canvas-inset` | `#eff2f5` |
| 主文字 | `--color-fg-default` | `#1f2328` |
| 次级文字 | `--color-fg-muted` | `#656d76` |
| 占位符 / 禁用文字 | `--color-fg-subtle` | `#8b949e` |
| 边框 | `--color-border-default` | `#d0d7de` |
| 次级边框 | `--color-border-muted` | `#d8dee4` |
| 主强调色（链接、主按钮） | `--color-accent-fg` | `#0969da` |
| 主按钮背景 | `--color-btn-primary-bg` | `#1f883d` (绿色，同 GitHub) |
| 主按钮 hover | `--color-btn-primary-hover-bg` | `#1a7f37` |
| 危险色 | `--color-danger-fg` | `#d1242f` |
| 成功色 | `--color-success-fg` | `#1a7f37` |
| 警告色 | `--color-attention-fg` | `#9a6700` |

### 画布/编辑区深色背景

编辑器画布区域可保留深色背景以区分内容区与操作区：

| 用途 | 色值 |
|------|------|
| 画布背景 | `#0d1117` |
| 画布节点背景 | `#161b22` |
| 画布边框 | `#30363d` |
| 画布文字 | `#e6edf3` |
| 画布次级文字 | `#8b949e` |

---

## 字体

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
  Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
```

等宽字体（代码/脚本编辑器）：

```css
font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
  "Liberation Mono", monospace;
```

### 字号

| 级别 | 大小 | 行高 | 用途 |
|------|------|------|------|
| xs | 12px | 1.5 | 辅助说明、标签、状态 |
| sm | 14px | 1.5 | 正文、表单、列表 |
| base | 16px | 1.5 | 页面标题、面板标题 |
| lg | 20px | 1.4 | 区域大标题 |
| xl | 24px | 1.3 | 页面一级标题 |

---

## 间距

采用 **4px 基准**的间距系统：

| Token | 值 |
|-------|-----|
| spacing-0 | 0 |
| spacing-1 | 4px |
| spacing-2 | 8px |
| spacing-3 | 12px |
| spacing-4 | 16px |
| spacing-5 | 20px |
| spacing-6 | 24px |
| spacing-8 | 32px |

常用规则：
- 面板内边距：`16px`
- 卡片内边距：`12px ~ 16px`
- 元素间距：`8px ~ 12px`
- 区域间距：`16px ~ 24px`

---

## 圆角

| 场景 | 值 |
|------|-----|
| 按钮、输入框、标签 | `6px` |
| 卡片、面板 | `6px` |
| 弹窗、浮层 | `12px` |
| 圆形头像/图标 | `50%` |

**禁止使用 `border-radius` > 12px**（当前代码中大量 18px/24px/999px 需逐步替换）。

---

## 阴影

保持极简，只在浮层/弹窗使用：

| 场景 | 值 |
|------|-----|
| 普通卡片/面板 | 无阴影，仅用边框 |
| 下拉菜单/Popover | `0 1px 3px rgba(31,35,40,0.12), 0 8px 24px rgba(66,74,83,0.12)` |
| 模态框/浮窗 | `0 8px 24px rgba(140,149,159,0.2)` |

**禁止使用 `box-shadow` 作为卡片装饰**。

---

## 边框

- 默认边框：`1px solid #d0d7de`
- 分割线：`1px solid #d8dee4`
- 激活/聚焦边框：`2px solid #0969da`（搭配负 margin 或 outline 补偿）
- 画布区域边框：`1px solid #30363d`

---

## 按钮

按照 GitHub 按钮层级：

| 类型 | 背景 | 边框 | 文字色 |
|------|------|------|--------|
| Primary（主操作） | `#1f883d` | `#1a7f37` | `#ffffff` |
| Default（次操作） | `#f6f8fa` | `#d0d7de` | `#24292f` |
| Danger（危险操作） | `#f6f8fa` | `#d0d7de` | `#d1242f` |
| Invisible（无边框） | `transparent` | `none` | `#0969da` |

hover 状态：背景微调深一层，不使用阴影或渐变。

---

## 选中态 / 激活态

- 画布中选中组件：`2px solid #0969da` 边框 + 浅蓝色背景 `rgba(9,105,218,0.08)`
- **禁止使用彩虹 conic-gradient 选中光效**（当前 `.canvas-node-selected::before/::after` 需移除）
- 列表选中行：`background: #f6f8fa`，左侧 `2px solid #0969da` 指示条
- Tab 激活：底部 `2px solid #fd8c73` 或 `#0969da` 下划线

---

## 布局

### 编辑器三栏布局

```
┌─────────┬────────────────────┬──────────┐
│ 物料面板 │   画布（深色）       │ 配置面板 │
│ 240~280px│   flex: 1          │ 320~360px│
└─────────┴────────────────────┴──────────┘
```

- 三栏之间用 `1px solid #d0d7de` 边框分隔，**不使用 gap + 独立卡片**
- 侧栏背景 `#f6f8fa`，主画布 `#0d1117`

### 顶栏

- 高度：`48px`
- 背景：`#24292f`（GitHub 深色顶栏）
- 文字：`#ffffff`
- 底部边框：`1px solid #d0d7de`

### 管理页面

- 表格/卡片列表，无装饰性背景
- 搜索栏 + 操作按钮组水平排列
- 表格行高 `40~44px`，hover 行背景 `#f6f8fa`

---

## 图标

- 推荐使用 Ant Design Icons（项目已有）
- 图标大小：`16px`（正文旁）、`20px`（按钮内）
- 图标颜色跟随文字色，不单独着色（除状态指示）

---

## 组件级规范

### 输入框

- 高度：`32px`
- 边框：`1px solid #d0d7de`
- 圆角：`6px`
- 背景：`#ffffff`
- 聚焦：`border-color: #0969da; box-shadow: 0 0 0 3px rgba(9,105,218,0.3)`

### 标签（Tag）

- 圆角：`16px`（标签是唯一允许大圆角的例外）
- 内边距：`0 8px`
- 字号：`12px`
- 背景：用途对应色的浅色变体

### 弹窗/浮窗

- 圆角：`12px`
- 边框：`1px solid #d0d7de`
- 阴影：`0 8px 24px rgba(140,149,159,0.2)`
- 标题栏底部分割线

---

## 过渡动效

- 仅允许 `transition` 用于 hover/focus 状态变化
- 持续时间：`0.12s ~ 0.2s`
- 缓动函数：`ease` 或 `ease-in-out`
- **禁止 `@keyframes` 装饰动画**（如彩虹旋转、呼吸光效）
- **禁止 `backdrop-filter: blur()`**

---

## 迁移注意事项

当前代码中以下样式模式需逐步替换：

| 旧模式 | 新模式 |
|--------|--------|
| `border-radius: 18px/24px/999px` | `border-radius: 6px`（弹窗 `12px`） |
| `background: rgba(..., 0.82) + backdrop-filter` | `background: #f6f8fa` 或 `#ffffff` |
| `box-shadow: 0 20px 45px ...` | 移除，改用边框 |
| `radial-gradient / linear-gradient` 背景 | 纯色背景 |
| `conic-gradient` 选中光效 | `2px solid #0969da` 边框 |
| `background: rgba(7,18,28,0.88)` 顶栏 | `background: #24292f` |
| 大间距 `gap: 18px/20px` | 收紧至 `8px/12px/16px` |

---

## CSS 变量声明（推荐在 `:root` 中统一定义）

```css
:root {
  --color-canvas-default: #ffffff;
  --color-canvas-subtle: #f6f8fa;
  --color-canvas-inset: #eff2f5;
  --color-fg-default: #1f2328;
  --color-fg-muted: #656d76;
  --color-fg-subtle: #8b949e;
  --color-border-default: #d0d7de;
  --color-border-muted: #d8dee4;
  --color-accent-fg: #0969da;
  --color-accent-emphasis: #0550ae;
  --color-btn-primary-bg: #1f883d;
  --color-btn-primary-hover-bg: #1a7f37;
  --color-danger-fg: #d1242f;
  --color-success-fg: #1a7f37;
  --color-attention-fg: #9a6700;
  --color-neutral-muted: rgba(175, 184, 193, 0.2);
  --shadow-floating: 0 8px 24px rgba(140, 149, 159, 0.2);
  --border-radius-sm: 6px;
  --border-radius-md: 6px;
  --border-radius-lg: 12px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
}
```
