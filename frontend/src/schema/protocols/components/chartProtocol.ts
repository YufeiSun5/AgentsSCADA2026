import type { ComponentProtocolDefinition } from '../types';

export const chartProtocol: ComponentProtocolDefinition = {
  type: 'chart',
  title: '图表组件',
  summary: '用于趋势曲线、统计柱状图、工艺指标波动展示。',
  usage: [
    '图表需输出标准 ECharts option 对象。',
    '工业趋势图优先采用折线图，并给出时间轴。',
    '多指标趋势建议统一颜色和图例命名。',
  ],
  supportedEvents: [
    {
      key: 'onOpen',
      label: '组件打开时',
      summary: '图表初始化或首次装载数据时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
    {
      key: 'onClose',
      label: '组件关闭时',
      summary: '图表离开运行态时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
  ],
  supportedMethods: [
    {
      name: 'message.info',
      summary: '提示图表初始化或数据刷新状态。',
      signature: 'message.info(content: string)',
      example: "message.info('趋势图已完成刷新');",
    },
    {
      name: 'setOption',
      summary: '运行态合并或替换 ECharts option。',
      signature: 'components.call(componentIdOrName, "setOption", option)',
      example: 'components.call("runtime_chart", "setOption", { series: [{ data: [1, 2, 3] }] });',
    },
    {
      name: 'appendData',
      summary: '运行态向 ECharts 系列追加数据。',
      signature: 'components.call(componentIdOrName, "appendData", payload)',
      example: 'components.call("runtime_chart", "appendData", { seriesIndex: 0, data: [[Date.now(), 42]] });',
    },
    {
      name: 'clear',
      summary: '清空图表当前运行态内容。',
      signature: 'components.call(componentIdOrName, "clear")',
      example: 'components.call("runtime_chart", "clear");',
    },
    {
      name: 'resize',
      summary: '触发布局变化后的图表重绘。',
      signature: 'components.call(componentIdOrName, "resize")',
      example: 'components.call("runtime_chart", "resize");',
    },
  ],
  properties: [
    {
      name: 'x',
      type: 'number',
      required: true,
      summary: '图表 X 坐标。',
      usage: '一般放在主数据展示区。',
      example: '720',
    },
    {
      name: 'y',
      type: 'number',
      required: true,
      summary: '图表 Y 坐标。',
      usage: '通常与表格或其他统计区对齐。',
      example: '120',
    },
    {
      name: 'width',
      type: 'number',
      required: true,
      summary: '图表宽度。',
      usage: '宽度足够时趋势线更易阅读。',
      example: '820',
    },
    {
      name: 'height',
      type: 'number',
      required: true,
      summary: '图表高度。',
      usage: '保证坐标轴和图例可完整显示。',
      example: '300',
    },
    {
      name: 'option',
      type: 'EChartsOption',
      required: true,
      summary: '图表配置对象。',
      usage: '必须符合 ECharts 配置语义。',
      example: '{ tooltip: { trigger: "axis" }, series: [] }',
    },
  ],
  aiHints: [
    'AI 生成图表时，不要省略 xAxis、yAxis 和 series。',
    '工业趋势图默认应带 tooltip 和时间轴类目。',
    '运行态更新图表使用 components.call 的 setOption/appendData/clear/resize，不要直接操作 ECharts DOM。',
  ],
};
