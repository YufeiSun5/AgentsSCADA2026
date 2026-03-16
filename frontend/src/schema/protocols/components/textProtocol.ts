import type { ComponentProtocolDefinition } from '../types';

export const textProtocol: ComponentProtocolDefinition = {
  type: 'text',
  title: '文本组件',
  summary: '用于标题、标签、运行状态说明和工艺段标识。',
  usage: [
    '大屏标题建议使用 24 到 36 像素。',
    '状态文案建议与告警色和背景色形成强对比。',
    'AI 生成文本时，应尽量使用业务语义明确的中文短句。',
  ],
  supportedEvents: [
    {
      key: 'onOpen',
      label: '组件打开时',
      summary: '文本组件初始化显示时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
    {
      key: 'onClose',
      label: '组件关闭时',
      summary: '文本组件退出显示时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
  ],
  supportedMethods: [
    {
      name: 'Ctx.message.success',
      summary: '在脚本中输出成功提示。',
      signature: 'Ctx.message.success(content: string)',
      example: "Ctx.message.success('标题已刷新');",
    },
  ],
  properties: [
    {
      name: 'x',
      type: 'number',
      required: true,
      summary: '文本 X 坐标。',
      usage: '常用于精确贴合设备图或工艺流向。',
      example: '56',
    },
    {
      name: 'y',
      type: 'number',
      required: true,
      summary: '文本 Y 坐标。',
      usage: '常与标题行或设备标签对齐。',
      example: '34',
    },
    {
      name: 'width',
      type: 'number',
      required: true,
      summary: '文本渲染区域宽度。',
      usage: '宽度不足时将影响长标题可读性。',
      example: '520',
    },
    {
      name: 'height',
      type: 'number',
      required: true,
      summary: '文本渲染区域高度。',
      usage: '应与字号和行高匹配。',
      example: '56',
    },
    {
      name: 'text',
      type: 'string',
      required: true,
      summary: '文本内容。',
      usage: '推荐直接写业务标题或状态说明。',
      example: '三号产线运行总览',
    },
    {
      name: 'color',
      type: 'string',
      required: true,
      summary: '文本颜色。',
      usage: '深色背景下推荐使用浅色字。',
      example: '#f8fafc',
    },
    {
      name: 'fontSize',
      type: 'number',
      required: true,
      summary: '字体大小。',
      usage: '标题和正文应有明显层次。',
      example: '28',
    },
  ],
  aiHints: [
    'AI 生成 text 时，应优先生成业务语义化标题，而不是“新的文本组件”。',
    '当文本用作状态标签时，建议同时生成颜色字段。',
  ],
};