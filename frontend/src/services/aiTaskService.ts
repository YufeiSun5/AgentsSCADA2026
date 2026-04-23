/*
 * 结构化 AI 任务服务。
 * 负责按 taskKind 调用后端统一 AI 接口，减少前端通过 reply 文本猜任务结果。
 */
import http from './http';
import type { AiAction, ConversationMessage, NodeSummary } from './aiService';

export type AiTaskKind =
    | 'layout'
    | 'props_edit'
    | 'script_edit'
    | 'variables_edit'
    | 'custom_html_edit';

export interface AiTaskTarget {
    scope?: string;
    pageId?: string;
    nodeId?: string;
    variableId?: string;
    file?: string;
    componentType?: string;
}

export interface AiTaskRequest {
    taskKind: AiTaskKind;
    messages: ConversationMessage[];
    nodes?: NodeSummary[];
    target?: AiTaskTarget;
    context?: Record<string, unknown>;
}

export interface AiTaskResponse<TResult = unknown> {
    reply: string;
    actions: AiAction[];
    resultType?: string | null;
    result?: TResult | null;
    warnings: string[];
}

export interface AiScriptTaskResult {
    language: string;
    code: string;
}

export interface AiVariablesTaskResult {
    mode?: string;
    variables?: Array<Record<string, unknown>>;
    selectedVariableName?: string;
}

function normalizeTaskResponse<TResult>(payload: Partial<AiTaskResponse<TResult>> | null | undefined) {
    return {
        reply: payload?.reply || '',
        actions: Array.isArray(payload?.actions) ? payload.actions : [],
        resultType: payload?.resultType || null,
        result: payload?.result ?? null,
        warnings: Array.isArray(payload?.warnings)
            ? payload?.warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [],
    } satisfies AiTaskResponse<TResult>;
}

export async function callAiTask<TResult = unknown>(
    request: AiTaskRequest,
): Promise<AiTaskResponse<TResult>> {
    const response = await http.post<{ code: number; data: AiTaskResponse<TResult> }>(
        '/dev/ai/chat',
        {
            taskKind: request.taskKind,
            messages: request.messages,
            nodes: request.nodes || [],
            target: request.target || null,
            context: request.context || {},
        },
        { timeout: 60_000 },
    );

    return normalizeTaskResponse(response.data.data);
}

export async function callAiScriptEditTask(
    request: Omit<AiTaskRequest, 'taskKind'>,
): Promise<AiTaskResponse<AiScriptTaskResult>> {
    return callAiTask<AiScriptTaskResult>({
        ...request,
        taskKind: 'script_edit',
    });
}

export async function callAiVariablesEditTask(
    request: Omit<AiTaskRequest, 'taskKind'>,
): Promise<AiTaskResponse<AiVariablesTaskResult>> {
    return callAiTask<AiVariablesTaskResult>({
        ...request,
        taskKind: 'variables_edit',
    });
}
