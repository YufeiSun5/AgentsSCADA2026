# 项目工程与代码规范 (V1.0)

## 0. 核心理念

代码是写给人看的。保持简单，拒绝炫技。若一段代码需要大量注释才能解释其运行方式，说明结构有问题——去重构它。

---

## 1. 缩进与行宽

### 1.1 缩进规则

- **使用 Tab**，一个 Tab 等于 **8 个字符宽度**
- 前端 React / Java 体系底线：统一使用 **4 个空格**，禁止使用 2 个空格
- **最大嵌套层数：3 层**。超过 3 层说明函数需要拆分

### 1.2 行宽限制

- 单行代码 **≤ 80 个字符**
- 超出则折行，或提取为独立函数

---

## 2. 大括号与空格

### 2.1 控制语句（K&R 风格）

左大括号放行尾，右大括号放行首。**任何情况下不得省略大括号**。

```javascript
// ✅ 正确
if (user_exists) {
	do_something();
} else {
	do_something_else();
}

// ❌ 错误：省略大括号，日后扩展极易引发 Bug
if (user_exists)
	do_something();
```

### 2.2 函数定义

函数的左右大括号**独占一行**。

```c
// ✅ 正确
int execute_script(char *script_content)
{
	return 0;
}
```

### 2.3 空格规则

| 场景 | 规则 |
|------|------|
| 关键字与括号之间 | 加一个空格：`if (x)`、`for (i)` |
| 函数名与括号之间 | 不加空格：`do_something()` |
| 二元/三元操作符两侧 | 加一个空格：`= + - < > * / % \| & ^ <= >= == != ? :` |

---

## 3. 命名规范

**禁止匈牙利命名法**（禁止在变量名中编码类型信息）。

### 3.1 局部变量

- 短小精悍，使用 `snake_case`
- 循环计数器直接用 `i`，不要用 `LoopCounterIndex`

```javascript
// ✅ 正确
let tmp;
let node_id;

// ❌ 错误：冗长无意义
let currentActiveNodeIdentifierString;
```

### 3.2 全局变量与函数

- 全局命名必须具备**描述性**
- 统计活跃页面数量的函数：`count_active_pages()`，而非 `cnt_pg()`

---

## 4. 函数设计

### 4.1 单一职责

- 一个函数只做一件事
- 函数体 ≤ 两到三屏文本
- 局部变量 ≤ 10 个

### 4.2 提早返回（Early Return）

遇到错误或边界条件立即返回，避免深层嵌套。

```javascript
// ✅ 正确：主干逻辑无嵌套
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

---

## 5. 注释规范

**强制使用中文注释。**

### 5.1 注释原则

- ❌ 不要解释代码**怎么做**（How）——代码本身就是答案
- ✅ 只解释代码**做什么**（What）和**为什么这么做**（Why）

### 5.2 注释风格

多行注释使用块注释风格：

```javascript
/*
 * 在渲染画布前，对传入的 JSON Schema 进行深度克隆和校验。
 * 原因：原始数据可能被其他 React 生命周期意外污染。
 */
function clone_and_verify_schema(raw_schema)
{
	let safe_schema = deep_clone(raw_schema);
	return safe_schema;
}
```
### 5.3 必要注释

每个文件最开头必须用块注释说明该文件的职责。

```javascript
/*
 * 画布渲染模块。
 * 负责将 JSON Schema 转换为可交互的 SCADA 画布元素，
 * 并管理元素的拖拽、选中、缩放等交互状态。
 */
```

---

## 6. 数据结构与状态

> "烂程序员关心的是代码。好程序员关心的是数据结构和它们之间的关系。" —— Linus Torvalds

- 设计良好的数据结构比复杂的代码逻辑更重要
- 在复杂模块（如拖拽编辑器）中，**优先设计清晰的 JSON 树状状态和数据流向**，代码逻辑自然水到渠成

---

## 7. 仓库前端约定

### 7.1 组件拆分

- 编辑器中的可拖拽物料，**一个组件一个文件**
- 目录位置：`frontend/src/components/materials/`
- 禁止把多个物料的渲染逻辑长期堆叠回单一大文件

### 7.2 协议拆分

- 页面协议与组件协议必须模块化维护
- 页面协议位置：`frontend/src/schema/protocols/pageCanvasProtocol.ts`
- 组件协议位置：`frontend/src/schema/protocols/components/`
- `frontend/src/schema/componentProtocol.ts` 只作为兼容导出层使用

### 7.3 脚本编辑器

- 脚本编辑器统一使用 Monaco Editor
- 当前代码与 AI 建议的比对统一使用 Monaco DiffEditor
- 后续“接受部分代码”优先基于 Monaco 的 range、selection、diff hunk 能力实现
- 不要引入与 Monaco 职责重叠的第二套代码对比组件

### 7.4 AI 驱动约束

- AI 可读取的说明文档，优先直接挂在协议层，不要散落在 README、注释和界面文案里重复维护
- 组件协议必须包含：用途、属性说明、支持事件、支持方法、AI 提示
- 新增组件时，渲染文件、协议文件、属性编辑入口应同步补齐
