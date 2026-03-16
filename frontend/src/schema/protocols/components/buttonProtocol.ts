import type { ComponentProtocolDefinition } from '../types';

export const buttonProtocol: ComponentProtocolDefinition = {
  type: 'button',
  title: '按钮组件',
  summary: '用于刷新、确认、联动跳转、控制命令等用户操作入口。',
  usage: [
    '按钮应绑定 onClick 脚本，避免成为纯展示元素。',
    '操作型按钮文案应直接表达动作，例如“刷新状态”“确认联动”。',
  ],
  supportedEvents: ['onOpen', 'onClose', 'onClick'],
  supportedMethods: [
    {
      name: 'Ctx.message.success',
      summary: '提示按钮动作成功。',
      signature: 'Ctx.message.success(content: string)',
      example: "Ctx.message.success('已触发设备复位');",
    },
    {
      name: 'Ctx.message.error',
      summary: '提示按钮动作失败。',
      signature: 'Ctx.message.error(content: string)',
      example: "Ctx.message.error('设备离线，无法执行操作');",
    },
  ],
  properties: [
    {
      name: 'x',
      type: 'number',
      required: true,
      summary: '按钮 X 坐标。',
      usage: '常与工具条或操作区对齐。',
      example: '1320',
    },
    {
      name: 'y',
      type: 'number',
      required: true,
      summary: '按钮 Y 坐标。',
      usage: '与顶部栏或表格联动。',
      example: '34',
    },
    {
      name: 'width',
      type: 'number',
      required: true,
      summary: '按钮宽度。',
      usage: '根据文案长度适配。',
      example: '140',
    },
    {
      name: 'height',
      type: 'number',
      required: true,
      summary: '按钮高度。',
      usage: '大屏按钮建议不小于 36 像素。',
      example: '40',
    },
    {
      name: 'text',
      type: 'string',
      required: true,
      summary: '按钮文案。',
      usage: '必须体现动作，不要使用模糊词。',
      example: '刷新状态',
    },
    {
      name: 'buttonType',
      type: 'string',
      required: true,
      summary: '按钮样式类型。',
      usage: '常用值为 primary、default、dashed。',
      example: 'primary',
    },
  ],
  aiHints: [
    'AI 为按钮生成脚本时，应限制在 Ctx 上下文与 message 方法内。',
    '命令型按钮应同时生成失败提示脚本。',
  ],
};