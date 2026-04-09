---
description: "Use when: 查看可用 Agent、了解 Agent 定义规范"
---

# agents 目录说明

存放自定义 Agent 定义，每个 Agent 有明确的角色、职责范围和工具限制。

## Agent 定义规范

每个 Agent 文件命名为 `<name>.agent.md`，必须包含：

1. YAML frontmatter（description、name、tools）
2. 角色定位
3. 职责范围
4. 约束（不做什么）
5. 具体检查清单或工作步骤

## tools 字段说明

`tools` 为文档级能力约束声明，表达最小必要能力。常用值：

| 工具 | 含义 |
|------|------|
| `read` | 读取文件 |
| `search` | 搜索代码 |
| `edit` | 编辑文件 |
| `terminal` | 执行命令 |

审查类 Agent 应限制为 `[read, search]`，不授予 `edit` 权限。
