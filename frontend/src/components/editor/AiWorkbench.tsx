/*
 * 统一 AI 工作台。
 * 负责统一承接排版、组件脚本、页面变量和变量脚本 AI 入口，
 * 并把代理结果拆成需要用户逐条审批的变更动作。
 */
import {
    CheckOutlined,
    CloseOutlined,
    CopyOutlined,
    EyeOutlined,
    InfoCircleOutlined,
    RobotOutlined,
    SendOutlined,
} from '@ant-design/icons';
import { Button, Checkbox, Input, Modal, Popover, Segmented, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { DiffEditor } from '@monaco-editor/react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
    flattenNodes,
    materialCatalog,
    type CanvasPosition,
    type ComponentNode,
    type ComponentScripts,
    type ComponentType,
    type ComponentVariable,
    type ComponentVariableType,
    type PageSchema,
    type PageScripts,
} from '../../schema/pageSchema';
import {
    fetchAiProviders,
    searchSystemVariables as fetchSystemVariables,
    type AiInteractionMode,
    type AiProviderOption,
    type SystemVariableOption,
} from '../../services/aiService';
import { callAiWorkspaceTask } from '../../services/aiTaskService';
import { getComponentProtocol, pageCanvasProtocol } from '../../schema/componentProtocol';

export type AiWorkbenchScope =
    | 'layout'
    | 'component'
    | 'page_settings'
    | 'script'
    | 'page_variables'
    | 'page_variable_script';

export interface AiWorkbenchTarget {
    scope: AiWorkbenchScope;
    nodeId?: string;
    variableId?: string;
    file?: string;
    componentType?: string;
    label?: string;
}

interface AiWorkbenchProps {
    page: PageSchema;
    selectedNode: ComponentNode | null;
    visible: boolean;
    target: AiWorkbenchTarget;
    onVisibleChange: (visible: boolean) => void;
    onTargetChange: (target: AiWorkbenchTarget) => void;
    onRevealNode: (nodeId: string) => void;
    onAddNode: (
        type: ComponentType,
        position?: CanvasPosition,
        options?: {
            title?: string;
            props?: Record<string, unknown>;
        },
    ) => string | null;
    onUpdatePageSettings: (patch: Record<string, unknown>) => void;
    onUpdateNodeProps: (nodeId: string, patch: Record<string, unknown>) => void;
    onUpdateNodeTitle: (nodeId: string, title: string) => void;
    onUpdateNodeScripts: (nodeId: string, patch: Partial<ComponentScripts>) => void;
    onUpdatePageScripts: (patch: Partial<PageScripts>) => void;
    onUpdatePageVariables: (variables: ComponentVariable[]) => void;
}

interface ChatEntry {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

type ActionStatus = 'pending' | 'approved' | 'rejected';
type ContextPickerKind = 'page_variable' | 'system_variable' | 'component';

interface WorkspaceAction {
    id?: string;
    type?: string;
    summary?: string;
    targetRef?: string;
    status?: ActionStatus;
    targetNodeId?: string;
    nodeId?: string;
    targetVariableId?: string;
    variableId?: string;
    file?: string;
    language?: string;
    code?: string;
    script?: string;
    patch?: Record<string, unknown>;
    props?: Record<string, unknown>;
    variable?: Partial<ComponentVariable>;
    name?: string;
    variableName?: string;
    displayName?: string;
    dataType?: string;
    variableType?: string;
    initialValue?: unknown;
    defaultValue?: unknown;
    value?: unknown;
    mode?: string;
    replaceAll?: boolean;
    title?: string;
    nodeType?: ComponentType;
    componentType?: ComponentType;
    materialType?: ComponentType;
    node_type?: ComponentType | string;
    component_type?: ComponentType | string;
    material_type?: ComponentType | string;
    component?: ComponentType | string;
    nodeKind?: ComponentType | string;
    material?: ComponentType | string;
    kind?: ComponentType | string;
    position?: CanvasPosition;
    variables?: Partial<ComponentVariable>[];
    mapping?: Record<string, string>;
}

interface ScriptDiffState {
    actionId?: string;
    title: string;
    language: string;
    originalCode: string;
    proposedCode: string;
    onAccept: (code: string) => void;
}

interface ActionReviewState {
    actionId?: string;
    title: string;
    draft: string;
}

const capabilityList = [
    'search_system_variables',
    'list_page_variables',
    'read_component',
    'read_component_script',
    'propose_change_set',
];

const capabilityDescriptions = [
    '搜索系统变量：按关键词查找泵、阀、状态、故障等系统点位候选。',
    '查看页面变量：读取当前页面变量摘要，用于判断已有状态和业务字段。',
    '读取组件：查看当前组件或用户加入的组件属性摘要。',
    '读取组件脚本：围绕当前目标脚本生成修改建议。',
    '提出变更包：只生成待审批动作，不自动应用、不自动保存。',
];

const supportedWorkspaceActionTypes = new Set([
    'confirm_state_mapping',
    'update_component_props',
    'update_component_script',
    'update_page_settings',
    'update_page_script',
    'update_page_variables',
    'update_page_variable_script',
    'add_node',
    'update_node_layout',
    'select_node',
]);

const supportedComponentTypes = new Set(materialCatalog.map((item) => item.type));

function createEntry(role: 'user' | 'assistant', content: string): ChatEntry {
    return {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
    };
}

function getDefaultProviderKey(providers: AiProviderOption[]) {
    return providers[0]?.providerKey || '';
}

function normalizeScriptFile(file?: string) {
    const text = String(file || '').trim().replace(/\.js$/i, '');
    const supportedKeys = ['onClick', 'onOpen', 'onClose', 'onTimer', 'onVariableChange', 'onLoad'];
    return supportedKeys.find((item) => item.toLowerCase() === text.toLowerCase()) || '';
}

function normalizeWorkspaceActionType(type?: string) {
    return String(type || '').trim();
}

function normalizeComponentTypeValue(value?: unknown) {
    const rawValue = String(value || '').trim();
    const normalizedType = materialCatalog.find((item) =>
        item.type.toLowerCase() === rawValue.toLowerCase(),
    )?.type;

    return normalizedType || null;
}

function normalizeVariableType(type?: unknown): ComponentVariableType {
    const value = String(type || '').trim().toLowerCase();
    if (value === 'bool' || value === 'boolean') {
        return 'boolean';
    }
    if (value === 'number' || value === 'int' || value === 'float' || value === 'double') {
        return 'number';
    }
    if (value === 'json' || value === 'object' || value === 'array') {
        return 'json';
    }
    return 'string';
}

function normalizePageVariableName(name?: unknown) {
    return String(name || '').trim().replace(/^page\./, '');
}

function normalizeVariableDataType(type: ComponentVariableType, dataType?: unknown) {
    const rawType = String(dataType || '').trim().toUpperCase();
    if (rawType) {
        return rawType;
    }
    if (type === 'boolean') {
        return 'BOOL';
    }
    if (type === 'number') {
        return 'DOUBLE';
    }
    if (type === 'json') {
        return 'JSON';
    }
    return 'STRING';
}

function createPageVariableDraft(variable: Partial<ComponentVariable>): ComponentVariable | null {
    const name = normalizePageVariableName(variable.name);
    if (!name) {
        return null;
    }

    const type = normalizeVariableType(variable.type || variable.dataType);
    const variableValue = (variable as { value?: unknown }).value;
    const initialValue = variable.initialValue ?? variableValue ?? (
        type === 'boolean' ? 'false' : type === 'number' ? '0' : ''
    );

    return {
        id: String(variable.id || `var-${Math.random().toString(36).slice(2, 10)}`),
        name,
        displayName: String(variable.displayName || name),
        type,
        dataType: normalizeVariableDataType(type, variable.dataType),
        rwMode: variable.rwMode || 'RW',
        unit: variable.unit || '',
        initialValue: String(initialValue),
        summary: String(variable.summary || ''),
        customExtra: variable.customExtra || {},
        scripts: {
            onChange: String(variable.scripts?.onChange || ''),
        },
    };
}

function readRawActionVariables(action: WorkspaceAction): Partial<ComponentVariable>[] {
    if (Array.isArray(action.variables)) {
        return action.variables;
    }
    return [];
}

function findExistingPageVariable(
    current: ComponentVariable[],
    variable: Partial<ComponentVariable>,
) {
    const id = String(variable.id || '').trim();
    if (id) {
        const match = current.find((item) => item.id === id);
        if (match) {
            return match;
        }
    }

    const name = normalizePageVariableName(variable.name);
    return name
        ? current.find((item) => normalizePageVariableName(item.name) === name) || null
        : null;
}

function isCompletePageVariableDefinition(variable: Partial<ComponentVariable>) {
    const record = variable as Record<string, unknown>;
    const hasName = Boolean(normalizePageVariableName(variable.name));
    const hasType = Boolean(variable.type || variable.dataType);
    const hasInitialValue = Object.prototype.hasOwnProperty.call(record, 'initialValue')
        || Object.prototype.hasOwnProperty.call(record, 'defaultValue')
        || Object.prototype.hasOwnProperty.call(record, 'value');

    return hasName && hasType && hasInitialValue;
}

function hasPageVariablePatch(variable: Partial<ComponentVariable>) {
    return Object.keys(variable as Record<string, unknown>).some((key) =>
        key !== 'id' && key !== 'name' && key !== 'displayName',
    );
}

function isValidPageVariableChange(
    variable: Partial<ComponentVariable>,
    current: ComponentVariable[],
) {
    if (isCompletePageVariableDefinition(variable)) {
        return true;
    }

    return Boolean(findExistingPageVariable(current, variable))
        && hasPageVariablePatch(variable);
}

function mergePageVariablePatch(
    current: ComponentVariable,
    patch: Partial<ComponentVariable>,
) {
    const record = patch as Record<string, unknown>;
    const nextInitialValue = Object.prototype.hasOwnProperty.call(record, 'value')
        ? record.value
        : Object.prototype.hasOwnProperty.call(record, 'defaultValue')
            ? record.defaultValue
            : patch.initialValue;
    const nextType = patch.type || (
        patch.dataType ? normalizeVariableType(patch.dataType) : current.type
    );

    return {
        ...current,
        ...patch,
        name: normalizePageVariableName(patch.name) || current.name,
        displayName: String(patch.displayName || current.displayName || current.name),
        type: nextType,
        dataType: patch.dataType || current.dataType || normalizeVariableDataType(nextType),
        rwMode: patch.rwMode || current.rwMode || 'RW',
        unit: patch.unit ?? current.unit ?? '',
        initialValue: nextInitialValue === undefined
            ? current.initialValue
            : String(nextInitialValue),
        summary: patch.summary ?? current.summary ?? '',
        customExtra: patch.customExtra || current.customExtra || {},
        scripts: {
            ...current.scripts,
            ...patch.scripts,
        },
    };
}

function readActionVariables(
    action: WorkspaceAction,
    current: ComponentVariable[],
) {
    return readRawActionVariables(action)
        .map((item) => {
            const existing = findExistingPageVariable(current, item);
            if (existing) {
                return mergePageVariablePatch(existing, item);
            }
            return createPageVariableDraft(item);
        })
        .filter(Boolean) as ComponentVariable[];
}

function mergePageVariables(
    current: ComponentVariable[],
    incoming: ComponentVariable[],
    replaceAll?: boolean,
) {
    if (replaceAll) {
        return incoming;
    }

    const byKey = new Map(current.map((item) => [normalizePageVariableName(item.name), item]));
    incoming.forEach((variable) => {
        const key = normalizePageVariableName(variable.name);
        byKey.set(key, {
            ...(byKey.get(key) || {}),
            ...variable,
        });
    });
    return Array.from(byKey.values());
}

function resolveAddNodeType(action: WorkspaceAction) {
    const explicitType = [
        action.nodeType,
        action.componentType,
        action.materialType,
        action.node_type,
        action.component_type,
        action.material_type,
        action.component,
        action.nodeKind,
        action.material,
        action.kind,
    ].map((item) => normalizeComponentTypeValue(item)).find(Boolean);

    return explicitType || null;
}

function buildActionPatch(action: WorkspaceAction) {
    return {
        ...(action.props || {}),
        ...(action.patch || {}),
    };
}

function readNumber(value: unknown) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function resolveAddNodePosition(action: WorkspaceAction) {
    const patch = buildActionPatch(action);
    const x = readNumber(action.position?.x ?? patch.x);
    const y = readNumber(action.position?.y ?? patch.y);
    return x === null || y === null
        ? undefined
        : { x, y };
}

function buildScriptFileName(scriptKey: string) {
    return `${scriptKey}.js`;
}

function buildScopedVariableKey(variable: ComponentVariable) {
    const name = variable.name.startsWith('page.')
        ? variable.name.slice(5)
        : variable.name;
    return `page.${name}`;
}

function buildPageVariableSummary(variable: ComponentVariable) {
    return {
        id: variable.id,
        source: 'page_variable',
        key: buildScopedVariableKey(variable),
        name: variable.name,
        displayName: variable.displayName || variable.summary || variable.name,
        dataType: variable.dataType || variable.type,
        rwMode: variable.rwMode || 'RW',
        unit: variable.unit || '',
        summary: variable.summary || '',
    };
}

function getComponentTypeLabel(type: ComponentType | string | undefined) {
    const typeLabels: Record<string, string> = {
        container: '容器',
        customHtml: 'HTML',
        text: '文本',
        button: '按钮',
        input: '输入框',
        table: '表格',
        chart: '图表',
        image: '图片',
    };
    return typeLabels[String(type || '')] || String(type || '组件');
}

function getComponentTitle(node: ComponentNode) {
    return String(node.title || node.name || node.id || '未命名组件');
}

function buildComponentDisplayLabel(node: ComponentNode) {
    return `${getComponentTypeLabel(node.type)} · ${getComponentTitle(node)}`;
}

function normalizeComponentTargetLabel(label: string | undefined, node: ComponentNode | null) {
    if (!label || !node) {
        return label || '';
    }

    const displayLabel = buildComponentDisplayLabel(node);
    if (label.startsWith(displayLabel)) {
        return label;
    }

    const rawTitle = getComponentTitle(node);
    if (label.startsWith(rawTitle)) {
        return `${displayLabel}${label.slice(rawTitle.length)}`;
    }

    return label;
}

function buildComponentSummary(node: ComponentNode) {
    const protocol = getComponentProtocol(node.type);
    const supportedScriptFiles = protocol.supportedEvents
        .map((item) => buildScriptFileName(item.key));
    return {
        id: node.id,
        source: 'component',
        type: node.type,
        name: node.name,
        title: node.title,
        protocol: {
            title: protocol.title,
            summary: protocol.summary,
            usage: protocol.usage,
            supportedEvents: protocol.supportedEvents.map((item) => ({
                key: item.key,
                file: buildScriptFileName(item.key),
                label: item.label,
                summary: item.summary,
                sharedWithAi: item.sharedWithAi,
            })),
            supportedMethods: protocol.supportedMethods.map((item) => ({
                name: item.name,
                summary: item.summary,
                signature: item.signature,
                example: item.example || '',
            })),
            properties: protocol.properties.map((item) => ({
                name: item.name,
                type: item.type,
                required: item.required,
                summary: item.summary,
                usage: item.usage,
                example: item.example || '',
            })),
            aiHints: protocol.aiHints,
        },
        x: Number(node.props.x || 0),
        y: Number(node.props.y || 0),
        width: Number(node.props.width || 0),
        height: Number(node.props.height || 0),
        supportedScriptFiles,
        visibleScriptFiles: supportedScriptFiles,
        props: {
            width: node.props.width,
            height: node.props.height,
            binding: node.props.binding,
            writeBack: node.props.writeBack,
        },
    };
}

function buildComponentBrief(node: ComponentNode) {
    const protocol = getComponentProtocol(node.type);
    return {
        id: node.id,
        type: node.type,
        name: node.name,
        title: node.title,
        summary: protocol.summary,
        text: String(node.props.text || ''),
        x: Number(node.props.x || 0),
        y: Number(node.props.y || 0),
        width: Number(node.props.width || 0),
        height: Number(node.props.height || 0),
        supportedScriptFiles: protocol.supportedEvents.map((item) => buildScriptFileName(item.key)),
        supportedMethodNames: protocol.supportedMethods.map((item) => item.name),
    };
}

function getSupportedScriptKeysForNode(node: ComponentNode) {
    return getComponentProtocol(node.type).supportedEvents.map((item) => item.key);
}

function getSupportedPageScriptKeys() {
    return pageCanvasProtocol.supportedEvents.map((item) => item.key);
}

function buildPageProtocolSummary() {
    return {
        title: pageCanvasProtocol.title,
        summary: pageCanvasProtocol.summary,
        usage: pageCanvasProtocol.usage,
        supportedEvents: pageCanvasProtocol.supportedEvents.map((item) => ({
            key: item.key,
            file: buildScriptFileName(item.key),
            label: item.label,
            summary: item.summary,
            sharedWithAi: item.sharedWithAi,
        })),
        properties: pageCanvasProtocol.properties.map((item) => ({
            name: item.name,
            type: item.type,
            required: item.required,
            summary: item.summary,
            usage: item.usage,
            example: item.example || '',
        })),
        aiHints: pageCanvasProtocol.aiHints,
    };
}

function resolveSupportedScriptKey(
    requestedFile: string | undefined,
    supportedKeys: string[],
    fallbackFile?: string,
) {
    const requestedKey = normalizeScriptFile(requestedFile);
    if (supportedKeys.includes(requestedKey)) {
        return requestedKey;
    }

    const fallbackKey = normalizeScriptFile(fallbackFile);
    if (fallbackFile && supportedKeys.includes(fallbackKey)) {
        return fallbackKey;
    }

    if (requestedKey === 'onLoad' && supportedKeys.includes('onOpen')) {
        return 'onOpen';
    }

    return supportedKeys[0] || requestedKey;
}

function extractChangeSetActions(result: unknown): WorkspaceAction[] {
    if (!result || typeof result !== 'object') {
        return [];
    }

    const root = result as {
        changeSet?: { actions?: unknown };
        actions?: unknown;
    };
    const actions = Array.isArray(root.changeSet?.actions)
        ? root.changeSet?.actions
        : Array.isArray(root.actions)
            ? root.actions
            : [];

    return actions.map((item, index) => {
        const action = item && typeof item === 'object'
            ? item as WorkspaceAction
            : {};
        const normalizedStatus: ActionStatus = action.status === 'approved'
            || action.status === 'rejected'
            ? action.status
            : 'pending';
        const normalizedAction: WorkspaceAction = {
            ...action,
            id: action.id || `action-${Date.now()}-${index}`,
            type: normalizeWorkspaceActionType(action.type),
            status: normalizedStatus,
        };
        if (normalizedAction.type === 'add_node') {
            normalizedAction.nodeType = resolveAddNodeType(normalizedAction) || undefined;
            normalizedAction.targetRef = normalizedAction.targetRef
                || `new_node:${normalizedAction.id}`;
        }
        if (normalizedAction.type === 'update_page_variables') {
            normalizedAction.targetRef = normalizedAction.targetRef || 'page_variables';
        }
        return normalizedAction;
    });
}

function readNeedsContext(result: unknown) {
    if (!result || typeof result !== 'object') {
        return [];
    }

    const needsContext = (result as { needsContext?: unknown }).needsContext;
    return Array.isArray(needsContext) ? needsContext : [];
}

function formatNeedsContext(needsContext: unknown[]) {
    const lines = needsContext.map((item) => {
        if (!item || typeof item !== 'object') {
            return String(item || '');
        }

        const contextItem = item as {
            type?: unknown;
            question?: unknown;
            message?: unknown;
            reason?: unknown;
            keyword?: unknown;
        };
        const type = String(contextItem.type || '');
        const question = String(contextItem.question || contextItem.message || '').trim();
        const reason = String(contextItem.reason || '').trim();
        const keyword = String(contextItem.keyword || '').trim();

        if (type === 'ask_user') {
            return question || reason || '请补充变量名称、类型或初始值。';
        }
        if (type === 'system_variable_search') {
            return [
                keyword ? `建议搜索系统变量：${keyword}` : '需要补充系统变量。',
                reason,
            ].filter(Boolean).join('。');
        }
        return [question, reason, keyword ? `关键词：${keyword}` : ''].filter(Boolean).join('。')
            || '需要补充上下文。';
    }).filter(Boolean);

    return lines.length > 0
        ? lines.join('\n')
        : '需要补充上下文。';
}

function findNodeById(nodes: ComponentNode[], nodeId: string) {
    return nodes.find((item) => item.id === nodeId) || null;
}

function parseTargetRefId(targetRef: string | undefined, prefixes: string[]) {
    const ref = String(targetRef || '').trim();
    if (!ref) {
        return '';
    }

    for (const prefix of prefixes) {
        const marker = `${prefix}:`;
        if (ref.startsWith(marker)) {
            return ref.slice(marker.length).split(':')[0]?.trim() || '';
        }
    }

    return '';
}

function resolveActionNodeId(action: WorkspaceAction, fallbackNodeId = '') {
    return action.targetNodeId
        || action.nodeId
        || parseTargetRefId(action.targetRef, ['component', 'node'])
        || fallbackNodeId;
}

function resolveActionVariableId(action: WorkspaceAction, fallbackVariableId = '') {
    return action.targetVariableId
        || action.variableId
        || parseTargetRefId(action.targetRef, ['page_variable', 'variable'])
        || fallbackVariableId;
}

function containsScadaBridgeCall(action: WorkspaceAction) {
    return /\bScadaBridge\s*\./.test(String(action.code || action.script || ''));
}

function isScriptAction(action: WorkspaceAction) {
    return action.type === 'update_component_script'
        || action.type === 'update_page_script'
        || action.type === 'update_page_variable_script';
}

function getActionStatusText(status?: ActionStatus) {
    if (status === 'approved') {
        return '已确认';
    }
    if (status === 'rejected') {
        return '已拒绝';
    }
    return '待确认';
}

function getActionTypeText(type?: string) {
    const labels: Record<string, string> = {
        confirm_state_mapping: '状态映射',
        update_component_props: '组件属性',
        update_component_script: '组件脚本',
        update_page_settings: '页面设置',
        update_page_script: '页面脚本',
        update_page_variables: '页面变量',
        update_page_variable_script: '变量脚本',
        add_node: '新增组件',
        update_node_layout: '组件布局',
        select_node: '选中组件',
    };
    return labels[String(type || '')] || String(type || '动作');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyRecord(value: unknown) {
    return isPlainRecord(value) && Object.keys(value).length > 0;
}

function validateWorkspaceAction(
    action: WorkspaceAction,
    nodes: ComponentNode[],
    page: PageSchema,
): string | null {
    const type = String(action.type || '');
    if (!supportedWorkspaceActionTypes.has(type)) {
        return `不支持的动作类型：${type || '(空)'}`;
    }

    if (!String(action.summary || '').trim()) {
        return `${type} 缺少 summary`;
    }

    if (!String(action.targetRef || '').trim()) {
        return `${type} 缺少 targetRef`;
    }

    if (type === 'confirm_state_mapping') {
        return hasNonEmptyRecord(action.mapping)
            ? null
            : 'confirm_state_mapping 缺少 mapping';
    }

    if (type === 'update_page_settings') {
        return hasNonEmptyRecord(action.patch)
            ? null
            : 'update_page_settings 缺少 patch';
    }

    if (type === 'update_page_script') {
        if (!String(action.file || '').trim()) {
            return 'update_page_script 缺少 file';
        }
        const scriptKey = normalizeScriptFile(action.file);
        const supportedKeys = getSupportedPageScriptKeys();
        if (!supportedKeys.includes(scriptKey)) {
            return `update_page_script 不支持 ${action.file}，可用文件：${supportedKeys.map((item) => buildScriptFileName(item)).join('、')}`;
        }
        return String(action.code || action.script || '').trim()
            ? null
            : 'update_page_script 缺少 code';
    }

    if (type === 'update_page_variables') {
        const rawVariables = readRawActionVariables(action);
        if (rawVariables.length === 0) {
            return 'update_page_variables 必须使用 variables[] 声明变量';
        }
        return rawVariables.every((item) => isValidPageVariableChange(item, page.variables))
            ? null
            : 'update_page_variables 新增变量必须包含 name、type/dataType 和 initialValue/defaultValue/value；修改已有变量必须用 id/name 指向现有变量并提供要修改的字段';
    }

    if (type === 'update_page_variable_script') {
        const variableId = resolveActionVariableId(action);
        const variable = page.variables.find((item) => item.id === variableId);
        if (!variable) {
            return 'update_page_variable_script 的目标变量不存在';
        }
        return String(action.code || action.script || '').trim()
            ? null
            : 'update_page_variable_script 缺少 code';
    }

    if (type === 'add_node') {
        return resolveAddNodeType(action)
            ? null
            : 'add_node 缺少有效 nodeType';
    }

    const nodeId = resolveActionNodeId(action);
    if (!findNodeById(nodes, nodeId)) {
        return `${type} 的目标组件不存在`;
    }

    if (type === 'select_node') {
        return null;
    }

    if (type === 'update_component_script') {
        if (!String(action.file || '').trim()) {
            return 'update_component_script 缺少 file';
        }
        const node = findNodeById(nodes, nodeId);
        const scriptKey = normalizeScriptFile(action.file);
        const supportedKeys = node ? getSupportedScriptKeysForNode(node) : [];
        if (!supportedKeys.includes(scriptKey)) {
            return `update_component_script 不支持 ${action.file}，可用文件：${supportedKeys.map((item) => buildScriptFileName(item)).join('、')}`;
        }
        return String(action.code || action.script || '').trim()
            ? null
            : 'update_component_script 缺少 code';
    }

    if (type === 'update_component_props' || type === 'update_node_layout') {
        return hasNonEmptyRecord(action.patch) || hasNonEmptyRecord(action.props)
            ? null
            : `${type} 缺少 patch 或 props`;
    }

    return null;
}

export default function AiWorkbench({
    page,
    selectedNode,
    visible,
    target,
    onVisibleChange,
    onTargetChange,
    onRevealNode,
    onAddNode,
    onUpdatePageSettings,
    onUpdateNodeProps,
    onUpdateNodeTitle,
    onUpdateNodeScripts,
    onUpdatePageScripts,
    onUpdatePageVariables,
}: AiWorkbenchProps) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [providers, setProviders] = useState<AiProviderOption[]>([]);
    const [interactionMode, setInteractionMode] = useState<AiInteractionMode>('agent');
    const [providerKey, setProviderKey] = useState('');
    const [history, setHistory] = useState<ChatEntry[]>([
        createEntry('assistant', '统一 AI 工作台已就绪。当前默认带页面变量摘要，可手动加入系统变量或组件上下文。'),
    ]);
    const [systemKeyword, setSystemKeyword] = useState('');
    const [systemLoading, setSystemLoading] = useState(false);
    const [systemResults, setSystemResults] = useState<SystemVariableOption[]>([]);
    const [pageVariableKeyword, setPageVariableKeyword] = useState('');
    const [selectedPageVariableIds, setSelectedPageVariableIds] = useState<string[]>([]);
    const [selectedSystemVariables, setSelectedSystemVariables] = useState<SystemVariableOption[]>([]);
    const [componentKeyword, setComponentKeyword] = useState('');
    const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
    const [contextPickerKind, setContextPickerKind] = useState<ContextPickerKind>('page_variable');
    const [actions, setActions] = useState<WorkspaceAction[]>([]);
    const [scriptDiff, setScriptDiff] = useState<ScriptDiffState | null>(null);
    const [actionReview, setActionReview] = useState<ActionReviewState | null>(null);
    const [windowPosition, setWindowPosition] = useState({ x: 24, y: 84 });
    const diffEditorRef = useRef<any>(null);
    const historyRef = useRef<HTMLDivElement>(null);
    const windowDragRef = useRef<{
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);

    const allNodes = useMemo(
        () => flattenNodes(page.root).filter((item) => item.id !== page.root.id),
        [page.root],
    );
    const selectedComponents = useMemo(() => {
        const ids = new Set(selectedComponentIds);
        if (selectedNode) {
            ids.add(selectedNode.id);
        }
        if (target.nodeId) {
            ids.add(target.nodeId);
        }
        return allNodes.filter((item) => ids.has(item.id));
    }, [allNodes, selectedComponentIds, selectedNode, target.nodeId]);
    const componentResults = useMemo(() => {
        const keyword = componentKeyword.trim().toLowerCase();
        if (!keyword) {
            return allNodes.slice(0, 20);
        }
        return allNodes.filter((item) =>
            item.title.toLowerCase().includes(keyword)
            || item.name.toLowerCase().includes(keyword)
            || String(item.props.text || '').toLowerCase().includes(keyword)
            || item.type.toLowerCase().includes(keyword),
        ).slice(0, 20);
    }, [allNodes, componentKeyword]);
    const selectedPageVariables = useMemo(() =>
        page.variables.filter((item) => selectedPageVariableIds.includes(item.id)),
    [page.variables, selectedPageVariableIds]);
    const pageVariableResults = useMemo(() => {
        const keyword = pageVariableKeyword.trim().toLowerCase();
        if (!keyword) {
            return page.variables.slice(0, 80);
        }
        return page.variables.filter((item) => [
            item.name,
            item.displayName,
            item.summary,
            item.dataType,
            item.type,
        ].join(' ').toLowerCase().includes(keyword)).slice(0, 80);
    }, [page.variables, pageVariableKeyword]);
    const pageVariableOptions = useMemo(() =>
        page.variables.map((item) => {
            const selected = selectedPageVariableIds.includes(item.id);
            return {
                value: item.id,
                disabled: selected,
                label: (
                    <div className="ai-workbench-select-option">
                        <strong>{item.displayName || item.name}</strong>
                        <small>
                            {buildScopedVariableKey(item)}
                            {item.summary ? ` · ${item.summary}` : ''}
                        </small>
                    </div>
                ),
            };
        }),
    [page.variables, selectedPageVariableIds]);
    const systemVariableOptions = useMemo(() =>
        systemResults.map((item) => {
            const selected = selectedSystemVariables.some((variable) => variable.id === item.id);
            return {
                value: String(item.id),
                disabled: selected,
                label: (
                    <div className="ai-workbench-select-option">
                        <strong>{item.name || item.varTag}</strong>
                        <small>
                            {item.varTag}
                            {item.description ? ` · ${item.description}` : ''}
                        </small>
                    </div>
                ),
            };
        }),
    [selectedSystemVariables, systemResults]);
    const componentOptions = useMemo(() =>
        componentResults.map((item) => {
            const selected = selectedComponentIds.includes(item.id);
            return {
                value: item.id,
                disabled: selected,
                label: (
                    <div className="ai-workbench-select-option">
                        <strong>{buildComponentDisplayLabel(item)}</strong>
                        <small>
                            {item.name || item.id}
                            {item.props.text ? ` · ${String(item.props.text)}` : ''}
                        </small>
                    </div>
                ),
            };
        }),
    [componentResults, selectedComponentIds]);

    useEffect(() => {
        let cancelled = false;
        void fetchAiProviders()
            .then((nextProviders) => {
                if (cancelled) {
                    return;
                }
                setProviders(nextProviders);
                setProviderKey((current) => current || getDefaultProviderKey(nextProviders));
            })
            .catch(() => {
                if (!cancelled) {
                    setProviders([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        historyRef.current?.scrollTo({
            top: historyRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }, [history, actions]);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            const drag = windowDragRef.current;
            if (!drag) {
                return;
            }

            const nextX = drag.originX + event.clientX - drag.startX;
            const nextY = drag.originY + event.clientY - drag.startY;
            setWindowPosition({
                x: Math.max(8, Math.min(nextX, window.innerWidth - 160)),
                y: Math.max(8, Math.min(nextY, window.innerHeight - 80)),
            });
        };
        const handleMouseUp = () => {
            windowDragRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const currentTargetText = useMemo(() => {
        const targetNode = target.nodeId
            ? findNodeById(allNodes, target.nodeId)
            : selectedNode;
        const normalizedLabel = normalizeComponentTargetLabel(target.label, targetNode);
        if (normalizedLabel) {
            return normalizedLabel;
        }
        if (target.scope === 'layout') {
            return '页面排版';
        }
        if (target.scope === 'page_variables') {
            return '页面变量';
        }
        if (target.scope === 'page_settings') {
            return '页面设置';
        }
        if (target.scope === 'page_variable_script') {
            return `变量脚本 ${target.file || 'onChange.js'}`;
        }
        if (target.scope === 'script') {
            return `脚本 ${target.file || ''}`;
        }
        return selectedNode
            ? buildComponentDisplayLabel(selectedNode)
            : '当前组件';
    }, [allNodes, selectedNode, target]);
    const pendingActions = useMemo(() =>
        actions.filter((item) => item.status !== 'approved' && item.status !== 'rejected'),
    [actions]);

    const handleSearchSystemVariables = useCallback(async (
        rawKeyword = systemKeyword,
        silent = false,
    ) => {
        const keyword = rawKeyword.trim();
        if (!keyword) {
            if (!silent) {
                message.warning('请输入系统变量关键词');
            }
            return;
        }
        setSystemLoading(true);
        try {
            const results = await fetchSystemVariables(keyword, 20);
            setSystemResults(results);
            if (!silent && results.length === 0) {
                message.info('没有匹配的系统变量');
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '系统变量搜索失败');
        } finally {
            setSystemLoading(false);
        }
    }, [systemKeyword]);

    useEffect(() => {
        const keyword = systemKeyword.trim();
        if (!keyword) {
            setSystemResults([]);
            return;
        }

        const timer = window.setTimeout(() => {
            void handleSearchSystemVariables(keyword, true);
        }, 280);

        return () => window.clearTimeout(timer);
    }, [handleSearchSystemVariables, systemKeyword]);

    const addSystemVariable = (variable: SystemVariableOption) => {
        setSelectedSystemVariables((previous) =>
            previous.some((item) => item.id === variable.id)
                ? previous
                : [...previous, variable],
        );
    };

    const addPageVariable = (variableId: string) => {
        setSelectedPageVariableIds((previous) =>
            previous.includes(variableId) ? previous : [...previous, variableId],
        );
    };

    const removePageVariable = (variableId: string) => {
        setSelectedPageVariableIds((previous) =>
            previous.filter((item) => item !== variableId),
        );
    };

    const removeSystemVariable = (variableId: number) => {
        setSelectedSystemVariables((previous) =>
            previous.filter((item) => item.id !== variableId),
        );
    };

    const toggleSystemVariable = (variable: SystemVariableOption, checked: boolean) => {
        if (checked) {
            addSystemVariable(variable);
            return;
        }
        removeSystemVariable(variable.id);
    };

    const togglePageVariable = (variableId: string, checked: boolean) => {
        if (checked) {
            addPageVariable(variableId);
            return;
        }
        removePageVariable(variableId);
    };

    const addComponent = (nodeId: string) => {
        setSelectedComponentIds((previous) =>
            previous.includes(nodeId) ? previous : [...previous, nodeId],
        );
    };

    const removeComponent = (nodeId: string) => {
        setSelectedComponentIds((previous) =>
            previous.filter((item) => item !== nodeId),
        );
    };

    const toggleComponent = (nodeId: string, checked: boolean) => {
        if (checked) {
            addComponent(nodeId);
            return;
        }
        removeComponent(nodeId);
    };

    const beginWindowDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
        const targetElement = event.target as HTMLElement;
        if (targetElement.closest('button,input,textarea,.ant-select,.ant-segmented,.ant-tag')) {
            return;
        }

        event.preventDefault();
        windowDragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: windowPosition.x,
            originY: windowPosition.y,
        };
    };

    const updateActionStatus = (actionId: string | undefined, status: ActionStatus) => {
        setActions((previous) =>
            previous.map((action) =>
                action.id === actionId ? { ...action, status } : action,
            ),
        );
    };

    const buildContext = () => {
        const targetNode = target.nodeId
            ? findNodeById(allNodes, target.nodeId)
            : selectedNode;
        const targetSupportedScriptFiles = targetNode
            ? getSupportedScriptKeysForNode(targetNode).map((item) => buildScriptFileName(item))
            : [];
        const pageSupportedScriptFiles = getSupportedPageScriptKeys().map((item) => buildScriptFileName(item));

        return {
            target,
            targetScriptPolicy: {
                currentFile: target.file || '',
                selectedComponentSupportedFiles: targetSupportedScriptFiles,
                pageSupportedFiles: pageSupportedScriptFiles,
                rule: '脚本动作的 file 必须使用 supportedFiles 中存在的文件；文件选择不明确时先返回 needs_context，不要改写到其它文件。',
            },
            runtimeScriptApi: {
                normalComponentAndPageScripts: {
                    globals: ['vars', 'components', 'tags', 'message', 'change', 'page', 'node'],
                    variableApi: [
                        'vars.get(name) -> RuntimeVariable | null',
                        'vars.getValue(name) -> unknown',
                        'vars.set(name, value, options?)',
                        'vars.patch(name, patch, options?)',
                        'vars.subscribe(name, (value, change, variable) => void) -> unsubscribe',
                    ],
                    tagApi: [
                        'tags.read(tag) -> Promise<RealtimePoint>',
                        'tags.getSnapshot(tag) -> RealtimePoint | null',
                        'tags.subscribe(tag, listener) -> unsubscribe',
                        'tags.write(tag, value, options?) -> Promise<WriteTagResult>',
                    ],
                    componentApi: [
                        'components.call(componentIdOrName, methodName, ...args)',
                        'components.setStyle(componentIdOrName, style)',
                        'components.setProps(componentIdOrName, props)',
                        'components.show(componentIdOrName)',
                        'components.hide(componentIdOrName)',
                        'components.enable(componentIdOrName)',
                        'components.disable(componentIdOrName)',
                    ],
                    hardRules: [
                        '普通页面脚本和普通组件脚本禁止使用 ScadaBridge。',
                        '页面变量订阅必须使用 vars.subscribe；回调第一个参数是变量当前值，不存在 vars.subscribeVar。',
                        '系统变量/后端点位订阅必须使用 tags.subscribe，不存在 ScadaBridge.subscribe。',
                        '动态修改通用样式、显示隐藏和禁用状态优先使用 components.setStyle/show/hide/enable/disable；物料专属能力才使用组件协议 supportedMethods。',
                    ],
                },
                customHtmlScripts: {
                    globals: ['ScadaBridge'],
                    hardRules: [
                        'ScadaBridge 只存在于 customHtml iframe 内部脚本。',
                        'customHtml 以外的组件脚本不能使用 ScadaBridge。',
                    ],
                },
            },
            pageSummary: {
                id: page.id,
                name: page.name,
                canvasWidth: page.root.props.canvasWidth,
                canvasHeight: page.root.props.canvasHeight,
                protocol: buildPageProtocolSummary(),
                supportedScriptFiles: pageSupportedScriptFiles,
                selectedNode: selectedNode ? buildComponentSummary(selectedNode) : null,
                nodes: allNodes.map((item) => buildComponentBrief(item)),
            },
            pageVariables: page.variables.map((item) => buildPageVariableSummary(item)),
            selectedPageVariables: selectedPageVariables.map((item) => buildPageVariableSummary(item)),
            selectedSystemVariables: selectedSystemVariables.map((item) => ({
                ...item,
                source: 'system_variable',
            })),
            selectedComponents: selectedComponents.map((item) => buildComponentSummary(item)),
            capabilities: capabilityList,
            policy: {
                requiresApproval: true,
                noAutoApply: true,
                noAutoSave: true,
                systemVariablesMustBeSelected: true,
            },
        };
    };

    const executePrompt = async () => {
        const text = prompt.trim();
        if (!text || loading) {
            return;
        }

        const userEntry = createEntry('user', text);
        const nextHistory = [...history, userEntry];
        setHistory(nextHistory);
        setPrompt('');
        setLoading(true);

        try {
            const result = await callAiWorkspaceTask({
                providerKey: providerKey || undefined,
                interactionMode,
                messages: nextHistory.map((item) => ({
                    role: item.role,
                    content: item.content,
                })),
                target: {
                    scope: target.scope,
                    pageId: page.id,
                    nodeId: target.nodeId,
                    variableId: target.variableId,
                    file: target.file,
                    componentType: target.componentType,
                },
                context: buildContext(),
            });

            setHistory((previous) => [
                ...previous,
                createEntry('assistant', result.reply || '已处理。'),
            ]);

            if (interactionMode === 'ask') {
                return;
            }

            const extractedActions = extractChangeSetActions(result.result);
            const rejectedReasons: string[] = [];
            const nextActions = extractedActions.filter((action) => {
                const reason = validateWorkspaceAction(action, allNodes, page);
                if (reason) {
                    rejectedReasons.push(`${action.summary || action.type || action.id}: ${reason}`);
                    return false;
                }
                return true;
            });
            setActions(nextActions);
            if (rejectedReasons.length > 0) {
                setHistory((previous) => [
                    ...previous,
                    createEntry(
                        'assistant',
                        `已拦截 ${rejectedReasons.length} 个无效动作：\n${rejectedReasons.join('\n')}`,
                    ),
                ]);
            }
            const needsContext = readNeedsContext(result.result);
            if (needsContext.length > 0) {
                const firstSearch = needsContext.find((item) =>
                    item && typeof item === 'object'
                    && (item as { type?: unknown }).type === 'system_variable_search',
                ) as { keyword?: unknown } | undefined;
                if (typeof firstSearch?.keyword === 'string') {
                    setSystemKeyword(firstSearch.keyword);
                }
                setHistory((previous) => [
                    ...previous,
                    createEntry('assistant', formatNeedsContext(needsContext)),
                ]);
            }
        } catch (error) {
            setHistory((previous) => [
                ...previous,
                createEntry('assistant', `AI 调用失败：${error instanceof Error ? error.message : String(error)}`),
            ]);
        } finally {
            setLoading(false);
        }
    };

    const openScriptDiff = (
        action: WorkspaceAction,
        originalCode: string,
        onAccept: (code: string) => void,
    ) => {
        const proposedCode = String(action.code || action.script || '').trim();
        if (!proposedCode) {
            message.warning('该脚本动作没有返回 code，无法进入 Diff');
            return;
        }
        setScriptDiff({
            actionId: action.id,
            title: action.summary || '脚本修改建议',
            language: action.language || 'javascript',
            originalCode,
            proposedCode,
            onAccept: (code) => {
                onAccept(code);
                updateActionStatus(action.id, 'approved');
            },
        });
    };

    const rejectScriptDiff = () => {
        if (scriptDiff?.actionId) {
            updateActionStatus(scriptDiff.actionId, 'rejected');
        }
        setScriptDiff(null);
    };

    const openActionReview = (action: WorkspaceAction) => {
        if (isScriptAction(action)) {
            approveAction(action);
            return;
        }

        setActionReview({
            actionId: action.id,
            title: action.summary || getActionTypeText(action.type),
            draft: JSON.stringify(action, null, 2),
        });
    };

    const parseReviewedAction = () => {
        if (!actionReview) {
            return null;
        }

        try {
            const parsed = JSON.parse(actionReview.draft) as WorkspaceAction;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                message.error('审阅内容必须是 JSON 对象');
                return null;
            }
            const nextStatus: ActionStatus = parsed.status === 'approved' || parsed.status === 'rejected'
                ? parsed.status
                : 'pending';
            const nextAction: WorkspaceAction = {
                ...parsed,
                id: parsed.id || actionReview.actionId,
                status: nextStatus,
            };
            const invalidReason = validateWorkspaceAction(nextAction, allNodes, page);
            if (invalidReason) {
                message.error(invalidReason);
                return null;
            }
            return nextAction;
        } catch (error) {
            message.error(`JSON 格式错误：${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    };

    const saveReviewedAction = () => {
        const nextAction = parseReviewedAction();
        if (!nextAction) {
            return false;
        }

        setActions((previous) => previous.map((item) =>
            item.id === actionReview?.actionId ? nextAction : item,
        ));
        message.success('审阅内容已更新');
        return true;
    };

    const confirmReviewedAction = () => {
        const nextAction = parseReviewedAction();
        if (!nextAction) {
            return;
        }

        setActions((previous) => previous.map((item) =>
            item.id === actionReview?.actionId ? nextAction : item,
        ));
        setActionReview(null);
        approveAction(nextAction);
    };

    const approveAction = (action: WorkspaceAction) => {
        const invalidReason = validateWorkspaceAction(action, allNodes, page);
        if (invalidReason) {
            message.error(invalidReason);
            return;
        }

        const type = action.type || '';
        if (type === 'confirm_state_mapping') {
            updateActionStatus(action.id, 'approved');
            return;
        }

        if (type === 'update_page_settings') {
            onUpdatePageSettings(action.patch || {});
            updateActionStatus(action.id, 'approved');
            return;
        }

        if (type === 'update_component_props' || type === 'update_node_layout') {
            const nodeId = resolveActionNodeId(action);
            const node = findNodeById(allNodes, nodeId);
            if (!node) {
                message.warning('缺少目标组件');
                return;
            }
            onUpdateNodeProps(nodeId, action.patch || action.props || {});
            if (action.title) {
                onUpdateNodeTitle(nodeId, action.title);
            }
            updateActionStatus(action.id, 'approved');
            return;
        }

        const addNodeType = resolveAddNodeType(action);
        if (type === 'add_node' && addNodeType) {
            const id = onAddNode(addNodeType, resolveAddNodePosition(action), {
                title: action.title,
                props: buildActionPatch(action),
            });
            if (id) {
                onRevealNode(id);
                updateActionStatus(action.id, 'approved');
            }
            return;
        }

        if (type === 'select_node') {
            const nodeId = resolveActionNodeId(action);
            const node = findNodeById(allNodes, nodeId);
            if (!node) {
                message.warning('缺少目标组件');
                return;
            }
            onRevealNode(nodeId);
            updateActionStatus(action.id, 'approved');
            return;
        }

        if (type === 'update_component_script') {
            const pendingMapping = actions.some((item) =>
                item.type === 'confirm_state_mapping' && item.status === 'pending',
            );
            if (pendingMapping) {
                message.warning('请先审批状态映射，再审阅脚本动作');
                return;
            }
            const nodeId = resolveActionNodeId(action, target.nodeId || '');
            const node = findNodeById(allNodes, nodeId);
            if (!node) {
                message.warning('缺少目标组件，无法进入 Diff');
                return;
            }
            const supportedKeys = getSupportedScriptKeysForNode(node);
            const scriptKey = resolveSupportedScriptKey(
                action.file,
                supportedKeys,
                target.file,
            ) as keyof ComponentScripts;
            if (!supportedKeys.includes(scriptKey as string)) {
                message.warning(`当前组件不支持 ${action.file || '该脚本'}，请让 AI 重新生成支持的脚本文件`);
                return;
            }
            if (node.type !== 'customHtml' && containsScadaBridgeCall(action)) {
                message.error('普通组件脚本不能使用 ScadaBridge，请让 AI 按 vars + components.call 重新生成');
                return;
            }
            openScriptDiff(action, String(node?.scripts?.[scriptKey] || ''), (code) => {
                onUpdateNodeScripts(nodeId, { [scriptKey]: code } as Partial<ComponentScripts>);
            });
            return;
        }

        if (type === 'update_page_script') {
            const pendingMapping = actions.some((item) =>
                item.type === 'confirm_state_mapping' && item.status === 'pending',
            );
            if (pendingMapping) {
                message.warning('请先审批状态映射，再审阅脚本动作');
                return;
            }
            const supportedKeys = getSupportedPageScriptKeys();
            const scriptKey = resolveSupportedScriptKey(
                action.file,
                supportedKeys,
                target.file,
            ) as keyof PageScripts;
            if (containsScadaBridgeCall(action)) {
                message.error('页面脚本不能使用 ScadaBridge，请让 AI 按 vars + components.call 重新生成');
                return;
            }
            openScriptDiff(action, String(page.scripts[scriptKey] || ''), (code) => {
                onUpdatePageScripts({ [scriptKey]: code } as Partial<PageScripts>);
            });
            return;
        }

        if (type === 'update_page_variable_script') {
            const pendingMapping = actions.some((item) =>
                item.type === 'confirm_state_mapping' && item.status === 'pending',
            );
            if (pendingMapping) {
                message.warning('请先审批状态映射，再审阅脚本动作');
                return;
            }
            const variableId = resolveActionVariableId(action, target.variableId || '');
            const variable = page.variables.find((item) => item.id === variableId);
            if (!variable) {
                message.warning('缺少目标变量，无法进入 Diff');
                return;
            }
            if (containsScadaBridgeCall(action)) {
                message.error('页面变量脚本不能使用 ScadaBridge，请让 AI 按 vars + components.call 重新生成');
                return;
            }
            openScriptDiff(action, String(variable?.scripts?.onChange || ''), (code) => {
                onUpdatePageVariables(page.variables.map((item) =>
                    item.id === variableId
                        ? { ...item, scripts: { ...item.scripts, onChange: code } }
                        : item,
                ));
            });
            return;
        }

        if (type === 'update_page_variables') {
            const incomingVariables = readActionVariables(action, page.variables);
            onUpdatePageVariables(mergePageVariables(
                page.variables,
                incomingVariables,
                action.mode === 'replace' || action.replaceAll === true,
            ));
            updateActionStatus(action.id, 'approved');
            return;
        }

        message.warning(`暂不支持审批动作：${type}`);
    };

    const renderActionCard = (action: WorkspaceAction) => {
        const isPending = action.status !== 'approved' && action.status !== 'rejected';
        return (
            <div key={action.id} className={`ai-review-card ai-review-card-${action.status || 'pending'}`}>
                <div className="ai-review-card-main">
                    <div className="ai-review-card-top">
                        <span className="ai-review-type">{getActionTypeText(action.type)}</span>
                        <Tag
                            className="ai-review-status"
                            color={action.status === 'approved'
                                ? 'green'
                                : action.status === 'rejected'
                                    ? 'red'
                                    : 'gold'}
                        >
                            {getActionStatusText(action.status)}
                        </Tag>
                    </div>
                    <div className="ai-review-summary">
                        {action.summary || action.targetRef || '待审阅变更'}
                    </div>
                    <div className="ai-review-target">
                        {action.targetRef || action.file || action.nodeId || action.variableId || '未声明目标'}
                    </div>
                </div>
                <div className="ai-review-actions">
                    <Button
                        size="small"
                        className="ai-review-button ai-review-button-review"
                        icon={<EyeOutlined />}
                        disabled={!isPending}
                        onClick={() => openActionReview(action)}
                    >
                        审阅
                    </Button>
                    <Button
                        size="small"
                        type="primary"
                        className="ai-review-button ai-review-button-confirm"
                        icon={<CheckOutlined />}
                        disabled={!isPending}
                        onClick={() => approveAction(action)}
                    >
                        确认
                    </Button>
                    <Button
                        size="small"
                        danger
                        className="ai-review-button ai-review-button-reject"
                        icon={<CloseOutlined />}
                        disabled={!isPending}
                        onClick={() => updateActionStatus(action.id, 'rejected')}
                    >
                        拒绝
                    </Button>
                </div>
            </div>
        );
    };

    const renderContextRow = (
        id: string,
        checked: boolean,
        title: string,
        meta: string,
        onChange: (checked: boolean) => void,
    ) => (
        <label key={id} className="ai-context-picker-row">
            <Checkbox
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span>
                <strong>{title}</strong>
                <small>{meta}</small>
            </span>
        </label>
    );

    const pageVariablePicker = (
        <div className="ai-context-picker">
            <Input
                size="small"
                allowClear
                value={pageVariableKeyword}
                placeholder="筛选页面变量"
                onChange={(event) => setPageVariableKeyword(event.target.value)}
            />
            <div className="ai-context-picker-list">
                {pageVariableResults.map((item) => renderContextRow(
                    item.id,
                    selectedPageVariableIds.includes(item.id),
                    item.displayName || item.name,
                    `${buildScopedVariableKey(item)}${item.summary ? ` · ${item.summary}` : ''}`,
                    (checked) => togglePageVariable(item.id, checked),
                ))}
                {pageVariableResults.length === 0 ? (
                    <div className="ai-context-picker-empty">没有匹配的页面变量</div>
                ) : null}
            </div>
        </div>
    );

    const systemVariablePicker = (
        <div className="ai-context-picker">
            <Input.Search
                size="small"
                allowClear
                loading={systemLoading}
                value={systemKeyword}
                placeholder="搜索系统变量，例如：泵 状态"
                onChange={(event) => setSystemKeyword(event.target.value)}
                onSearch={(value) => void handleSearchSystemVariables(value)}
            />
            <div className="ai-context-picker-list">
                {systemResults.map((item) => renderContextRow(
                    String(item.id),
                    selectedSystemVariables.some((variable) => variable.id === item.id),
                    item.name || item.varTag,
                    `${item.varTag}${item.description ? ` · ${item.description}` : ''}`,
                    (checked) => toggleSystemVariable(item, checked),
                ))}
                {systemResults.length === 0 ? (
                    <div className="ai-context-picker-empty">
                        {systemKeyword.trim() ? '没有匹配的系统变量' : '输入关键词后查询'}
                    </div>
                ) : null}
            </div>
        </div>
    );

    const componentPicker = (
        <div className="ai-context-picker">
            <Input
                size="small"
                allowClear
                value={componentKeyword}
                placeholder="筛选组件"
                onChange={(event) => setComponentKeyword(event.target.value)}
            />
            <div className="ai-context-picker-list">
                {componentResults.map((item) => renderContextRow(
                    item.id,
                    selectedComponentIds.includes(item.id),
                    item.title || item.name,
                    `${item.name || item.type}${item.props.text ? ` · ${String(item.props.text)}` : ''}`,
                    (checked) => toggleComponent(item.id, checked),
                ))}
                {componentResults.length === 0 ? (
                    <div className="ai-context-picker-empty">没有匹配的组件</div>
                ) : null}
            </div>
        </div>
    );

    if (!visible) {
        return null;
    }

    return (
        <div
            className="ai-assistant-window ai-workbench-window"
            style={{ left: windowPosition.x, top: windowPosition.y, width: 520, height: 760 }}
        >
            <div className="ai-assistant-head ai-workbench-head" onMouseDown={beginWindowDrag}>
                <div className="ai-workbench-title-row">
                    <Space size={8}>
                        <RobotOutlined style={{ color: '#38bdf8' }} />
                        <Typography.Text strong className="ai-workbench-title">
                            AI 工作台
                        </Typography.Text>
                        <Tooltip
                            placement="bottomLeft"
                            title={(
                                <div>
                                    {capabilityDescriptions.map((item) => (
                                        <div key={item}>{item}</div>
                                    ))}
                                </div>
                            )}
                        >
                            <Button
                                type="text"
                                size="small"
                                className="ai-workbench-icon-button"
                                icon={<InfoCircleOutlined />}
                            />
                        </Tooltip>
                    </Space>
                    <Button
                        type="text"
                        size="small"
                        icon={<CloseOutlined />}
                        className="ai-workbench-icon-button"
                        onClick={() => onVisibleChange(false)}
                    />
                </div>
                <div className="ai-workbench-target-row">
                    <div className="ai-workbench-target-card">
                        <span>目标</span>
                        <strong>{currentTargetText}</strong>
                    </div>
                    <Space size={8} className="ai-workbench-controls">
                        <Segmented
                            size="small"
                            value={interactionMode}
                            disabled={loading}
                            options={[
                                { label: '提问', value: 'ask' },
                                { label: '代理', value: 'agent' },
                            ]}
                            onChange={(value) => setInteractionMode(value as AiInteractionMode)}
                        />
                        <label className="ai-workbench-provider-field">
                            <span>模型</span>
                            <Select
                                size="small"
                                value={providerKey || undefined}
                                placeholder="默认模型"
                                className="ai-workbench-provider"
                                popupClassName="ai-workbench-select-popup"
                                options={providers.map((item) => ({
                                    label: item.name,
                                    model: item.model,
                                    providerKey: item.providerKey,
                                    value: item.providerKey,
                                }))}
                                optionRender={(option) => (
                                    <div className="ai-model-option">
                                        <strong>{String(option.data.label || '')}</strong>
                                        <small>{String((option.data as { model?: string }).model || '')}</small>
                                    </div>
                                )}
                                onChange={setProviderKey}
                            />
                        </label>
                    </Space>
                </div>
            </div>

            <div className="ai-workbench-context">
                <div className="ai-workbench-context-head">
                    <div>
                        <Typography.Text className="ai-workbench-context-title">
                            上下文
                        </Typography.Text>
                        <Typography.Text className="ai-workbench-context-count">
                            页面变量默认摘要 {page.variables.length} · 已加入 {selectedPageVariables.length + selectedSystemVariables.length + selectedComponentIds.length}
                        </Typography.Text>
                    </div>
                </div>
                <div className="ai-workbench-context-tags">
                    <Tag className="ai-context-chip ai-context-chip-fixed">页面变量摘要 · 默认</Tag>
                    {selectedComponents
                        .filter((item) => !selectedComponentIds.includes(item.id))
                        .map((item) => (
                            <Tag
                                key={item.id}
                                className="ai-context-chip"
                                closable
                                onClose={(event) => {
                                    event.preventDefault();
                                    removeComponent(item.id);
                                }}
                            >
                                当前组件：{buildComponentDisplayLabel(item)}
                            </Tag>
                        ))}
                    {selectedPageVariables.map((item) => (
                        <Tag
                            key={item.id}
                            className="ai-context-chip"
                            closable
                            onClose={(event) => {
                                event.preventDefault();
                                removePageVariable(item.id);
                            }}
                        >
                            页面变量：{item.displayName || buildScopedVariableKey(item)}
                        </Tag>
                    ))}
                    {selectedSystemVariables.map((item) => (
                        <Tag
                            key={item.id}
                            className="ai-context-chip"
                            closable
                            onClose={(event) => {
                                event.preventDefault();
                                removeSystemVariable(item.id);
                            }}
                        >
                            系统变量：{item.name || item.varTag}
                        </Tag>
                    ))}
                    {selectedComponentIds.map((nodeId) => {
                        const node = findNodeById(allNodes, nodeId);
                        if (!node) {
                            return null;
                        }
                        return (
                            <Tag
                                key={nodeId}
                                className="ai-context-chip"
                                closable
                                onClose={(event) => {
                                    event.preventDefault();
                                    removeComponent(nodeId);
                                }}
                            >
                                组件：{buildComponentDisplayLabel(node)}
                            </Tag>
                        );
                    })}
                </div>
                <div className="ai-workbench-context-search">
                    <div className="ai-context-source-tabs">
                        <Popover
                            trigger="click"
                            placement="bottomLeft"
                            overlayClassName="ai-context-picker-popover"
                            content={pageVariablePicker}
                        >
                            <button
                                type="button"
                                className={contextPickerKind === 'page_variable' ? 'active' : ''}
                                onClick={() => setContextPickerKind('page_variable')}
                            >
                                <strong>页面变量</strong>
                                <span>{selectedPageVariables.length}</span>
                            </button>
                        </Popover>
                        <Popover
                            trigger="click"
                            placement="bottom"
                            overlayClassName="ai-context-picker-popover"
                            content={systemVariablePicker}
                        >
                            <button
                                type="button"
                                className={contextPickerKind === 'system_variable' ? 'active' : ''}
                                onClick={() => setContextPickerKind('system_variable')}
                            >
                                <strong>系统变量</strong>
                                <span>{selectedSystemVariables.length}</span>
                            </button>
                        </Popover>
                        <Popover
                            trigger="click"
                            placement="bottomRight"
                            overlayClassName="ai-context-picker-popover"
                            content={componentPicker}
                        >
                            <button
                                type="button"
                                className={contextPickerKind === 'component' ? 'active' : ''}
                                onClick={() => setContextPickerKind('component')}
                            >
                                <strong>组件</strong>
                                <span>{selectedComponents.length}</span>
                            </button>
                        </Popover>
                    </div>
                </div>
            </div>

            <div className="ai-assistant-history" ref={historyRef} style={{ flex: 1, minHeight: 0 }}>
                {history.map((entry) => (
                    <div
                        key={entry.id}
                        className={entry.role === 'user' ? 'ai-msg ai-msg-user' : 'ai-msg ai-msg-assistant'}
                    >
                        <div className="ai-msg-header">
                            <span className="ai-msg-role">{entry.role === 'user' ? '你' : 'AI'}</span>
                            <button
                                className="ai-msg-copy"
                                title="复制"
                                onClick={() => void navigator.clipboard.writeText(entry.content)}
                            >
                                <CopyOutlined />
                            </button>
                        </div>
                        <span className="ai-msg-content">{entry.content}</span>
                    </div>
                ))}
                {loading ? (
                    <div className="ai-msg ai-msg-assistant">
                        <span className="ai-msg-role">AI</span>
                        <span className="ai-msg-content ai-msg-thinking">思考中…</span>
                    </div>
                ) : null}
            </div>

            {pendingActions.length > 0 ? (
                <div className="ai-review-panel">
                    <div className="ai-review-panel-head">
                        <div>
                            <Typography.Text className="ai-review-title">变更审阅</Typography.Text>
                            <Typography.Text className="ai-review-subtitle">
                                AI 只生成建议，确认后才进入页面草稿
                            </Typography.Text>
                        </div>
                        <Space size={4}>
                            <Tag color="gold">待确认 {pendingActions.length}</Tag>
                        </Space>
                    </div>
                    <div className="ai-review-list">
                        {pendingActions.map(renderActionCard)}
                    </div>
                </div>
            ) : null}

            <div className="ai-assistant-footer">
                <Input.TextArea
                    className="ai-workbench-prompt"
                    value={prompt}
                    disabled={loading}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    placeholder={interactionMode === 'ask'
                        ? '询问当前页面、组件、变量或脚本上下文…'
                        : '描述你要完成的任务，AI 会生成待审批变更包…'}
                    onChange={(event) => setPrompt(event.target.value)}
                    onPressEnter={(event) => {
                        if (event.shiftKey) {
                            return;
                        }
                        event.preventDefault();
                        void executePrompt();
                    }}
                />
                <Button
                    type="primary"
                    size="small"
                    className="ai-workbench-send"
                    icon={<SendOutlined />}
                    loading={loading}
                    onClick={() => void executePrompt()}
                />
            </div>

            <Modal
                title={(
                    <div className="ai-review-modal-title">
                        <span>审阅变更</span>
                        <small>{actionReview?.title || ''}</small>
                    </div>
                )}
                open={Boolean(actionReview)}
                width={820}
                destroyOnClose
                className="ai-review-modal"
                onCancel={() => setActionReview(null)}
                footer={(
                    <Space>
                        <Button
                            danger
                            onClick={() => {
                                if (actionReview?.actionId) {
                                    updateActionStatus(actionReview.actionId, 'rejected');
                                }
                                setActionReview(null);
                            }}
                        >
                            拒绝
                        </Button>
                        <Button onClick={saveReviewedAction}>保存审阅修改</Button>
                        <Button type="primary" onClick={confirmReviewedAction}>
                            确认应用
                        </Button>
                    </Space>
                )}
            >
                <Typography.Text className="ai-review-modal-hint">
                    可在确认前调整 JSON。保存只更新待审阅动作，确认才会写入当前页面草稿。
                </Typography.Text>
                <Input.TextArea
                    className="ai-review-json-editor"
                    value={actionReview?.draft || ''}
                    spellCheck={false}
                    autoSize={{ minRows: 18, maxRows: 24 }}
                    onChange={(event) => {
                        setActionReview((previous) => previous
                            ? { ...previous, draft: event.target.value }
                            : previous);
                    }}
                />
            </Modal>

            <Modal
                title={(
                    <div className="ai-review-modal-title">
                        <span>审阅脚本 Diff</span>
                        <small>{scriptDiff?.title || ''}</small>
                    </div>
                )}
                open={Boolean(scriptDiff)}
                width={1080}
                destroyOnClose
                className="ai-review-modal"
                onCancel={rejectScriptDiff}
                footer={(
                    <Space>
                        <Button danger onClick={rejectScriptDiff}>拒绝</Button>
                        <Button
                            type="primary"
                            onClick={() => {
                                if (!scriptDiff) {
                                    return;
                                }
                                const code = diffEditorRef.current
                                    ?.getModifiedEditor?.()
                                    ?.getValue?.() || scriptDiff.proposedCode;
                                scriptDiff.onAccept(code);
                                setScriptDiff(null);
                                message.success('已接受 Diff，修改进入当前页面草稿，请手动保存页面');
                            }}
                        >
                            确认应用
                        </Button>
                    </Space>
                )}
            >
                <Typography.Text className="ai-review-modal-hint">
                    右侧建议代码可以直接编辑。确认后只写入前端草稿，仍需手动保存页面。
                </Typography.Text>
                {scriptDiff ? (
                    <DiffEditor
                        height={560}
                        language={scriptDiff.language}
                        original={scriptDiff.originalCode}
                        modified={scriptDiff.proposedCode}
                        onMount={(editor) => {
                            diffEditorRef.current = editor;
                        }}
                        options={{
                            renderSideBySide: true,
                            minimap: { enabled: false },
                            automaticLayout: true,
                            readOnly: false,
                            originalEditable: false,
                            renderOverviewRuler: true,
                        }}
                    />
                ) : null}
            </Modal>
        </div>
    );
}
