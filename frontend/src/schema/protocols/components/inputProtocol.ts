import type { ComponentProtocolDefinition } from '../types';

export const inputProtocol: ComponentProtocolDefinition = {
  type: 'input',
  title: '输入框组件',
  summary: '用于关键字过滤、表单录入和查询条件输入。',
  usage: [
    '常与按钮、表格、列表一起组成查询区。',
    '如果是设备筛选或报警检索，应给出明确 placeholder。',
  ],
  supportedEvents: ['onOpen', 'onClose', 'onClick'],
  supportedMethods: [
    {
      name: 'Ctx.message.info',
      summary: '提示输入框相关状态。',
      signature: 'Ctx.message.info(content: string)',
      example: "Ctx.message.info('请输入报警编码');",
    },
  ],
  properties: [
    {
      name: 'x',
      type: 'number',
      required: true,
      summary: '输入框 X 坐标。',
      usage: '通常放在查询区左上角。',
      example: '48',
    },
    {
      name: 'y',
      type: 'number',
      required: true,
      summary: '输入框 Y 坐标。',
      usage: '需要与表头或工具条对齐。',
      example: '112',
    },
    {
      name: 'width',
      type: 'number',
      required: true,
      summary: '输入框宽度。',
      usage: '至少满足业务编码完整显示。',
      example: '320',
    },
    {
      name: 'height',
      type: 'number',
      required: true,
      summary: '输入框高度。',
      usage: '推荐与按钮高度一致。',
      example: '40',
    },
    {
      name: 'placeholder',
      type: 'string',
      required: true,
      summary: '占位提示。',
      usage: '应该告诉用户可输入哪些关键字。',
      example: '请输入报警编码或设备名',
    },
  ],
  aiHints: [
    'AI 生成 input 时，要同时生成语义明确的 placeholder。',
    '若输入框属于查询区，建议配套生成查询按钮或表格。',
  ],
};