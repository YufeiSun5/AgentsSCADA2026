package com.scada.controller.dev;

import com.scada.common.result.R;
import com.scada.dto.AiChatDto;
import com.scada.service.dev.AiDevChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 开发/可行性测试专用：AI 编排接口，无需携带 JWT。
 * 仅在开发阶段使用，生产环境应移除或添加认证。
 * 路由统一在 SecurityConfig 中 /api/dev/** 免认证。
 * 注意：context-path 已为 /api，此处不再重复前缀。
 */
@Slf4j
@RestController
@RequestMapping("/dev/ai")
@RequiredArgsConstructor
public class AiDevController {

    private final AiDevChatService aiDevChatService;

    /**
     * 接收自然语言指令 + 当前画布 Schema，返回结构化操作动作列表。
     * POST /api/dev/ai/chat（无需认证，开发测试专用）
     */
    @PostMapping("/chat")
    public R<AiChatDto.Response> chat(@RequestBody AiChatDto.Request request) {
        try {
            AiChatDto.Response response = aiDevChatService.chat(request);
            return R.ok(response);
        } catch (Throwable t) {
            // 临时诊断：打印根异常类型，帮助定位 500 根本原因
            log.error("[AiDev] 控制器未捕获异常 {}: {}", t.getClass().getName(), t.getMessage(), t);
            return R.fail(500, "AI 服务异常：" + t.getClass().getSimpleName() + " - " + t.getMessage());
        }
    }
}
