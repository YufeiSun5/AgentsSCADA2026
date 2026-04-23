# 开发进度追踪

> 最后更新：2026-04-20（保存后保留 AI 选中组件）

## 当前阶段

**前端实时组件 Demo + AG Grid 表格底座 + 原生脚本 API 完成** — 物料面板精简为 HTML、文本、按钮、ECharts、表格、图片；新增图片组件；输入框物料下架；容器仅保留内部兼容；新增 Mock 实时数据服务，文本支持实时绑定与点击弹窗回写，按钮支持控制回写确认，HTML ScadaBridge 增加快捷绑定方法；页面局部变量允许中文命名；页面/组件脚本切换为原生风格全局对象 `vars` / `components` / `message` / `change` / `page` / `node`，不再保留 `Ctx` 兼容；展示页内所有可加注释的脚本和 customHtml HTML/CSS/JS 均已补中文注释；表格物料迁移到 AG Grid Community，支持低代码 columnDefs/rowData、分页、虚拟滚动、编辑列和内置按钮/开关/进度/标签单元格；页面变量改为“紧凑摘要列表 + 主弹窗编辑 + 脚本/AI 独立弹窗”模式，支持变量专属 `scripts.onChange`、左侧单行变量列表和 AI 变量编辑入口；变量脚本页补齐了与组件代码编辑器一致的 AI 对话侧栏和 Diff 对比入口，变量 AI 总弹窗也统一为同一套暗色工作台样式；变量 AI 默认改为增量合并，避免只返回一个变量时覆盖整张变量表，并且拒绝“我有哪些变量”这类闲聊/查询式输入；Monaco 关闭脚本语法级误报，避免页面脚本顶层 `return` 等函数体写法持续飘红；AI 代码编辑防止把 JS 里的 `{}` 误识别为空 JSON patch；后端 AI 入口新增显式 `taskKind`、`target`、`context` 协议，增加 Router + 5 类任务 Agent 骨架，`variables_edit` 与 `script_edit` 已切到结构化 `resultType/result` 返回，给后续 MCP 工具层预留统一能力面；当 `props.json` AI 窗口收到 `update_node/update_page` 这类布局动作时，前端会直接把动作应用到画布，并提示用户保存页面，避免只返回动作 JSON 但界面不变。

## 已完成

- 管理页、编辑页、预览页三页式路由结构
- 固定画布尺寸、自由拖拽、右键层级调整、删除组件
- 选中组件彩虹发光边框、拖动实时坐标更新
- 6 种物料组件拆分为独立文件（container/text/button/input/table/chart）
- 组件协议模块化（页面协议 + 6 种组件协议 + AI 提示字段）
- 脚本编辑区 VS Code 风格工作台（当前代码 / AI 建议 / Diff 对比三视图）
- AI 建议全量采纳与片段采纳入口预埋
- **ConfigPanel 代码编辑器 AI Diff 工作流（2026-04-08）**：
  - AI 回复若含代码块（```...```）自动解析并在消息旁显示"在编辑器中对比"按钮
  - 点击后进入 Monaco DiffEditor 模式：左侧原始代码，右侧 AI 建议
  - Footer 显示"接受修改"/"拒绝修改"按钮，接受后写回实际 store
  - AI 上下文自动携带当前文件完整代码；若有选中文本则优先携带选中片段
  - Monaco onMount 追踪 activeEditorRef 以读取选中区域
- 撤销/重做支持（最多 40 步历史）
- AI 编排助手全量重构（2026-04-08）：
  - **AiLayoutAssistant（第一层）**：可拖动浮窗（340px），职责是宏观排版——选中组件、调整位置/尺寸/层级布局属性；不能修改脚本，只持有 Schema 结构上下文
  - **ConfigPanel AI 聊天（第二层）**：双击画布组件后右侧展开，针对当前选中组件做脚本代码辅助；持有完整代码上下文（props + 脚本 + 变量）
  - 两层当前分离是阶段性设计；**演进目标**：合并为一个对话框，统一排版 + 代码上下文
  - 后端：AiChatDto 改为多轮 messages[] + nodes[]，支持多轮上下文传递
  - 前端：aiService.ts 统一为 callAiChat(messages, nodes) 接口
  - 已接入 GLM-4-flash（智谱AI），端点通过 vite.config.js 代理
- AI 工程化文档体系搭建（`.ai/` 目录、编辑器适配层）
- **AI 任务拆分第一批（2026-04-20）**：
  - 后端 `AiChatDto` 扩展 `taskKind/target/context/resultType/result/warnings`
  - 新增 `AiTaskRouter` + `layout/props/script/variables/custom_html` 五类 Agent 骨架
  - `AiDevChatService` 支持显式 taskKind 路由；保留旧 `messages + nodes` 自动判别兼容层
  - 前端新增 `aiTaskService.ts`，页面变量结构 AI 与变量脚本 AI 已改为显式 `variables_edit` / `script_edit`
  - 运行态冒烟通过：`script_edit` 返回 `resultType=code`，`variables_edit` 返回 `resultType=variables`
- **AI 选中态保留修复（2026-04-20）**：
  - `editorStore.setSchema` 新增 `preserveSelection` 选项，保存后若节点仍存在则保留当前 `selectedId`
  - 编辑页手动保存与 AI 编排自动保存改为保留选中态，避免 `select_node` 成功后配置面板又退回页面级信息

### 自定义 HTML 组件（customHtml）（2026-04-08 新完成）

**前端 — 类型与协议**
| 文件 | 说明 |
|------|------|
| `pageSchema.ts` 新增 | `ComponentType` 加入 `'customHtml'`，`materialCatalog` 新增 customHtml 条目（默认属性：htmlContent/cssContent/jsContent/transparent/libraryAssetIds/sandboxPermissions） |
| `customHtmlProtocol.ts` | 组件协议：5 个 ScadaBridge 方法、11 个属性、7 条 AI 提示、onLoad 事件 |
| `protocols/components/index.ts` | 导出 customHtmlProtocol |
| `protocols/index.ts` | 注册到 `componentProtocols` 映射 |

**前端 — 渲染与桥接**
| 文件 | 说明 |
|------|------|
| `CustomHtmlMaterial.tsx` | iframe srcdoc 渲染：SDK 注入 → 库脚本标签 → 用户 CSS → 用户 HTML → 用户 JS；编辑模式 `pointer-events:none`，预览模式 `auto`；透明背景支持 |
| `materials/index.ts` | 导出 CustomHtmlMaterial |
| `SchemaRenderer.tsx` | 新增 `case 'customHtml'` 分支 |
| `scadaBridge.ts` | ScadaBridge SDK 源码（注入 iframe）：`onReady/readTag/writeTag/subscribe/query/assetUrl`，postMessage + requestId 匹配 |
| `bridgeManager.ts` | 父窗口消息路由 BridgeManager：Mock 变量池（8 个变量 ±2% 波动），attach/destroy/sendReady |

**前端 — ConfigPanel 扩展**
| 修改点 | 说明 |
|--------|------|
| PanelSection 类型 | 新增 `'html' \| 'css' \| 'js' \| 'assets'` |
| Segmented tabs | customHtml 显示 HTML/CSS/JS/属性/资产/变量 |
| 属性区 | 透明背景开关、sandbox 权限选择（含 allow-same-origin 安全警告） |
| 内联 Monaco 编辑器 | HTML（language=html）、CSS（language=css）、JS（language=javascript）各 360px |
| 资产管理 tab | 集成 AssetManager 组件，支持上传/列表/删除/URL 复制/库文件关联 |
| AI 上下文扩展 | customHtml 选中时自动注入 ScadaBridge API 文档 + 当前编辑面板代码 |
| useEffect 重置 | 切换组件时重置 panelSection（customHtml ↔ 非 customHtml） |

**前端 — 资产管理**
| 文件 | 说明 |
|------|------|
| `assetService.ts` | HTTP 封装：uploadAsset / listAssets / deleteAsset / getAssetFileUrl |
| `AssetManager.tsx` | 上传拖拽区 + 资产列表（图片缩略图 / 文件图标）+ 复制 URL + 删除 + JS/CSS 库关联切换 |

**后端 — 资产管理**
| 文件 | 说明 |
|------|------|
| `V3__add_sys_assets.sql` | Flyway 迁移：sys_assets 表（id/name/asset_type/mime_type/file_path/file_size/page_id/scope/created_by/created_at/deleted） |
| `SysAsset.java` | MyBatis-Plus 实体 |
| `SysAssetMapper.java` | extends BaseMapper<SysAsset> |
| `AssetService.java` | 上传（扩展名白名单 + 20MB 限制 + 年月/UUID 路径）、下载 Resource、列表、逻辑删除 |
| `AssetController.java` | POST /upload、GET /{id}/file（长缓存）、GET /（列表）、DELETE /{id} |
| `ErrorCode.java` 新增 | ASSET_NOT_FOUND(5001)、ASSET_TYPE_DENIED(5002)、ASSET_TOO_LARGE(5003)、ASSET_STORAGE_ERROR(5004) |
| `SecurityConfig.java` 修改 | `/assets/*/file` 设为 permitAll（iframe 需公开访问） |
| `application.yml` 修改 | `scada.storage.path` 配置 + multipart 限制（20MB/50MB） |

### 编辑器 UX 强化（2026-04-14 新完成）

| 改动 | 文件 | 说明 |
|------|------|------|
| global.css Primer 重写 | `styles/global.css` | 42 处违规全部清除（blur/gradient/大圆角/conic）；彩虹选中框保留；`.editor-workspace` 改为 flex 布局 |
| 编辑器画布节点去 Card 化 | `CanvasArea.tsx` | `<Card>` → `<div>`，移除 40px 标题栏；编辑态与预览态渲染一致 |
| 左右面板折叠/展开 | `EditorPage.tsx` + `MaterialPalette.tsx` + `ConfigPanel.tsx` | 面板内"←/→"按钮收起；收起后变为 `position:fixed` 浮动小按钮（32×32 深色圆角）；按钮支持鼠标拖动重定位；点击（非拖动）展开面板 |
| 画布自动填满 | `global.css` + `EditorPage.tsx` | 用条件渲染代替 `display:none`，flex 容器自动回收空间；两侧收起后画布铺满全部剩余宽度 |
| 预览新窗口 | `EditorPage.tsx` | `window.open('/preview/:id', '_blank')` 替代 `navigate()`；预览关闭按钮调用 `window.close()` |
| 预览尺寸控制 | `PreviewPage.tsx` | 顶部添加分辨率预设下拉（FHD/QHD/4K 等 6 项）+ W/H 数字输入框；初始值读自页面 `canvasWidth/canvasHeight`；通过 `displayPage` memo 覆盖传给 SchemaRenderer |
| customHtml 配置面板精简 | `ConfigPanel.tsx` | 移除右侧面板 HTML/CSS/JS 三个 tab；编辑代码统一走双击弹出的浮动工作台；仅保留属性/资产/变量三个 tab |
| InputMaterial borderRadius | `InputMaterial.tsx` | 读取 `node.props.borderRadius`，传给 `<Input style>` 覆盖 AntD 默认 6px |
| schema 默认 borderRadius | `pageSchema.ts` + `SchemaRenderer.tsx` + `ContainerMaterial.tsx` | 所有组件默认圆角从 16/24 统一改为 6 |

### 前端实时组件 Demo（2026-04-17 新完成）

| 改动 | 文件 | 说明 |
|------|------|------|
| 物料精简 | `pageSchema.ts` + `MaterialPalette.tsx` | 用户可见物料保留 HTML、文本、按钮、ECharts、表格、图片；container 设为内部兼容不可见；input 下架 |
| 图片组件 | `ImageMaterial.tsx` + `imageProtocol.ts` | 新增图片物料，支持 `src` / `assetId` / `objectFit` |
| 实时服务 | `realtimeService.ts` | 新增统一实时数据服务，当前使用 Mock 数据；接口预留 `subscribeTag/readTag/writeTag`，后续对接 WebSocket 和 command_ack |
| 文本增强 | `TextMaterial.tsx` + `textProtocol.ts` | 支持 `binding` 实时变量显示，支持 `writeBack` 点击弹窗输入并回写 |
| 按钮增强 | `ButtonMaterial.tsx` + `buttonProtocol.ts` | 支持 `writeBack` 控制指令下发、二次确认和成功/失败提示 |
| HTML 桥接增强 | `scadaBridge.ts` + `bridgeManager.ts` + `customHtmlProtocol.ts` | ScadaBridge 增加 `bindText` / `bindWriteDialog`；BridgeManager 改为复用统一实时服务 |
| Demo 页面 | `mock/pages.ts` + `pageService.ts` | 本地 demo 重置为目标组件集合测试页，localStorage 版本升级为 `scada-layout-v3-realtime-demo` |
| AI 提示词与代码防护 | `AiDevChatService.java` + `ConfigPanel.tsx` | 后端提示词同步精简后组件集合，明确 ScadaBridge API 合同；后端兜底将裸 JS 包装为 fenced code block；前端识别裸 JS 并在 Diff 中提示 readTag 返回对象、bindText 重复绑定、未 onReady 等风险 |
| HTML 代码编辑器保存流 | `ConfigPanel.tsx` | customHtml 默认打开完整 HTML 文档；提供“分开显示/完整HTML”切换；HTML/CSS/JS 共用完整 HTML 草稿源；保存按钮显式写回 schema；关闭未保存窗口时弹窗确认保存或丢弃 |
| HTML 预览 ready 修复 | `CustomHtmlMaterial.tsx` | iframe load 后 BridgeManager attach 完立即补发 `scada-bridge-ready`，避免 SDK 的 loaded 消息早于父窗口监听导致 `ScadaBridge.onReady` 永不执行 |
| 页面局部变量运行时 | `runtime/pageRuntime.tsx` + `PreviewPage.tsx` | 落地 RuntimeVariable 富结构：value/previousValue/双时间戳/quality/change/alarm/write/display/各类 Extra；脚本直接注入 `vars` / `components` / `message` / `change` / `page` / `node` 全局对象；变量变更按队列触发页面 `onVariableChange` |
| 页面变量组件接入 | `TextMaterial.tsx` + `ButtonMaterial.tsx` + `ChartMaterial.tsx` + `scadaBridge.ts` + `bridgeManager.ts` | 文本/按钮支持 `source: "page"` 读写页面变量；文本和图表注册组件方法；HTML 增加 `readVar/writeVar/subscribeVar/bindVarText/bindVarWriteDialog/callComponent` |
| 页面变量演示页 | `mock/pages.ts` + `pageService.ts` | 新增“页面变量运行时演示”页面，覆盖 number/boolean/string/json 页面变量、文本绑定、按钮写变量、onVariableChange 调组件方法、HTML 读写页面变量 |
| AI 变量上下文 | `ConfigPanel.tsx` + `AiDevChatService.java` + 协议层 | 每次代码 AI 请求自动注入页面变量运行时规则、当前 page/component 变量清单、`vars` / `components` / `message` / `change` / `ScadaBridge.*Var` 调用约束 |
| 变量绑定配置面板 | `ConfigPanel.tsx` | 文本实时绑定、文本回写、按钮回写增加“页面变量 / 系统点位”来源切换；页面变量来源可直接从当前页面变量列表下拉选择 |
| 用户注释版演示页 | `mock/pages.ts` + `pageService.ts` | “页面变量运行时演示”增加可见注释文本，标明文本绑定、按钮写变量、onVariableChange 图表联动和 HTML ScadaBridge 页面变量桥接；localStorage 版本升级为 `scada-layout-v6-variable-config-demo` |
| 页面中文变量名支持 | `ConfigPanel.tsx` + `mock/pages.ts` + 协议层 + `AiDevChatService.java` | 页面变量名允许中文；配置下拉使用作用域 key 防止 `page.page.*`；AI 规则明确必须用 `vars.getValue("page.温度")` / `ScadaBridge.*Var(..., "page.温度")` 字符串 API；演示页改为 `page.温度`、`page.页面模式`、`page.循环泵运行`、`page.报警等级`；localStorage 版本升级为 `scada-layout-v7-chinese-variable-demo` |
| 页面变量演示页完善 | `mock/pages.ts` + `TableMaterial.tsx` + `ImageMaterial.tsx` + 协议层 | 按钮 demo 区分配置式 writeBack 与脚本式 onClick：writeBack 先写变量，onClick 可做后置日志；新增操作日志、操作次数、脚本复位、批次推进、高温触发；表格注册 `setDataSource/appendRow`，图片注册 `setSrc/setBackground`，onVariableChange 同步刷新文本、表格、图表和图片；HTML 卡片增加 `readVar/writeVar/callComponent` 示例；localStorage 版本升级为 `scada-layout-v8-runtime-page-complete-demo` |
| AI 代码编辑防空 JSON | `AiDevChatService.java` + `ConfigPanel.tsx` + `mock/pages.ts` + `pageService.ts` | 修复代码辅助返回 JS 时后端从 `|| {}` 误提取空 JSON 的问题；代码任务不再盲目 `extractJson`，裸 JS 会包装成 `javascript` 代码块；脚本编辑页若收到 `json` 代码块会被前端拦截，避免 `{}` 覆盖 onClick.js；AI 请求上下文增加“代码编辑/属性 JSON 编辑”强制输出格式；演示页“批次 +10”改为“批次 +20”；LLM 连接阶段超时自动重试一次；localStorage 版本升级为 `scada-layout-v9-ai-code-guard-demo` |
| AG Grid 表格底座 | `TableMaterial.tsx` + `tableProtocol.ts` + `pageSchema.ts` + `mock/pages.ts` + `pageService.ts` | 表格物料从 AntD Table 迁移到 AG Grid Community；新协议优先使用 `columnDefs/rowData`，兼容旧 `columns/dataSource`；内置 `text/tag/button/input/switch/progress` 单元格类型、分页、隔行样式、运行态 `setRows/updateRow/deleteRow/setColumnDefs/refresh/setPage` 方法；localStorage 版本升级为 `scada-layout-v10-ag-grid-table-demo` |
| 页面变量演示页增强 | `mock/pages.ts` + `pageService.ts` | “页面变量运行时演示”重构为更明显的联动页：新增实时数据表、组件状态表、最近事件表；页面 onVariableChange 同步刷新文本、图片、图表和三张表；温度文本增加点击写入；HTML 卡片增加日志显示与 `callComponent` 同步状态；localStorage 版本升级为 `scada-layout-v11-runtime-demo-enhanced` |
| 排版助手动作兼容修复 | `aiService.ts` + `AiLayoutAssistant.tsx` + `EditorPage.tsx` + `mock/pages.ts` + `pageService.ts` | 排版助手支持从 `reply` 文本里兜底提取 `reply/actions` JSON；当 AI 错把已有组件返回为 `add_node` 时，前端会按标题匹配现有节点并转为位置/尺寸更新，避免重复加组件；编辑页进入时不再默认打开排版助手；“页面变量运行时演示”改为 1920×1080 仪表盘布局；localStorage 版本升级为 `scada-layout-v12-runtime-dashboard-layout` |
| 编排落地与前端警告修复 | `CanvasArea.tsx` + `AiLayoutAssistant.tsx` + `EditorPage.tsx` + `index.html` | 修复编辑器画布 `background` / `backgroundSize` 混用警告，改为 `backgroundColor + backgroundImage`；AI 编排动作应用后自动保存页面，减少“回复成功但页面状态没持久化”的情况；补充内联 favicon，消除常见 `404 favicon.ico` 噪音。 |
| 排版助手前端调试日志 | `aiService.ts` + `AiLayoutAssistant.tsx` + `EditorPage.tsx` | 为整页排版链路补充前端控制台日志：发送给 AI 的消息与节点摘要、收到的 `reply/actions`、每个动作的命中结果与应用结果、自动保存后的页面摘要，便于验证 AI 是否具备整页重排能力。 |
| 排版助手后端协议收紧 | `AiDevChatService.java` | 将布局任务提示词收紧为“一次性返回最终 actions”，明确禁止确认式话术、半截 action 和脏分隔符；后端 `parseResponse` 在标准 JSON 解析失败后会尝试恢复非标准响应中的 `update_page/update_node/select_node`，优先在后端把整页重排动作救回再返回前端。 |
| 代码 AI 去布局污染 | `AiDevChatService.java` + `ConfigPanel.tsx` | 保持现有代码生成链路不变，只调整提示词：后端根据任务类型为代码 AI 使用独立 code prompt，移除布局动作协议、组件类型清单和整页组件列表；前端代码 AI 调用不再传整页 `nodes` 摘要，避免页面排版上下文污染代码窗口。 |
| 代码 AI 最小改动约束 | `AiDevChatService.java` | 为代码 AI 增加“默认最小必要改动、未提及逻辑必须保留、禁止顺手删除日志/状态同步/变量回写等副作用代码、不得擅自改 reason/source/message”等硬约束，降低完整文件替换时误删原逻辑的概率。 |
| 排版助手坏 JSON 恢复 | `aiService.ts` + `AiDevChatService.java` | 前端新增对非标准布局回复的恢复器：即使 `reply` 中的顶层 JSON 非法，也会尽量从碎片中恢复 `update_page/update_node/select_node` 动作；可恢复类似 `{"type":"update_node",...},"update_node","nodeId","patch":{...}` 的半截输出。后端提示词同步收紧：布局任务禁止输出“请确认是否执行”等确认语句，actions 必须是完整 JSON 对象。 |
| 原生脚本 API | `scriptSandbox.ts` + `PreviewPage.tsx` + `ConfigPanel.tsx` + `mock/pages.ts` + 协议层 + `AiDevChatService.java` | 页面/组件脚本不再注入 `Ctx`，统一改为原生风格全局对象 `vars` / `components` / `message` / `change` / `page` / `node`；`vars.set/patch` 默认自动补脚本来源；Monaco 补充脚本全局声明；所有 demo 脚本同步改写；localStorage 版本升级为 `scada-layout-v13-native-script-api` |
| 展示页脚本注释 | `mock/pages.ts` + `pageService.ts` | 为展示页中所有可加注释的页面脚本、按钮脚本及 customHtml 的 HTML/CSS/JS 补充中文注释，帮助用户直接在编辑器里理解每段示例代码；localStorage 版本升级为 `scada-layout-v14-demo-commented` |
| 页面变量弹窗编辑器 + 变量专属脚本 | `ConfigPanel.tsx` + `PreviewPage.tsx` + `pageSchema.ts` + `mock/pages.ts` + `pageCanvasProtocol.ts` + `pageService.ts` | 页面变量区改为摘要卡片，编辑/新建统一走弹窗式变量编辑器；弹窗左侧显示变量列表与 AI 变量助手，右侧编辑基础字段和变量专属 `scripts.onChange`；预览运行时先执行变量专属脚本，再执行页面 `onVariableChange`；Monaco 关闭脚本语法级误报，避免页面总线脚本里的函数体写法飘红；运行时演示页将温度/泵/模式/报警/批次逻辑拆到变量专属脚本中，页面总线脚本只保留全局汇总和组件分发；localStorage 版本升级为 `scada-layout-v15-variable-script-modal` |
| 变量列表紧凑化 + 脚本/AI 独立弹窗 | `ConfigPanel.tsx` | 页面变量摘要列表改为单行展示，避免单个变量卡片过高；变量主弹窗中不再内嵌脚本编辑器和 AI 输入区，变量脚本改为独立 Monaco 弹窗，变量 AI 改为独立对话弹窗，交互形态向组件编辑器工作区靠拢。 |
| 变量 AI 同风格化 + 变量脚本页补 AI | `ConfigPanel.tsx` | 变量 AI 总弹窗改为与现有代码 AI 一致的暗色对话工作台样式；变量脚本编辑器改为“左代码 / 右 AI”布局，支持在脚本页直接提问、生成完整 onChange.js、进入 Diff 对比并接受修改。 |
| 变量 AI 增量合并 + 拒绝闲聊 | `ConfigPanel.tsx` | 页面变量 AI 默认按增量合并应用结果，只有明确要求“替换全部/只保留/清空后重建”才整表覆盖；selectedVariableName 支持 id/name/scoped key；变量 AI 不再处理闲聊或查询式输入，未命中编辑意图时直接拒绝并要求用户使用新增/修改/删除/重命名等明确编辑命令。 |

### 后端脚手架（2026-04-08 新完成）

| 文件/目录 | 说明 |
|-----------|------|
| `backend/pom.xml` | Maven POM，Spring Boot 3.4.4 + Java 21，含全部依赖 |
| `backend/src/main/java/com/scada/ScadaApplication.java` | 主启动类，@MapperScan + @EnableScheduling |
| `backend/src/main/resources/application.yml` | 基础配置（虚拟线程、数据源、Flyway、JWT、MQTT、AI） |
| `backend/src/main/resources/application-dev.yml` | 开发环境覆盖（localhost PG、SQL 日志） |
| `backend/src/main/resources/db/migration/V1__init_schema.sql` | Flyway 初始化脚本，建立全部 14 张系统表 + 初始数据 |
| `com.scada.common.result.R` | 统一 REST 响应包装 |
| `com.scada.common.result.PageResult` | 分页结果包装（对接 MP IPage） |
| `com.scada.common.exception.BizException` | 业务异常 |
| `com.scada.common.exception.ErrorCode` | 错误码枚举（通用 + 用户 + 页面 + 网关/变量 + AI） |
| `com.scada.common.exception.GlobalExceptionHandler` | 全局异常处理器（BizException / 校验异常 / 401 / 403 / 500） |
| `com.scada.config.MybatisPlusConfig` | 分页插件（PostgreSQL）+ 自动填充（createdAt / updatedAt） |
| `com.scada.config.SecurityConfig` | Spring Security：JWT 无状态、CORS、@PreAuthorize 开启 |
| `com.scada.security.JwtUtils` | JWT 生成与解析（配置路径 `scada.jwt.secret`） |
| `com.scada.security.JwtAuthenticationFilter` | JWT 认证过滤器，注入 SecurityContext |
| `com.scada.security.ScadaUserDetails` | 安全上下文用户信息（userId + username + roles） |
| `com.scada.domain.entity.SysUser` | 用户实体 |
| `com.scada.domain.entity.SysPage` | 页面实体（JSONB schema_json + 乐观锁 @Version） |
| `com.scada.domain.entity.SysGateway` | 网关实体（protocol_type / push_mode / parse_config） |
| `com.scada.domain.entity.SysVariable` | 变量点位实体 |
| `com.scada.domain.entity.SysPageLock` | 页面编辑锁（page_id 为主键） |
| `com.scada.domain.entity.SysAiProvider` | AI 服务商（api_key AES-256-GCM 加密） |
| `com.scada.mapper.Sys*Mapper` | 5 个 Mapper 接口（extends BaseMapper） |
| `com.scada.controller.AuthController` | 登录接口 POST /api/auth/login → JWT Token |

## AI 工程化状态

| 文件 | 状态 |
|------|------|
| `AGENTS.md` | ✅ 已创建 |
| `MEMORY.md` | ✅ 已创建 |
| `.ai/instructions/coding-style.md` | ✅ 已创建 |
| `.ai/instructions/frontend-react.md` | ✅ 已创建 |
| `.ai/instructions/schema-protocol.md` | ✅ 已创建 |
| `.ai/instructions/ai-workflow.md` | ✅ 已创建 |
| `.ai/skills/add-material/SKILL.md` | ✅ 已创建 |
| `.ai/agents/code-reviewer.agent.md` | ✅ 已创建 |
| `.ai/prompts/new-material.prompt.md` | ✅ 已创建 |
| `.ai/prompts/add-event-handler.prompt.md` | ✅ 已创建 |

## 关键技术记录

- **vite.config.js**（优先级高于 .ts）配置了 `/api` → `http://localhost:8080` 代理
- **GLM-4-flash** baseUrl: `https://open.bigmodel.cn/api/paas/v4`，不加 /v1 前缀
- **AiDevChatService.java** 的 parseResponse 兼容3种GLM输出格式
- **JWT 配置路径**：`scada.jwt.secret`（application.yml），生产必须通过环境变量 `JWT_SECRET` 注入
- **AI Key 加密**：AES-256-GCM，加密密钥从环境变量 `AI_ENCRYPTION_KEY` 注入
- **MyBatis-Plus** 逻辑删除字段：`deleted`（0=正常，1=已删），auto-fill: `createdAt` / `updatedAt`
- **Flyway** 迁移文件路径：`classpath:db/migration`，命名规则 `V{n}__{desc}.sql`
- **初始账户**：用户名 `admin`，密码 `admin123`（BCrypt），首次启动后立即修改

## 后续建议（后端）

1. **下一步**：实现用户角色查询 + AuthController 补全（现在 roles 写死 `List.of()`）
2. 实现 `SysPageService`：页面 CRUD + 乐观锁保护 + 编辑锁申请/续期/释放
3. 实现 MQTT 接收层：`MqttReceiver` + 分区队列 + `GatewayParser` 策略注册
4. 实现变量处理引擎：采集点→计算点→告警判断→存储
5. 实现 `WriteDispatcher` 统一回写模块
6. 实现 `AiGatewayService`：Semaphore 并发控制 + SSE 流式代理

## 后续建议（前端）

- 给每个物料补独立属性编辑器文件，与渲染文件、协议文件形成三位一体
- 基于 Monaco DiffEditor 实现按差异块采纳（非全量/选区追加）
- BridgeManager 接入真实 WebSocket 实时变量推送（当前为 Mock 数据）
- 预览页"关闭预览"调用 window.close()，若从非新窗口路由进入会无效，可降级回退到跳转编辑器
- 考虑将两层 AI 助手（AiLayoutAssistant + ConfigPanel AI）合并为统一对话框
- 配置 ESLint + Prettier 统一代码风格 <!-- 待确认 -->
