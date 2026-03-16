import type { ComponentProtocolDefinition } from '../types';

export const tableProtocol: ComponentProtocolDefinition = {
  type: 'table',
  title: '表格组件',
  summary: '用于展示设备列表、点位数据、报警清单和运行记录。',
  usage: [
    '表格适合承载二维结构数据，列定义与数据源必须成对生成。',
    '工业场景下建议控制列数，保证大屏阅读效率。',
  ],
  supportedEvents: [
    {
      key: 'onOpen',
      label: '组件打开时',
      summary: '表格初始化加载数据时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
    {
      key: 'onClose',
      label: '组件关闭时',
      summary: '表格离开运行态时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
  ],
  supportedMethods: [
    {
      name: 'Ctx.message.warning',
      summary: '提示表格无数据或状态异常。',
      signature: 'Ctx.message.warning(content: string)',
      example: "Ctx.message.warning('当前暂无设备状态数据');",
    },
  ],
  properties: [
    {
      name: 'x',
      type: 'number',
      required: true,
      summary: '表格 X 坐标。',
      usage: '一般与顶部标题或筛选区左对齐。',
      example: '56',
    },
    {
      name: 'y',
      type: 'number',
      required: true,
      summary: '表格 Y 坐标。',
      usage: '应位于查询区或标题下方。',
      example: '120',
    },
    {
      name: 'width',
      type: 'number',
      required: true,
      summary: '表格宽度。',
      usage: '宽度需覆盖主要列内容。',
      example: '620',
    },
    {
      name: 'height',
      type: 'number',
      required: true,
      summary: '表格高度。',
      usage: '决定可见行数和滚动区域。',
      example: '300',
    },
    {
      name: 'columns',
      type: 'Array<Column>',
      required: true,
      summary: '列定义。',
      usage: '每列需包含 title 与 dataIndex。',
      example: '[{ title: "点位", dataIndex: "tag" }]',
    },
    {
      name: 'dataSource',
      type: 'Array<Record<string, unknown>>',
      required: true,
      summary: '数据源。',
      usage: '数据字段必须与 columns.dataIndex 对应。',
      example: '[{ key: "1", tag: "A-101", value: "48.1" }]',
    },
  ],
  aiHints: [
    'AI 生成表格时，必须同步生成 columns 与 dataSource 示例。',
    '表格更适合作为设备清单、报警记录、运行日志等结构化区域。',
  ],
};