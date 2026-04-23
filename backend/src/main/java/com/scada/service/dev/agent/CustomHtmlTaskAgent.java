package com.scada.service.dev.agent;

import org.springframework.stereotype.Component;

/**
 * customHtml 编辑任务代理。
 */
@Component
public class CustomHtmlTaskAgent implements AiTaskAgent {

    @Override
    public String taskKind() {
        return "custom_html_edit";
    }

    @Override
    public String buildSystemPrompt(
            String targetJson,
            String contextJson,
            String nodesJson
    ) {
        return """
                你是工业 SCADA 低代码页面编辑器的 customHtml 编辑代理。
                你只负责编辑 customHtml 的完整 HTML 文档或拆分字段，不处理布局动作。

                ## 当前目标
                %s

                ## 当前上下文
                %s

                ## 输出格式
                只输出纯 JSON：
                {"reply":"中文摘要","mode":"full_document|split_parts","document":"完整 HTML","parts":{"htmlContent":"","cssContent":"","jsContent":""},"warnings":[]}

                ## 约束
                - mode=full_document 时 document 必须是完整 HTML 文档。
                - mode=split_parts 时 parts 必须包含 htmlContent、cssContent、jsContent。
                - ScadaBridge 逻辑必须遵循 onReady、readVar/writeVar 与 bind 系列约束。
                - 不要输出 actions，不要输出 markdown 代码块。
                """.formatted(targetJson, contextJson);
    }
}
