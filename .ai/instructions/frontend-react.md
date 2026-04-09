---
description: "Use when: 编辑 React 组件、物料文件、编辑器组件、状态管理、样式"
applyTo: "frontend/src/**/*.tsx,frontend/src/**/*.ts,frontend/src/**/*.css"
---

# 前端 React 约定

## 物料组件规则

- **一个物料一个文件**，位于 `frontend/src/components/materials/`
- 禁止把多个物料的渲染逻辑堆叠在单一文件中
- 所有物料统一实现 `MaterialRenderProps` 接口：

```typescript
interface MaterialRenderProps {
    node: ComponentNode;
    interactive: boolean;
    onRunScript?: (script: string | undefined, node: ComponentNode) => void;
}
```

- 新增物料时导出需同步更新 `materials/index.ts`

## 新增组件三位一体

新建任何组件必须同时创建以下三个文件，缺一不可：

1. **渲染文件**：`frontend/src/components/materials/<Name>Material.tsx`
2. **协议文件**：`frontend/src/schema/protocols/components/<name>Protocol.ts`
3. **注册到 catalog**：在 `frontend/src/schema/pageSchema.ts` 的 `materialCatalog` 中添加条目

还需更新：
- `frontend/src/components/materials/index.ts`（导出）
- `frontend/src/schema/protocols/components/index.ts`（导出）
- `frontend/src/schema/protocols/index.ts`（注册到 `componentProtocols`）
- `frontend/src/schema/pageSchema.ts` 的 `ComponentType` 联合类型

## 编辑器组件结构

| 组件 | 路径 | 职责 |
|------|------|------|
| `CanvasArea` | `components/editor/CanvasArea.tsx` | 画布：选中、拖拽、右键菜单 |
| `ConfigPanel` | `components/editor/ConfigPanel.tsx` | 右侧配置：属性/变量/事件/脚本编辑 |
| `EditorToolbar` | `components/editor/EditorToolbar.tsx` | 顶栏：标题、状态、撤销/重做、保存、预览 |
| `MaterialPalette` | `components/editor/MaterialPalette.tsx` | 左侧物料面板：拖拽卡片 |

## 状态管理（Zustand + Immer）

- 全局编辑器状态集中在 `frontend/src/stores/editorStore.ts`
- 使用 Immer 的 `produce` 处理深层嵌套的 JSON Schema 状态树
- 撤销/重做：`history` / `future` 栈，最多 40 步
- 状态变更通过 store action 完成，禁止在组件中直接修改 schema 对象

## 脚本编辑器

- 统一使用 **Monaco Editor**
- 当前代码与 AI 建议的对比统一使用 **Monaco DiffEditor**
- 后续"接受部分代码"优先基于 Monaco 的 range / selection / diff hunk 能力
- **禁止引入与 Monaco 职责重叠的第二套代码对比组件**

## 样式约定

- 全局样式位于 `frontend/src/styles/global.css`
- 组件级样式优先内联或 CSS Module
- 画布背景色默认 `#081622`（工业深色主题）
