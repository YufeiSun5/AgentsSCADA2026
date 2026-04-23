/*
 * 画布交互模块。
 * 负责组件选中、拖拽、右键菜单和双击打开代码编辑器。
 */
import { Dropdown, Empty, Typography } from 'antd';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { MenuProps } from 'antd';
import type { MouseEvent } from 'react';
import type { MutableRefObject } from 'react';
import type { ComponentNode, PageSchema } from '../../schema/pageSchema';
import SchemaRenderer from '../renderer/SchemaRenderer';

export const CANVAS_ROOT_ID = 'canvas-root';

function CanvasNodeItem({
  page,
  node,
  selected,
  onSelect,
  onContextAction,
  onOpenEditor,
}: {
  page: PageSchema;
  node: ComponentNode;
  selected: boolean;
  onSelect: (id: string) => void;
  onContextAction: (nodeId: string, action: 'front' | 'back' | 'forward' | 'backward' | 'delete') => void;
  onOpenEditor: (nodeId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: {
      kind: 'canvas-item',
    },
  });

  const width = Number(node.props.width || 240);
  const height = Number(node.props.height || 60);
  const x = Number(node.props.x || 0);
  const y = Number(node.props.y || 0);
  const zIndex = Number(node.props.zIndex || 1);
  const menuItems: MenuProps['items'] = [
    { key: 'front', label: '置于最上层' },
    { key: 'forward', label: '上移一层' },
    { type: 'divider' },
    { key: 'backward', label: '下移一层' },
    { key: 'back', label: '置于最下层' },
    { type: 'divider' },
    { key: 'delete', label: '删除组件', danger: true },
  ];

  const handleSelect = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect(node.id);
  };

  const dragBinding = selected
    ? {
        ...attributes,
        ...listeners,
      }
    : {};

  return (
    <Dropdown
      trigger={['contextMenu']}
      menu={{
        items: menuItems,
        onClick: ({ key }) => onContextAction(node.id, key as 'front' | 'back' | 'forward' | 'backward' | 'delete'),
      }}
    >
      <div
        ref={setNodeRef}
        className={selected ? 'canvas-node canvas-node-selected' : 'canvas-node'}
        {...dragBinding}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          height,
          zIndex,
          opacity: isDragging ? 0.78 : 1,
        }}
        onMouseDown={handleSelect}
        onClick={handleSelect}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
          onOpenEditor(node.id);
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
      >
        <SchemaRenderer page={page} node={node} />
      </div>
    </Dropdown>
  );
}

export default function CanvasArea({
  page,
  nodes,
  selectedId,
  onSelect,
  canvasRef,
  onContextAction,
  onOpenEditor,
}: {
  page: PageSchema;
  nodes: ComponentNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  onContextAction: (nodeId: string, action: 'front' | 'back' | 'forward' | 'backward' | 'delete') => void;
  onOpenEditor: (nodeId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_ROOT_ID });
  const canvasWidth = Number(page.root.props.canvasWidth || 1600);
  const canvasHeight = Number(page.root.props.canvasHeight || 900);
  const canvasBackground = String(page.root.props.background || '#081622');
  const gridSize = Number(page.root.props.gridSize || 20);
  const borderRadius = Number(page.root.props.borderRadius || 6);

  const bindCanvasRef = (element: HTMLDivElement | null) => {
    setNodeRef(element);
    canvasRef.current = element;
  };

  return (
    <div className="editor-panel-shell editor-canvas-shell">
      <div className="panel-heading">
        <Typography.Title level={4}>画布区</Typography.Title>
        <Typography.Text type="secondary">固定页面尺寸、自由拖动组件，接近 SCADA 组态编辑方式。</Typography.Text>
      </div>
      <div className={isOver ? 'canvas-drop-zone canvas-drop-zone-over' : 'canvas-drop-zone'} onClick={() => onSelect(null)}>
        <div className="canvas-stage-scroll">
          <div
            ref={bindCanvasRef}
            className="canvas-stage"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              backgroundColor: canvasBackground,
              backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
              borderRadius,
              backgroundSize: `${gridSize}px ${gridSize}px`,
            }}
          >
            {nodes.length === 0 ? (
              <div className="canvas-empty-state">
                <Empty description="拖拽左侧物料到此处开始搭建页面" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              nodes.map((node) => (
                <CanvasNodeItem
                  key={node.id}
                  page={page}
                  node={node}
                  selected={selectedId === node.id}
                  onSelect={onSelect}
                  onContextAction={onContextAction}
                  onOpenEditor={onOpenEditor}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}