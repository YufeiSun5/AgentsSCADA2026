package com.scada.service.dev;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scada.domain.entity.SysAiProvider;
import com.scada.dto.AiChatDto;
import com.scada.mapper.SysAiProviderMapper;
import com.scada.service.dev.agent.AiTaskAgent;
import com.scada.service.dev.agent.AiTaskRouter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.ConnectException;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 开发/可行性测试专用：调用 LLM，将自然语言转换为画布操作动作列表。
 * 不使用加密，直接读取 sys_ai_providers.api_key 明文。
 * 生产环境请使用正式的 AiProviderService（含 AES-256-GCM 解密）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiDevChatService {

    private static final int TIMEOUT_SECONDS = 60;
    private static final int CONNECT_TIMEOUT_SECONDS = 20;
    private static final Set<String> SUPPORTED_ACTION_TYPES = Set.of(
            "update_page", "add_node", "update_node", "select_node");

    /** 布局编排系统提示词，%s 占位符替换为当前组件列表 JSON。 */
    private static final String LAYOUT_SYSTEM_PROMPT = """
            你是一个工业 SCADA 低代码页面编辑平台的 AI 助手，支持两类任务：
            【布局编排】将自然语言转换为画布操作动作列表（reply 描述操作，actions 含动作）
            【代码辅助】帮助编写/优化组件脚本（JavaScript），reply 中必须包含 markdown 代码块，actions 返回 []

            ## 可用组件类型（add_node 时的 nodeType 值）
            - customHtml: HTML/自定义 HTML/高级自定义组件
            - text: 文本/标题/标签
            - button: 按钮/操作键
            - table: 表格/列表/台账
            - chart: 图表/趋势图/折线图
            - image: 图片/设备图/工艺图

            ## 组件约束
            - container 仅用于页面根节点和旧数据兼容，禁止 add_node 新增 container。
            - input 已下架，禁止 add_node 新增 input；需要输入回写时使用 text.writeBack 或 button.writeBack。
            - HTML/customHtml 是当前主力组件，自定义交互优先在 HTML 组件 JS 中完成。

            ## 页面局部变量运行时（页面/组件脚本中使用）
            - 页面脚本和组件脚本直接使用全局对象 vars、components、message、change、page、node，不要生成 Ctx.xxx。
            - 页面变量使用 page.<name> 命名；vars.get(name) 返回完整 RuntimeVariable，vars.getValue(name) 返回 value。
            - 变量名允许中文；访问中文变量必须使用字符串 API，例如 vars.getValue("page.温度")，不要生成 vars.page.温度。
            - RuntimeVariable 外层包含 value、previousValue、valueTs、previousValueTs、quality、qualityTs、changeSeq、changeSource、alarm/write/display 字段。
            - 扩展字段按属性分类：identityExtra、ownerExtra、typeExtra、valueExtra、timeExtra、qualityExtra、changeExtra、alarmExtra、writeExtra、displayExtra、configExtra、customExtra。
            - 写页面变量使用 vars.set("page.温度", value, options?)；source 会按页面脚本/组件脚本自动补齐，reason 只在需要审计时再写。
            - 页面 onVariableChange 直接使用 change。
            - 调用页面内组件方法使用 components.call(componentIdOrName, methodName, ...args)。

            ## ScadaBridge API 合同（customHtml JS 中使用）
            - 所有 ScadaBridge 调用必须放在 ScadaBridge.onReady(callback) 内，或确保 ready 后再执行。
            - ScadaBridge.readTag(tagName) 返回 Promise<{value:any,timestamp:number,unit?:string,quality?:string}>，读取数值必须使用 data.value。
            - ScadaBridge.writeTag(tagName, value) 返回 Promise<{success:boolean,message?:string}>。
            - ScadaBridge.subscribe(tagName, callback) 返回 unsubscribe，callback 入参结构同 readTag。
            - ScadaBridge.readVar(name) 返回 Promise<RuntimeVariable|null>，读取当前页面局部变量完整对象。
            - ScadaBridge.writeVar(name, value) 写入当前页面局部变量，不写后端系统点位。
            - ScadaBridge.subscribeVar(name, callback) 订阅当前页面局部变量变化，callback 接收完整变量对象和 change。
            - ScadaBridge.callComponent(componentIdOrName, methodName, ...args) 调用页面内组件方法。
            - ScadaBridge.bindText(selector, tagName, options) 只在初始化时调用一次，禁止放进 setInterval/循环。
            - ScadaBridge.bindVarText(selector, name, options) 将页面局部变量绑定到文本节点，只在初始化时调用一次。
            - ScadaBridge.bindWriteDialog(selector, tagName, options) 只在初始化时调用一次。
            - ScadaBridge.bindVarWriteDialog(selector, name, options) 点击元素后写入页面局部变量，只在初始化时调用一次。
            - 页面内逻辑优先使用 readVar/writeVar/subscribeVar；系统点位才使用 readTag/writeTag/subscribe。
            - 如果需要周期性写值，只在定时器内调用 writeTag/writeVar，不要在定时器内重复 bindText/bindVarText/bindWriteDialog。

            ## 当前页面组件列表（id 是修改/选中操作的唯一标识）
            %s

            ## 响应格式（顶层只输出纯 JSON，不要用 markdown 包裹整个 JSON）
            布局任务：
            {"reply":"用中文简洁描述操作","actions":[...]}
            代码辅助任务：
            {"reply":"说明文字\\n```javascript\\n完整代码\\n```","actions":[]}

            ## 布局任务强约束
            - 布局任务必须一次性直接返回最终 actions，严禁输出“请确认是否执行”“是否继续”“是否需要我执行”等确认语句
            - 如果无法稳定输出完整 actions，就返回 {"reply":"说明无法执行的原因","actions":[]}，不要输出半截 JSON
            - actions 数组里的每一项都必须是完整 JSON 对象，必须用花括号包裹，禁止出现 "update_node","id","patch":... 这种残缺片段
            - actions 数组中对象之间只能使用英文逗号分隔，禁止混入中文分号、编号步骤、解释文字或注释
            - reply 只允许是一句简洁中文摘要，不能包含编号步骤、确认问题或额外说明

            ## 支持的 action 类型（仅用于布局编排任务）
            1. {"type":"update_page","patch":{"canvasWidth":1920,"canvasHeight":1080,"background":"#081622"}}
            2. {"type":"add_node","nodeType":"text","position":{"x":24,"y":32},"title":"实时温度","props":{"width":260,"height":60,"binding":{"enabled":true,"tagName":"temperature","template":"温度：{value} {unit}","precision":1}}}
            3. {"type":"update_node","nodeId":"ID","patch":{"width":400,"x":100,"y":200},"title":"新标题（可选，省略则不改）"}
               - patch 中的 x/y 表示移动组件位置；width/height 表示调整大小；其他字段修改对应属性
               - 向下移动 50px：patch 中 y = 当前 y + 50；向右移动：x = 当前 x + 50
            4. {"type":"select_node","nodeId":"ID"}

            ## 规则
            - 只输出纯 JSON，不要有任何包裹或说明文字
            - 多个操作放在 actions 数组中顺序执行
            - 布局任务必须直接给出最终可执行 actions，禁止输出“请确认是否执行”“是否继续”“是否需要我执行”这类确认语句
            - actions 数组中的每个元素必须是完整 JSON 对象，禁止省略花括号，禁止混入中文分号、说明文字或半截字段
            - 若动作数量很多，也必须输出完整合法 JSON；宁可返回 actions=[]，也不要返回不完整的 actions 数组
            - 修改/选中时必须使用组件列表中真实存在的 id
            - 代码辅助任务时 actions 返回 []，reply 必须含完整 fenced code block
            - 意图不明确时 reply 解释原因，actions 返回 []
            - 坐标和尺寸必须是计算好的整数，禁止输出算术表达式（用 100 而不是 120-20）
            - 不要输出只包含片段的裸代码；需要修改当前文件时输出完整可替换代码
            """;

    /** 代码辅助系统提示词，不注入整页组件列表，也不包含布局动作协议。 */
    private static final String CODE_SYSTEM_PROMPT = """
            你是一个工业 SCADA 低代码页面编辑平台的代码助手，只负责帮助编写、修复、重构当前正在编辑的代码文件。

            ## 任务边界
            - 你当前只处理代码编辑任务，不处理页面布局、组件排版、增删组件、选中组件。
            - 严禁输出任何布局 action，例如 update_page、add_node、update_node、select_node。
            - 严禁建议移动组件位置、调整组件尺寸、修改画布大小、重新排版页面。
            - 你只能围绕用户当前编辑的文件、当前选中代码、当前组件脚本或当前页面脚本回答。

            ## 代码编辑强约束
            - 默认策略是最小必要改动：只修改用户明确要求变更的那几行，未提及的现有逻辑必须保留。
            - 严禁为了“顺手优化”删除、改写或省略现有副作用逻辑，例如日志写入、状态同步、事件上报、变量回写、组件调用。
            - 当用户要求“把 +1 改成 +10”这类局部修改时，必须保留原文件其他语句与原有语义，只改目标表达式。
            - 返回完整文件不等于重写文件；完整代码必须是“基于原文件的最小修改结果”，不能擅自删减原有代码。
            - 除非用户明确要求，否则不要重命名变量、不要修改 reason/source/message 等业务语义字段。

            ## 页面脚本 / 组件脚本运行时
            - 页面脚本和组件脚本直接使用全局对象 vars、components、message、change、page、node，不要生成 Ctx.xxx。
            - 页面变量使用 page.<name> 命名；vars.get(name) 返回完整 RuntimeVariable，vars.getValue(name) 返回 value。
            - 变量名允许中文；访问中文变量必须使用字符串 API，例如 vars.getValue("page.温度")，不要生成 vars.page.温度。
            - RuntimeVariable 外层包含 value、previousValue、valueTs、previousValueTs、quality、qualityTs、changeSeq、changeSource、alarm/write/display 字段。
            - 扩展字段按属性分类：identityExtra、ownerExtra、typeExtra、valueExtra、timeExtra、qualityExtra、changeExtra、alarmExtra、writeExtra、displayExtra、configExtra、customExtra。
            - 写页面变量使用 vars.set("page.温度", value, options?)；source 会按页面脚本/组件脚本自动补齐，reason 只在需要审计时再写。
            - 页面 onVariableChange 直接使用 change。
            - 调用页面内组件方法使用 components.call(componentIdOrName, methodName, ...args)。

            ## ScadaBridge API 合同（customHtml JS 中使用）
            - 所有 ScadaBridge 调用必须放在 ScadaBridge.onReady(callback) 内，或确保 ready 后再执行。
            - ScadaBridge.readTag(tagName) 返回 Promise<{value:any,timestamp:number,unit?:string,quality?:string}>，读取数值必须使用 data.value。
            - ScadaBridge.writeTag(tagName, value) 返回 Promise<{success:boolean,message?:string}>。
            - ScadaBridge.subscribe(tagName, callback) 返回 unsubscribe，callback 入参结构同 readTag。
            - ScadaBridge.readVar(name) 返回 Promise<RuntimeVariable|null>，读取当前页面局部变量完整对象。
            - ScadaBridge.writeVar(name, value) 写入当前页面局部变量，不写后端系统点位。
            - ScadaBridge.subscribeVar(name, callback) 订阅当前页面局部变量变化，callback 接收完整变量对象和 change。
            - ScadaBridge.callComponent(componentIdOrName, methodName, ...args) 调用页面内组件方法。
            - ScadaBridge.bindText(selector, tagName, options) 只在初始化时调用一次，禁止放进 setInterval/循环。
            - ScadaBridge.bindVarText(selector, name, options) 将页面局部变量绑定到文本节点，只在初始化时调用一次。
            - ScadaBridge.bindWriteDialog(selector, tagName, options) 只在初始化时调用一次。
            - ScadaBridge.bindVarWriteDialog(selector, name, options) 点击元素后写入页面局部变量，只在初始化时调用一次。
            - 页面内逻辑优先使用 readVar/writeVar/subscribeVar；系统点位才使用 readTag/writeTag/subscribe。
            - 如果需要周期性写值，只在定时器内调用 writeTag/writeVar，不要在定时器内重复 bindText/bindVarText/bindWriteDialog。

            ## 响应格式
            - 顶层只输出纯 JSON，不要用 markdown 包裹整个 JSON。
            - 代码任务必须返回：{"reply":"说明文字\\n```javascript\\n完整代码\\n```","actions":[]}
            - reply 中必须包含当前文件的完整可替换代码 fenced code block。
            - actions 必须始终返回 []。
            - 不要返回 JSON patch、属性对象、布局动作、组件树、页面布局建议。
            - 如果无法完成，就在 reply 中说明原因，actions 仍然返回 []。
            """;

    private final SysAiProviderMapper providerMapper;
    private final ObjectMapper objectMapper;
    private final AiTaskRouter aiTaskRouter;

    /** 单例 HTTP 客户端，连接超时 20s，响应超时 60s，不走系统代理。 */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .proxy(ProxySelector.of(null))
            .connectTimeout(Duration.ofSeconds(CONNECT_TIMEOUT_SECONDS))
            .build();

    /**
     * 调用 LLM，返回 AI 编排结果。
     * 找不到启用的 provider 时返回带提示的空 actions。
     */
    public AiChatDto.Response chat(AiChatDto.Request request) {
        // 查询第一条启用的 AI 服务商配置
        SysAiProvider provider = providerMapper.selectOne(
                new LambdaQueryWrapper<SysAiProvider>()
                        .eq(SysAiProvider::getEnabled, Boolean.TRUE)
                        .orderByAsc(SysAiProvider::getSortOrder)
                        .last("LIMIT 1")
        );

        if (provider == null) {
            return new AiChatDto.Response(
                    "暂未配置可用的 AI 服务商。请在数据库 sys_ai_providers 表中插入一条 enabled=true 的记录，并填写正确的 api_key。",
                    List.of()
            );
        }

        // 将组件列表序列化为 JSON 字符串（发给 LLM 用于定位，不含完整属性）
        String nodesJson;
        try {
            nodesJson = objectMapper.writeValueAsString(
                    request.nodes() != null ? request.nodes() : List.of());
        } catch (Exception e) {
            nodesJson = "[]";
        }

        String explicitTaskKind = aiTaskRouter.normalizeTaskKind(request.taskKind());
        AiTaskAgent explicitTaskAgent = explicitTaskKind.isBlank()
                ? null
                : aiTaskRouter.resolve(explicitTaskKind);
        boolean codeTask = isCodeTaskRequest(request.messages());
        String systemPrompt = explicitTaskAgent != null
                ? explicitTaskAgent.buildSystemPrompt(
                    serializeContext(request.target()),
                    serializeContext(request.context()),
                    nodesJson
                )
                : codeTask
                    ? CODE_SYSTEM_PROMPT
                    : LAYOUT_SYSTEM_PROMPT.formatted(nodesJson);

        // 构建完整的 GLM 消息列表：system + 多轮对话历史
        List<Map<String, Object>> glmMessages = new ArrayList<>();
        glmMessages.add(Map.of("role", "system", "content", systemPrompt));
        if (request.messages() != null) {
            for (AiChatDto.ConversationMessage msg : request.messages()) {
                glmMessages.add(Map.of("role", msg.role(), "content", msg.content()));
            }
        }

        log.debug("[AiDev] provider={} model={} turns={} task={}",
                provider.getProviderKey(), provider.getModel(),
            request.messages() != null ? request.messages().size() : 0,
            explicitTaskAgent != null
                ? explicitTaskAgent.taskKind()
                : codeTask ? "code" : "layout");

        try {
            return callLlm(provider, glmMessages, explicitTaskAgent != null ? explicitTaskAgent.taskKind() : null);
        } catch (Exception e) {
            log.warn("[AiDev] LLM 调用异常: {}", e.getMessage());
            if (isConnectionTimeout(e)) {
                return new AiChatDto.Response(
                        "AI 服务连接超时：后端已自动重试 1 次仍失败。请稍后重试，或检查模型服务商网络、代理/VPN 和 baseUrl 配置。",
                        List.of()
                );
            }
            return new AiChatDto.Response("AI 服务调用失败：" + e.getMessage(), List.of());
        }
    }

    /**
     * 向 OpenAI 兼容接口发送请求，解析并返回结构化结果。
     * 端点：POST {baseUrl}/chat/completions，请求头 Authorization: Bearer。
     * baseUrl 已含版本路径（如 GLM: /api/paas/v4），不再拼接 /v1。
     * @param glmMessages 完整消息列表（含 system + 多轮对话）
     */
    private AiChatDto.Response callLlm(
            SysAiProvider provider,
            List<Map<String, Object>> glmMessages,
            String explicitTaskKind
    )
            throws Exception {
        // 构建 OpenAI 格式请求体
        Map<String, Object> body = Map.of(
                "model", provider.getModel(),
                "messages", glmMessages,
                "max_tokens", provider.getMaxTokensPerReq() != null ? provider.getMaxTokensPerReq() : 2000
        );
        String requestJson = objectMapper.writeValueAsString(body);

        // 发送 HTTP 请求（OpenAI 格式：{baseUrl}/chat/completions，Authorization: Bearer 认证）
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(provider.getBaseUrl().stripTrailing() + "/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + provider.getApiKey())
                .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

        HttpResponse<String> httpResponse = sendLlmRequestWithRetry(httpRequest);

        if (httpResponse.statusCode() != 200) {
            throw new RuntimeException("LLM HTTP " + httpResponse.statusCode() + ": " + httpResponse.body());
        }

        // 提取 OpenAI 响应格式：choices[0].message.content
        JsonNode root = objectMapper.readTree(httpResponse.body());
        String content = root.path("choices").path(0).path("message").path("content").asText("");
        if (content.isBlank()) {
            throw new RuntimeException("LLM 响应中无 content 内容，原始响应：" + httpResponse.body());
        }

        // 代码辅助任务不能盲目提取第一个 {}，否则会把 JS 中的 || {} 误当成 JSON patch。
        boolean codeTask = isCodeTask(glmMessages);
        String jsonContent = prepareContentForParse(content, codeTask, explicitTaskKind);
        log.debug("[AiDev] LLM 原始响应: {}", jsonContent);

        if (explicitTaskKind != null && !explicitTaskKind.isBlank()) {
            return parseTaskResponse(jsonContent, explicitTaskKind);
        }

        return parseLegacyResponse(jsonContent, codeTask);
    }

    /**
     * 只对连接阶段超时重试一次，避免偶发网络抖动直接打断代码编辑。
     */
    private HttpResponse<String> sendLlmRequestWithRetry(HttpRequest httpRequest)
            throws Exception {
        try {
            return httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        } catch (HttpConnectTimeoutException | ConnectException e) {
            log.warn("[AiDev] LLM 连接超时，1 秒后重试一次: {}", e.getMessage());
            Thread.sleep(1000);
            return httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        }
    }

    private boolean isConnectionTimeout(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof HttpConnectTimeoutException) {
                return true;
            }
            String message = current.getMessage();
            if (message != null && message.contains("HTTP connect timed out")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String serializeContext(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(
                    value != null ? value : Map.of()
            );
        } catch (Exception ignored) {
            return "{}";
        }
    }

    /**
     * 解析 LLM 输出，兼容三种格式：
     * 1. 标准格式：{"reply":"...","actions":[...]}
     * 2. 裸单个 action：{"type":"add_node",...}
     * 3. 裸 action 数组：[{"type":"add_node",...}]
     */
    private AiChatDto.Response parseLegacyResponse(String jsonContent, boolean codeTask) throws Exception {
        JsonNode node;
        try {
            node = objectMapper.readTree(jsonContent);
        } catch (Exception e) {
            if (!codeTask) {
                try {
                    jsonContent = normalizeJsonForParsing(jsonContent);
                    node = objectMapper.readTree(jsonContent);
                } catch (Exception ignored) {
                    AiChatDto.Response salvaged = salvageMalformedLayoutResponse(jsonContent);
                    if (salvaged != null) {
                        return salvaged;
                    }
                    log.warn("[AiDev] JSON 解析失败，将原始内容作为 reply 返回. 错误: {}", e.getMessage());
                    // LLM 返回了非标准 JSON，将原始内容作为纯文本 reply 返回，避免暴露技术错误
                    return new AiChatDto.Response(normalizeCodeReply(jsonContent), List.of());
                }
            } else {
                log.warn("[AiDev] JSON 解析失败，将原始内容作为 reply 返回. 错误: {}", e.getMessage());
                return new AiChatDto.Response(normalizeCodeReply(jsonContent), List.of());
            }
        }

        // 标准格式：顶层有 reply 字段
        if (node.has("reply")) {
            AiChatDto.Response resp = objectMapper.treeToValue(node, AiChatDto.Response.class);
            return new AiChatDto.Response(
                    normalizeCodeReply(resp.reply()),
                    roundPatchCoords(resp.actions())
            );
        }

        // 裸 action 数组
        if (node.isArray()) {
            if (codeTask) {
                return new AiChatDto.Response(
                        "AI 返回了布局 actions，但当前是代码编辑任务。已拦截，避免误改画布；请重试并要求返回完整 JavaScript 代码块。",
                        List.of()
                );
            }
            List<Map<String, Object>> actions = objectMapper.convertValue(
                    node, objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
            return new AiChatDto.Response("已执行 " + actions.size() + " 个操作", actions);
        }

        // 裸单个 action（有 type 字段）
        if (node.has("type")) {
            if (codeTask) {
                return new AiChatDto.Response(
                        "AI 返回了布局 action，但当前是代码编辑任务。已拦截，避免误改画布；请重试并要求返回完整 JavaScript 代码块。",
                        List.of()
                );
            }
            Map<String, Object> action = objectMapper.convertValue(node,
                    objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
            return new AiChatDto.Response("已执行操作", List.of(action));
        }

        if (codeTask) {
            return new AiChatDto.Response(
                    "AI 返回了 JSON，但当前文件是代码文件。已拦截该结果，避免用 JSON 覆盖脚本；请重试并要求返回完整 JavaScript 代码块。",
                    List.of()
            );
        }

        // 兜底：AI 直接返回了修改后的裸 JSON 对象（如 props 修改场景）
        // 将其包装成 markdown 代码块放入 reply，前端可识别并展示 Diff 对比按钮
        try {
            String prettyJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(node);
            String reply = "已为你生成修改后的属性，点击【在编辑器中对比】按钮可预览 Diff：\n```json\n" + prettyJson + "\n```";
            return new AiChatDto.Response(reply, List.of());
        } catch (Exception ex) {
            return new AiChatDto.Response(
                    "AI 返回了未知格式，请重试。原始内容：" + normalizeCodeReply(jsonContent),
                    List.of()
            );
        }
    }

    private AiChatDto.Response parseTaskResponse(String jsonContent, String rawTaskKind) throws Exception {
        String taskKind = aiTaskRouter.normalizeTaskKind(rawTaskKind);

        return switch (taskKind) {
            case "layout" -> parseLayoutTaskResponse(jsonContent);
            case "script_edit" -> parseScriptTaskResponse(jsonContent);
            case "variables_edit" -> parseVariablesTaskResponse(jsonContent);
            case "props_edit" -> parsePropsTaskResponse(jsonContent);
            case "custom_html_edit" -> parseCustomHtmlTaskResponse(jsonContent);
            default -> new AiChatDto.Response("暂不支持的 AI 任务类型：" + rawTaskKind, List.of());
        };
    }

    private AiChatDto.Response parseLayoutTaskResponse(String jsonContent) throws Exception {
        AiChatDto.Response response = parseLegacyResponse(jsonContent, false);
        return new AiChatDto.Response(
                response.reply(),
                response.actions(),
                "actions",
                response.actions(),
                response.warnings() != null ? response.warnings() : List.of()
        );
    }

    private AiChatDto.Response parseScriptTaskResponse(String jsonContent) throws Exception {
        JsonNode node = readStructuredJson(jsonContent);
        if (node != null && node.isObject()) {
            String reply = node.path("reply").asText("已生成脚本修改建议");
            String language = node.path("language").asText("javascript");
            String code = node.path("code").asText("");
            List<String> warnings = readWarnings(node);

            if (code.isBlank()) {
                String fallbackCode = extractCodePayload(reply);
                if (fallbackCode != null) {
                    code = fallbackCode;
                }
            }

            if (!code.isBlank()) {
                return new AiChatDto.Response(
                        reply,
                        List.of(),
                        "code",
                        Map.of(
                                "language", language,
                                "code", code
                        ),
                        warnings
                );
            }
        }

        String fallbackCode = extractCodePayload(jsonContent);
        if (fallbackCode != null) {
            return new AiChatDto.Response(
                    "已按脚本代码兜底解析，请检查后保存。",
                    List.of(),
                    "code",
                    Map.of(
                            "language", "javascript",
                            "code", fallbackCode
                    ),
                    List.of("AI 未按结构化 JSON 返回，后端已按原始脚本兜底解析。")
            );
        }

        return new AiChatDto.Response("AI 未返回可解析的脚本代码。", List.of());
    }

    private AiChatDto.Response parseVariablesTaskResponse(String jsonContent) throws Exception {
        JsonNode node = readStructuredJson(jsonContent);
        if (node == null) {
            return new AiChatDto.Response("AI 未返回可解析的变量 JSON。", List.of());
        }

        String reply = "已生成变量修改建议";
        String mode = "merge";
        JsonNode variablesNode = node;
        String selectedVariableName = "";
        List<String> warnings = List.of();

        if (node.isObject()) {
            reply = node.path("reply").asText(reply);
            mode = node.path("mode").asText("merge");
            variablesNode = node.path("variables");
            selectedVariableName = node.path("selectedVariableName").asText("");
            warnings = readWarnings(node);
        }

        if (!variablesNode.isArray()) {
            return new AiChatDto.Response("AI 变量结果缺少 variables 数组。", List.of());
        }

        List<Map<String, Object>> variables = objectMapper.convertValue(
                variablesNode,
                objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class)
        );

        return new AiChatDto.Response(
                reply,
                List.of(),
                "variables",
                Map.of(
                        "mode", mode,
                        "variables", variables,
                        "selectedVariableName", selectedVariableName
                ),
                warnings
        );
    }

    private AiChatDto.Response parsePropsTaskResponse(String jsonContent) throws Exception {
        JsonNode node = readStructuredJson(jsonContent);
        if (node == null || !node.isObject()) {
            return new AiChatDto.Response("AI 未返回可解析的属性 patch。", List.of());
        }

        String reply = node.path("reply").asText("已生成属性修改建议");
        JsonNode patchNode = node.path("patch");
        if (!patchNode.isObject()) {
            return new AiChatDto.Response("AI 属性结果缺少 patch 对象。", List.of());
        }

        Map<String, Object> patch = objectMapper.convertValue(
                patchNode,
                objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class)
        );

        return new AiChatDto.Response(
                reply,
                List.of(),
                "patch",
                patch,
                readWarnings(node)
        );
    }

    private AiChatDto.Response parseCustomHtmlTaskResponse(String jsonContent) throws Exception {
        JsonNode node = readStructuredJson(jsonContent);
        if (node == null || !node.isObject()) {
            return new AiChatDto.Response("AI 未返回可解析的 customHtml 结果。", List.of());
        }

        String reply = node.path("reply").asText("已生成 customHtml 修改建议");
        String mode = node.path("mode").asText("full_document");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", mode);

        if ("split_parts".equals(mode)) {
            JsonNode partsNode = node.path("parts");
            if (!partsNode.isObject()) {
                return new AiChatDto.Response("AI customHtml 结果缺少 parts 对象。", List.of());
            }
            result.put("parts", objectMapper.convertValue(
                    partsNode,
                    objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class)
            ));
        } else {
            String document = node.path("document").asText("");
            if (document.isBlank()) {
                return new AiChatDto.Response("AI customHtml 结果缺少 document。", List.of());
            }
            result.put("document", document);
        }

        return new AiChatDto.Response(
                reply,
                List.of(),
                "custom_html",
                result,
                readWarnings(node)
        );
    }

    private JsonNode readStructuredJson(String jsonContent) {
        try {
            return objectMapper.readTree(jsonContent);
        } catch (Exception firstError) {
            try {
                return objectMapper.readTree(normalizeJsonForParsing(jsonContent));
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private List<String> readWarnings(JsonNode node) {
        if (node == null || !node.path("warnings").isArray()) {
            return List.of();
        }

        List<String> warnings = new ArrayList<>();
        for (JsonNode item : node.path("warnings")) {
            String warning = item.asText("").trim();
            if (!warning.isEmpty()) {
                warnings.add(warning);
            }
        }
        return warnings;
    }

    private String extractCodePayload(String source) {
        if (source == null || source.isBlank()) {
            return null;
        }

        Matcher fencedMatcher = Pattern.compile("```(?:\\w+)?\\s*([\\s\\S]*?)\\s*```")
                .matcher(source);
        if (fencedMatcher.find()) {
            String code = fencedMatcher.group(1).strip();
            return code.isEmpty() ? null : code;
        }

        String trimmed = source.strip();
        if (looksLikeJavascript(trimmed)) {
            return trimmed;
        }

        return null;
    }

    /**
     * 后端兜底归一化：模型即使不按提示词输出 fenced code block，
     * 也要把明显的 JS 代码包装起来，便于前端进入 Diff 对比。
     */
    private String normalizeCodeReply(String reply) {
        if (reply == null || reply.isBlank() || reply.contains("```")) {
            return reply;
        }

        String trimmed = reply.strip();
        if (!looksLikeJavascript(trimmed)) {
            return reply;
        }

        return "已生成代码，请在编辑器中对比后确认：\n```javascript\n"
                + trimmed
                + "\n```";
    }

    private boolean looksLikeJavascript(String text) {
        return text.contains("ScadaBridge.")
                || text.contains("vars.")
                || text.contains("components.")
                || text.contains("message.")
                || text.contains("setInterval(")
                || text.contains("document.")
                || text.matches("(?s).*\\b(const|let|var|function)\\s+[A-Za-z_$][\\w$]*.*");
    }

    private boolean isCodeTask(List<Map<String, Object>> glmMessages) {
        if (glmMessages == null || glmMessages.isEmpty()) {
            return false;
        }

        Object content = glmMessages.get(glmMessages.size() - 1).get("content");
        String text = String.valueOf(content);

        return text.contains("【当前文件】")
                && (
                text.contains(".js")
                        || text.contains("完整HTML")
                        || text.contains("HTML 编辑")
                        || text.contains("CSS 编辑")
                        || text.contains("JS 编辑")
                        || text.contains("【当前完整代码】")
        )
                && !text.contains("文件: props.json");
    }

    private boolean isCodeTaskRequest(List<AiChatDto.ConversationMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return false;
        }

        String text = String.valueOf(messages.get(messages.size() - 1).content());
        return text.contains("【当前文件】")
                && (
                text.contains(".js")
                        || text.contains("完整HTML")
                        || text.contains("HTML 编辑")
                        || text.contains("CSS 编辑")
                        || text.contains("JS 编辑")
                        || text.contains("【当前完整代码】")
        )
                && !text.contains("文件: props.json");
    }

    private String prepareContentForParse(
            String content,
            boolean codeTask,
            String explicitTaskKind
    ) {
        String trimmed = content.strip();

        String normalizedTaskKind = aiTaskRouter.normalizeTaskKind(explicitTaskKind);
        if ("variables_edit".equals(normalizedTaskKind)
                || "props_edit".equals(normalizedTaskKind)
                || "custom_html_edit".equals(normalizedTaskKind)
                || "layout".equals(normalizedTaskKind)) {
            return evalNumericExpressions(extractJson(trimmed));
        }

        if ("script_edit".equals(normalizedTaskKind)) {
            if (trimmed.startsWith("{")
                    || trimmed.startsWith("[")
                    || trimmed.startsWith("```json")) {
                return evalNumericExpressions(extractJson(trimmed));
            }

            return trimmed;
        }

        if (!codeTask) {
            return evalNumericExpressions(extractJson(trimmed));
        }

        if (trimmed.startsWith("```json")
                || trimmed.startsWith("{")
                || trimmed.startsWith("[")) {
            return evalNumericExpressions(extractJson(trimmed));
        }

        return trimmed;
    }

    private String normalizeJsonForParsing(String json) {
        return stripJsonComments(json)
                .replaceAll(",\\s*(?=[}\\]])", "")
                .strip();
    }

    private String stripJsonComments(String source) {
        StringBuilder output = new StringBuilder();
        boolean inString = false;
        boolean escaped = false;

        for (int i = 0; i < source.length(); i++) {
            char current = source.charAt(i);
            char next = i + 1 < source.length() ? source.charAt(i + 1) : '\0';

            if (inString) {
                output.append(current);
                if (escaped) {
                    escaped = false;
                } else if (current == '\\') {
                    escaped = true;
                } else if (current == '"') {
                    inString = false;
                }
                continue;
            }

            if (current == '"') {
                inString = true;
                output.append(current);
                continue;
            }

            if (current == '/' && next == '/') {
                while (i < source.length() && source.charAt(i) != '\n') {
                    i++;
                }
                if (i < source.length()) {
                    output.append('\n');
                }
                continue;
            }

            if (current == '/' && next == '*') {
                i += 2;
                while (i < source.length()
                        && !(source.charAt(i) == '*' && i + 1 < source.length()
                        && source.charAt(i + 1) == '/')) {
                    i++;
                }
                i++;
                continue;
            }

            output.append(current);
        }

        return output.toString();
    }

    /** 从 LLM 输出中提取纯 JSON（兼容 markdown 代码块及 JSON 前后有多余说明文字的情况） */
    /**
     * 对 actions 列表中 update_node / add_node 的 patch/position 坐标和尺寸字段取整，
     * 避免 AI 返回浮点数（如 203.6）导致画布位置不精确。
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> roundPatchCoords(List<Map<String, Object>> actions) {
        if (actions == null) return List.of();
        for (Map<String, Object> action : actions) {
            roundMapNumbers((Map<String, Object>) action.get("patch"),
                    "x", "y", "width", "height", "zIndex");
            roundMapNumbers((Map<String, Object>) action.get("position"),
                    "x", "y");
            if (action.get("props") instanceof Map<?, ?> props) {
                roundMapNumbers((Map<String, Object>) props,
                        "x", "y", "width", "height");
            }
        }
        return actions;
    }

    private void roundMapNumbers(Map<String, Object> map, String... keys) {
        if (map == null) return;
        for (String key : keys) {
            if (map.get(key) instanceof Number n) {
                map.put(key, (long) Math.round(n.doubleValue()));
            }
        }
    }

    /**
     * 将 JSON 字符串中数值位置的简单算术表达式（整数加减）替换为计算结果。
     * 例如：{"y": 120 - 20} → {"y": 100}
     * 仅处理字符串值之外的 +/- 运算，避免误改字符串内容。
     */
    private String evalNumericExpressions(String json) {
        // 匹配 JSON 值位置的「整数 [+-] 整数」模式（前后不是引号内内容）
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "(:\\s*)([-]?\\d+)\\s*([+\\-])\\s*(\\d+)(?=[,}\\]])");
        java.util.regex.Matcher m = p.matcher(json);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            long a   = Long.parseLong(m.group(2));
            long b   = Long.parseLong(m.group(4));
            long res = "+".equals(m.group(3)) ? a + b : a - b;
            m.appendReplacement(sb, m.group(1) + res);
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String extractJson(String content) {
        String trimmed = content.strip();
        // 1. 去除 markdown 代码块包裹（如 ```json ... ```）
        if (trimmed.startsWith("```")) {
            int newline = trimmed.indexOf('\n');
            int end = trimmed.lastIndexOf("```");
            if (newline > -1 && end > newline) {
                trimmed = trimmed.substring(newline + 1, end).strip();
            }
        }
        // 2. 定位首个 JSON 对象或数组起始位置（兼容 LLM 在 JSON 前插入说明文字）
        int objStart = trimmed.indexOf('{');
        int arrStart = trimmed.indexOf('[');
        if (objStart == -1 && arrStart == -1) return trimmed;
        int start;
        char open, close;
        if (objStart == -1 || (arrStart != -1 && arrStart < objStart)) {
            start = arrStart; open = '['; close = ']';
        } else {
            start = objStart; open = '{'; close = '}';
        }
        // 3. 深度计数扫描，正确忽略字符串内的括号，找到匹配末尾括号
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int i = start; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (escaped) { escaped = false; continue; }
            if (c == '\\' && inString) { escaped = true; continue; }
            if (c == '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c == open) depth++;
            else if (c == close) {
                depth--;
                if (depth == 0) return trimmed.substring(start, i + 1);
            }
        }
        return trimmed.substring(start);
    }

    private AiChatDto.Response salvageMalformedLayoutResponse(String source) {
        String reply = extractReplyFromMalformedJson(source);
        List<Map<String, Object>> actions = new ArrayList<>();
        actions.addAll(collectJsonObjectActions(source));
        actions.addAll(collectTupleLikeActions(source));
        List<Map<String, Object>> deduped = dedupeActions(actions);

        if (deduped.isEmpty()) {
            return null;
        }

        log.warn("[AiDev] 从非标准响应中恢复 {} 个 actions", deduped.size());
        return new AiChatDto.Response(
                reply != null && !reply.isBlank()
                        ? reply
                        : "已从异常格式响应中恢复 " + deduped.size() + " 个操作",
                roundPatchCoords(deduped)
        );
    }

    private String extractReplyFromMalformedJson(String source) {
        Matcher matcher = Pattern.compile("\\\"reply\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"",
                Pattern.DOTALL).matcher(source);
        if (!matcher.find()) {
            return null;
        }

        return parseJsonStringLiteral(matcher.group(1));
    }

    private String parseJsonStringLiteral(String rawValue) {
        try {
            return objectMapper.readValue("\"" + rawValue + "\"", String.class);
        } catch (Exception ignored) {
            return rawValue;
        }
    }

    private List<Map<String, Object>> collectJsonObjectActions(String source) {
        List<Map<String, Object>> actions = new ArrayList<>();
        for (int index = 0; index < source.length(); index++) {
            if (source.charAt(index) != '{') {
                continue;
            }

            BalancedSegment segment = extractBalancedSegment(source, index, '{', '}');
            if (segment == null) {
                continue;
            }

            try {
                JsonNode node = objectMapper.readTree(segment.text());
                if (!node.isObject()) {
                    index = segment.endIndex();
                    continue;
                }

                String actionType = node.path("type").asText("");
                if (SUPPORTED_ACTION_TYPES.contains(actionType)) {
                    actions.add(objectMapper.convertValue(node, Map.class));
                }
            } catch (Exception ignored) {
                // 忽略无法独立解析的片段，继续向后扫描。
            }

            index = segment.endIndex();
        }

        return actions;
    }

    private List<Map<String, Object>> collectTupleLikeActions(String source) {
        List<Map<String, Object>> actions = new ArrayList<>();
        collectMalformedUpdatePageActions(source, actions);
        collectMalformedUpdateNodeActions(source, actions);
        collectMalformedSelectNodeActions(source, actions);
        return actions;
    }

    private void collectMalformedUpdatePageActions(String source, List<Map<String, Object>> actions) {
        Matcher matcher = Pattern.compile("\\\"update_page\\\"\\s*,\\s*\\\"patch\\\"\\s*:\\s*")
                .matcher(source);
        while (matcher.find()) {
            BalancedSegment patchSegment = extractBalancedSegment(source, matcher.end(), '{', '}');
            if (patchSegment == null) {
                continue;
            }

            try {
                Map<String, Object> action = new LinkedHashMap<>();
                action.put("type", "update_page");
                action.put("patch", objectMapper.readValue(patchSegment.text(), Map.class));
                actions.add(action);
            } catch (Exception ignored) {
                // 忽略损坏的 patch 片段。
            }
        }
    }

    private void collectMalformedUpdateNodeActions(String source, List<Map<String, Object>> actions) {
        Matcher matcher = Pattern.compile("\\\"update_node\\\"\\s*,\\s*\\\"([^\\\"\\\\]+)\\\"\\s*,\\s*\\\"patch\\\"\\s*:\\s*")
                .matcher(source);
        while (matcher.find()) {
            BalancedSegment patchSegment = extractBalancedSegment(source, matcher.end(), '{', '}');
            if (patchSegment == null) {
                continue;
            }

            try {
                Map<String, Object> action = new LinkedHashMap<>();
                action.put("type", "update_node");
                action.put("nodeId", matcher.group(1));
                action.put("patch", objectMapper.readValue(patchSegment.text(), Map.class));
                actions.add(action);
            } catch (Exception ignored) {
                // 忽略损坏的 patch 片段。
            }
        }
    }

    private void collectMalformedSelectNodeActions(String source, List<Map<String, Object>> actions) {
        Matcher matcher = Pattern.compile("\\\"select_node\\\"\\s*,\\s*\\\"([^\\\"\\\\]+)\\\"")
                .matcher(source);
        while (matcher.find()) {
            Map<String, Object> action = new LinkedHashMap<>();
            action.put("type", "select_node");
            action.put("nodeId", matcher.group(1));
            actions.add(action);
        }
    }

    private List<Map<String, Object>> dedupeActions(List<Map<String, Object>> actions) {
        List<Map<String, Object>> deduped = new ArrayList<>();
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (Map<String, Object> action : actions) {
            try {
                String key = objectMapper.writeValueAsString(action);
                if (seen.add(key)) {
                    deduped.add(action);
                }
            } catch (Exception ignored) {
                deduped.add(action);
            }
        }
        return deduped;
    }

    private BalancedSegment extractBalancedSegment(String source, int startIndex, char openChar, char closeChar) {
        if (startIndex < 0 || startIndex >= source.length() || source.charAt(startIndex) != openChar) {
            return null;
        }

        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int index = startIndex; index < source.length(); index++) {
            char current = source.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (current == '\\' && inString) {
                escaped = true;
                continue;
            }
            if (current == '"') {
                inString = !inString;
                continue;
            }
            if (inString) {
                continue;
            }
            if (current == openChar) {
                depth++;
                continue;
            }
            if (current == closeChar) {
                depth--;
                if (depth == 0) {
                    return new BalancedSegment(source.substring(startIndex, index + 1), index);
                }
            }
        }

        return null;
    }

    private record BalancedSegment(String text, int endIndex) {}
}
