import type { ComponentNode, PageSchema } from '../../schema/pageSchema';

export interface MaterialRenderProps {
  page: PageSchema;
  node: ComponentNode;
  interactive?: boolean;
  onRunScript?: (script: string | undefined, node: ComponentNode) => void;
}