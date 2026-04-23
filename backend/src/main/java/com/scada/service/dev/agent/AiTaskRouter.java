package com.scada.service.dev.agent;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * AI 任务路由器。
 * 负责按 taskKind 选择对应的任务代理。
 */
@Component
@RequiredArgsConstructor
public class AiTaskRouter {

    private final List<AiTaskAgent> agents;

    public AiTaskAgent resolve(String rawTaskKind) {
        String normalizedTaskKind = normalizeTaskKind(rawTaskKind);
        return agents.stream()
                .filter(agent -> agent.taskKind().equals(normalizedTaskKind))
                .findFirst()
                .orElse(null);
    }

    public String normalizeTaskKind(String rawTaskKind) {
        String taskKind = rawTaskKind == null ? "" : rawTaskKind.trim().toLowerCase();
        if (taskKind.isEmpty()) {
            return "";
        }

        return switch (taskKind) {
            case "layout" -> "layout";
            case "props", "props_edit" -> "props_edit";
            case "script", "script_edit" -> "script_edit";
            case "variables", "variables_edit" -> "variables_edit";
            case "custom_html", "custom_html_edit" -> "custom_html_edit";
            default -> taskKind;
        };
    }
}
