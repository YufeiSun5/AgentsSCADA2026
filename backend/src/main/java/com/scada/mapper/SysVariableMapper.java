package com.scada.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.scada.domain.entity.SysVariable;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SysVariableMapper extends BaseMapper<SysVariable> {
}
