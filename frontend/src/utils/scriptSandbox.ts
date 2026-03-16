import type { ComponentNode, PageSchema } from '../schema/pageSchema';

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
  setPageVariable?: (name: string, value: unknown) => void;
  variableChange?: {
    name: string;
    value: unknown;
  };
}

export async function executeScript(script: string | undefined, context: ScriptContext) {
  if (!script?.trim()) {
    return;
  }

  const runner = new Function(
    'Ctx',
    `
      'use strict';
      return (async () => {
        ${script}
      })();
    `,
  ) as (ctx: ScriptContext) => Promise<void>;

  await runner(Object.freeze({ ...context }));
}