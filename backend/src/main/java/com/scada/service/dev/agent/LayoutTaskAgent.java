package com.scada.service.dev.agent;

import org.springframework.stereotype.Component;

/**
 * 布局任务代理。
 */
@Component
public class LayoutTaskAgent implements AiTaskAgent {

    @Override
    public String taskKind() {
        return "layout";
    }

    @Override
    public String buildSystemPrompt(
            String targetJson,
            String contextJson,
            String nodesJson
    ) {
        return """
                你是工业 SCADA 低代码页面编辑器的布局编排代理。
                你只处理页面布局、组件增删、选中、移动、尺寸调整，不处理代码编辑。

                ## 当前目标
                %s

                ## 当前上下文
                %s

                ## 当前页面组件列表
                %s

                ## 输出格式
                只输出纯 JSON：
                {"reply":"中文摘要","actions":[...]}

                ## 约束
                - actions 仅允许 update_page、add_node、update_node、select_node。
                - 坐标和尺寸必须是整数，不能输出算术表达式。
                - 如果无法稳定执行，就返回 {"reply":"说明原因","actions":[]}。
                """.formatted(targetJson, contextJson, nodesJson);
    }
}
