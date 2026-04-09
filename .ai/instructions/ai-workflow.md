---
description: "Use when: 更新文档、修改 MEMORY、归档旧文档、维护 .ai/ 体系"
applyTo: "MEMORY.md,.ai/**"
---

# 文档更新规范

## 何时必须更新 MEMORY.md

以下变更完成后，必须同步更新 `MEMORY.md`：

- 新增或删除核心模块
- 完成一个功能里程碑
- 技术栈变更（新增依赖、替换框架）
- 目录结构重大调整

## 何时必须更新 instructions

- 技术栈切换（如状态管理从 Zustand 换为 Redux）→ 更新对应 instruction
- 目录结构重构 → 更新涉及路径的所有 instruction
- 新增模块类型（如后端代码进入仓库）→ 创建新 instruction
- 编码约定变更 → 更新 `coding-style.md`

## MEMORY.md 归档规则

- `MEMORY.md` 控制在 100 行以内
- 超出时，将已完成事项归档到 `.ai/docs/changelog.md`
- 归档格式：`## YYYY-MM-DD 归档` + 归档内容

## 待确认标记规范

- 不确定的内容标记为 `<!-- 待确认 -->`
- 禁止将不确定内容伪装成确定结论
- 定期清理已确认的标记

## 失效文档处理

- 失效的 prompt / skill / doc 移动到 `.ai/docs/archive/`
- 不要留在活跃目录中误导 AI

## 信息源优先级

当不同来源信息冲突时：

**运行配置 / 构建脚本 / CI > 当前源码结构 > 测试用例 > README > 其他历史文档 > 注释 > issue / commit**
