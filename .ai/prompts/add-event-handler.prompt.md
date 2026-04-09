---
description: "为现有组件添加新的事件处理（协议 + 渲染层同步）"
agent: "agent"
tools: [read, edit, search]
---

# 添加事件处理

为现有组件添加一个新的事件处理器，确保协议层和渲染层同步更新。

## 输入

请告诉我：
1. 目标组件类型（如 `button`、`table`）
2. 新事件名称（如 `onDoubleClick`、`onRowSelect`）
3. 事件的触发时机和预期行为

## 执行流程

1. 阅读 [协议规范](../instructions/schema-protocol.md) 了解协议结构
2. 在 `frontend/src/schema/pageSchema.ts` 的 `ComponentScripts` 接口中添加新事件字段
3. 在目标组件的协议文件 `protocols/components/<name>Protocol.ts` 中：
   - 向 `supportedEvents` 添加事件定义
   - 向 `aiHints` 添加脚本生成约束
4. 在目标组件的渲染文件 `materials/<Name>Material.tsx` 中绑定事件触发
5. 确保 `normalizeNode()` 能处理新事件字段的默认值
6. 遵循 [编码风格规范](../instructions/coding-style.md)
7. 完成后更新 `MEMORY.md`
