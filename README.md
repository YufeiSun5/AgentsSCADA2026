# AgentsSCADA2026

工业低代码通用底座中的可视化页面编辑器模块。当前仓库已完成前端初始化、SCADA 式固定画布编辑、组件协议建模，以及面向 AI 副驾驶的脚本工作台基础设施。

## 当前已完成

- 管理页、编辑页、预览页三页式结构已经打通。
- 页面编辑器支持固定画布尺寸、自由拖拽、右键层级调整、删除组件。
- 选中组件时会显示环绕彩虹发光边框，拖动过程中 X/Y 坐标会实时更新。
- 所有可拖拽物料已经拆成独立文件，便于后续维护与扩展。
- 组件协议已拆成模块化目录，支持页面协议、组件协议、AI 提示统一管理。
- 脚本编辑区已改造成 VS Code 风格工作台，内置当前代码、AI 建议、Diff 对比三种视图。
- 已预埋 AI 建议全量采纳与片段采纳入口，便于后续接入真实大模型返回结果。

## 技术栈

- 前端框架：React 18 + React Router v6
- 工程化：Vite 6 + TypeScript
- UI 组件：Ant Design 5
- 拖拽引擎：dnd-kit
- 状态管理：Zustand + Immer
- 代码编辑器：Monaco Editor + Monaco DiffEditor
- 图表：ECharts + echarts-for-react
- 接口层：Axios

## 目录说明

- frontend/src/pages：管理页、编辑页、预览页
- frontend/src/components/materials：每个可拖拽组件一个文件
- frontend/src/components/editor：画布、工具栏、配置面板等编辑器组件
- frontend/src/schema/pageSchema.ts：运行时页面 Schema
- frontend/src/schema/protocols：页面协议、组件协议与 AI 提示
- frontend/src/services：本地持久化与后续 REST API 接口层

## 脚本编辑器方案

脚本编辑器当前采用 Monaco Editor 和 Monaco DiffEditor，原因如下：

- Monaco 本身就是 VS Code 编辑器内核，界面和交互迁移成本最低。
- Monaco DiffEditor 天然支持当前代码与 AI 建议的差异对比。
- 后续“接受部分代码”可以继续基于 Monaco 的选区、range 和 diff hunk 能力实现，不需要推翻现有方案。

## 运行方式

在 frontend 目录执行：

```bash
npm install
npm run dev
```

构建验证：

```bash
npm run build
```

## 后续建议

- 给每个物料补独立属性编辑器文件，与渲染文件、协议文件形成三位一体结构。
- 将 AI 建议接入真实服务，替换当前本地草案生成逻辑。
- 基于 Monaco DiffEditor 实现按差异块采纳，而不仅是全量或选区追加。