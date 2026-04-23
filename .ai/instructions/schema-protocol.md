---
description: "Use when: 编辑 JSON Schema、组件协议、页面协议、pageSchema、AI 提示"
applyTo: "frontend/src/schema/**"
---

# JSON Schema 与协议层规范

## 核心数据结构

### PageSchema（页面描述树）

```typescript
interface PageSchema {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'enabled' | 'disabled';
    updatedAt: string;
    variables: ComponentVariable[];
    scripts: PageScripts;        // onOpen / onClose / onTimer / onVariableChange
    root: ComponentNode;         // 页面根容器，children 递归嵌套
}
```

### ComponentNode（组件节点）

```typescript
interface ComponentNode {
    id: string;
    type: ComponentType;         // 'container' | 'text' | 'button' | 'input' | 'table' | 'chart' | 'customHtml'
    name: string;
    title: string;
    props: Record<string, unknown>;
    variables: ComponentVariable[];
    scripts: ComponentScripts;   // onOpen / onClose / onLoad / onClick
    children: ComponentNode[];
}
```

所有组件都有 `x`, `y`, `width`, `height`, `zIndex` 属性用于画布定位。

## 协议结构

### ComponentProtocolDefinition

每种组件类型对应一个协议文件，位于 `frontend/src/schema/protocols/components/`：

```typescript
interface ComponentProtocolDefinition {
    type: ComponentType;
    title: string;
    summary: string;
    usage: string[];
    supportedEvents: ProtocolEventDefinition[];
    supportedMethods: ProtocolMethodDefinition[];
    properties: ProtocolPropertyDefinition[];
    aiHints: string[];           // AI 生成脚本时的约束提示
}
```

### 协议注册表

`frontend/src/schema/protocols/index.ts` 维护 `componentProtocols` 映射表：

```typescript
const componentProtocols: Record<ComponentType, ComponentProtocolDefinition>
```

通过 `getComponentProtocol(type)` 检索，`buildComponentCopilotContext(type)` 构建 AI 上下文。

## 新增协议流程

1. 在 `protocols/components/` 下创建 `<name>Protocol.ts`
2. 实现 `ComponentProtocolDefinition` 接口，必须填写 `aiHints`
3. 在 `protocols/components/index.ts` 中导出
4. 在 `protocols/index.ts` 的 `componentProtocols` 中注册
5. 同步创建渲染文件和 materialCatalog 条目（参考 `frontend-react.md`）

## aiHints 字段要求

- 每个组件协议必须包含 `aiHints` 数组
- 内容面向 AI：描述生成脚本时应遵循的约束
- 至少包含：可用的 Ctx 方法范围、常见误用警告

## 物料目录（materialCatalog）

位于 `frontend/src/schema/pageSchema.ts`，定义 6 种物料：

| type | label | category |
|------|-------|----------|
| `container` | 容器 | 布局容器 |
| `text` | 文本 | 基础组件 |
| `button` | 按钮 | 基础组件 |
| `input` | 输入框 | 基础组件 |
| `table` | 表格 | 数据展示 |
| `chart` | 图表 | 数据展示 |
| `customHtml` | 自定义HTML | 高级组件 |

`createComponentNode(type)` 根据 catalog 创建带默认属性的新节点。

## customHtml 组件特殊规则

- `customHtml` 使用 iframe srcdoc 渲染用户 HTML/CSS/JS，与画布主页面严格隔离
- 协议文件中的 `supportedMethods` 描述 **ScadaBridge SDK** 方法（readTag/writeTag/subscribe/query/assetUrl），不使用常规组件的 Ctx 方法
- `aiHints` 必须包含 ScadaBridge API 用法说明，告知 AI 在 `ScadaBridge.onReady()` 回调中编写初始化逻辑
- 默认属性：`htmlContent`、`cssContent`、`jsContent`、`transparent`、`libraryAssetIds`、`sandboxPermissions`
- `libraryAssetIds` 关联后端 `sys_assets` 表中的 JS/CSS 文件，渲染时自动注入 `<script>` / `<link>` 标签

## 兼容层

`frontend/src/schema/componentProtocol.ts` 仅作为兼容导出层，从 `./protocols` 再导出。新代码直接引用 `./protocols`。
