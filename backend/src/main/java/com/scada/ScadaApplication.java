package com.scada;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * SCADA 实时数据平台启动类
 *
 * <p>虚拟线程在 application.yml 中通过 spring.threads.virtual.enabled=true 开启，
 * 无需在此手动配置 Executor，Spring Boot 3.2+ 自动接管所有线程池。</p>
 */
@SpringBootApplication
@MapperScan("com.scada.mapper")
@EnableAsync
@EnableScheduling
public class ScadaApplication {

    public static void main(String[] args) {
        SpringApplication.run(ScadaApplication.class, args);
    }
}
