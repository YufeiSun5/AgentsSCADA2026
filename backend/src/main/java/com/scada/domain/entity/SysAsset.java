package com.scada.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 资产文件元数据表。
 * 存储用户上传的图片、JS 库、CSS 文件等元信息，
 * 实际文件存储在本地磁盘（scada.storage.path 配置路径下）。
 */
@Data
@TableName(value = "sys_assets", autoResultMap = true)
public class SysAsset {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 原始文件名 */
    private String name;

    /** 资产类型: image / javascript / stylesheet / other */
    private String assetType;

    /** MIME 类型，如 image/png, application/javascript */
    private String mimeType;

    /** 磁盘存储相对路径（相对于 scada.storage.path） */
    private String filePath;

    /** 文件大小（字节） */
    private Long fileSize;

    /** 关联页面 ID（可选） */
    private Long pageId;

    /** 作用域: page / global */
    private String scope;

    /** 创建人 ID */
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private OffsetDateTime createdAt;

    @TableLogic
    private Integer deleted;
}
