---
description: "新建一个完整的物料组件（渲染 + 协议 + 注册）"
agent: "agent"
tools: [read, edit, search]
---

# 新建物料组件

请按照 [add-material 技能](../skills/add-material/SKILL.md) 的完整流程，为项目新建一个物料组件。

## 输入

请告诉我：
1. 组件类型名（英文小写，如 `gauge`）
2. 组件中文名称（如 `仪表盘`）
3. 所属分类：基础组件 / 数据展示 / 布局容器
4. 组件的核心功能和默认属性

## 执行流程

1. 先阅读 [前端 React 约定](../instructions/frontend-react.md) 和 [协议规范](../instructions/schema-protocol.md)
2. 按技能步骤依次创建：类型扩展 → catalog 条目 → 渲染文件 → 导出更新 → 协议文件 → 协议注册 → 渲染器分支
3. 遵循 [编码风格规范](../instructions/coding-style.md)
4. 完成后更新 `MEMORY.md`
