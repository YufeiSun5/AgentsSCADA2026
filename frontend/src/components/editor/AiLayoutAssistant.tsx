/*
 * AI 编排助手（浮动对话窗口）。
 * 只保留对话 UI + 多轮 AI 调用，去掉本地规则引擎，支持拖动。
 */
import { CloseOutlined, CopyOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Input, Space, Typography, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  flattenNodes,
  type CanvasPosition,
  type ComponentNode,
  type ComponentType,
  type PageSchema,
} from '../../schema/pageSchema';
import { callAiChat, type AiAction } from '../../services/aiService';

const AI_LAYOUT_DEBUG_PREFIX = '[AiLayoutAssistant]';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AiLayoutAssistantProps {
  page: PageSchema;
  selectedNode: ComponentNode | null;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onRevealNode: (nodeId: string) => void;
  onAddNode: (
    type: ComponentType,
    position?: CanvasPosition,
    options?: {
      title?: string;
      props?: Record<string, unknown>;
    },
  ) => string | null;
  onUpdatePageSettings: (patch: Record<string, unknown>) => void;
  onUpdateNodeProps: (nodeId: string, patch: Record<string, unknown>) => void;
  onUpdateNodeTitle: (nodeId: string, title: string) => void;
  onAfterActionsApplied?: () => Promise<void> | void;
}

function createEntry(role: 'user' | 'assistant', content: string): ChatEntry {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export default function AiLayoutAssistant({
  page,
  selectedNode,
  visible,
  onVisibleChange,
  onRevealNode,
  onAddNode,
  onUpdatePageSettings,
  onUpdateNodeProps,
  onUpdateNodeTitle,
  onAfterActionsApplied,
}: AiLayoutAssistantProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatEntry[]>([
    createEntry('assistant', '你好！我可以帮你调整布局、添加组件、修改属性，直接描述想做什么就行。'),
  ]);

  // 浮窗位置（支持拖动）
  const [pos, setPos] = useState({ x: window.innerWidth - 360, y: 108 });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const historyRef = useRef<HTMLDivElement>(null);

  const existingNodes = useMemo(
    () => flattenNodes(page.root).filter((n) => n.id !== page.root.id),
    [page.root],
  );

  // 当前组件列表（只传 id/type/title，按需构建，不含完整属性）
  const nodes = useMemo(
    () =>
      flattenNodes(page.root)
        .filter((n) => n.id !== page.root.id)
        .map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          // 包含实时位置与尺寸，让 AI 准确计算移动/调整后的坐标
          x: Math.round(Number(n.props.x ?? 0)),
          y: Math.round(Number(n.props.y ?? 0)),
          width: Math.round(Number(n.props.width ?? 0)),
          height: Math.round(Number(n.props.height ?? 0)),
        })),
    [page.root],
  );

  // 新消息时自动滚动到底部
  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  // 全局鼠标事件：处理拖动
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const { startX, startY, originX, originY } = dragRef.current;
      setPos({
        x: Math.min(Math.max(0, originX + e.clientX - startX), window.innerWidth - 340),
        y: Math.min(Math.max(0, originY + e.clientY - startY), window.innerHeight - 120),
      });
    };
    const onUp = () => { dragRef.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!visible) return null;

  const beginDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
  };

  /** 将 LLM 返回的动作列表应用到画布 */
  const applyAiActions = (actions: AiAction[]) => {
    if (!Array.isArray(actions)) return 0;
    let appliedCount = 0;
    const actionLogs: Array<Record<string, unknown>> = [];
    for (const action of actions) {
      if (action.type === 'update_page' && action.patch) {
        onUpdatePageSettings(action.patch);
        appliedCount += 1;
        actionLogs.push({
          type: action.type,
          target: 'page',
          result: 'applied',
          patchKeys: Object.keys(action.patch).join(','),
        });
      } else if (action.type === 'add_node' && action.nodeType) {
        const matchedNode = action.title
          ? existingNodes.find((node) => node.title === action.title && node.type === action.nodeType)
          : undefined;

        if (matchedNode) {
          const patch = {
            ...(action.position ? { x: action.position.x, y: action.position.y } : {}),
            ...(action.props || {}),
          };

          if (Object.keys(patch).length > 0) {
            onUpdateNodeProps(matchedNode.id, patch);
            appliedCount += 1;
          }
          if (action.title && action.title !== matchedNode.title) {
            onUpdateNodeTitle(matchedNode.id, action.title);
          }
          onRevealNode(matchedNode.id);
          actionLogs.push({
            type: action.type,
            target: matchedNode.id,
            result: 'reused-existing-node',
            title: matchedNode.title,
            patchKeys: Object.keys(patch).join(','),
          });
          continue;
        }

        const id = onAddNode(
          action.nodeType as ComponentType,
          action.position as CanvasPosition | undefined,
          { title: action.title, props: action.props },
        );
        if (id) {
          appliedCount += 1;
          onRevealNode(id);
          actionLogs.push({
            type: action.type,
            target: id,
            result: 'added',
            title: action.title || '',
            patchKeys: action.props ? Object.keys(action.props).join(',') : '',
          });
        } else {
          actionLogs.push({
            type: action.type,
            target: action.title || action.nodeType,
            result: 'ignored',
            reason: 'onAddNode-return-null',
          });
        }
      } else if (action.type === 'update_node' && action.nodeId) {
        const matchedNode = existingNodes.find((node) => node.id === action.nodeId);
        if (!matchedNode) {
          actionLogs.push({
            type: action.type,
            target: action.nodeId,
            result: 'missed',
            reason: 'node-not-found',
          });
          continue;
        }

        if (action.patch) onUpdateNodeProps(action.nodeId, action.patch);
        if (action.title) onUpdateNodeTitle(action.nodeId, action.title);
        onRevealNode(action.nodeId);
        appliedCount += 1;
        actionLogs.push({
          type: action.type,
          target: action.nodeId,
          result: 'applied',
          title: matchedNode.title,
          patchKeys: action.patch ? Object.keys(action.patch).join(',') : '',
        });
      } else if (action.type === 'select_node' && action.nodeId) {
        onRevealNode(action.nodeId);
        appliedCount += 1;
        actionLogs.push({
          type: action.type,
          target: action.nodeId,
          result: 'applied',
        });
      } else {
        actionLogs.push({
          type: action.type,
          target: action.nodeId || action.title || action.nodeType || 'unknown',
          result: 'ignored',
          reason: 'action-invalid-or-missing-fields',
        });
      }
    }

    console.groupCollapsed(`${AI_LAYOUT_DEBUG_PREFIX} 前端应用 AI 动作`);
    console.info('总动作数', actions.length);
    console.info('成功应用数', appliedCount);
    console.table(actionLogs);
    console.groupEnd();

    return appliedCount;
  };

  /** 发送消息给 AI，并将结果应用到画布 */
  const executePrompt = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    // 若有选中组件，将其信息前置到用户消息，让 AI 知道操作目标（每次用最新坐标）
    let content = text;
    if (selectedNode) {
      const p = selectedNode.props;
      content = `【当前选中组件（实时）】id=${selectedNode.id} type=${selectedNode.type} title="${selectedNode.title}" x=${Math.round(Number(p.x ?? 0))} y=${Math.round(Number(p.y ?? 0))} width=${Math.round(Number(p.width ?? 0))} height=${Math.round(Number(p.height ?? 0))}\n${text}`;
    }
    const userEntry  = createEntry('user', text);    // 气泡只显示用户实际输入
    const msgEntry   = createEntry('user', content); // 实际发送给 AI（含上下文）
    const nextHistory = [...history, msgEntry];
    setHistory((prev) => [...prev, userEntry]);
    setPrompt('');
    setLoading(true);

    console.groupCollapsed(`${AI_LAYOUT_DEBUG_PREFIX} 准备执行整页排版`);
    console.info('pageId', page.id);
    console.info('pageName', page.name);
    console.info('组件总数', nodes.length);
    console.info('用户输入', text);
    console.info('当前选中组件', selectedNode ? {
      id: selectedNode.id,
      type: selectedNode.type,
      title: selectedNode.title,
    } : null);
    console.groupEnd();

    // assistant 消息重新包装为 JSON 格式，强化 LLM 遵循格式约定，避免多轮后退化为纯文本回复
    const messages = nextHistory.map((e) => {
      if (e.role === 'assistant') {
        return { role: e.role, content: JSON.stringify({ reply: e.content, actions: [] }) };
      }
      return { role: e.role, content: e.content };
    });

    try {
      const result = await callAiChat(messages, nodes);
      const appliedCount = applyAiActions(Array.isArray(result.actions) ? result.actions : []);
      if (appliedCount > 0) {
        await onAfterActionsApplied?.();
        message.success(`AI 编排已应用 ${appliedCount} 个动作`);
      }
      console.info(`${AI_LAYOUT_DEBUG_PREFIX} 本次编排完成`, {
        appliedCount,
        actionCount: Array.isArray(result.actions) ? result.actions.length : 0,
      });
      setHistory((prev) => [...prev, createEntry('assistant', result.reply || '已完成操作')]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${AI_LAYOUT_DEBUG_PREFIX} 前端执行 AI 编排失败`, err);
      setHistory((prev) => [...prev, createEntry('assistant', `AI 调用失败：${msg}`)]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-assistant-window" style={{ left: pos.x, top: pos.y }}>
      {/* 标题栏（拖动手柄） */}
      <div className="ai-assistant-head" onMouseDown={beginDrag}>
        <Space size={6}>
          <RobotOutlined style={{ color: '#38bdf8' }} />
          <Typography.Text strong style={{ color: '#f8fafc', fontSize: 13 }}>
            AI 编排助手
          </Typography.Text>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          style={{ color: '#94a3b8' }}
          onClick={() => onVisibleChange(false)}
        />
      </div>

      {/* 对话历史 */}
      <div className="ai-assistant-history" ref={historyRef}>
        {history.map((entry) => (
          <div
            key={entry.id}
            className={entry.role === 'user' ? 'ai-msg ai-msg-user' : 'ai-msg ai-msg-assistant'}
          >
            <div className="ai-msg-header">
              <span className="ai-msg-role">{entry.role === 'user' ? '你' : 'AI'}</span>
              <button
                className="ai-msg-copy"
                title="复制"
                onClick={() => void navigator.clipboard.writeText(entry.content)}
              >
                <CopyOutlined />
              </button>
            </div>
            <span className="ai-msg-content">{entry.content}</span>
          </div>
        ))}
        {loading && (
          <div className="ai-msg ai-msg-assistant">
            <span className="ai-msg-role">AI</span>
            <span className="ai-msg-content ai-msg-thinking">思考中…</span>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="ai-assistant-footer">
        <Input.TextArea
          value={prompt}
          disabled={loading}
          autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder="描述你想做什么…（Shift+Enter 换行）"
          onChange={(e) => setPrompt(e.target.value)}
          onPressEnter={(e) => {
            if (e.shiftKey) return;
            e.preventDefault();
            void executePrompt(prompt);
          }}
        />
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          loading={loading}
          onClick={() => void executePrompt(prompt)}
        />
      </div>
    </div>
  );
}
