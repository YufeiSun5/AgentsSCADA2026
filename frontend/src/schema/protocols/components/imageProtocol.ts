import type { ComponentProtocolDefinition } from '../types';

export const imageProtocol: ComponentProtocolDefinition = {
  type: 'image',
  title: '图片组件',
  summary: '用于展示设备图、工艺图、背景图和上传后的图片资产。',
  usage: [
    '优先使用 assetId 引用后端资产，便于页面迁移和权限控制。',
    'objectFit 可选 cover、contain、fill，工艺图通常推荐 contain。',
    '图片组件只负责展示，不承载控制逻辑。',
  ],
  supportedEvents: [],
  supportedMethods: [
    {
      name: 'setSrc',
      summary: '运行态替换图片 URL，可用于根据变量状态切换设备图。',
      signature: 'components.call(componentIdOrName, "setSrc", src)',
      example: 'components.call("runtime_state_image", "setSrc", svgDataUrl);',
    },
    {
      name: 'clearSrc',
      summary: '清除运行态图片 URL，恢复配置中的 assetId 或 src。',
      signature: 'components.call(componentIdOrName, "clearSrc")',
      example: 'components.call("runtime_state_image", "clearSrc");',
    },
    {
      name: 'setBackground',
      summary: '运行态替换图片容器背景色。',
      signature: 'components.call(componentIdOrName, "setBackground", color)',
      example: 'components.call("runtime_state_image", "setBackground", "#3b1218");',
    },
    {
      name: 'setObjectFit',
      summary: '运行态切换图片填充方式。',
      signature: 'components.call(componentIdOrName, "setObjectFit", objectFit)',
      example: 'components.call("runtime_state_image", "setObjectFit", "contain");',
    },
  ],
  properties: [
    {
      name: 'x',
      type: 'number',
      required: true,
      summary: '图片 X 坐标。',
      usage: '画布绝对定位 left 值。',
    },
    {
      name: 'y',
      type: 'number',
      required: true,
      summary: '图片 Y 坐标。',
      usage: '画布绝对定位 top 值。',
    },
    {
      name: 'width',
      type: 'number',
      required: true,
      summary: '图片宽度。',
      usage: '建议按设备图原始比例设置。',
    },
    {
      name: 'height',
      type: 'number',
      required: true,
      summary: '图片高度。',
      usage: '建议按设备图原始比例设置。',
    },
    {
      name: 'src',
      type: 'string',
      required: false,
      summary: '图片 URL。',
      usage: '无 assetId 时使用，可用于 demo 或外部静态资源。',
      example: 'https://example.com/device.png',
    },
    {
      name: 'assetId',
      type: 'string',
      required: false,
      summary: '资产文件 ID。',
      usage: '配置后会通过 /api/assets/{assetId}/file 加载图片。',
      example: '42',
    },
    {
      name: 'objectFit',
      type: 'string',
      required: false,
      summary: '图片填充方式。',
      usage: '可选 cover、contain、fill。',
      example: 'contain',
    },
  ],
  aiHints: [
    '生成图片组件时，优先使用 assetId；没有资产时才使用 src。',
    '设备图和工艺图通常使用 objectFit: contain，避免裁切关键信息。',
    '需要根据变量状态切换图片时，使用组件方法 setSrc / clearSrc / setBackground / setObjectFit，不要直接操作 img DOM。',
  ],
};
