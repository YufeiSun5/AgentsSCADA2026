export type PageStatus = 'draft' | 'enabled' | 'disabled';

export type ComponentType = 'container' | 'text' | 'button' | 'table' | 'chart' | 'customHtml' | 'image';

export type ComponentVariableType = 'string' | 'number' | 'boolean' | 'json';

export interface VariableScripts {
  onChange?: string;
}

export interface ComponentVariable {
  id: string;
  name: string;
  type: ComponentVariableType;
  initialValue: string;
  summary: string;
  displayName?: string;
  dataType?: string;
  rwMode?: 'R' | 'W' | 'RW' | string;
  unit?: string;
  format?: string;
  precision?: number;
  color?: string;
  icon?: string;
  identityExtra?: Record<string, unknown>;
  ownerExtra?: Record<string, unknown>;
  typeExtra?: Record<string, unknown>;
  valueExtra?: Record<string, unknown>;
  timeExtra?: Record<string, unknown>;
  qualityExtra?: Record<string, unknown>;
  changeExtra?: Record<string, unknown>;
  alarmExtra?: Record<string, unknown>;
  writeExtra?: Record<string, unknown>;
  displayExtra?: Record<string, unknown>;
  configExtra?: Record<string, unknown>;
  customExtra?: Record<string, unknown>;
  scripts?: VariableScripts;
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
  category: '基础组件' | '数据展示' | '布局容器' | '高级组件';
  description: string;
  defaultProps: Record<string, unknown>;
  visible?: boolean;
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
    visible: false,
    defaultProps: {
      x: 80,
      y: 80,
      width: 320,
      height: 180,
      zIndex: 1,
      background: '#16324a',
      padding: 16,
      borderRadius: 6,
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
      binding: {
        enabled: false,
        tagName: 'temperature',
        template: '{value} {unit}',
        precision: 1,
        fallback: '--',
      },
      writeBack: {
        enabled: false,
        tagName: 'setpoint',
        valueType: 'number',
        title: '写入变量值',
        placeholder: '请输入回写值',
      },
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
      writeBack: {
        enabled: false,
        tagName: 'pump_run',
        value: 1,
        action: 'set',
        confirmRequired: true,
        confirmTitle: '确认下发控制指令？',
        successMessage: '控制指令已下发',
        errorMessage: '控制指令下发失败',
      },
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
      width: 680,
      height: 320,
      zIndex: 1,
      gridEngine: 'ag-grid',
      pagination: {
        enabled: true,
        pageSize: 20,
        pageSizeOptions: [10, 20, 50, 100],
      },
      rowSelection: 'single',
      theme: {
        compact: true,
        striped: true,
        oddRowBackground: '#f6f8fa',
        evenRowBackground: '#ffffff',
        hoverRowBackground: '#eef6ff',
      },
      columnDefs: [
        { field: 'tag', headerName: '点位', width: 150, cellType: 'tag' },
        { field: 'value', headerName: '值', width: 120, editable: true, cellType: 'input' },
        { field: 'status', headerName: '状态', width: 100, cellType: 'switch' },
        { field: 'progress', headerName: '进度', width: 150, cellType: 'progress' },
        { field: 'action', headerName: '操作', width: 120, cellType: 'button', buttonText: '写入' },
      ],
      rowData: [
        { key: '1', tag: 'A-101', value: '48.1', status: true, progress: 76, action: 'write' },
        { key: '2', tag: 'A-102', value: '49.7', status: false, progress: 42, action: 'write' },
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
  {
    type: 'customHtml',
    label: 'HTML',
    category: '高级组件',
    description: '通过 iframe 沙箱渲染用户自定义 HTML/CSS/JS，支持 ScadaBridge 实时数据桥接与第三方库加载。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 400,
      height: 300,
      zIndex: 1,
      htmlContent: '<div class="html-card">\n  <span>HTML 实时温度</span>\n  <strong id="html-temperature">--</strong>\n  <button id="html-setpoint">写入设定值</button>\n</div>',
      cssContent: '.html-card {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  padding: 16px;\n  color: #e6edf3;\n  background: #0d2436;\n  border: 1px solid #30363d;\n  border-radius: 6px;\n  font-family: sans-serif;\n}\n.html-card span {\n  display: block;\n  color: #8b949e;\n  font-size: 13px;\n}\n.html-card strong {\n  display: block;\n  margin: 8px 0 12px;\n  font-size: 28px;\n}\n.html-card button {\n  height: 32px;\n  border: 1px solid #1a7f37;\n  border-radius: 6px;\n  color: #ffffff;\n  background: #1f883d;\n}',
      jsContent: 'ScadaBridge.onReady(function () {\n  ScadaBridge.bindText("#html-temperature", "temperature", {\n    template: "{value} {unit}",\n    precision: 1,\n    fallback: "--"\n  });\n\n  ScadaBridge.bindWriteDialog("#html-setpoint", "setpoint", {\n    title: "写入设定值",\n    type: "number"\n  });\n});',
      transparent: true,
      libraryAssetIds: [],
      sandboxPermissions: 'allow-scripts allow-modals',
    },
  },
  {
    type: 'image',
    label: '图片',
    category: '基础组件',
    description: '用于展示设备图、工艺图、背景图或上传资产图片。',
    defaultProps: {
      x: 80,
      y: 80,
      width: 320,
      height: 180,
      zIndex: 1,
      src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="%230d2436"/><rect x="80" y="108" width="480" height="144" rx="8" fill="%23161b22" stroke="%2330363d" stroke-width="4"/><circle cx="186" cy="180" r="46" fill="%230969da"/><circle cx="454" cy="180" r="46" fill="%231f883d"/><path d="M232 180h176" stroke="%23e6edf3" stroke-width="18" stroke-linecap="round"/><text x="320" y="312" text-anchor="middle" fill="%23e6edf3" font-family="Arial" font-size="28">SCADA IMAGE</text></svg>',
      alt: '设备示意图',
      objectFit: 'cover',
      borderRadius: 6,
      background: '#0d2436',
    },
  },
];

export function cloneSchema<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeVariable(variable: ComponentVariable): ComponentVariable {
  return {
    ...variable,
    displayName: variable.displayName || variable.name,
    rwMode: variable.rwMode || 'RW',
    unit: variable.unit || '',
    initialValue: String(variable.initialValue ?? ''),
    summary: String(variable.summary || ''),
    scripts: {
      onChange: String(variable.scripts?.onChange || ''),
    },
  };
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
        borderRadius: 6,
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
    variables: Array.isArray(node.variables)
      ? node.variables.map((variable) => normalizeVariable(variable))
      : [],
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
    borderRadius: toNumber(normalizedRoot.props.borderRadius, 6),
  };

  return {
    ...schema,
    variables: Array.isArray(schema.variables)
      ? schema.variables.map((variable) => normalizeVariable(variable))
      : [],
    scripts: {
      onOpen: String(schema.scripts?.onOpen || ''),
      onClose: String(schema.scripts?.onClose || ''),
      onTimer: String(schema.scripts?.onTimer || ''),
      onVariableChange: String(schema.scripts?.onVariableChange || ''),
    },
    root: normalizedRoot,
  };
}
