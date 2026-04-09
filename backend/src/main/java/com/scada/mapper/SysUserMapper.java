package com.scada.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.scada.domain.entity.SysUser;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SysUserMapper extends BaseMapper<SysUser> {
    // MP BaseMapper 已提供完整 CRUD，此接口保留用于扩展自定义 SQL
}
