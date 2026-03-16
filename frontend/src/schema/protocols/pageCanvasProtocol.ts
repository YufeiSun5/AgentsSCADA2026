import type { PageProtocolDefinition } from './types';

/*
 * 页面协议独立成文件，便于后续扩展多种画布模式与运行环境描述。
 */
export const pageCanvasProtocol: PageProtocolDefinition = {
  title: '页面画布协议',
  summary:
    '定义 SCADA 页面级尺寸、背景、网格与显示比例，'
    + '是生成页面布局时的第一约束。',
  usage: [
    '页面宽高决定最终运行时画布尺寸，组件坐标必须在该尺寸范围内布局。',
    'gridSize 用于拖动吸附、对齐线和 AI 生成时的栅格推断。',
    'background 建议使用深色工业风配色，保证仪表与告警色在大屏上对比清晰。',
  ],
  properties: [
    {
      name: 'canvasWidth',
      type: 'number',
      required: true,
      summary: '页面画布宽度，单位为像素。',
      usage: '运行时按该宽度创建固定画布，组件 x 与 width 必须受其约束。',
      example: '1600',
    },
    {
      name: 'canvasHeight',
      type: 'number',
      required: true,
      summary: '页面画布高度，单位为像素。',
      usage: '运行时按该高度创建固定画布，组件 y 与 height 必须受其约束。',
      example: '900',
    },
    {
      name: 'background',
      type: 'string',
      required: true,
      summary: '页面背景色或背景表达式。',
      usage: '建议统一为深色底，便于叠加状态色、趋势线和按钮。',
      example: '#081622',
    },
    {
      name: 'gridSize',
      type: 'number',
      required: true,
      summary: '画布网格尺寸。',
      usage: '后续扩展网格吸附、智能对齐和 AI 自动布局时直接复用该值。',
      example: '20',
    },
  ],
  aiHints: [
    'AI 生成页面时，先确定 canvasWidth、canvasHeight，再为每个组件生成 x、y、width、height。',
    'AI 生成布局时，优先按 8、10、16、20 的工业网格倍数落点。',
    'AI 输出脚本时，需参考组件支持事件和方法，不要凭空生成不存在的行为。',
  ],
};