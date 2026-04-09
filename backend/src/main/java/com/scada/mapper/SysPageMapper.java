package com.scada.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.scada.domain.entity.SysPage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 页面 Mapper。
 * 带权限过滤的分页查询需自定义 SQL（JOIN sys_role_pages）。
 */
@Mapper
public interface SysPageMapper extends BaseMapper<SysPage> {

    /**
     * 按角色权限过滤的分页查询。
     * admin 角色传 null roleId 时跳过 JOIN，返回全部页面。
     */
    @Select("""
            SELECT p.* FROM sys_pages p
            WHERE p.deleted = 0
              AND (#{roleId} IS NULL
                   OR EXISTS (
                       SELECT 1 FROM sys_role_pages rp
                       WHERE rp.page_id = p.id AND rp.role_id = #{roleId}
                   ))
            ORDER BY p.updated_at DESC
            """)
    IPage<SysPage> selectPagesByRole(IPage<SysPage> page, @Param("roleId") Long roleId);
}
