import type { ComponentNode, PageSchema } from '../schema/pageSchema';
import type {
  RuntimeChangeListener,
  RuntimeChangeSource,
  RuntimeComponentsApi,
  SetRuntimeVariableOptions,
  RuntimeVarsApi,
  RuntimeVariableChange,
} from '../runtime/pageRuntime';

export interface ScriptContext {
  message: {
    success: (content: string) => void;
    error: (content: string) => void;
    info: (content: string) => void;
    warning: (content: string) => void;
  };
  page: PageSchema;
  node: ComponentNode;
  pageVariables?: Record<string, unknown>;
  setPageVariable?: (
    name: string,
    value: unknown,
    options?: SetRuntimeVariableOptions,
  ) => void;
  vars?: RuntimeVarsApi;
  components?: RuntimeComponentsApi;
  change?: RuntimeVariableChange;
  variableChange?: {
    name: string;
    value: unknown;
  };
  onVariableChange?: (listener: RuntimeChangeListener) => () => void;
  scriptSource?: RuntimeChangeSource;
}

function withDefaultScriptSource(
  options: SetRuntimeVariableOptions | undefined,
  defaultSource: RuntimeChangeSource,
) {
  if (options?.source) {
    return options;
  }

  return {
    ...(options || {}),
    source: defaultSource,
  };
}

function bindScriptVarsApi(
  vars: RuntimeVarsApi | undefined,
  defaultSource: RuntimeChangeSource,
): RuntimeVarsApi | undefined {
  if (!vars) {
    return undefined;
  }

  return {
    get: vars.get,
    getValue: vars.getValue,
    all: vars.all,
    values: vars.values,
    subscribe: vars.subscribe,
    set: (name, value, options) =>
      vars.set(name, value, withDefaultScriptSource(options, defaultSource)),
    patch: (name, patch, options) =>
      vars.patch(name, patch, withDefaultScriptSource(options, defaultSource)),
  };
}

export async function executeScript(script: string | undefined, context: ScriptContext) {
  if (!script?.trim()) {
    return;
  }

  const defaultSource = context.scriptSource || 'system';
  const vars = bindScriptVarsApi(context.vars, defaultSource);
  const setPageVariable = context.setPageVariable
    ? (
      name: string,
      value: unknown,
      options?: SetRuntimeVariableOptions,
    ) => context.setPageVariable?.(
      name,
      value,
      withDefaultScriptSource(options, defaultSource),
    )
    : undefined;
  const runner = new Function(
    'message',
    'page',
    'node',
    'pageVariables',
    'setPageVariable',
    'vars',
    'components',
    'change',
    'variableChange',
    'onVariableChange',
    `
      'use strict';
      return (async () => {
        ${script}
      })();
    `,
  ) as (
    messageApi: ScriptContext['message'],
    page: PageSchema,
    node: ComponentNode,
    pageVariables: ScriptContext['pageVariables'],
    setPageVariable: ScriptContext['setPageVariable'],
    varsApi: RuntimeVarsApi | undefined,
    componentsApi: RuntimeComponentsApi | undefined,
    change: RuntimeVariableChange | undefined,
    variableChange: ScriptContext['variableChange'],
    onVariableChange: ScriptContext['onVariableChange'],
  ) => Promise<void>;

  await runner(
    context.message,
    context.page,
    context.node,
    context.pageVariables,
    setPageVariable,
    vars,
    context.components,
    context.change,
    context.variableChange,
    context.onVariableChange,
  );
}
