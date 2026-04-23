import type { ComponentProtocolDefinition } from '../types';

export const containerProtocol: ComponentProtocolDefinition = {
  type: 'container',
  title: '容器组件',
  summary:
    '用于组织区块、嵌套组件和表达工艺分区，'
    + '是画布中的布局承载节点。',
  usage: [
    '适合包裹一组同业务域组件，例如设备区块、告警面板或统计卡片。',
    '容器自身支持背景色、内边距和圆角，用于形成视觉边界。',
    '后续可以扩展内部绝对定位子节点，因此 AI 生成复杂分区时优先使用容器。',
  ],
  supportedEvents: [
    {
      key: 'onOpen',
      label: '组件打开时',
      summary: '容器进入运行态时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
    {
      key: 'onClose',
      label: '组件关闭时',
      summary: '容器离开运行态时执行。',
      scope: 'component',
      sharedWithAi: true,
    },
  ],
  supportedMethods: [
    {
      name: 'message.info',
      summary: '在页面上提示说明信息。',
      signature: 'message.info(content: string)',
      example: "message.info('容器初始化完成');",
    },
  ],
  properties: [
    {
      name: 'x',
      type: 'number',
      required: true,
      summary: '左上角 X 坐标。',
      usage: '决定容器在页面中的水平落点。',
      example: '80',
    },
    {
      name: 'y',
      type: 'number',
      required: true,
      summary: '左上角 Y 坐标。',
      usage: '决定容器在页面中的垂直落点。',
      example: '120',
    },
    {
      name: 'width',
      type: 'number',
      required: true,
      summary: '容器宽度。',
      usage: '建议按工艺区块宽度设置。',
      example: '320',
    },
    {
      name: 'height',
      type: 'number',
      required: true,
      summary: '容器高度。',
      usage: '用于定义区块可承载的内容空间。',
      example: '180',
    },
    {
      name: 'background',
      type: 'string',
      required: true,
      summary: '容器背景色。',
      usage: '工业深色背景常用于承载局部区块。',
      example: '#16324a',
    },
    {
      name: 'padding',
      type: 'number',
      required: true,
      summary: '容器内边距。',
      usage: '控制内部组件与边界的间距。',
      example: '16',
    },
    {
      name: 'borderRadius',
      type: 'number',
      required: true,
      summary: '圆角。',
      usage: '用于柔化区块边缘，默认即可。',
      example: '16',
    },
  ],
  aiHints: [
    'AI 生成容器时，应先输出容器，再生成其内部组件。',
    '当多个组件属于同一区域时，不要直接平铺到根画布，优先放入容器。',
  ],
};
