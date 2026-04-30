/*
 * 编辑页控制器。
 * 负责串联画布拖拽、右侧面板和多组件代码编辑器请求。
 */
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Empty, Spin, message } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AiWorkbench, { type AiWorkbenchTarget } from '../../components/editor/AiWorkbench';
import CanvasArea, { CANVAS_ROOT_ID } from '../../components/editor/CanvasArea';
import ConfigPanel from '../../components/editor/ConfigPanel';
import EditorToolbar from '../../components/editor/EditorToolbar';
import MaterialPalette from '../../components/editor/MaterialPalette';
import { findNodeById } from '../../schema/pageSchema';
import { getPage, savePage } from '../../services/pageService';
import { useEditorStore } from '../../stores/editorStore';

interface EditorOpenRequest {
  nodeId: string;
  nonce: number;
}

export default function EditorPage() {
  const navigate = useNavigate();
  const { pageId = 'demo' } = useParams();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [loading, setLoading] = useState(true);
  const [aiAssistantVisible, setAiAssistantVisible] = useState(false);
  const [aiWorkbenchTarget, setAiWorkbenchTarget] = useState<AiWorkbenchTarget>({ scope: 'layout' });
  const [editorOpenRequest, setEditorOpenRequest] = useState<EditorOpenRequest | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastDragDeltaRef = useRef({ x: 0, y: 0 });

  // 左右面板折叠状态
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // 折叠后浮动按钮的屏幕位置
  const [leftBtnPos, setLeftBtnPos] = useState({ x: 8, y: 220 });
  const [rightBtnPos, setRightBtnPos] = useState(() => ({ x: window.innerWidth - 44, y: 220 }));
  // 浮动按钮拖拽 ref
  const collapseTabDragRef = useRef<{
    side: 'left' | 'right';
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const collapseTabMovedRef = useRef(false);
  const {
    schema,
    selectedId,
    history,
    future,
    setSchema,
    selectNode,
    addNode,
    startNodeMove,
    moveNode,
    commitNodeMove,
    cancelNodeMove,
    updateNodeName,
    updateSelectedName,
    updateNodeTitle,
    updateSelectedTitle,
    updateNodeProps,
    updateSelectedProps,
    replaceNodeProps,
    replaceSelectedProps,
    updateNodeVariables,
    updateSelectedVariables,
    updateNodeScripts,
    updateSelectedScripts,
    updatePageVariables,
    updatePageScripts,
    updatePageSettings,
    bringSelectedToFront,
    sendSelectedToBack,
    moveSelectedForward,
    moveSelectedBackward,
    deleteSelectedNode,
    undo,
    redo,
  } = useEditorStore();

  useEffect(() => {
    const loadSchema = async () => {
      setLoading(true);
      try {
        const result = await getPage(pageId);
        if (result) {
          setSchema(result);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadSchema();
  }, [pageId, setSchema]);

  const selectedNode = useMemo(() => {
    if (!schema || !selectedId) {
      return null;
    }
    return findNodeById(schema.root, selectedId);
  }, [schema, selectedId]);

  // 面板收起按钮的拖拽监听
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = collapseTabDragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      const newPos = { x: drag.originX + dx, y: drag.originY + dy };
      if (drag.side === 'left') setLeftBtnPos(newPos);
      else setRightBtnPos(newPos);
    };
    const onUp = () => {
      collapseTabMovedRef.current = collapseTabDragRef.current?.moved ?? false;
      collapseTabDragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (loading) {
    return <Spin size="large" />;
  }

  if (!schema) {
    return <Empty description="未找到页面配置" />;
  }

  const revealNodeInCanvas = (nodeId: string) => {
    selectNode(nodeId);
    window.requestAnimationFrame(() => {
      const latest_schema = useEditorStore.getState().schema;
      const latest_node = latest_schema ? findNodeById(latest_schema.root, nodeId) : null;
      const canvas_element = canvasRef.current;
      const scroll_container = canvas_element?.closest('.canvas-stage-scroll');

      if (!latest_node || !scroll_container) {
        return;
      }

      const x = Number(latest_node.props.x || 0);
      const y = Number(latest_node.props.y || 0);

      scroll_container.scrollTo({
        left: Math.max(0, x - 120),
        top: Math.max(0, y - 120),
        behavior: 'smooth',
      });
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeKind = event.active.data.current?.kind;

    lastDragDeltaRef.current = { x: 0, y: 0 };

    if (activeKind === 'canvas-item') {
      startNodeMove(String(event.active.id));
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const activeKind = event.active.data.current?.kind;

    if (activeKind !== 'canvas-item') {
      return;
    }

    const deltaX = event.delta.x - lastDragDeltaRef.current.x;
    const deltaY = event.delta.y - lastDragDeltaRef.current.y;

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    moveNode(String(event.active.id), {
      x: deltaX,
      y: deltaY,
    });

    lastDragDeltaRef.current = {
      x: event.delta.x,
      y: event.delta.y,
    };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeKind = active.data.current?.kind;

    if (!over) {
      if (activeKind === 'canvas-item') {
        cancelNodeMove();
        lastDragDeltaRef.current = { x: 0, y: 0 };
      }
      return;
    }

    if (activeKind === 'palette') {
      const componentType = active.data.current?.componentType;
      if (componentType) {
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const translated = active.rect.current.translated;

        if (canvasRect && translated) {
          addNode(componentType, {
            x: translated.left - canvasRect.left,
            y: translated.top - canvasRect.top,
          });
        } else {
          addNode(componentType);
        }
      }
      return;
    }

    if (activeKind === 'canvas-item') {
      commitNodeMove();
      lastDragDeltaRef.current = { x: 0, y: 0 };
    }
  };

  const handleDragCancel = () => {
    cancelNodeMove();
    lastDragDeltaRef.current = { x: 0, y: 0 };
  };

  const handleDragEndWithPalette = (event: DragEndEvent) => {
    const activeKind = event.active.data.current?.kind;

    if (activeKind === 'palette') {
      handleDragEnd(event);
      return;
    }

    handleDragEnd(event);
  };

  // 启动浮动按钮拖拽
  const startCollapseTabDrag = (e: React.MouseEvent, side: 'left' | 'right') => {
    const pos = side === 'left' ? leftBtnPos : rightBtnPos;
    collapseTabDragRef.current = {
      side,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  };

  // 点击浮动按钮展开面板（若为拖拽操作则忽略点击）
  const handleCollapseTabClick = (side: 'left' | 'right') => {
    if (collapseTabMovedRef.current) {
      collapseTabMovedRef.current = false;
      return;
    }
    if (side === 'left') setLeftCollapsed(false);
    else setRightCollapsed(false);
  };

  return (
    <div className="editor-page">
      <EditorToolbar
        schema={schema}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        aiVisible={aiAssistantVisible}
        onUndo={undo}
        onRedo={redo}
        onToggleAiAssistant={() => {
          setAiWorkbenchTarget({ scope: 'layout', label: '页面排版' });
          setAiAssistantVisible((previous) => !previous);
        }}
        onPreview={() => window.open(`/preview/${schema.id}`, '_blank')}
        onSave={async () => {
          const saved = await savePage(schema);
          setSchema(saved, { preserveSelection: true });
          message.success('页面 JSON Schema 已保存');
        }}
      />
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEndWithPalette}
        onDragCancel={handleDragCancel}
      >
        <div className="editor-workspace">
          {!leftCollapsed && (
          <aside className="editor-side-left">
            <MaterialPalette onCollapse={() => setLeftCollapsed(true)} />
          </aside>
          )}
          <main className="editor-main">
            <CanvasArea
              page={schema}
              nodes={schema.root.children}
              selectedId={selectedId}
              onSelect={selectNode}
              canvasRef={canvasRef}
              onOpenEditor={(nodeId) => {
                setEditorOpenRequest({
                  nodeId,
                  nonce: Date.now(),
                });
              }}
              onContextAction={(nodeId, action) => {
                selectNode(nodeId);
                if (action === 'front') {
                  bringSelectedToFront(nodeId);
                }
                if (action === 'back') {
                  sendSelectedToBack(nodeId);
                }
                if (action === 'forward') {
                  moveSelectedForward(nodeId);
                }
                if (action === 'backward') {
                  moveSelectedBackward(nodeId);
                }
                if (action === 'delete') {
                  deleteSelectedNode(nodeId);
                  message.success('组件已删除');
                }
              }}
            />
          </main>
          {!rightCollapsed && (
          <aside className="editor-side-right">
            <ConfigPanel
              page={schema}
              node={selectedNode}
              editorOpenRequest={editorOpenRequest}
              onEditorOpenRequestHandled={() => setEditorOpenRequest(null)}
              onNodeNameChange={updateNodeName}
              onNameChange={updateSelectedName}
              onNodeTitleChange={updateNodeTitle}
              onTitleChange={updateSelectedTitle}
              onNodePropsChange={updateNodeProps}
              onPropsChange={updateSelectedProps}
              onNodePropsReplace={replaceNodeProps}
              onPropsReplace={replaceSelectedProps}
              onNodeVariablesChange={updateNodeVariables}
              onVariablesChange={updateSelectedVariables}
              onNodeScriptsChange={updateNodeScripts}
              onScriptsChange={updateSelectedScripts}
              onPageVariablesChange={updatePageVariables}
              onPageScriptsChange={updatePageScripts}
              onPageSettingsChange={updatePageSettings}
              onOpenAiWorkbench={(target, options) => {
                setAiWorkbenchTarget(target);
                if (options?.reveal !== false) {
                  setAiAssistantVisible(true);
                }
              }}
              onCollapse={() => setRightCollapsed(true)}
            />
          </aside>
          )}
        </div>
      </DndContext>

      {/* 面板收起后的浮动展开按钮，支持自由拖动位置 */}
      {leftCollapsed && (
        <button
          className="panel-float-btn"
          style={{ left: leftBtnPos.x, top: leftBtnPos.y }}
          onMouseDown={(e) => startCollapseTabDrag(e, 'left')}
          onClick={() => handleCollapseTabClick('left')}
          title="展开物料面板"
        >
          <RightOutlined />
        </button>
      )}
      {rightCollapsed && (
        <button
          className="panel-float-btn"
          style={{ left: rightBtnPos.x, top: rightBtnPos.y }}
          onMouseDown={(e) => startCollapseTabDrag(e, 'right')}
          onClick={() => handleCollapseTabClick('right')}
          title="展开配置面板"
        >
          <LeftOutlined />
        </button>
      )}

      <AiWorkbench
        page={schema}
        selectedNode={selectedNode}
        visible={aiAssistantVisible}
        onVisibleChange={setAiAssistantVisible}
        target={aiWorkbenchTarget}
        onTargetChange={setAiWorkbenchTarget}
        onRevealNode={revealNodeInCanvas}
        onAddNode={addNode}
        onUpdatePageSettings={updatePageSettings}
        onUpdateNodeProps={updateNodeProps}
        onUpdateNodeTitle={updateNodeTitle}
        onUpdateNodeScripts={updateNodeScripts}
        onUpdatePageScripts={updatePageScripts}
        onUpdatePageVariables={updatePageVariables}
      />
    </div>
  );
}
