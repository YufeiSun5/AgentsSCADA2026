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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const [editorOpenRequest, setEditorOpenRequest] = useState<EditorOpenRequest | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastDragDeltaRef = useRef({ x: 0, y: 0 });
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

  if (loading) {
    return <Spin size="large" />;
  }

  if (!schema) {
    return <Empty description="未找到页面配置" />;
  }

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

  return (
    <div className="editor-page">
      <EditorToolbar
        schema={schema}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onPreview={() => navigate(`/preview/${schema.id}`)}
        onSave={async () => {
          const saved = await savePage(schema);
          setSchema(saved);
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
          <aside className="editor-side-left">
            <MaterialPalette />
          </aside>
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
            />
          </aside>
        </div>
      </DndContext>
    </div>
  );
}