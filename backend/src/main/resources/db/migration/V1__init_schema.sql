-- Flyway 初始化脚本 V1
-- 执行一次，建立所有系统表
-- Flyway 会自动记录版本，后续修改请新建 V2__xxx.sql

-- ==================== 用户与权限 ====================

CREATE TABLE IF NOT EXISTS sys_users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(64)  NOT NULL UNIQUE,
    password    VARCHAR(256) NOT NULL,                    -- BCrypt 哈希
    display_name VARCHAR(128),
    email       VARCHAR(128),
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted     SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sys_roles (
    id          BIGSERIAL PRIMARY KEY,
    role_key    VARCHAR(64)  NOT NULL UNIQUE,              -- admin / designer / operator / viewer
    role_name   VARCHAR(128) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sys_user_roles (
    user_id     BIGINT NOT NULL REFERENCES sys_users(id) ON DELETE CASCADE,
    role_id     BIGINT NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- RBAC：旧有点位/变量读写权限
CREATE TABLE IF NOT EXISTS sys_permissions (
    id          BIGSERIAL PRIMARY KEY,
    role_id     BIGINT       NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
    resource    VARCHAR(64)  NOT NULL,                    -- 资源类型：variable / gateway / page
    resource_id BIGINT,                                   -- 具体资源 ID，NULL 表示全部
    action      VARCHAR(16)  NOT NULL,                    -- read / write / manage
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ==================== 网关 ====================

CREATE TABLE IF NOT EXISTS sys_gateway (
    id                 BIGSERIAL PRIMARY KEY,
    gateway_key        VARCHAR(64)  NOT NULL UNIQUE,       -- 唯一标识，用于 MQTT topic 匹配
    name               VARCHAR(128) NOT NULL,
    description        TEXT,
    protocol_type      VARCHAR(32)  NOT NULL DEFAULT 'flat_json',
    push_mode          VARCHAR(16)  NOT NULL DEFAULT 'full', -- full / incremental / delta_only
    topic_pattern      VARCHAR(256),
    cmd_topic_pattern  VARCHAR(256),
    parse_config       JSONB,                              -- 上行解析配置
    write_config       JSONB,                              -- 下行回写配置
    online             BOOLEAN      NOT NULL DEFAULT FALSE,
    last_seen_at       TIMESTAMPTZ,
    deleted            SMALLINT     NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ==================== 变量点位 ====================

CREATE TABLE IF NOT EXISTS sys_variables (
    id              BIGSERIAL PRIMARY KEY,
    gateway_id      BIGINT       NOT NULL REFERENCES sys_gateway(id),
    var_tag         VARCHAR(128) NOT NULL,                -- 变量唯一 tag（全局唯一）
    name            VARCHAR(128) NOT NULL,
    data_type       VARCHAR(16)  NOT NULL DEFAULT 'float', -- float / int / bool / string
    source_type     SMALLINT     NOT NULL DEFAULT 0,       -- 0=采集点 1=计算点
    json_path       VARCHAR(256),                         -- 从报文中提取原始值的路径
    rw_mode         VARCHAR(4)   NOT NULL DEFAULT 'R',     -- R / W / RW
    scale_factor    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    offset_val      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    calc_rule       TEXT,                                 -- 计算点表达式（Aviator）
    store_mode      SMALLINT     NOT NULL DEFAULT 1,       -- 0不存 1变化 2定时 3混合
    store_deadband  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    store_cycle     INT          NOT NULL DEFAULT 60,      -- 定时存储间隔（秒）
    store_on_startup SMALLINT    NOT NULL DEFAULT 0,
    alarm_enable    SMALLINT     NOT NULL DEFAULT 0,
    limit_hh        DOUBLE PRECISION,
    limit_h         DOUBLE PRECISION,
    limit_l         DOUBLE PRECISION,
    limit_ll        DOUBLE PRECISION,
    alarm_deadband  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    unit            VARCHAR(32),
    description     TEXT,
    deleted         SMALLINT     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (gateway_id, var_tag)
);

CREATE INDEX idx_variables_tag ON sys_variables(var_tag) WHERE deleted = 0;

-- ==================== 任务调度 ====================

CREATE TABLE IF NOT EXISTS sys_tasks (
    id               BIGSERIAL PRIMARY KEY,
    name             VARCHAR(128) NOT NULL,
    task_type        SMALLINT     NOT NULL,                -- 1定时 2数据改变 3条件事件
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    -- 定时任务
    cron_expr        VARCHAR(64),
    interval_sec     INT,
    -- 数据改变任务
    trigger_var_id   BIGINT       REFERENCES sys_variables(id),
    change_type      VARCHAR(16),                         -- ANY/INCREASE/DECREASE/THRESHOLD/FALSE_TO_TRUE/TRUE_TO_FALSE
    change_threshold DOUBLE PRECISION,
    -- 条件事件任务
    condition_expr   TEXT,                               -- Aviator 表达式
    -- 执行动作
    action_type      SMALLINT     NOT NULL,               -- 1=HTTP 2=设备回写 3=DB 4=脚本 5=日志 6=MQTT发布
    action_config    JSONB,
    require_auth     BOOLEAN      NOT NULL DEFAULT FALSE, -- 脚本回写是否校验权限
    last_run_time    TIMESTAMPTZ,
    last_run_status  VARCHAR(16),
    deleted          SMALLINT     NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ==================== 报警记录 ====================

CREATE TABLE IF NOT EXISTS sys_alarm_records (
    id              BIGSERIAL PRIMARY KEY,
    var_id          BIGINT       NOT NULL REFERENCES sys_variables(id),
    var_tag         VARCHAR(128) NOT NULL,
    alarm_level     VARCHAR(4)   NOT NULL,                -- HH / H / L / LL
    alarm_value     DOUBLE PRECISION,
    alarm_at        TIMESTAMPTZ  NOT NULL,
    ack_at          TIMESTAMPTZ,
    ack_by          BIGINT,
    recovered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_alarm_var ON sys_alarm_records(var_id, alarm_at DESC);
CREATE INDEX idx_alarm_time ON sys_alarm_records(alarm_at DESC);

-- ==================== 时序数据（分区表）====================

CREATE TABLE IF NOT EXISTS sys_ts_data (
    var_id      BIGINT           NOT NULL,
    var_tag     VARCHAR(128)     NOT NULL,
    ts          TIMESTAMPTZ      NOT NULL,
    value       DOUBLE PRECISION,
    value_str   TEXT,                                     -- string 类型变量
    quality     SMALLINT         NOT NULL DEFAULT 192     -- OPC 质量码
) PARTITION BY RANGE (ts);

-- 按月分区：历史数据量大时 ATTACH/DETACH 分区非常方便
-- Flyway 只建父表，分区由应用启动时按需创建（或 pg_partman 扩展自动管理）
CREATE INDEX idx_ts_var_time ON sys_ts_data(var_id, ts DESC);

-- ==================== 页面管理 ====================

CREATE TABLE IF NOT EXISTS sys_pages (
    id          BIGSERIAL PRIMARY KEY,
    page_key    VARCHAR(64)  UNIQUE,
    name        VARCHAR(128) NOT NULL,
    description TEXT,
    status      VARCHAR(16)  NOT NULL DEFAULT 'draft',    -- draft / enabled / disabled
    schema_json JSONB        NOT NULL DEFAULT '{}',
    thumbnail   TEXT,
    version     INT          NOT NULL DEFAULT 1,          -- 乐观锁版本号
    created_by  BIGINT,
    updated_by  BIGINT,
    deleted     SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_pages_status  ON sys_pages(status)        WHERE deleted = 0;
CREATE INDEX idx_pages_updated ON sys_pages(updated_at DESC) WHERE deleted = 0;
CREATE INDEX idx_pages_schema_gin ON sys_pages USING GIN(schema_json jsonb_path_ops);

-- ==================== 页面权限 ====================

CREATE TABLE IF NOT EXISTS sys_role_pages (
    role_id      BIGINT      NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
    page_id      BIGINT      NOT NULL REFERENCES sys_pages(id) ON DELETE CASCADE,
    access_level VARCHAR(16) NOT NULL DEFAULT 'view',     -- view / edit
    PRIMARY KEY (role_id, page_id)
);

-- ==================== 页面编辑锁 ====================

CREATE TABLE IF NOT EXISTS sys_page_locks (
    page_id         BIGINT       PRIMARY KEY REFERENCES sys_pages(id) ON DELETE CASCADE,
    locked_by       BIGINT       NOT NULL REFERENCES sys_users(id),
    locked_by_name  VARCHAR(64)  NOT NULL,
    locked_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_page_locks_expires ON sys_page_locks(expires_at);

-- ==================== AI 服务配置 ====================

CREATE TABLE IF NOT EXISTS sys_ai_providers (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(64)  NOT NULL,
    provider_key        VARCHAR(64)  NOT NULL UNIQUE,
    base_url            VARCHAR(512) NOT NULL,
    api_key             VARCHAR(512) NOT NULL,             -- AES-256-GCM 加密存储
    model               VARCHAR(128) NOT NULL,
    max_concurrent      INT          NOT NULL DEFAULT 5,
    max_tokens_per_req  INT          NOT NULL DEFAULT 4096,
    enabled             BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          INT          NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ==================== AI 调用日志 ====================

CREATE TABLE IF NOT EXISTS sys_ai_usage_log (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       NOT NULL,
    provider_id         BIGINT       NOT NULL REFERENCES sys_ai_providers(id),
    model               VARCHAR(128),
    prompt_tokens       INT,
    completion_tokens   INT,
    total_tokens        INT,
    duration_ms         INT,
    status              VARCHAR(16)  NOT NULL,             -- success / error / timeout
    error_msg           TEXT,
    scene               VARCHAR(32),                      -- code_gen / layout_suggest / script_assist
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_log_user     ON sys_ai_usage_log(user_id,     created_at DESC);
CREATE INDEX idx_ai_log_provider ON sys_ai_usage_log(provider_id, created_at DESC);

-- ==================== 初始数据 ====================

-- 内置角色
INSERT INTO sys_roles (role_key, role_name, description) VALUES
    ('admin',    '系统管理员', '拥有所有权限'),
    ('designer', '页面设计师', '可编辑被分配的页面'),
    ('operator', '操作员',    '可预览页面并下发控制指令'),
    ('viewer',   '只读用户',  '仅可查看页面')
ON CONFLICT (role_key) DO NOTHING;

-- 默认管理员账户（密码 admin123，BCrypt 哈希，首次登录后请立即修改）
INSERT INTO sys_users (username, password, display_name) VALUES
    ('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Bm9G', '系统管理员')
ON CONFLICT (username) DO NOTHING;

-- 为管理员绑定 admin 角色
INSERT INTO sys_user_roles (user_id, role_id)
    SELECT u.id, r.id FROM sys_users u, sys_roles r
    WHERE u.username = 'admin' AND r.role_key = 'admin'
ON CONFLICT DO NOTHING;
