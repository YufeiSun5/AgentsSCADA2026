/**
 * 开发/测试阶段 AI 编排接口。
 * 调用后端 /api/dev/ai/chat，将自然语言指令转换为画布动作列表。
 * 支持多轮对话：每次调用携带完整的对话历史。
 */
import http from './http';

/** 单条 AI 动作（与后端 AiChatDto.Response.actions 对应） */
export interface AiAction {
  type: 'update_page' | 'add_node' | 'update_node' | 'select_node';
  /** update_page */
  patch?: Record<string, unknown>;
  /** add_node */
  nodeType?: string;
  position?: { x: number; y: number };
  title?: string;
  props?: Record<string, unknown>;
  /** update_node / select_node */
  nodeId?: string;
}

export interface AiChatResult {
  reply: string;
  actions: AiAction[];
}

/** 单条对话消息（与后端 AiChatDto.ConversationMessage 对应） */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 简化组件节点（与后端 AiChatDto.NodeSummary 对应，含位置与尺寸供 AI 计算坐标） */
export interface NodeSummary {
  id: string;
  type: string;
  title: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * 调用后端 AI 接口（多轮对话）。
 * @param messages 完整的对话历史（不含系统消息）
 * @param nodes    当前画布组件列表（仅 id/type/title，按需提供）
 */
export async function callAiChat(
  messages: ConversationMessage[],
  nodes: NodeSummary[],
): Promise<AiChatResult> {
  // LLM 响应可能较慢，单独设置 60s 超时
  const response = await http.post<{ code: number; data: AiChatResult }>(
    '/dev/ai/chat',
    { messages, nodes },
    { timeout: 60_000 },
  );
  const result = response.data.data;
  // 防御 GLM 省略 actions 字段（返回 null 或 undefined）的情况
  return {
    reply: result?.reply ?? '',
    actions: Array.isArray(result?.actions) ? result.actions : [],
  };
}
