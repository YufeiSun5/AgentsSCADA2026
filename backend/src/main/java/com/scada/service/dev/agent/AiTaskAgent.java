package com.scada.service.dev.agent;

/**
 * AI 任务代理接口。
 * 按 taskKind 拆分系统提示词与解析策略，便于后续接入 MCP 工具层。
 */
public interface AiTaskAgent {

    String taskKind();

    String buildSystemPrompt(
            String targetJson,
            String contextJson,
            String nodesJson
    );
}
