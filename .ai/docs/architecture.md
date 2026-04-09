---
description: "Use when: 了解系统架构、三页式结构、数据流向、JSON Schema 树"
---

# 系统架构

> 详细任务拆解见 [docs/SOW.md](../../docs/SOW.md)

## 三页式架构

```
管理页 (/) ──创建/编辑──→ 编辑页 (/editor/:pageId) ──预览──→ 预览页 (/preview/:pageId)
```

| 页面 | 职责 | 核心技术 |
|------|------|----------|
| 管理页 | 页面列表 CRUD、状态切换 | AntD Table + Axios |
| 编辑页 | 拖拽编辑 + 脚本编写 | dnd-kit + Monaco + Zustand |
| 预览页 | Schema 递归渲染 + 脚本执行 | SchemaRenderer + scriptSandbox |

## 数据流

```
用户拖拽/配置
    ↓
editorStore (Zustand + Immer)
    ↓
PageSchema (JSON 树)
    ↓
保存 → REST API → PostgreSQL JSONB（规划中）
    ↓
预览页加载 → SchemaRenderer 递归渲染 → scriptSandbox 执行脚本
```

## JSON Schema 树结构

```
PageSchema
├── id, name, status, updatedAt
├── variables[]              ← 页面级变量
├── scripts                  ← onOpen / onClose / onTimer / onVariableChange
└── root (ComponentNode)     ← 页面根容器
    ├── id, type, name, title
    ├── props                ← x, y, width, height, zIndex, ...
    ├── variables[]          ← 组件级变量
    ├── scripts              ← onOpen / onClose / onLoad / onClick
    └── children[]           ← 递归嵌套子节点
```

## 编辑页内部结构

```
EditorPage
├── MaterialPalette（左侧）    ← 物料拖拽源
├── CanvasArea（中间）          ← DndContext 接收区 + 组件渲染
├── ConfigPanel（右侧）        ← 属性/变量/事件配置 + Monaco 脚本编辑
└── EditorToolbar（顶部）      ← 保存/撤销/重做/预览
```

## AI 交互分层（编辑页）

编辑页的 AI 能力分为两个层级，职责严格分离：

### 第一层：AI 排版助手（AiLayoutAssistant 浮窗）

- **触发方式**：EditorToolbar 点击 AI 按钮，弹出可拖动浮窗（340px）
- **职责**：宏观排版建议——帮用户**选中组件**、调整位置/尺寸/层级等**布局属性**
- **能做**：对话式描述需求 → AI 建议移动哪个组件、改多大尺寸 → 操作落到 editorStore（选中、修改 props）
- **不能做**：修改组件内部脚本逻辑、生成代码片段
- **限制原因**：浮窗不持有代码上下文，只有 Schema 结构信息（组件列表 + props）

### 第二层：AI 脚本助手（ConfigPanel 内嵌聊天）

- **触发方式**：**双击画布中的组件**，右侧 ConfigPanel 切换到"脚本"标签，内嵌 AI 聊天 UI
- **职责**：针对**当前选中组件**的脚本逻辑提供代码实现辅助
- **能做**：生成/修改 onOpen / onClick 等事件处理脚本 → Diff 对比 → 采纳写入 Monaco Editor
- **持有上下文**：当前组件 props、已有脚本内容、页面变量列表

### 演进目标

> 当前两层分离是技术约束下的阶段性设计。  
> **最终目标**：将两层合并为一个统一对话框——既能调整排版，又能生成代码，上下文完整共享。  
> 实现前提：统一上下文管理 + 流式 diff 采纳机制。
