import { Typography } from 'antd';
import type { CSSProperties } from 'react';
import type { ComponentNode, PageSchema } from '../../schema/pageSchema';
import type { MaterialRenderProps } from './materialTypes';

interface ContainerMaterialProps extends MaterialRenderProps {
  renderChild: (
    page: PageSchema,
    node: ComponentNode,
    interactive: boolean,
    onRunScript?: (script: string | undefined, node: ComponentNode) => void,
  ) => JSX.Element;
}

export default function ContainerMaterial({
  page,
  node,
  interactive = false,
  onRunScript,
  renderChild,
}: ContainerMaterialProps) {
  const style = {
    width: '100%',
    height: '100%',
  } as CSSProperties;

  return (
    <div
      style={{
        ...style,
        background: String(node.props.background || '#ffffff'),
        padding: Number(node.props.padding || 16),
        borderRadius: Number(node.props.borderRadius || 16),
        minHeight: Number(node.props.minHeight || 120),
        border: '1px solid rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
      }}
    >
      {node.children.length > 0 ? (
        <div className="schema-canvas-root schema-canvas-child-root">
          {node.children.map((child) => (
            <div
              key={child.id}
              className="schema-canvas-item"
              style={{
                left: Number(child.props.x || 0),
                top: Number(child.props.y || 0),
                width: Number(child.props.width || 240),
                height: Number(child.props.height || 60),
                zIndex: Number(child.props.zIndex || 1),
              }}
            >
              {renderChild(page, child, interactive, onRunScript)}
            </div>
          ))}
        </div>
      ) : (
        <Typography.Text type="secondary">空容器</Typography.Text>
      )}
    </div>
  );
}