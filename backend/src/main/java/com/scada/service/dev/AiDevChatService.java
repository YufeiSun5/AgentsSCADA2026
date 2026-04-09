package com.scada.service.dev;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scada.domain.entity.SysAiProvider;
import com.scada.dto.AiChatDto;
import com.scada.mapper.SysAiProviderMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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

    /** LLM 系统提示词模板，%s 占位符替换为当前组件列表 JSON */
    private static final String SYSTEM_PROMPT = """
            你是一个工业 SCADA 低代码页面编辑平台的 AI 助手，支持两类任务：
            【布局编排】将自然语言转换为画布操作动作列表（reply 描述操作，actions 含动作）
            【代码辅助】帮助编写/优化组件脚本（JavaScript），reply 中含代码或解释，actions 返回 []

            ## 可用组件类型（add_node 时的 nodeType 值）
            - container: 容器/区域/卡片/面板
            - text: 文本/标题/标签
            - button: 按钮/操作键
            - input: 输入框/搜索框
            - table: 表格/列表/台账
            - chart: 图表/趋势图/折线图

            ## 当前页面组件列表（id 是修改/选中操作的唯一标识）
            %s

            ## 响应格式（只输出纯 JSON，不要任何 markdown 代码块包裹）
            {"reply":"用中文简洁描述操作或代码内容","actions":[]}

            ## 支持的 action 类型（仅用于布局编排任务）
            1. {"type":"update_page","patch":{"canvasWidth":1920,"canvasHeight":1080,"background":"#081622"}}
            2. {"type":"add_node","nodeType":"container","position":{"x":24,"y":32},"title":"左侧区域","props":{"width":760,"height":820,"background":"#16324a"}}
            3. {"type":"update_node","nodeId":"ID","patch":{"width":400,"x":100,"y":200},"title":"新标题（可选，省略则不改）"}
               - patch 中的 x/y 表示移动组件位置；width/height 表示调整大小；其他字段修改对应属性
               - 向下移动 50px：patch 中 y = 当前 y + 50；向右移动：x = 当前 x + 50
            4. {"type":"select_node","nodeId":"ID"}

            ## 规则
            - 只输出纯 JSON，不要有任何包裹或说明文字
            - 多个操作放在 actions 数组中顺序执行
            - 修改/选中时必须使用组件列表中真实存在的 id
            - 代码辅助任务时 actions 返回 []，reply 含完整代码
            - 意图不明确时 reply 解释原因，actions 返回 []
            - 坐标和尺寸必须是计算好的整数，禁止输出算术表达式（用 100 而不是 120-20）
            """;

    private final SysAiProviderMapper providerMapper;
    private final ObjectMapper objectMapper;

    /** 单例 HTTP 客户端，连接超时 10s，响应超时 60s，不走系统代理（避免本地 VPN/Clash 干扰 MiniMax API） */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .proxy(ProxySelector.of(null))
            .connectTimeout(Duration.ofSeconds(10))
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

        String systemPrompt = SYSTEM_PROMPT.formatted(nodesJson);

        // 构建完整的 GLM 消息列表：system + 多轮对话历史
        List<Map<String, Object>> glmMessages = new ArrayList<>();
        glmMessages.add(Map.of("role", "system", "content", systemPrompt));
        if (request.messages() != null) {
            for (AiChatDto.ConversationMessage msg : request.messages()) {
                glmMessages.add(Map.of("role", msg.role(), "content", msg.content()));
            }
        }

        log.debug("[AiDev] provider={} model={} turns={}",
                provider.getProviderKey(), provider.getModel(),
                request.messages() != null ? request.messages().size() : 0);

        try {
            return callLlm(provider, glmMessages);
        } catch (Exception e) {
            log.warn("[AiDev] LLM 调用异常: {}", e.getMessage());
            return new AiChatDto.Response("AI 服务调用失败：" + e.getMessage(), List.of());
        }
    }

    /**
     * 向 OpenAI 兼容接口发送请求，解析并返回结构化结果。
     * 端点：POST {baseUrl}/chat/completions，请求头 Authorization: Bearer。
     * baseUrl 已含版本路径（如 GLM: /api/paas/v4），不再拼接 /v1。
     * @param glmMessages 完整消息列表（含 system + 多轮对话）
     */
    private AiChatDto.Response callLlm(SysAiProvider provider, List<Map<String, Object>> glmMessages)
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

        HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

        if (httpResponse.statusCode() != 200) {
            throw new RuntimeException("LLM HTTP " + httpResponse.statusCode() + ": " + httpResponse.body());
        }

        // 提取 OpenAI 响应格式：choices[0].message.content
        JsonNode root = objectMapper.readTree(httpResponse.body());
        String content = root.path("choices").path(0).path("message").path("content").asText("");
        if (content.isBlank()) {
            throw new RuntimeException("LLM 响应中无 content 内容，原始响应：" + httpResponse.body());
        }

        // 去除 LLM 可能返回的 markdown 代码块包裹，并对数值表达式求值（如 120-20 → 100）
        String jsonContent = evalNumericExpressions(extractJson(content));
        log.debug("[AiDev] LLM 原始响应: {}", jsonContent);

        return parseResponse(jsonContent);
    }

    /**
     * 解析 LLM 输出，兼容三种格式：
     * 1. 标准格式：{"reply":"...","actions":[...]}
     * 2. 裸单个 action：{"type":"add_node",...}
     * 3. 裸 action 数组：[{"type":"add_node",...}]
     */
    private AiChatDto.Response parseResponse(String jsonContent) throws Exception {
        JsonNode node;
        try {
            node = objectMapper.readTree(jsonContent);
        } catch (Exception e) {
            log.warn("[AiDev] JSON 解析失败，将原始内容作为 reply 返回. 错误: {}", e.getMessage());
            // LLM 返回了非标准 JSON，将原始内容作为纯文本 reply 返回，避免暴露技术错误
            return new AiChatDto.Response(jsonContent, List.of());
        }

        // 标准格式：顶层有 reply 字段
        if (node.has("reply")) {
            AiChatDto.Response resp = objectMapper.treeToValue(node, AiChatDto.Response.class);
            return new AiChatDto.Response(resp.reply(), roundPatchCoords(resp.actions()));
        }

        // 裸 action 数组
        if (node.isArray()) {
            List<Map<String, Object>> actions = objectMapper.convertValue(
                    node, objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
            return new AiChatDto.Response("已执行 " + actions.size() + " 个操作", actions);
        }

        // 裸单个 action（有 type 字段）
        if (node.has("type")) {
            Map<String, Object> action = objectMapper.convertValue(node,
                    objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
            return new AiChatDto.Response("已执行操作", List.of(action));
        }

        // 兜底：AI 直接返回了修改后的裸 JSON 对象（如 props 修改场景）
        // 将其包装成 markdown 代码块放入 reply，前端可识别并展示 Diff 对比按钮
        try {
            String prettyJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(node);
            String reply = "已为你生成修改后的属性，点击【在编辑器中对比】按钮可预览 Diff：\n```json\n" + prettyJson + "\n```";
            return new AiChatDto.Response(reply, List.of());
        } catch (Exception ex) {
            return new AiChatDto.Response("AI 返回了未知格式，请重试。原始内容：" + jsonContent, List.of());
        }
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
}
