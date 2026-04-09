import { produce } from 'immer';
import { create } from 'zustand';
import { cloneSchema, createComponentNode, findNodeById, normalizePageSchema, type CanvasPosition, type ComponentNode, type ComponentScripts, type ComponentType, type ComponentVariable, type PageSchema, type PageScripts } from '../schema/pageSchema';

interface EditorState {
  schema: PageSchema | null;
  selectedId: string | null;
  history: PageSchema[];
  future: PageSchema[];
  dragSnapshot: PageSchema | null;
  setSchema: (schema: PageSchema) => void;
  selectNode: (nodeId: string | null) => void;
  addNode: (
    type: ComponentType,
    position?: CanvasPosition,
    options?: {
      title?: string;
      props?: Record<string, unknown>;
    },
  ) => string | null;
  startNodeMove: (nodeId: string) => void;
  moveNode: (activeId: string, delta: CanvasPosition) => void;
  commitNodeMove: () => void;
  cancelNodeMove: () => void;
  updateNodeName: (nodeId: string, name: string) => void;
  updateSelectedName: (name: string) => void;
  updateNodeTitle: (nodeId: string, title: string) => void;
  updateSelectedTitle: (title: string) => void;
  updateNodeProps: (nodeId: string, patch: Record<string, unknown>) => void;
  updateSelectedProps: (patch: Record<string, unknown>) => void;
  replaceNodeProps: (nodeId: string, nextProps: Record<string, unknown>) => void;
  replaceSelectedProps: (nextProps: Record<string, unknown>) => void;
  updateNodeVariables: (nodeId: string, variables: ComponentVariable[]) => void;
  updateSelectedVariables: (variables: ComponentVariable[]) => void;
  updateNodeScripts: (nodeId: string, patch: Partial<ComponentScripts>) => void;
  updateSelectedScripts: (patch: Partial<ComponentScripts>) => void;
  updatePageVariables: (variables: ComponentVariable[]) => void;
  updatePageScripts: (patch: Partial<PageScripts>) => void;
  updatePageSettings: (patch: Record<string, unknown>) => void;
  bringSelectedToFront: (nodeId?: string) => void;
  sendSelectedToBack: (nodeId?: string) => void;
  moveSelectedForward: (nodeId?: string) => void;
  moveSelectedBackward: (nodeId?: string) => void;
  deleteSelectedNode: (nodeId?: string) => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 40;

function buildNextState(
  current: PageSchema,
  updater: (draft: PageSchema) => void,
): PageSchema {
  return produce(cloneSchema(current), updater);
}

function findSelectedNode(schema: PageSchema, selectedId: string | null): ComponentNode | null {
  return selectedId ? findNodeById(schema.root, selectedId) : null;
}

function commitNodeChange(
  getState: () => EditorState,
  setState: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  nodeId: string,
  updater: (node: ComponentNode) => void,
) {
  const { schema } = getState();
  if (!schema) {
    return;
  }

  const nextSchema = buildNextState(schema, (draft) => {
    const targetNode = findNodeById(draft.root, nodeId);
    if (targetNode) {
      updater(targetNode);
    }
  });

  setState((state) => ({
    schema: nextSchema,
    history: [...state.history, cloneSchema(schema)].slice(-MAX_HISTORY),
    future: [],
  }));
}

function clampPosition(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function reindexZOrder(nodes: ComponentNode[]) {
  nodes.forEach((node, index) => {
    node.props.zIndex = index + 1;
  });
}

function moveNodeOrder(nodes: ComponentNode[], nodeId: string, direction: 'front' | 'back' | 'forward' | 'backward') {
  const currentIndex = nodes.findIndex((node) => node.id === nodeId);

  if (currentIndex < 0) {
    return false;
  }

  const targetNode = nodes[currentIndex];
  nodes.splice(currentIndex, 1);

  if (direction === 'front') {
    nodes.push(targetNode);
  }

  if (direction === 'back') {
    nodes.unshift(targetNode);
  }

  if (direction === 'forward') {
    nodes.splice(Math.min(currentIndex + 1, nodes.length), 0, targetNode);
  }

  if (direction === 'backward') {
    nodes.splice(Math.max(currentIndex - 1, 0), 0, targetNode);
  }

  reindexZOrder(nodes);
  return true;
}

function commitSelectionOrder(
  getState: () => EditorState,
  setState: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  direction: 'front' | 'back' | 'forward' | 'backward',
  nodeId?: string,
) {
  const { schema, selectedId } = getState();
  const targetId = nodeId || selectedId;
  if (!schema || !targetId) {
    return;
  }

  const nextSchema = buildNextState(schema, (draft) => {
    moveNodeOrder(draft.root.children, targetId, direction);
  });

  setState((state) => ({
    schema: nextSchema,
    selectedId: targetId,
    history: [...state.history, cloneSchema(schema)].slice(-MAX_HISTORY),
    future: [],
  }));
}

export const useEditorStore = create<EditorState>((set, get) => ({
  schema: null,
  selectedId: null,
  history: [],
  future: [],
  dragSnapshot: null,
  setSchema: (schema) => set({ schema: normalizePageSchema(cloneSchema(schema)), selectedId: null, history: [], future: [], dragSnapshot: null }),
  selectNode: (nodeId) => set({ selectedId: nodeId }),
  addNode: (type, position, options) => {
    const current = get().schema;
    if (!current) {
      return null;
    }

    const nextNode = createComponentNode(type);
    nextNode.title = options?.title || nextNode.title;
    nextNode.props = {
      ...nextNode.props,
      ...(options?.props || {}),
    };

    const nextSchema = buildNextState(current, (draft) => {
      const canvasWidth = Number(draft.root.props.canvasWidth || 1600);
      const canvasHeight = Number(draft.root.props.canvasHeight || 900);
      const nodeWidth = Number(nextNode.props.width || 240);
      const nodeHeight = Number(nextNode.props.height || 60);

      nextNode.props.x = clampPosition(position?.x ?? 48, 0, canvasWidth - nodeWidth);
      nextNode.props.y = clampPosition(position?.y ?? 48, 0, canvasHeight - nodeHeight);
      nextNode.props.zIndex = draft.root.children.length + 1;
      draft.root.children.push(nextNode);
    });

    set((state) => ({
      schema: nextSchema,
      selectedId: nextNode.id,
      history: [...state.history, cloneSchema(current)].slice(-MAX_HISTORY),
      future: [],
    }));

    return nextNode.id;
  },
  startNodeMove: (nodeId) => {
    const { schema, dragSnapshot } = get();
    if (!schema || dragSnapshot) {
      return;
    }

    set({
      dragSnapshot: cloneSchema(schema),
      selectedId: nodeId,
    });
  },
  moveNode: (activeId, delta) => {
    const current = get().schema;
    if (!current) {
      return;
    }

    const activeIndex = current.root.children.findIndex((node) => node.id === activeId);
    if (activeIndex < 0) {
      return;
    }

    const nextSchema = buildNextState(current, (draft) => {
      const activeNode = draft.root.children[activeIndex];
      const canvasWidth = Number(draft.root.props.canvasWidth || 1600);
      const canvasHeight = Number(draft.root.props.canvasHeight || 900);
      const width = Number(activeNode.props.width || 240);
      const height = Number(activeNode.props.height || 60);
      const currentX = Number(activeNode.props.x || 0);
      const currentY = Number(activeNode.props.y || 0);

      activeNode.props.x = clampPosition(currentX + delta.x, 0, canvasWidth - width);
      activeNode.props.y = clampPosition(currentY + delta.y, 0, canvasHeight - height);
      activeNode.props.zIndex = draft.root.children.length + 1;
    });

    set({
      schema: nextSchema,
      selectedId: activeId,
    });
  },
  commitNodeMove: () => {
    const { schema, dragSnapshot } = get();
    if (!schema || !dragSnapshot) {
      return;
    }

    set((state) => ({
      schema: cloneSchema(schema),
      dragSnapshot: null,
      history: [...state.history, cloneSchema(dragSnapshot)].slice(-MAX_HISTORY),
      future: [],
    }));
  },
  cancelNodeMove: () => {
    const { dragSnapshot } = get();
    if (!dragSnapshot) {
      return;
    }

    set({
      schema: cloneSchema(dragSnapshot),
      dragSnapshot: null,
    });
  },
  updateNodeName: (nodeId, name) => {
    commitNodeChange(get, set, nodeId, (targetNode) => {
      targetNode.name = name;
    });
  },
  updateSelectedName: (name) => {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }

    get().updateNodeName(selectedId, name);
  },
  updateNodeTitle: (nodeId, title) => {
    commitNodeChange(get, set, nodeId, (targetNode) => {
      targetNode.title = title;
    });
  },
  updateSelectedTitle: (title) => {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }

    get().updateNodeTitle(selectedId, title);
  },
  updateNodeProps: (nodeId, patch) => {
    commitNodeChange(get, set, nodeId, (targetNode) => {
      targetNode.props = {
        ...targetNode.props,
        ...patch,
      };
    });
  },
  updateSelectedProps: (patch) => {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }

    get().updateNodeProps(selectedId, patch);
  },
  replaceNodeProps: (nodeId, nextProps) => {
    commitNodeChange(get, set, nodeId, (targetNode) => {
      targetNode.props = nextProps;
    });
  },
  replaceSelectedProps: (nextProps) => {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }

    get().replaceNodeProps(selectedId, nextProps);
  },
  updateNodeVariables: (nodeId, variables) => {
    commitNodeChange(get, set, nodeId, (targetNode) => {
      targetNode.variables = variables;
    });
  },
  updateSelectedVariables: (variables) => {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }

    get().updateNodeVariables(selectedId, variables);
  },
  updateNodeScripts: (nodeId, patch) => {
    commitNodeChange(get, set, nodeId, (targetNode) => {
      targetNode.scripts = {
        ...targetNode.scripts,
        ...patch,
      };
    });
  },
  updateSelectedScripts: (patch) => {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }

    get().updateNodeScripts(selectedId, patch);
  },
  updatePageVariables: (variables) => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    const nextSchema = buildNextState(schema, (draft) => {
      draft.variables = variables;
    });

    set((state) => ({
      schema: nextSchema,
      history: [...state.history, cloneSchema(schema)].slice(-MAX_HISTORY),
      future: [],
    }));
  },
  updatePageScripts: (patch) => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    const nextSchema = buildNextState(schema, (draft) => {
      draft.scripts = {
        ...draft.scripts,
        ...patch,
      };
    });

    set((state) => ({
      schema: nextSchema,
      history: [...state.history, cloneSchema(schema)].slice(-MAX_HISTORY),
      future: [],
    }));
  },
  updatePageSettings: (patch) => {
    const { schema } = get();
    if (!schema) {
      return;
    }

    const nextSchema = buildNextState(schema, (draft) => {
      draft.root.props = {
        ...draft.root.props,
        ...patch,
      };
    });

    set((state) => ({
      schema: normalizePageSchema(nextSchema),
      history: [...state.history, cloneSchema(schema)].slice(-MAX_HISTORY),
      future: [],
    }));
  },
  bringSelectedToFront: (nodeId) => {
    commitSelectionOrder(get, set, 'front', nodeId);
  },
  sendSelectedToBack: (nodeId) => {
    commitSelectionOrder(get, set, 'back', nodeId);
  },
  moveSelectedForward: (nodeId) => {
    commitSelectionOrder(get, set, 'forward', nodeId);
  },
  moveSelectedBackward: (nodeId) => {
    commitSelectionOrder(get, set, 'backward', nodeId);
  },
  deleteSelectedNode: (nodeId) => {
    const { schema, selectedId } = get();
    const targetId = nodeId || selectedId;

    if (!schema || !targetId) {
      return;
    }

    const nextSchema = buildNextState(schema, (draft) => {
      draft.root.children = draft.root.children.filter((node) => node.id !== targetId);
      reindexZOrder(draft.root.children);
    });

    set((state) => ({
      schema: nextSchema,
      selectedId: state.selectedId === targetId ? null : state.selectedId,
      history: [...state.history, cloneSchema(schema)].slice(-MAX_HISTORY),
      future: [],
      dragSnapshot: null,
    }));
  },
  undo: () => {
    const { history, future, schema } = get();
    if (!schema || history.length === 0) {
      return;
    }

    const previous = history[history.length - 1];
    set({
      schema: cloneSchema(previous),
      history: history.slice(0, -1),
      future: [cloneSchema(schema), ...future].slice(0, MAX_HISTORY),
      selectedId: null,
    });
  },
  redo: () => {
    const { history, future, schema } = get();
    if (!schema || future.length === 0) {
      return;
    }

    const next = future[0];
    set({
      schema: cloneSchema(next),
      history: [...history, cloneSchema(schema)].slice(-MAX_HISTORY),
      future: future.slice(1),
      selectedId: null,
    });
  },
}));