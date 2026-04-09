package com.scada.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 工业网关配置表�?
 * parse_config / write_config 使用 JSONB 存储各厂商协议参数，
 * 对应后端 GatewayParser/GatewayEncoder 的策略配置�?
 */
@Data
@TableName(value = "sys_gateway", autoResultMap = true)
public class SysGateway {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 网关唯一标识，用�?MQTT topic 匹配�?gatewaySnapshot key */
    private String gatewayKey;

    private String name;

    private String description;

    /**
     * 协议类型，对�?parserRegistry 中的 key�?
     * flat_json / nested_json / array_points / binary_base64 / numeric_key / custom
     */
    private String protocolType;

    /**
     * 推送模式：
     * full        - 每条消息含全量点�?
     * incremental - 首次全量，后续仅推送变�?
     * delta_only  - 始终只推变化（无全量基准�?
     */
    private String pushMode;

    /** 上行数据订阅 topic 模式，支�?MQTT 通配�?*/
    private String topicPattern;

    /** 下行指令发布 topic 模式 */
    private String cmdTopicPattern;

    /** 上行解析配置（JSONB），协议参数由具�?Parser 定义 */
    private String parseConfig;

    /** 下行回写配置（JSONB），协议参数由具�?Encoder 定义 */
    private String writeConfig;

    /** 当前是否在线 */
    private Boolean online;

    private OffsetDateTime lastSeenAt;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private OffsetDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private OffsetDateTime updatedAt;
}
