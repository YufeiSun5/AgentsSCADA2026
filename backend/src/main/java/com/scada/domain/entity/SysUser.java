package com.scada.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 系统用户表对应实体�?
 */
@Data
@TableName("sys_users")
public class SysUser {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    /** BCrypt 哈希，查询时不返回给前端 */
    private String password;

    private String displayName;

    private String email;

    private Boolean enabled;

    /** 逻辑删除标记�?=正常�?=已删�?*/
    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private OffsetDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private OffsetDateTime updatedAt;
}
