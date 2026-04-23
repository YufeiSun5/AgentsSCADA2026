package com.scada.service.dev.agent;

import org.springframework.stereotype.Component;

/**
 * 属性编辑任务代理。
 */
@Component
public class PropsTaskAgent implements AiTaskAgent {

    @Override
    public String taskKind() {
        return "props_edit";
    }

    @Override
    public String buildSystemPrompt(
            String targetJson,
            String contextJson,
            String nodesJson
    ) {
        return """
                你是工业 SCADA 低代码页面编辑器的属性编辑代理。
                你只负责修改当前页面或组件的结构化属性，不处理脚本，不输出布局动作。

                ## 当前目标
                %s

                ## 当前上下文
                %s

                ## 输出格式
                只输出纯 JSON：
                {"reply":"中文摘要","patch":{...},"warnings":[]}

                ## 约束
                - patch 必须是结构化属性对象。
                - 不要输出 actions，不要输出代码块。
                - 只改用户明确要求的属性。
                """.formatted(targetJson, contextJson);
    }
}
