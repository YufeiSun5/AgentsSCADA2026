-- 资产管理表：存储用户上传的图片、JS 库、CSS 文件等元数据
CREATE TABLE sys_assets (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,                           -- 原始文件名
    asset_type  VARCHAR(32)  NOT NULL,                           -- image / javascript / stylesheet / other
    mime_type   VARCHAR(128) NOT NULL,                           -- 如 image/png, application/javascript
    file_path   VARCHAR(512) NOT NULL,                           -- 磁盘存储路径（相对于 storage root）
    file_size   BIGINT       NOT NULL,                           -- 文件大小（字节）
    page_id     BIGINT       REFERENCES sys_pages(id),           -- 可选: 关联页面
    scope       VARCHAR(32)  NOT NULL DEFAULT 'page',            -- page(页面级) / global(全局共享)
    created_by  BIGINT       REFERENCES sys_users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted     SMALLINT     NOT NULL DEFAULT 0
);

COMMENT ON TABLE  sys_assets                IS '资产文件元数据表';
COMMENT ON COLUMN sys_assets.asset_type     IS '资产类型: image / javascript / stylesheet / other';
COMMENT ON COLUMN sys_assets.file_path      IS '磁盘存储相对路径（相对于 scada.storage.path）';
COMMENT ON COLUMN sys_assets.scope          IS '作用域: page(页面级) / global(全局共享)';

CREATE INDEX idx_assets_page  ON sys_assets(page_id) WHERE deleted = 0;
CREATE INDEX idx_assets_scope ON sys_assets(scope)   WHERE deleted = 0;
