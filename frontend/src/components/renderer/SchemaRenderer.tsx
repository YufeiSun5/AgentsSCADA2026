import type { ComponentNode, PageSchema } from '../../schema/pageSchema';
import type { CSSProperties } from 'react';
import {
  ButtonMaterial,
  ChartMaterial,
  ContainerMaterial,
  InputMaterial,
  TableMaterial,
  TextMaterial,
} from '../materials';

interface SchemaRendererProps {
  page: PageSchema;
  node?: ComponentNode;
  interactive?: boolean;
  onRunScript?: (script: string | undefined, node: ComponentNode) => void;
}

function renderNode(
  page: PageSchema,
  node: ComponentNode,
  interactive: boolean,
  onRunScript?: (script: string | undefined, node: ComponentNode) => void,
  isRoot = false,
): JSX.Element {
  const style = {
    width: '100%',
    height: '100%',
  } as CSSProperties;

  if (isRoot) {
    const canvasWidth = Number(node.props.canvasWidth || 1600);
    const canvasHeight = Number(node.props.canvasHeight || 900);
    const gridSize = Number(node.props.gridSize || 20);
    const background = String(node.props.background || '#081622');

    return (
      <div
        className="schema-canvas-root"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          borderRadius: Number(node.props.borderRadius || 24),
          background,
          backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      >
        {node.children.map((child) => {
          const x = Number(child.props.x || 0);
          const y = Number(child.props.y || 0);
          const width = Number(child.props.width || 240);
          const height = Number(child.props.height || 60);
          const zIndex = Number(child.props.zIndex || 1);

          return (
            <div
              key={child.id}
              className="schema-canvas-item"
              style={{
                left: x,
                top: y,
                width,
                height,
                zIndex,
              }}
            >
              {renderNode(page, child, interactive, onRunScript)}
            </div>
          );
        })}
      </div>
    );
  }

  switch (node.type) {
    case 'container':
      return (
        <ContainerMaterial
          page={page}
          node={node}
          interactive={interactive}
          onRunScript={onRunScript}
          renderChild={renderNode}
        />
      );
    case 'text':
      return <TextMaterial page={page} node={node} />;
    case 'button':
      return (
        <ButtonMaterial
          page={page}
          node={node}
          interactive={interactive}
          onRunScript={onRunScript}
        />
      );
    case 'input':
      return <InputMaterial page={page} node={node} />;
    case 'table':
      return <TableMaterial page={page} node={node} />;
    case 'chart':
      return <ChartMaterial page={page} node={node} />;
    default:
      return <TextMaterial page={page} node={{ ...node, props: { ...node.props, text: '未知组件' } }} />;
  }
}

export default function SchemaRenderer({ page, node, interactive = false, onRunScript }: SchemaRendererProps) {
  const currentNode = node ?? page.root;
  return renderNode(page, currentNode, interactive, onRunScript, !node);
}