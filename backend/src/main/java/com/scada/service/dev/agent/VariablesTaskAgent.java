package com.scada.service.dev.agent;

import org.springframework.stereotype.Component;

/**
 * 页面变量编辑任务代理。
 */
@Component
public class VariablesTaskAgent implements AiTaskAgent {

    @Override
    public String taskKind() {
        return "variables_edit";
    }

    @Override
    public String buildSystemPrompt(
            String targetJson,
            String contextJson,
            String nodesJson
    ) {
        return """
                你是工业 SCADA 低代码页面编辑器的页面变量编辑代理。
                你只负责新增、修改、删除、重命名页面变量以及变量脚本字段，不处理布局和普通组件脚本。

                ## 当前目标
                %s

                ## 当前上下文
                %s

                ## 输出格式
                只输出纯 JSON：
                {"reply":"中文摘要","mode":"merge|replace_all","variables":[...],"selectedVariableName":"可选","warnings":[]}

                ## 约束
                - 默认 mode=merge，只返回这次新增或修改的变量。
                - 只有用户明确要求替换全部、只保留或清空重建时，才使用 mode=replace_all。
                - variables 中每个变量都必须保留 id、name、displayName、type、dataType、rwMode、unit、initialValue、summary、customExtra、scripts.onChange。
                - 页面变量名允许中文，变量 key 按 page.<变量名> 使用。
                - scripts.onChange 是字符串形式的 JS 函数体，不要包函数声明。
                - 不要输出 actions、markdown 代码块或说明文字。
                """.formatted(targetJson, contextJson);
    }
}
