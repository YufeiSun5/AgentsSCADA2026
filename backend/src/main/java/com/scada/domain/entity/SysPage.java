package com.scada.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 低代码页面表�?
 * schema_json 字段使用 PostgreSQL JSONB 存储完整页面 Schema�?
 */
@Data
@TableName(value = "sys_pages", autoResultMap = true)
public class SysPage {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 页面唯一标识（URL 友好），可�?*/
    private String pageKey;

    private String name;

    private String description;

    /** draft / enabled / disabled */
    private String status;

    /**
     * 完整页面 Schema �?JSON 字符串�?
     * 使用 autoResultMap=true 时，MP 会自动将 JSONB 列映射为 String�?
     * 若需对象化，可引�?JacksonTypeHandler�?
     */
    private String schemaJson;

    /** 页面缩略图（Base64 �?URL�?*/
    private String thumbnail;

    /** 乐观锁版本号，更新时 WHERE version = #{version} AND id = #{id} */
    @Version
    private Integer version;

    private Long createdBy;

    private Long updatedBy;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private OffsetDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private OffsetDateTime updatedAt;
}
