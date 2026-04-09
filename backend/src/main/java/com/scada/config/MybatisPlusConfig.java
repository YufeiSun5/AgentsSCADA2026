package com.scada.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.OffsetDateTime;

/**
 * MyBatis-Plus 配置。
 * 1. 分页插件（3.5.10.x 起内置分页，无需单独添加 PaginationInnerInterceptor）
 * 2. 字段自动填充（created_at / updated_at）
 */
@Slf4j
@Configuration
public class MybatisPlusConfig {

    /** 分页插件 */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        // 3.5.10.x 起分页功能内置，直接返回拦截器即可
        return new MybatisPlusInterceptor();
    }

    /** 自动填充处理器 */
    @Bean
    public MetaObjectHandler metaObjectHandler() {
        return new MetaObjectHandler() {

            @Override
            public void insertFill(MetaObject metaObject) {
                // 新建时自动填充 createdAt 和 updatedAt
                this.strictInsertFill(metaObject, "createdAt", OffsetDateTime.class, OffsetDateTime.now());
                this.strictInsertFill(metaObject, "updatedAt", OffsetDateTime.class, OffsetDateTime.now());
            }

            @Override
            public void updateFill(MetaObject metaObject) {
                // 更新时自动更新 updatedAt
                this.strictUpdateFill(metaObject, "updatedAt", OffsetDateTime.class, OffsetDateTime.now());
            }
        };
    }
}
