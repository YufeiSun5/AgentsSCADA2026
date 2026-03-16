/*
 * 兼容导出层保留旧路径，避免拆分协议目录后影响现有导入。
 */
export {
  buildComponentCopilotContext,
  componentProtocols,
  getComponentProtocol,
  pageCanvasProtocol,
} from './protocols';

export type {
  ComponentProtocolDefinition,
  PageProtocolDefinition,
  ProtocolMethodDefinition,
  ProtocolPropertyDefinition,
} from './protocols';