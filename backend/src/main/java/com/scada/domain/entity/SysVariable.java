package com.scada.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 变量点位表�?
 * 每一行对应一个采集点或计算点�?
 */
@Data
@TableName("sys_variables")
public class SysVariable {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("gateway_id")
    private Long gatewayId;

    /** 变量全局唯一 tag，引擎内部用�?key 访问实时值缓�?*/
    private String varTag;

    private String name;

    /** float / int / bool / string */
    private String dataType;

    /** 0=采集点，1=计算�?*/
    private Integer sourceType;

    /** JSONPath 表达式，从报文中提取原始�?*/
    private String jsonPath;

    /** R / W / RW */
    private String rwMode;

    private Double scaleFactor;
    private Double offsetVal;

    /** 计算�?Aviator 表达�?*/
    private String calcRule;

    /** 存储模式�?=不存�?=变化存，2=定时存，3=混合 */
    private Integer storeMode;

    private Double  storeDeadband;
    private Integer storeCycle;

    /** 告警配置 */
    private Integer alarmEnable;
    private Double  limitHh;
    private Double  limitH;
    private Double  limitL;
    private Double  limitLl;
    private Double  alarmDeadband;

    private String unit;
    private String description;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private OffsetDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private OffsetDateTime updatedAt;
}
