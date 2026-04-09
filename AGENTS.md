# Project Guidelines

## 项目定位

工业低代码通用底座中的 **可视化页面编辑器模块**（SCADA 式）。允许开发/实施人员通过拖拽标准组件、配置属性、编写自定义脚本，快速构建并发布工业页面。

## 技术栈

- **前端框架**：React 18 + React Router v6
- **工程化**：Vite 6 + TypeScript（strict）
- **UI 组件**：Ant Design 5
- **拖拽引擎**：dnd-kit
- **状态管理**：Zustand + Immer
- **代码编辑器**：Monaco Editor + Monaco DiffEditor
- **图表**：ECharts + echarts-for-react
- **接口层**：Axios

**后端**
- **运行时**：Java 21（虚拟线程）+ Spring Boot 3.4.x
- **数据库**：PostgreSQL（系统表 + 时序分区表，全部 JSONB 存储复杂结构）
- **ORM**：MyBatis-Plus 3.5.x（Lambda 查询、自动填充、逻辑删除）
- **数据库迁移**：Flyway（`V{n}__{desc}.sql`）
- **安全**：Spring Security + JWT（jjwt 0.12.x），无状态
- **MQTT**：Eclipse Paho 1.2.5
- **表达式引擎**：Aviator（告警条件 / 计算点规则）
- **脚本沙箱**：GraalVM Polyglot（用户自定义 JS）
- **AI 代理**：OpenAI 兼容格式，后端 SSE 流式转发，Semaphore 并发控制
- **构建**：Maven，基础包 `com.scada`

## 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 页面管理 | `frontend/src/pages/management/` | 页面列表 CRUD、状态管理 |
| 编辑器核心 | `frontend/src/pages/editor/` + `components/editor/` | 画布、物料面板、配置面板、工具栏 |
| 物料体系 | `frontend/src/components/materials/` | 6 种物料组件（container/text/button/input/table/chart） |
| 协议层 | `frontend/src/schema/protocols/` | 页面协议 + 6 种组件协议 + AI 提示 |
| 状态管理 | `frontend/src/stores/editorStore.ts` | Zustand + Immer，管理 schema/选中/历史/拖拽 |
| 预览渲染 | `frontend/src/pages/preview/` + `components/renderer/` | Schema 递归渲染 + 脚本沙箱执行 |

**后端核心模块**

| 包 | 路径 | 职责 |
|----|------|------|
| 公共层 | `com.scada.common` | `R<T>` 统一响应、`PageResult`、`BizException`、`ErrorCode`、全局异常处理 |
| 安全层 | `com.scada.security` | JWT 生成/解析、认证过滤器、SecurityContext 用户信息 |
| 配置层 | `com.scada.config` | MP 分页 + 自动填充、Spring Security、CORS |
| 实体层 | `com.scada.domain.entity` | 对应 sys_* 系统表（Lombok + MP 注解） |
| Mapper 层 | `com.scada.mapper` | 继承 BaseMapper，复杂 SQL 用 @Select 注解或 XML |
| 控制器层 | `com.scada.controller` | REST 接口，路径前缀 `/api`（context-path） |
| MQTT 层 | `com.scada.mqtt` | MQTT 接收、分区队列、gatewaySnapshot 增量推送状态 |
| 协议适配 | `com.scada.protocol` | GatewayParser / GatewayEncoder 策略模式，支持 6 种报文格式 |
| 变量引擎 | `com.scada.engine` | 变量处理管道：解析→计算→告警→存储 |
| 回写模块 | `com.scada.write` | WriteDispatcher 统一回写（WebSocket / 脚本 / 任务均走此处） |
| 脚本沙箱 | `com.scada.script` | GraalVM JS 沙箱，注入 writeTag / readTag 函数 |
| AI 网关 | `com.scada.ai` | AiGatewayService，多 Key 轮询 + Semaphore 并发 + SSE 流式代理 |

## 路由结构

| 路径 | 页面 |
|------|------|
| `/` | 页面资产管理页 |
| `/editor/:pageId` | 可视化编辑核心页 |
| `/preview/:pageId` | 独立预览与运行页 |

## 核心约定

1. **一个物料一个文件**，目录：`frontend/src/components/materials/`
2. **协议模块化维护**，页面协议与组件协议分离，位于 `frontend/src/schema/protocols/`
3. **新增组件三位一体**：渲染文件 + 协议文件 + 注册到 materialCatalog，三者同步创建
4. **脚本编辑器统一使用 Monaco Editor**，禁止引入职责重叠的第二套代码对比组件
5. **AI 可读说明挂在协议层**（`aiHints` 字段），不散落在 README 或注释中重复维护
6. **后端每张系统表对应一个 Entity + 一个 Mapper**，Service / Controller 按业务域聚合（不要一表一 Controller）
7. **数据库变更必须通过 Flyway**，禁止直接修改 `V1__init_schema.sql`，新建 `V2__...sql`
8. **API Key 明文禁止落库**，统一经 `AiKeyEncryptor`（AES-256-GCM）加密后存 `sys_ai_providers.api_key`

---

## 必读文件

开始任何开发任务前，按以下顺序阅读：

| 优先级 | 文件 | 内容 |
|--------|------|------|
| 1 | `MEMORY.md` | 当前开发阶段、已完成事项、后续计划 |
| 2 | `.ai/instructions/coding-style.md` | 编码风格规范（缩进、大括号、命名、函数、注释） |
| 3 | `.ai/instructions/frontend-react.md` | React 组件与状态管理约定 |
| 4 | `.ai/instructions/schema-protocol.md` | JSON Schema 与协议层规范 |
| 5 | `.ai/docs/后端文档.md` | 后端完整技术设计（系统表、模块架构、协议适配、AI 中心等）|

## 按需资源

| 目录 | 用途 | 何时使用 |
|------|------|----------|
| `.ai/docs/` | 功能设计与架构文档 | 需要了解系统架构或模块设计时 |
| `.ai/skills/add-material/` | 新增物料组件技能 | 新建物料组件时 |
| `.ai/agents/code-reviewer.agent.md` | 只读代码审查 Agent | 提交前代码审查时 |
| `.ai/prompts/new-material.prompt.md` | 新建物料 Prompt | 快速启动新建物料流程时 |
| `.ai/prompts/add-event-handler.prompt.md` | 添加事件处理 Prompt | 为组件增加事件处理时 |
| `backend/src/main/resources/db/migration/` | Flyway 迁移脚本 | 新增/修改系统表结构时 |

## 强制工作流

1. **开始前**：读 `MEMORY.md` 了解当前进度，读相关 instructions 了解规范
2. **完成后**：更新 `MEMORY.md` 中的已完成事项和当前阶段
3. **不确定时**：标注 `<!-- 待确认 -->`，不伪装成确定结论

## 语言要求

- **代码注释**：强制中文
- **Commit 消息**：中文
- **文档**：中文
- **变量/函数名**：英文（snake_case 或遵循框架惯例）
