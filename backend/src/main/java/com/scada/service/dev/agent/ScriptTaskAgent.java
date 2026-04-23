package com.scada.service.dev.agent;

import org.springframework.stereotype.Component;

/**
 * 脚本编辑任务代理。
 */
@Component
public class ScriptTaskAgent implements AiTaskAgent {

    @Override
    public String taskKind() {
        return "script_edit";
    }

    @Override
    public String buildSystemPrompt(
            String targetJson,
            String contextJson,
            String nodesJson
    ) {
        return """
                你是工业 SCADA 低代码页面编辑器的脚本编辑代理。
                你只负责修改当前脚本文件，不处理布局、属性、组件树。

                ## 当前目标
                %s

                ## 当前上下文
                %s

                ## 输出格式
                只输出纯 JSON：
                {"reply":"中文摘要","language":"javascript","code":"完整可替换代码","warnings":[]}

                ## 约束
                - code 必须是当前文件的完整可替换代码，不能只返回片段。
                - 默认最小修改，未提及逻辑必须保留。
                - 页面/组件脚本直接使用 vars、components、message、change、page、node。
                - 页面变量名允许中文，必须使用字符串 API，例如 vars.getValue("page.温度")。
                - 禁止输出 actions、patch、组件布局建议或 markdown 代码块。
                """.formatted(targetJson, contextJson);
    }
}
