---
name: add-material
description: "Use when: 新增物料组件、新建拖拽组件、添加新的 ComponentType"
argument-hint: "物料名称和类型，如：仪表盘 gauge"
---

# 新增物料组件

## 适用场景

需要在编辑器中添加一种新的可拖拽物料组件。

## 前置条件

- 明确组件的 `ComponentType` 值（英文小写，如 `gauge`）
- 明确组件的中文名称、所属分类（基础组件 / 数据展示 / 布局容器）
- 明确组件的默认属性（尺寸、位置、特有配置）

## 操作步骤

### 1. 扩展类型定义

在 `frontend/src/schema/pageSchema.ts` 中：
- 向 `ComponentType` 联合类型添加新值

```typescript
export type ComponentType = 'container' | 'text' | 'button' | 'input' | 'table' | 'chart' | '新类型';
```

### 2. 注册到物料目录

在 `frontend/src/schema/pageSchema.ts` 的 `materialCatalog` 数组中添加条目：

```typescript
{
    type: '新类型',
    label: '中文名',
    category: '分类',
    description: '一句话说明用途。',
    defaultProps: {
        x: 80, y: 80,
        width: 300, height: 200,
        zIndex: 1,
        // 组件特有属性...
    },
},
```

### 3. 创建渲染文件

创建 `frontend/src/components/materials/<Name>Material.tsx`：

```typescript
import type { MaterialRenderProps } from './materialTypes';

export default function <Name>Material({ node, interactive, onRunScript }: MaterialRenderProps)
{
    return (
        // 组件渲染逻辑
    );
}
```

### 4. 更新物料导出

在 `frontend/src/components/materials/index.ts` 中添加导出。

### 5. 创建协议文件

创建 `frontend/src/schema/protocols/components/<name>Protocol.ts`，实现 `ComponentProtocolDefinition`。

**必须包含 `aiHints` 字段。**

### 6. 注册协议

- 在 `protocols/components/index.ts` 中导出新协议
- 在 `protocols/index.ts` 的 `componentProtocols` 映射中注册

### 7. 更新渲染器

在 `frontend/src/components/renderer/SchemaRenderer.tsx` 中添加新组件类型的渲染分支。

## 关键约束

- 渲染文件、协议文件、catalog 条目**必须同步创建**
- 协议的 `type` 字段必须与 `ComponentType` 值一致
- `aiHints` 至少包含：可用的 Ctx 方法范围和常见误用警告
- 文件头注释用中文说明组件职责
