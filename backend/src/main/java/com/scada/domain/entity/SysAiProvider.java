package com.scada.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * AI 服务商配置表�?
 * api_key 字段使用 AES-256-GCM 加密后存储，读取时由 AiKeyEncryptor 解密�?
 */
@Data
@TableName("sys_ai_providers")
public class SysAiProvider {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    /** 程序内唯一标识，用于选择 key */
    private String providerKey;

    /** OpenAI 兼容接口地址，如 https://api.openai.com/v1 */
    private String baseUrl;

    /** AES-256-GCM 加密存储；响应给前端时只返回最�?4 �?*/
    private String apiKey;

    private String model;

    /** 并发限制（Semaphore 初始值） */
    private Integer maxConcurrent;

    private Integer maxTokensPerReq;

    private Boolean enabled;

    /** 前端下拉选择时的排列顺序 */
    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private OffsetDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private OffsetDateTime updatedAt;
}
