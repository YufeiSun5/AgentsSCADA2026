---
description: "Use when: 编写代码、代码审查、格式化、缩进、命名、注释、函数设计"
applyTo: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.css"
---

# 编码风格规范

## 核心理念

代码是写给人看的。保持简单，拒绝炫技。若一段代码需要大量注释才能解释其运行方式，去重构它。

## 缩进与行宽

- **使用 Tab**，一个 Tab 等于 **8 个字符宽度**
- 前端 React / Java 体系底线：统一使用 **4 个空格**，禁止使用 2 个空格
- **最大嵌套层数：3 层**，超过则拆分函数
- 单行代码 **≤ 80 个字符**，超出则折行或提取函数

## 大括号

### 控制语句（K&R 风格）

左大括号放行尾，右大括号放行首。**任何情况下不得省略大括号**。

```javascript
// ✅ 正确
if (user_exists) {
    do_something();
} else {
    do_something_else();
}

// ❌ 错误
if (user_exists)
    do_something();
```

### 函数定义

函数的左右大括号**独占一行**。

```javascript
function process_page_data(page_id)
{
    // ...
}
```

## 空格规则

| 场景 | 规则 |
|------|------|
| 关键字与括号之间 | 加一个空格：`if (x)`、`for (i)` |
| 函数名与括号之间 | 不加空格：`do_something()` |
| 二元/三元操作符两侧 | 加一个空格：`= + - < > * / %` |

## 命名规范

**禁止匈牙利命名法。**

- 局部变量：短小精悍，`snake_case`，循环计数器直接用 `i`
- 全局变量与函数：必须具备描述性，`count_active_pages()` 而非 `cnt_pg()`
- React 组件：`PascalCase`（遵循框架惯例）
- React hooks：`camelCase`，以 `use` 开头（遵循框架惯例）

```javascript
// ✅ 正确
let tmp;
let node_id;

// ❌ 错误
let currentActiveNodeIdentifierString;
```

## 函数设计

- **单一职责**：一个函数只做一件事
- 函数体 ≤ 两到三屏文本，局部变量 ≤ 10 个
- **提早返回（Early Return）**：遇到错误立即返回，避免深层嵌套

```javascript
function process_page_data(page_id)
{
    if (!page_id) {
        console.error("页面 ID 不存在");
        return null;
    }

    let page_data = fetch_data(page_id);
    if (!page_data) {
        console.error("无法获取页面数据");
        return null;
    }

    render_page(page_data);
    return true;
}
```

## 注释规范

**强制使用中文注释。**

- ❌ 不要解释代码**怎么做**（How）
- ✅ 只解释代码**做什么**（What）和**为什么这么做**（Why）
- 每个文件最开头必须用块注释说明该文件的职责

```javascript
/*
 * 画布渲染模块。
 * 负责将 JSON Schema 转换为可交互的 SCADA 画布元素，
 * 并管理元素的拖拽、选中、缩放等交互状态。
 */
```

## 数据结构优先

> "烂程序员关心的是代码。好程序员关心的是数据结构和它们之间的关系。" —— Linus Torvalds

- 设计良好的数据结构比复杂的代码逻辑更重要
- 优先设计清晰的 JSON 树状状态和数据流向，代码逻辑自然水到渠成
