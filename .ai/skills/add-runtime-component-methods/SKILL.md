---
name: add-runtime-component-methods
description: "Use when: 为现有或新增 SCADA 物料组件添加脚本可调用的运行态方法、组件原生能力适配、components.call 方法、Monaco 类型提示、协议 supportedMethods/aiHints、AI 工作台上下文或审批校验。"
---

# 添加运行态组件方法

## 目标

把底层组件库能力稳定暴露给低代码脚本和 AI。不要让脚本直接依赖 React 实例、DOM 私有结构或未声明 API；所有可调用能力必须经过物料适配层、协议层和类型提示同步声明。

## 必读文件

先读项目根目录 `MEMORY.md` 和 `.ai/instructions/` 下相关规范。做组件能力改造时至少检查：

- `frontend/src/runtime/pageRuntime.tsx`
- `frontend/src/utils/scriptSandbox.ts`
- `frontend/src/components/materials/<Name>Material.tsx`
- `frontend/src/schema/protocols/components/<name>Protocol.ts`
- `frontend/src/components/editor/ConfigPanel.tsx`
- `frontend/src/components/editor/AiWorkbench.tsx`

## 设计原则

- 运行态方法是低代码协议，不是底层库 API 的无过滤透传。
- 通用能力优先统一命名，例如 `setStyle`、`setText`、`setDisabled`、`reset`。
- 专属能力按底层库语义命名，例如 ECharts 的 `setOption/appendData/resize`、AG Grid 的 `setRows/updateRow/autoSizeColumns`。
- 运行态状态必须是临时状态，不直接保存页面 schema；保存仍由用户显式点击保存。
- 协议层是 AI 可读说明的唯一来源，新增方法必须同步写入 `supportedMethods` 和 `aiHints`。
- 普通页面/组件脚本使用 `vars/tags/components/message/change/page/node`；`ScadaBridge` 只用于 `customHtml` iframe。

## 实施流程

### 1. 盘点目标组件

确认底层组件和当前已暴露能力：

- 查物料实现里是否调用 `usePageRuntime()`。
- 查是否有 `runtime?.registerComponent(node.id, methods, [node.name])`。
- 查协议 `supportedMethods` 是否和实现一致。
- 查 AI 工作台传给后端的组件摘要是否包含该协议。

### 2. 添加物料适配

在物料组件内注册运行态方法。示例：

```tsx
const runtime = usePageRuntime();
const [runtimeStyle, setRuntimeStyle] = useState<CSSProperties>({});

useEffect(() => {
  return runtime?.registerComponent(node.id, {
    setStyle: (patch) => {
      setRuntimeStyle((previous) => ({ ...previous, ...readObject(patch) }));
    },
    reset: () => {
      setRuntimeStyle({});
    },
  }, [node.name]);
}, [runtime, node.id, node.name]);
```

要求：

- 方法参数先用本物料已有的 `readObject/readNumber/readBoolean/readString` 这类解析函数兜底。
- 切换 `node.id` 或关键 props 时清理运行态状态，避免复用旧组件状态。
- 不要把 `setState` 暴露给脚本；暴露稳定、语义化的方法。
- 若方法依赖实例 ref，必须处理实例未就绪，避免抛出不可恢复错误。

### 3. 同步协议

在对应 `<name>Protocol.ts` 中补：

- `supportedMethods`：名称、用途、签名、示例。
- `properties`：如果新增默认静态 props，也写入属性说明。
- `aiHints`：写清常见误用，例如普通脚本不要用 `ScadaBridge`。

示例：

```ts
{
  name: 'components.call',
  summary: '运行态修改按钮显示样式。',
  signature: 'components.call(componentIdOrName, "setStyle", style)',
  example: 'components.call("start_button", "setStyle", { backgroundColor: "#4CAF50" });',
}
```

### 4. 同步脚本上下文

如果只是新增某个组件的 `components.call` 方法，通常不需要改 `scriptSandbox.ts` 或 Monaco 全局类型。

如果新增全局脚本对象或全局方法，必须同步：

- `frontend/src/utils/scriptSandbox.ts` 的 `ScriptContext` 和 `new Function` 参数。
- `frontend/src/pages/preview/PreviewPage.tsx` 的脚本上下文构建。
- `frontend/src/components/editor/ConfigPanel.tsx` 的 `scriptEditorExtraLib`。
- `frontend/src/components/editor/AiWorkbench.tsx` 的 `runtimeScriptApi` 或上下文策略。
- 后端相关 Agent prompt，如果 AI 会生成该能力。

### 5. 审批与 AI 约束

如果新增的方法会被 AI 生成，检查 `AiWorkbench`：

- action 审批前是否能定位目标组件。
- 脚本 action 是否进入 Diff，而不是自动写入。
- 是否需要拦截错误 API，例如普通组件脚本中的 `ScadaBridge.*`。
- 当前组件的 `supportedMethods` 是否已经进入 `buildComponentSummary()`。

### 6. 验证

至少运行：

```powershell
cd frontend
node .\node_modules\typescript\bin\tsc -b
node .\node_modules\vite\bin\vite.js build
```

如果修改了后端 prompt、DTO、Controller 或 Agent：

```powershell
cd backend
mvn -q -DskipTests compile
```

最后运行：

```powershell
git diff --check
```

## 审阅清单

审阅其它组件时按这个顺序输出缺口：

1. 实现是否注册了运行态方法。
2. 协议 `supportedMethods` 是否覆盖实现。
3. AI `aiHints` 是否能防止常见误用。
4. Monaco/脚本上下文是否知道新增全局 API。
5. 方法是否只改运行态临时状态，不绕过用户保存。
6. 是否有类型检查或构建验证。
