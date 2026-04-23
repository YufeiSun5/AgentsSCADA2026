import type { ComponentType } from '../pageSchema';
import type { ComponentProtocolDefinition } from './types';
import {
  buttonProtocol,
  chartProtocol,
  containerProtocol,
  customHtmlProtocol,
  imageProtocol,
  tableProtocol,
  textProtocol,
} from './components';
import { pageCanvasProtocol } from './pageCanvasProtocol';

/*
 * 统一注册表保留稳定入口，便于 UI 层和 AI 层按组件类型检索协议。
 */
export const componentProtocols: Record<
  ComponentType,
  ComponentProtocolDefinition
> = {
  container: containerProtocol,
  text: textProtocol,
  button: buttonProtocol,
  table: tableProtocol,
  chart: chartProtocol,
  customHtml: customHtmlProtocol,
  image: imageProtocol,
};

export function getComponentProtocol(type: ComponentType) {
  return componentProtocols[type];
}

export function buildComponentCopilotContext(type: ComponentType) {
  const protocol = getComponentProtocol(type);

  return {
    title: protocol.title,
    summary: protocol.summary,
    usage: protocol.usage,
    supportedEvents: protocol.supportedEvents,
    supportedMethods: protocol.supportedMethods,
    properties: protocol.properties,
    aiHints: protocol.aiHints,
  };
}

export { pageCanvasProtocol };
export type {
  ComponentProtocolDefinition,
  PageProtocolDefinition,
  ProtocolMethodDefinition,
  ProtocolPropertyDefinition,
} from './types';
