package com.scada.dto;

import java.util.List;
import java.util.Map;

/**
 * AI 编排接口请求/响应 DTO（开发测试用）。
 * 支持多轮对话，与前端 AiLayoutAssistant / AI 代码助手约定的协议对应。
 */
public class AiChatDto {

    /** 单条对话消息（role: user / assistant） */
    public record ConversationMessage(String role, String content) {}

    /** 简化组件节点信息（发给 LLM 用于定位，含位置与尺寸） */
    public record NodeSummary(String id, String type, String title,
                               Integer x, Integer y, Integer width, Integer height) {}

    /** 前端请求：多轮对话历史 + 当前画布组件列表 */
    public record Request(
            List<ConversationMessage> messages,
            List<NodeSummary> nodes
    ) {}

    /**
     * 后端返回的响应。
     * reply  - AI 对操作的中文描述（或代码内容）
     * actions - 结构化动作列表，前端按顺序执行；代码辅助任务时为 []
     * 动作格式见 AiDevChatService.SYSTEM_PROMPT
     */
    public record Response(
            String reply,
            List<Map<String, Object>> actions
    ) {}
}
