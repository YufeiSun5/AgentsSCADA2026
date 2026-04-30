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

    /** 结构化任务目标。 */
    public record TaskTarget(
            String scope,
            String pageId,
            String nodeId,
            String variableId,
            String file,
            String componentType
    ) {}

    /** 前端请求：支持显式 taskKind，也兼容旧版 messages + nodes。 */
    public record Request(
            String taskKind,
            String providerKey,
            String interactionMode,
            List<ConversationMessage> messages,
            List<NodeSummary> nodes,
            TaskTarget target,
            Map<String, Object> context
    ) {

        public Request(
                List<ConversationMessage> messages,
                List<NodeSummary> nodes
        ) {
            this(null, null, null, messages, nodes, null, Map.of());
        }
    }

    /** 可选 AI 服务商，不包含 api_key。 */
    public record ProviderOption(
            String providerKey,
            String name,
            String model,
            Integer sortOrder
    ) {}

    /** 系统变量搜索候选，不包含运行时值。 */
    public record SystemVariableOption(
            Long id,
            Long gatewayId,
            String varTag,
            String name,
            String dataType,
            String rwMode,
            String unit,
            String description,
            Integer alarmEnable
    ) {}

    /**
     * 后端返回的响应。
     * reply  - AI 对操作的中文描述（或代码内容）
     * actions - 结构化动作列表，前端按顺序执行；代码辅助任务时为 []
     * 动作格式见 AiDevChatService.SYSTEM_PROMPT
     */
    public record Response(
            String reply,
            List<Map<String, Object>> actions,
            String resultType,
            Object result,
            List<String> warnings
    ) {

        public Response(
                String reply,
                List<Map<String, Object>> actions
        ) {
            this(reply, actions, null, null, List.of());
        }
    }
}
