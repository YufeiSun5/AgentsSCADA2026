package com.scada.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.scada.domain.entity.SysAsset;
import org.apache.ibatis.annotations.Mapper;

/**
 * 资产文件 Mapper。
 */
@Mapper
public interface SysAssetMapper extends BaseMapper<SysAsset> {
}
