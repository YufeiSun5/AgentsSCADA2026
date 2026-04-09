---
description: "Use when: 查看可用 Prompt 模板、了解 Prompt 格式要求"
---

# prompts 目录说明

存放常用操作的 Prompt 模板，帮助快速启动特定开发流程。

## 格式要求

每个 Prompt 文件命名为 `<name>.prompt.md`，必须包含：

1. YAML frontmatter（description、agent、tools）
2. 正文使用 Markdown 链接引用相关 instructions 和 skills

## YAML frontmatter 示例

```yaml
---
description: "一句话描述用途"
agent: "agent"
tools: [read, edit, search]
---
```

## 引用方式

在对话中告诉 AI："按照 `.ai/prompts/<name>.prompt.md` 执行"，或直接引用文件内容。

## 创建条件

- 仅为项目中最常见的操作创建 Prompt
- 不为凑数创建低价值模板
