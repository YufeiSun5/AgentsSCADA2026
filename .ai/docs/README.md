---
description: "Use when: 查阅架构设计、功能设计、变更历史"
---

# docs 目录说明

存放功能设计文档、架构设计文档和变更历史。

## 文件命名规范

- 功能设计：`<feature-name>.md`（如 `script-sandbox.md`）
- 架构文档：`architecture.md`
- 变更归档：`changelog.md`

## 创建条件

- 新功能涉及多模块协作或有非显而易见的设计决策时，创建功能设计文档
- `MEMORY.md` 超过 100 行时，将已完成事项归档到 `changelog.md`

## 子目录

- `archive/` — 失效的 prompt、skill、doc 的归档目录
