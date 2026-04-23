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

## customHtml 物料特殊规则

- `CustomHtmlMaterial` 使用 iframe srcdoc 渲染，**禁止改为 Shadow DOM 或 dangerouslySetInnerHTML**
- 编辑模式下 iframe 必须设置 `pointer-events: none`，预览模式下 `auto`
- ScadaBridge SDK 源码位于 `utils/scadaBridge.ts`，单一导出 `SCADA_BRIDGE_SDK_SOURCE` 字符串
- 父窗口消息路由器位于 `utils/bridgeManager.ts`，`BridgeManager` 类负责处理 readTag/writeTag/subscribe/query 请求
- 当前 BridgeManager 使用 Mock 数据（⬆ 待接入真实 WebSocket 数据源）
- `libraryAssetIds` 关联的 JS/CSS 库文件由后端 `AssetController` 提供，渲染时自动生成 `<script>` / `<link>` 标签

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
| `AssetManager` | `components/editor/AssetManager.tsx` | 资产管理：上传/列表/删除/库文件关联 |

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

## 资产管理（Asset）

- 前端接口封装位于 `services/assetService.ts`：`uploadAsset` / `listAssets` / `deleteAsset` / `getAssetFileUrl`
- 后端 API 路径 `/api/assets`，服务类 `AssetService`，实体 `SysAsset`
- 文件存储路径由 `scada.storage.path` 配置，相对路径存入数据库
- 上传文件扩展名白名单：png/jpg/jpeg/gif/webp/svg/js/css/json/woff/woff2/ttf/eot
- **iframe 加载资产无需 JWT**，`/assets/*/file` 已配为 `permitAll`
- ConfigPanel 中 customHtml 组件显示「资产」tab，集成 `AssetManager` 组件

## 样式约定

- 全局样式位于 `frontend/src/styles/global.css`
- 组件级样式优先内联或 CSS Module
- **UI 视觉规范详见 `.ai/instructions/ui-design.md`**（GitHub Primer 风格）
- 画布背景色默认 `#0d1117`（GitHub 深色）
- 面板/侧栏背景 `#f6f8fa`，边框 `#d0d7de`
- 禁止渐变背景、磨砂模糊、大圆角（>12px）、装饰性阴影和动画光效
