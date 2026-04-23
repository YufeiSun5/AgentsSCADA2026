/**
 * 开发/测试阶段 AI 编排接口。
 * 调用后端 /api/dev/ai/chat，将自然语言指令转换为画布动作列表。
 * 支持多轮对话：每次调用携带完整的对话历史。
 */
import http from './http';

const AI_LAYOUT_DEBUG_PREFIX = '[AiLayoutAssistant]';
const AI_ACTION_TYPES = new Set(['update_page', 'add_node', 'update_node', 'select_node']);

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
  resultType?: string | null;
  result?: unknown;
  warnings?: string[];
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

function extractBalancedSegment(source: string, startIndex: number, openChar: string, closeChar: string) {
  if (startIndex < 0 || source[startIndex] !== openChar) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const current = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (current === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (current === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (current === openChar) {
      depth += 1;
      continue;
    }
    if (current === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          text: source.slice(startIndex, index + 1),
          endIndex: index,
        };
      }
    }
  }

  return null;
}

function parseJsonStringLiteral(rawValue: string) {
  try {
    return JSON.parse(`"${rawValue}"`) as string;
  } catch {
    return rawValue;
  }
}

function extractReplyFromMalformedJson(source: string) {
  const match = source.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/s);
  if (!match) {
    return null;
  }

  return parseJsonStringLiteral(match[1]);
}

function isAiAction(value: unknown): value is AiAction {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && AI_ACTION_TYPES.has(String((value as { type?: unknown }).type || ''));
}

function collectJsonObjectActions(source: string) {
  const actions: AiAction[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '{') {
      continue;
    }

    const segment = extractBalancedSegment(source, index, '{', '}');
    if (!segment) {
      continue;
    }

    try {
      const parsed = JSON.parse(segment.text) as unknown;
      if (isAiAction(parsed)) {
        actions.push(parsed);
      }
    } catch {
      // ignore malformed object fragments
    }

    index = segment.endIndex;
  }

  return actions;
}

function collectTupleLikeActions(source: string) {
  const actions: AiAction[] = [];
  const updateNodePattern = /"update_node"\s*,\s*"([^"\\]+)"\s*,\s*"patch"\s*:\s*/g;
  let updateNodeMatch: RegExpExecArray | null;

  while ((updateNodeMatch = updateNodePattern.exec(source)) !== null) {
    const patchStart = updateNodePattern.lastIndex;
    const patchSegment = extractBalancedSegment(source, patchStart, '{', '}');
    if (!patchSegment) {
      continue;
    }

    try {
      const patch = JSON.parse(patchSegment.text) as Record<string, unknown>;
      actions.push({
        type: 'update_node',
        nodeId: updateNodeMatch[1],
        patch,
      });
    } catch {
      // ignore malformed patch fragments
    }

    updateNodePattern.lastIndex = patchSegment.endIndex + 1;
  }

  const selectNodePattern = /"select_node"\s*,\s*"([^"\\]+)"/g;
  let selectNodeMatch: RegExpExecArray | null;
  while ((selectNodeMatch = selectNodePattern.exec(source)) !== null) {
    actions.push({
      type: 'select_node',
      nodeId: selectNodeMatch[1],
    });
  }

  return actions;
}

function dedupeActions(actions: AiAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = JSON.stringify({
      type: action.type,
      nodeId: action.nodeId || '',
      nodeType: action.nodeType || '',
      title: action.title || '',
      patch: action.patch || null,
      position: action.position || null,
      props: action.props || null,
    });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function salvageMalformedAiResult(source: string): Partial<AiChatResult> | null {
  const reply = extractReplyFromMalformedJson(source) || source;
  const actions = dedupeActions([
    ...collectJsonObjectActions(source),
    ...collectTupleLikeActions(source),
  ]);

  if (actions.length === 0) {
    return null;
  }

  console.warn(`${AI_LAYOUT_DEBUG_PREFIX} 从非标准 JSON 中恢复 actions`, {
    actionCount: actions.length,
    actionTypes: actions.map((action) => action.type),
  });

  return {
    reply,
    actions,
  };
}

function parseEmbeddedAiResult(rawReply: string): Partial<AiChatResult> | null {
  const trimmedReply = rawReply.trim();
  if (!trimmedReply) {
    return null;
  }

  const fencedMatch = trimmedReply.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmedReply;

  if (!candidate.startsWith('{') || !candidate.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate) as Partial<AiChatResult> & { reply?: unknown; actions?: unknown };
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const nextReply = typeof parsed.reply === 'string' ? parsed.reply : rawReply;
    const nextActions = Array.isArray(parsed.actions) ? parsed.actions as AiAction[] : [];
    if (!nextActions.length && nextReply === rawReply) {
      return null;
    }

    console.info(`${AI_LAYOUT_DEBUG_PREFIX} 从 reply 文本中解析到嵌入式 JSON`, {
      replyLength: rawReply.length,
      actionCount: nextActions.length,
      actionTypes: nextActions.map((action) => action.type),
    });

    return {
      reply: nextReply,
      actions: nextActions,
    };
  } catch {
    return salvageMalformedAiResult(candidate);
  }
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
  console.groupCollapsed(`${AI_LAYOUT_DEBUG_PREFIX} 前端发送 AI 编排请求`);
  console.info('发送消息数', messages.length);
  console.info('页面组件数', nodes.length);
  console.info('最后一条消息', messages[messages.length - 1]?.content || '');
  console.table(nodes.map((node) => ({
    id: node.id,
    type: node.type,
    title: node.title,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  })));
  console.groupEnd();

  // LLM 响应可能较慢，单独设置 60s 超时
  const response = await http.post<{ code: number; data: AiChatResult }>(
    '/dev/ai/chat',
    { messages, nodes },
    { timeout: 60_000 },
  );
  const result = response.data.data;
  const rawReply = result?.reply ?? '';
  const rawActions = Array.isArray(result?.actions) ? result.actions : [];

  console.groupCollapsed(`${AI_LAYOUT_DEBUG_PREFIX} 前端收到 AI 响应`);
  console.info('reply', rawReply);
  console.info('actionCount', rawActions.length);
  console.table(rawActions.map((action, index) => ({
    index,
    type: action.type,
    nodeId: action.nodeId || '',
    nodeType: action.nodeType || '',
    title: action.title || '',
    patchKeys: action.patch ? Object.keys(action.patch).join(',') : '',
  })));
  console.groupEnd();

  if (rawActions.length === 0 && typeof rawReply === 'string') {
    const embedded = parseEmbeddedAiResult(rawReply);
    if (embedded) {
      return {
        reply: embedded.reply ?? rawReply,
        actions: Array.isArray(embedded.actions) ? embedded.actions : [],
        resultType: result?.resultType ?? null,
        result: result?.result ?? null,
        warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      };
    }
  }

  // 防御 GLM 省略 actions 字段（返回 null 或 undefined）的情况
  return {
    reply: rawReply,
    actions: rawActions,
    resultType: result?.resultType ?? null,
    result: result?.result ?? null,
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
  };
}
