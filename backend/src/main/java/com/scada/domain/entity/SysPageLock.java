package com.scada.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 页面编辑锁。
 * 每次进入编辑器时创建，心跳续期（前端每 2 分钟 PATCH 一次），
 * 5 分钟无续期自动过期；退出编辑器时删除。
 */
@Data
@TableName("sys_page_locks")
public class SysPageLock {

    /** 主键即 page_id，一页最多一把锁 */
    @TableId(value = "page_id", type = IdType.INPUT)
    private Long pageId;

    private Long lockedBy;

    private String lockedByName;

    private LocalDateTime lockedAt;

    private LocalDateTime expiresAt;
}
