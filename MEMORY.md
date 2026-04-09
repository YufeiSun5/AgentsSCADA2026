# 开发进度追踪

> 最后更新：2026-04-08（后端脚手架完成）

## 当前阶段

**后端项目脚手架完成** — Maven 项目已完整搭建，数据库迁移脚本、安全层、Mapper 层骨架均已就绪，可直接连接 PostgreSQL 启动。

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
- 配置 ESLint + Prettier 统一代码风格 <!-- 待确认 -->
