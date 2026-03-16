export type PageStatus = 'draft' | 'enabled' | 'disabled';

export type ComponentType = 'container' | 'text' | 'button' | 'input' | 'table' | 'chart';

export type ComponentVariableType = 'string' | 'number' | 'boolean' | 'json';

export interface ComponentVariable {
  id: string;
  name: string;
  type: ComponentVariableType;
  initialValue: string;
  summary: string;
}

export interface ComponentScripts {
  onOpen?: string;
  onClose?: string;
  onLoad?: string;
  onClick?: string;
}

export interface PageScripts {
  onOpen?: string;
  onClose?: string;
  onTimer?: string;
  onVariableChange?: string;
}

export interface ComponentNode {
  id: string;
  type: ComponentType;
  name: string;
  title: string;
  props: Record<string, unknown>;
  variables: ComponentVariable[];
  scripts: ComponentScripts;
  children: ComponentNode[];
}

export interface PageSchema {
  id: string;
  name: string;
  description: string;
  status: PageStatus;
  updatedAt: string;
  variables: ComponentVariable[];
  scripts: PageScripts;
  root: ComponentNode;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface PageListQuery {
  keyword: string;
  status: 'all' | PageStatus;
  page: number;
  pageSize: number;
}

export interface PagedResult<T> {
  list: T[];
  total: number;
}

export interface MaterialDefinition {
  type: ComponentType;
  label: string;
  category: '基础组件' | '数据展示' | '布局容器';
  description: string;
  defaultProps: Record<string, unknown>;
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const materialCatalog: MaterialDefinition[] = [
  {
    type: 'container',
    label: '容器',
    category: '布局容器',
    description: '用于包裹嵌套组件与定义区块视觉风格。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 320,
      height: 180,
      zIndex: 1,
      background: '#16324a',
      padding: 16,
      borderRadius: 16,
      minHeight: 120,
    },
  },
  {
    type: 'text',
    label: '文本',
    category: '基础组件',
    description: '用于标题、说明文字、状态描述。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 260,
      height: 48,
      zIndex: 2,
      text: '新的文本组件',
      color: '#e2e8f0',
      fontSize: 24,
    },
  },
  {
    type: 'button',
    label: '按钮',
    category: '基础组件',
    description: '可绑定点击脚本，触发业务动作。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 160,
      height: 44,
      zIndex: 2,
      text: '执行操作',
      buttonType: 'primary',
    },
  },
  {
    type: 'input',
    label: '输入框',
    category: '基础组件',
    description: '用于表单采集或筛选条件输入。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 260,
      height: 40,
      zIndex: 2,
      placeholder: '请输入内容',
    },
  },
  {
    type: 'table',
    label: '表格',
    category: '数据展示',
    description: '用于展示分页前的静态示例数据。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 540,
      height: 260,
      zIndex: 1,
      columns: [
        { title: '点位', dataIndex: 'tag' },
        { title: '值', dataIndex: 'value' },
      ],
      dataSource: [
        { key: '1', tag: 'A-101', value: '48.1' },
        { key: '2', tag: 'A-102', value: '49.7' },
      ],
    },
  },
  {
    type: 'chart',
    label: '图表',
    category: '数据展示',
    description: '通过 ECharts 配置渲染工业趋势图。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 600,
      height: 260,
      zIndex: 1,
      option: {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['08:00', '10:00', '12:00', '14:00', '16:00'] },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'line',
            smooth: true,
            data: [45, 47, 49, 48, 50],
            areaStyle: {},
          },
        ],
      },
    },
  },
];

export function cloneSchema<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createComponentNode(type: ComponentType): ComponentNode {
  const material = materialCatalog.find((item) => item.type === type);
  const componentId = createId(type);

  if (!material) {
    throw new Error(`Unsupported material type: ${type}`);
  }

  return {
    id: componentId,
    type,
    name: `${type}_${componentId.split('-').pop()}`,
    title: material.label,
    props: cloneSchema(material.defaultProps),
    variables: [],
    scripts: {
      onOpen: '',
      onClose: '',
      onLoad: '',
      onClick: '',
    },
    children: [],
  };
}

export function createEmptyPageSchema(name = '未命名页面'): PageSchema {
  return {
    id: createId('page'),
    name,
    description: '基于 JSON Schema 的页面描述对象。',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    variables: [],
    scripts: {
      onOpen: '',
      onClose: '',
      onTimer: '',
      onVariableChange: '',
    },
    root: {
      id: createId('root'),
      type: 'container',
      name: 'page_root',
      title: '页面根容器',
      props: {
        canvasWidth: 1600,
        canvasHeight: 900,
        background: '#081622',
        gridSize: 20,
        timerIntervalMs: 0,
        padding: 0,
        borderRadius: 24,
        minHeight: 560,
      },
      variables: [],
      scripts: {
        onOpen: '',
        onClose: '',
        onLoad: '',
        onClick: '',
      },
      children: [],
    },
  };
}

export function findNodeById(root: ComponentNode, id: string): ComponentNode | null {
  if (root.id === id) {
    return root;
  }

  for (const child of root.children) {
    const result = findNodeById(child, id);
    if (result) {
      return result;
    }
  }

  return null;
}

export function flattenNodes(root: ComponentNode): ComponentNode[] {
  return [root, ...root.children.flatMap((child) => flattenNodes(child))];
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeNode(node: ComponentNode): ComponentNode {
  const material = materialCatalog.find((item) => item.type === node.type);
  const defaultProps = material?.defaultProps || {};
  const fallbackName = node.name || node.title || `${node.type}_${node.id.split('-').pop()}`;

  return {
    ...node,
    name: fallbackName,
    props: {
      ...cloneSchema(defaultProps),
      ...node.props,
      x: toNumber(node.props.x, toNumber(defaultProps.x, 80)),
      y: toNumber(node.props.y, toNumber(defaultProps.y, 80)),
      width: toNumber(node.props.width, toNumber(defaultProps.width, 240)),
      height: toNumber(node.props.height, toNumber(defaultProps.height, 60)),
      zIndex: toNumber(node.props.zIndex, toNumber(defaultProps.zIndex, 1)),
    },
    variables: Array.isArray(node.variables) ? node.variables : [],
    scripts: {
      onOpen: String(node.scripts?.onOpen || node.scripts?.onLoad || ''),
      onClose: String(node.scripts?.onClose || ''),
      onLoad: String(node.scripts?.onLoad || node.scripts?.onOpen || ''),
      onClick: String(node.scripts?.onClick || ''),
    },
    children: node.children.map((child) => normalizeNode(child)),
  };
}

export function normalizePageSchema(schema: PageSchema): PageSchema {
  const normalizedRoot = normalizeNode(schema.root);

  normalizedRoot.props = {
    ...normalizedRoot.props,
    canvasWidth: toNumber(normalizedRoot.props.canvasWidth, 1600),
    canvasHeight: toNumber(normalizedRoot.props.canvasHeight, 900),
    gridSize: toNumber(normalizedRoot.props.gridSize, 20),
    timerIntervalMs: toNumber(normalizedRoot.props.timerIntervalMs, 0),
    background: String(normalizedRoot.props.background || '#081622'),
    borderRadius: toNumber(normalizedRoot.props.borderRadius, 24),
  };

  return {
    ...schema,
    variables: Array.isArray(schema.variables) ? schema.variables : [],
    scripts: {
      onOpen: String(schema.scripts?.onOpen || ''),
      onClose: String(schema.scripts?.onClose || ''),
      onTimer: String(schema.scripts?.onTimer || ''),
      onVariableChange: String(schema.scripts?.onVariableChange || ''),
    },
    root: normalizedRoot,
  };
}