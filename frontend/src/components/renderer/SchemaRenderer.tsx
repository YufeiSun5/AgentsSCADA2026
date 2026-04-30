import type { ComponentNode, PageSchema } from '../../schema/pageSchema';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePageRuntime } from '../../runtime/pageRuntime';
import {
  ButtonMaterial,
  ChartMaterial,
  ContainerMaterial,
  CustomHtmlMaterial,
  ImageMaterial,
  TableMaterial,
  TextMaterial,
} from '../materials';

interface SchemaRendererProps {
  page: PageSchema;
  node?: ComponentNode;
  interactive?: boolean;
  onRunScript?: (script: string | undefined, node: ComponentNode) => void;
}

interface RuntimeNodeShellProps {
  page: PageSchema;
  node: ComponentNode;
  interactive: boolean;
  onRunScript?: (script: string | undefined, node: ComponentNode) => void;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function RuntimeNodeShell({
  page,
  node,
  interactive,
  onRunScript,
}: RuntimeNodeShellProps) {
  const runtime = usePageRuntime();
  const [runtimeProps, setRuntimeProps] = useState<Record<string, unknown>>({});
  const [runtimeStyle, setRuntimeStyle] = useState<CSSProperties>({});
  const [visible, setVisible] = useState(node.props.hidden !== true);
  const [disabled, setDisabled] = useState<boolean | null>(null);

  useEffect(() => {
    setRuntimeProps({});
    setRuntimeStyle({});
    setVisible(node.props.hidden !== true);
    setDisabled(null);
  }, [node.id, node.props.hidden]);

  useEffect(() => {
    return runtime?.registerComponent(node.id, {
      setStyle: (style) => {
        const stylePatch = readRecord(style);
        setRuntimeStyle((previous) => ({
          ...previous,
          ...stylePatch,
        }));
        setRuntimeProps((previous) => ({
          ...previous,
          ...stylePatch,
        }));
      },
      setProps: (props) => {
        const nextProps = readRecord(props);
        const nextStyle = readRecord(nextProps.style);
        const restProps = { ...nextProps };
        delete restProps.style;
        if (Object.keys(nextStyle).length > 0) {
          setRuntimeStyle((previous) => ({
            ...previous,
            ...nextStyle,
          }));
        }
        setRuntimeProps((previous) => ({
          ...previous,
          ...restProps,
        }));
      },
      setVisible: (value) => setVisible(value !== false),
      show: () => setVisible(true),
      hide: () => setVisible(false),
      setDisabled: (value) => setDisabled(value === true),
      enable: () => setDisabled(false),
      disable: () => setDisabled(true),
      resetRuntimeState: () => {
        setRuntimeProps({});
        setRuntimeStyle({});
        setVisible(node.props.hidden !== true);
        setDisabled(null);
      },
    }, [node.name, node.title]);
  }, [runtime, node.id, node.name, node.title, node.props.hidden]);

  const mergedNode = useMemo<ComponentNode>(() => {
    const baseStyle = readRecord(node.props.style);
    return {
      ...node,
      props: {
        ...node.props,
        ...runtimeProps,
        style: {
          ...baseStyle,
          ...runtimeStyle,
        },
        disabled: disabled ?? node.props.disabled,
      },
    };
  }, [node, runtimeProps, runtimeStyle, disabled]);

  const x = Number(mergedNode.props.x || 0);
  const y = Number(mergedNode.props.y || 0);
  const width = Number(mergedNode.props.width || 240);
  const height = Number(mergedNode.props.height || 60);
  const zIndex = Number(mergedNode.props.zIndex || 1);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="schema-canvas-item"
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex,
        ...runtimeStyle,
      }}
    >
      {renderNodeContent(page, mergedNode, interactive, onRunScript)}
    </div>
  );
}

function renderPositionedNode(
  page: PageSchema,
  node: ComponentNode,
  interactive: boolean,
  onRunScript?: (script: string | undefined, node: ComponentNode) => void,
) {
  return (
    <RuntimeNodeShell
      key={node.id}
      page={page}
      node={node}
      interactive={interactive}
      onRunScript={onRunScript}
    />
  );
}

function renderNodeContent(
  page: PageSchema,
  node: ComponentNode,
  interactive: boolean,
  onRunScript?: (script: string | undefined, node: ComponentNode) => void,
): JSX.Element {
  switch (node.type) {
    case 'container':
      return (
        <ContainerMaterial
          page={page}
          node={node}
          interactive={interactive}
          onRunScript={onRunScript}
          renderChild={renderPositionedNode}
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
    case 'table':
      return <TableMaterial page={page} node={node} />;
    case 'chart':
      return <ChartMaterial page={page} node={node} />;
    case 'image':
      return <ImageMaterial page={page} node={node} />;
    case 'customHtml':
      return (
        <CustomHtmlMaterial
          page={page}
          node={node}
          interactive={interactive}
          onRunScript={onRunScript}
        />
      );
    default:
      return <TextMaterial page={page} node={{ ...node, props: { ...node.props, text: '未知组件' } }} />;
  }
}

function renderRootNode(
  page: PageSchema,
  node: ComponentNode,
  interactive: boolean,
  onRunScript?: (script: string | undefined, node: ComponentNode) => void,
) {
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
        borderRadius: Number(node.props.borderRadius || 6),
        background,
        backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
    >
      {node.children.map((child) => renderPositionedNode(
        page,
        child,
        interactive,
        onRunScript,
      ))}
    </div>
  );
}

export default function SchemaRenderer({ page, node, interactive = false, onRunScript }: SchemaRendererProps) {
  const currentNode = node ?? page.root;
  return node
    ? renderNodeContent(page, currentNode, interactive, onRunScript)
    : renderRootNode(page, currentNode, interactive, onRunScript);
}
