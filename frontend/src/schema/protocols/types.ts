import type { ComponentType } from '../pageSchema';

export type ProtocolEventScope = 'page' | 'component';

export interface ProtocolEventDefinition {
  key: string;
  label: string;
  summary: string;
  scope: ProtocolEventScope;
  sharedWithAi: boolean;
}

export interface ProtocolMethodDefinition {
  name: string;
  summary: string;
  signature: string;
  example?: string;
}

export interface ProtocolPropertyDefinition {
  name: string;
  type: string;
  required: boolean;
  summary: string;
  usage: string;
  example?: string;
}

export interface ComponentProtocolDefinition {
  type: ComponentType;
  title: string;
  summary: string;
  usage: string[];
  supportedEvents: ProtocolEventDefinition[];
  supportedMethods: ProtocolMethodDefinition[];
  properties: ProtocolPropertyDefinition[];
  aiHints: string[];
}

export interface PageProtocolDefinition {
  title: string;
  summary: string;
  usage: string[];
  properties: ProtocolPropertyDefinition[];
  supportedEvents: ProtocolEventDefinition[];
  aiHints: string[];
}