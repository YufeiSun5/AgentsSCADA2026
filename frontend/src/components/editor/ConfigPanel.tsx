/*
 * 右侧配置面板。
 * 负责当前选中组件的属性、变量、事件菜单，以及多组件同时打开的代码编辑器窗口。
 */
import {
    Alert,
    Button,
    Collapse,
    Divider,
    Empty,
    Input,
    InputNumber,
    Modal,
    Segmented,
    Select,
    Space,
    Tag,
    Typography,
    message,
} from 'antd';
import {
    CodeOutlined,
    CopyOutlined,
    DeleteOutlined,
    PlusOutlined,
    RightOutlined,
    SendOutlined,
} from '@ant-design/icons';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cloneSchema, findNodeById, flattenNodes, type ComponentNode, type ComponentScripts, type ComponentVariable, type ComponentVariableType, type PageSchema, type PageScripts } from '../../schema/pageSchema';
import { getComponentProtocol, pageCanvasProtocol } from '../../schema/componentProtocol';
import { callAiChat, type AiAction } from '../../services/aiService';
import { callAiScriptEditTask, callAiVariablesEditTask } from '../../services/aiTaskService';
import AssetManager from './AssetManager';

type PanelSection = 'props' | 'variables' | 'events' | 'assets';
type ScriptEntryKey = keyof ComponentScripts | keyof PageScripts;
type CustomHtmlParts = {
    htmlContent: string;
    cssContent: string;
    jsContent: string;
};
/** customHtml 组件的完整代码与分离代码 tab */
type CustomHtmlFullTab = 'fullHtml';
type CustomHtmlSplitTab = keyof CustomHtmlParts;
type CustomHtmlContentTab = CustomHtmlFullTab | CustomHtmlSplitTab;
type WorkspaceTab = 'propsJson' | ScriptEntryKey | CustomHtmlContentTab;

const customHtmlFullTab: CustomHtmlFullTab = 'fullHtml';
const customHtmlSplitTabs: CustomHtmlSplitTab[] = ['htmlContent', 'cssContent', 'jsContent'];
const customHtmlContentTabs: CustomHtmlContentTab[] = [customHtmlFullTab, ...customHtmlSplitTabs];
const scriptEditorExtraLibPath = 'ts:scada-runtime-script-globals.d.ts';
let scriptEditorEnvironmentReady = false;

const scriptEditorExtraLib = `
declare const message: {
    success(content: string): void;
    error(content: string): void;
    info(content: string): void;
    warning(content: string): void;
};

declare const page: any;
declare const node: any;
declare const pageVariables: Record<string, any> | undefined;

declare const change:
    | {
        seq: number;
        key: string;
        value: unknown;
        previousValue: unknown;
        ts: number;
        source: string;
        reason?: string;
        variable?: any;
    }
    | undefined;

declare const variableChange: typeof change;

declare const vars: {
    get(name: string): any;
    getValue(name: string): any;
    set(
        name: string,
        value: any,
        options?: {
            reason?: string;
            silent?: boolean;
            patch?: Record<string, any>;
            source?: string;
        },
    ): any;
    patch(
        name: string,
        patch: Record<string, any>,
        options?: {
            reason?: string;
            silent?: boolean;
            patch?: Record<string, any>;
            source?: string;
        },
    ): any;
    all(): Record<string, any>;
    values(): Record<string, any>;
    subscribe(
        name: string,
        listener: (variable: any, change?: any) => void,
    ): () => void;
};

declare const components: {
    call(componentIdOrName: string, methodName: string, ...args: any[]): any;
};

declare function setPageVariable(
    name: string,
    value: unknown,
    options?: {
        reason?: string;
        silent?: boolean;
        patch?: Record<string, any>;
        source?: string;
    },
): void;

declare function onVariableChange(
    listener: (nextChange: any) => void,
): () => void;
`;

function configureMonacoForScriptEditor(monaco: any)
{
    if (scriptEditorEnvironmentReady) {
        return;
    }

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        // 页面脚本在运行时会被包进函数体执行，顶层 return 在 Monaco 里会被当作脚本语法报红。
        // 关闭语法级诊断，保留语义提示，避免函数体脚本与普通 JS 文件语法模型冲突。
        noSyntaxValidation: true,
    });
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        allowNonTsExtensions: true,
        checkJs: true,
        target: monaco.languages.typescript.ScriptTarget.ES2020,
    });
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        scriptEditorExtraLib,
        scriptEditorExtraLibPath,
    );
    scriptEditorEnvironmentReady = true;
}

function isCustomHtmlContentTab(tab: WorkspaceTab): tab is CustomHtmlContentTab
{
    return customHtmlContentTabs.includes(tab as CustomHtmlContentTab);
}

const customHtmlTabMeta: Record<CustomHtmlContentTab, { label: string; language: string }> = {
    fullHtml:    { label: '完整HTML', language: 'html' },
    htmlContent: { label: 'HTML',     language: 'html' },
    cssContent:  { label: 'CSS',      language: 'css' },
    jsContent:   { label: 'JS',       language: 'javascript' },
};

const customHtmlSplitTabMeta: Record<CustomHtmlSplitTab, { label: string; language: string; prop: keyof CustomHtmlParts }> = {
    htmlContent: { label: 'HTML', language: 'html', prop: 'htmlContent' },
    cssContent:  { label: 'CSS',  language: 'css',  prop: 'cssContent' },
    jsContent:   { label: 'JS',   language: 'javascript', prop: 'jsContent' },
};

type FloatingTarget =
    | {
        kind: 'editor';
        windowId: string;
    }
    | {
        kind: 'ai';
    };

interface FloatingWindowState {
    visible: boolean;
    maximized: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface EditorWindowState extends FloatingWindowState {
    id: string;
    targetKind: 'node' | 'page';
    targetId: string;
    activeTab: WorkspaceTab;
    /** 非 null 时进入 Diff 对比模式 */
    diffProposal: DiffProposal | null;
}

interface FloatingWindowDragState {
    target: FloatingTarget;
    start_x: number;
    start_y: number;
    origin_x: number;
    origin_y: number;
}

/** AI 提议的代码修改，用于 Diff 对比视图 */
interface DiffProposal {
    originalCode: string;
    proposedCode: string;
    language: string;
    guardWarnings?: string[];
}

interface EditorOpenRequest {
    nodeId: string;
    nonce: number;
}

const variableTypeOptions: Array<{
    label: string;
    value: ComponentVariableType;
}> = [
    { label: '字符串', value: 'string' },
    { label: '数值', value: 'number' },
    { label: '布尔', value: 'boolean' },
    { label: 'JSON', value: 'json' },
];

const runtimeDataTypeOptions = [
    { label: 'STRING', value: 'STRING' },
    { label: 'BOOL', value: 'BOOL' },
    { label: 'INT16', value: 'INT16' },
    { label: 'INT32', value: 'INT32' },
    { label: 'INT64', value: 'INT64' },
    { label: 'FLOAT', value: 'FLOAT' },
    { label: 'DOUBLE', value: 'DOUBLE' },
    { label: 'JSON', value: 'JSON' },
];

const default_ai_window: FloatingWindowState = {
    visible: false,
    maximized: false,
    x: 0,
    y: 0,
    width: 420,
    height: 360,
};

const shared_editor_theme = 'vs-dark';

function createVariableDraft()
{
    return {
        id: `var-${Math.random().toString(36).slice(2, 10)}`,
        name: '新变量',
        displayName: '新变量',
        type: 'string' as ComponentVariableType,
        dataType: 'STRING',
        rwMode: 'RW',
        unit: '',
        initialValue: '',
        summary: '',
        customExtra: {},
        scripts: {
            onChange: '',
        },
    };
}

function normalizeVariableDraft(variable: ComponentVariable): ComponentVariable
{
    return {
        ...createVariableDraft(),
        ...variable,
        displayName: variable.displayName || variable.name,
        rwMode: variable.rwMode || 'RW',
        unit: variable.unit || '',
        initialValue: String(variable.initialValue ?? ''),
        summary: String(variable.summary || ''),
        scripts: {
            onChange: String(variable.scripts?.onChange || ''),
        },
    };
}

function buildVariableListMeta(variable: ComponentVariable)
{
    return {
        scopedKey: buildScopedVariableKey('page', variable.name),
        typeLabel: String(variable.dataType || variable.type || 'STRING'),
        rwLabel: String(variable.rwMode || 'RW'),
        scriptEnabled: Boolean(variable.scripts?.onChange?.trim()),
    };
}

function matchesPageVariableSelector(
    variable: ComponentVariable,
    selector: string,
)
{
    const normalized_selector = String(selector || '').trim();
    if (!normalized_selector) {
        return false;
    }

    return variable.id === normalized_selector
        || variable.name === normalized_selector
        || buildScopedVariableKey('page', variable.name) === normalized_selector
        || String(variable.displayName || '').trim() === normalized_selector;
}

function mergePageVariableAiDrafts(
    currentVariables: ComponentVariable[],
    incomingVariables: ComponentVariable[],
)
{
    const merged_variables = currentVariables.map((item) => normalizeVariableDraft(item));

    incomingVariables.forEach((incoming) => {
        const normalized_incoming = normalizeVariableDraft(incoming);
        const matched_index = merged_variables.findIndex((item) =>
            matchesPageVariableSelector(item, normalized_incoming.id)
            || matchesPageVariableSelector(item, normalized_incoming.name)
            || matchesPageVariableSelector(item, buildScopedVariableKey('page', normalized_incoming.name)),
        );

        if (matched_index >= 0) {
            const current_item = merged_variables[matched_index];
            merged_variables[matched_index] = normalizeVariableDraft({
                ...current_item,
                ...normalized_incoming,
                customExtra: {
                    ...(current_item.customExtra || {}),
                    ...(normalized_incoming.customExtra || {}),
                },
                scripts: {
                    ...current_item.scripts,
                    ...normalized_incoming.scripts,
                },
            });
            return;
        }

        merged_variables.push(normalized_incoming);
    });

    return merged_variables;
}

function mapVariableTypeToDataType(type: ComponentVariableType)
{
    if (type === 'number') {
        return 'DOUBLE';
    }

    if (type === 'boolean') {
        return 'BOOL';
    }

    if (type === 'json') {
        return 'JSON';
    }

    return 'STRING';
}

function createEditorWindow(
    target_kind: 'node' | 'page',
    target_id: string,
    offset_index: number,
)
{
    const width = Math.min(920, window.innerWidth - 80);
    const height = Math.min(620, window.innerHeight - 120);
    const center_x = Math.max(20, Math.round((window.innerWidth - width) / 2));
    const center_y = Math.max(20, Math.round((window.innerHeight - height) / 2));

    return {
        id: `editor-${target_kind}-${target_id}`,
        targetKind: target_kind,
        targetId: target_id,
        activeTab: 'propsJson' as WorkspaceTab,
        visible: true,
        maximized: false,
        width,
        height,
        x: center_x + offset_index * 26,
        y: center_y + offset_index * 20,
        diffProposal: null as DiffProposal | null,
    };
}

/**
 * 将 patch 对象递归合并到 current 中：
 * 遍历整棵树，找到第一个包含 patch 全部 key 的对象层，在该层保序更新；
 * 找不到匹配层时 fallback 到顶层 spread（patch 为全新 key 场景）。
 */
function deepMergePatch(
    current: Record<string, unknown>,
    patch: Record<string, unknown>,
): Record<string, unknown> {
    const patchKeys = Object.keys(patch);

    function applyToNode(node: unknown): { hit: boolean; value: unknown } {
        if (typeof node !== 'object' || node === null) return { hit: false, value: node };

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const res = applyToNode(node[i]);
                if (res.hit) {
                    const arr = [...node];
                    arr[i] = res.value;
                    return { hit: true, value: arr };
                }
            }
            return { hit: false, value: node };
        }

        const obj = node as Record<string, unknown>;
        // 当前层包含 patch 所有 key → 在此层原位更新（保持字段顺序）
        if (patchKeys.every((k) => k in obj)) {
            const updated = Object.fromEntries(
                Object.entries(obj).map(([k, v]) => [k, k in patch ? patch[k] : v]),
            );
            return { hit: true, value: updated };
        }

        // 递归子节点，返回第一个命中的层
        for (const [k, v] of Object.entries(obj)) {
            const res = applyToNode(v);
            if (res.hit) {
                return { hit: true, value: { ...obj, [k]: res.value } };
            }
        }

        return { hit: false, value: obj };
    }

    const res = applyToNode(current);
    return res.hit
        ? (res.value as Record<string, unknown>)
        : { ...current, ...patch }; // fallback：patch 含全新 key
}

/** 从 AI 回复文本中提取第一个代码块 */
function extractCodeBlock(text: string): { language: string; code: string } | null
{
    // 兼容：有无语言标签、\r\n 换行、代码块前后有说明文字
    const match = /```(\w+)?\r?\n([\s\S]*?)```/.exec(text);
    if (!match) return null;
    return {
        language: match[1] || 'javascript',
        code: match[2].trim(),
    };
}

function stripJsonComments(source: string)
{
    let output = '';
    let in_string = false;
    let escaped = false;

    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        const next = source[i + 1];

        if (in_string) {
            output += char;
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                in_string = false;
            }
            continue;
        }

        if (char === '"') {
            in_string = true;
            output += char;
            continue;
        }

        if (char === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') {
                i += 1;
            }
            output += '\n';
            continue;
        }

        if (char === '/' && next === '*') {
            i += 2;
            while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
                i += 1;
            }
            i += 1;
            continue;
        }

        output += char;
    }

    return output;
}

function normalizeJsonCandidate(source: string)
{
    return stripJsonComments(source).replace(/,\s*([}\]])/g, '$1').trim();
}

function parseJsonCandidate(source: string): unknown
{
    try {
        return JSON.parse(source);
    } catch {
        return JSON.parse(normalizeJsonCandidate(source));
    }
}

function extractJsonCandidate(text: string)
{
    const trimmed_text = text.trim();
    const obj_start = trimmed_text.indexOf('{');
    const arr_start = trimmed_text.indexOf('[');

    if (obj_start < 0 && arr_start < 0) {
        return null;
    }

    const start = obj_start < 0 || (arr_start >= 0 && arr_start < obj_start)
        ? arr_start
        : obj_start;
    const open = trimmed_text[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let in_string = false;
    let escaped = false;

    for (let i = start; i < trimmed_text.length; i += 1) {
        const char = trimmed_text[i];

        if (in_string) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                in_string = false;
            }
            continue;
        }

        if (char === '"') {
            in_string = true;
            continue;
        }

        if (char === open) {
            depth += 1;
        } else if (char === close) {
            depth -= 1;
            if (depth === 0) {
                return trimmed_text.slice(start, i + 1);
            }
        }
    }

    return trimmed_text.slice(start);
}

function inferCodeBlockFromReply(
    text: string,
    active_tab?: WorkspaceTab | null,
): { language: string; code: string } | null
{
    if (active_tab === 'propsJson') {
        const candidate = extractJsonCandidate(text);
        if (!candidate) {
            return null;
        }

        try {
            return {
                language: 'json',
                code: JSON.stringify(parseJsonCandidate(candidate), null, 2),
            };
        } catch {
            return null;
        }
    }

    const trimmed_text = text.trim();
    if (!trimmed_text) {
        return null;
    }

    const looks_like_js =
        /(^|\n)\s*(\{|const\s+|let\s+|var\s+|function\s+|async\s+function\s+|ScadaBridge\.|setInterval\(|document\.)/.test(trimmed_text)
        || trimmed_text.includes('ScadaBridge.');

    if (!looks_like_js) {
        return null;
    }

    const lines = trimmed_text.split(/\r?\n/);
    const start_index = lines.findIndex((line) =>
        /^\s*(\{|const\s+|let\s+|var\s+|function\s+|async\s+function\s+|ScadaBridge\.|setInterval\(|document\.|\/\/)/.test(line),
    );

    return {
        language: 'javascript',
        code: (start_index >= 0 ? lines.slice(start_index).join('\n') : trimmed_text).trim(),
    };
}

function buildAiCodeGuardWarnings(
    code: string,
    active_tab?: WorkspaceTab | null,
): string[]
{
    const warnings: string[] = [];

    if (active_tab === 'propsJson') {
        return warnings;
    }

    const read_tag_then = /ScadaBridge\.readTag\([^)]*\)\.then\(\s*([A-Za-z_$][\w$]*)\s*=>\s*\{([\s\S]*?)\}\s*\)/g;
    for (const match of code.matchAll(read_tag_then)) {
        const param_name = match[1];
        const body = match[2];
        const assign_raw_result = new RegExp(`=\\s*${param_name}\\s*[;\\n]`).test(body);

        if (assign_raw_result) {
            warnings.push(
                'ScadaBridge.readTag 返回对象，读取数值应使用 data.value，不能直接把返回对象赋给数值变量。',
            );
            break;
        }
    }

    if (/setInterval\s*\([\s\S]*?ScadaBridge\.bindText/.test(code)) {
        warnings.push(
            'ScadaBridge.bindText 应在初始化时调用一次，不要放在 setInterval 或循环中重复绑定。',
        );
    }

    if (/setInterval\s*\([\s\S]*?ScadaBridge\.bindWriteDialog/.test(code)) {
        warnings.push(
            'ScadaBridge.bindWriteDialog 应在初始化时调用一次，不要放在 setInterval 或循环中重复绑定。',
        );
    }

    if (code.includes('ScadaBridge.') && !code.includes('ScadaBridge.onReady')) {
        warnings.push(
            'HTML 组件脚本建议把 ScadaBridge 调用放进 ScadaBridge.onReady 回调，避免 SDK 尚未就绪。',
        );
    }

    return warnings;
}

function buildScriptPreview(script_value: string)
{
    const trimmed_value = script_value.trim();

    if (!trimmed_value) {
        return '当前还没有脚本内容';
    }

    return trimmed_value.split('\n').slice(0, 3).join('\n');
}

function buildPropsDraft(node: ComponentNode | null)
{
    return JSON.stringify(node?.props || {}, null, 2);
}

function buildPagePropsDraft(page: PageSchema)
{
    return JSON.stringify(page.root.props || {}, null, 2);
}

function readCustomHtmlParts(node: ComponentNode | null): CustomHtmlParts
{
    return {
        htmlContent: String(node?.props.htmlContent ?? ''),
        cssContent:  String(node?.props.cssContent ?? ''),
        jsContent:   String(node?.props.jsContent ?? ''),
    };
}

function buildCustomHtmlDocument(parts: CustomHtmlParts)
{
    return [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <style data-scada-part="css">',
        parts.cssContent,
        '  </style>',
        '</head>',
        '<body>',
        parts.htmlContent,
        '  <script data-scada-part="js">',
        parts.jsContent,
        '  </script>',
        '</body>',
        '</html>',
    ].join('\n');
}

function buildCustomHtmlDocumentFromNode(node: ComponentNode | null)
{
    return buildCustomHtmlDocument(readCustomHtmlParts(node));
}

function parseCustomHtmlDocument(source: string): CustomHtmlParts
{
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    const style_node = doc.querySelector('style[data-scada-part="css"]') ?? doc.querySelector('style');
    const script_node = doc.querySelector('script[data-scada-part="js"]') ?? doc.querySelector('script');
    const cssContent = style_node?.textContent ?? '';
    const jsContent = script_node?.textContent ?? '';

    style_node?.remove();
    script_node?.remove();

    return {
        htmlContent: doc.body.innerHTML.trim(),
        cssContent,
        jsContent,
    };
}

function normalizeCodeLanguage(language: string)
{
    const lower_language = language.toLowerCase();
    if (lower_language === 'js') return 'javascript';
    if (lower_language === 'ts') return 'typescript';
    return lower_language || 'javascript';
}

function isCompleteHtmlDocument(code: string)
{
    return /<!doctype\s+html/i.test(code) || /<html[\s>]/i.test(code);
}

function buildEditorDraftKey(window_id: string, tab: WorkspaceTab)
{
    if (tab === 'propsJson') {
        return window_id;
    }

    if (isCustomHtmlContentTab(tab)) {
        return `${window_id}::${customHtmlFullTab}`;
    }

    return `${window_id}::${tab}`;
}

function resolveEditorDraftTab(window_id: string, draft_key: string): WorkspaceTab | null
{
    if (draft_key === window_id) {
        return 'propsJson';
    }

    const prefix = `${window_id}::`;
    if (!draft_key.startsWith(prefix)) {
        return null;
    }

    return draft_key.slice(prefix.length) as WorkspaceTab;
}

function hasOwnDraft(drafts: Record<string, string>, draft_key: string)
{
    return Object.prototype.hasOwnProperty.call(drafts, draft_key);
}

function readRecord(value: unknown): Record<string, unknown>
{
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function buildEventFileName(event_key: string)
{
    return `${event_key}.js`;
}

function isEventScriptTab(tab: WorkspaceTab | null | undefined)
{
    return Boolean(tab && tab !== 'propsJson' && !isCustomHtmlContentTab(tab));
}

function buildAiOutputContract(tab: WorkspaceTab | null | undefined, file: string)
{
    if (tab === 'propsJson') {
        return [
            '【本次任务类型】属性 JSON 编辑',
            '【强制输出格式】',
            '- 只修改 props.json 时，返回完整或补丁 JSON fenced code block。',
            '- JSON 必须严格合法：禁止注释、尾逗号、解释性文字写进 JSON 内部。',
            '- 示例：{"reply":"```json\\n{ \\"width\\": 320 }\\n```","actions":[]}',
            '',
        ].join('\n');
    }

    if (isEventScriptTab(tab)) {
        return [
            '【本次任务类型】代码编辑',
            `【目标文件】${file}`,
            '【强制输出格式】',
            '- 必须返回当前文件的完整可替换 JavaScript 代码 fenced code block。',
            '- 顶层响应仍是 JSON，但 reply 字段里必须包含 ```javascript 代码块，actions 必须是 []。',
            '- 禁止返回 JSON patch、{}、actions、update_node 或属性对象。',
            '- 示例：{"reply":"已修改\\n```javascript\\n完整 onClick.js 代码\\n```","actions":[]}',
            '',
        ].join('\n');
    }

    return [
        '【本次任务类型】代码编辑',
        `【目标文件】${file}`,
        '【强制输出格式】',
        '- 必须返回当前编辑文件的完整可替换代码 fenced code block。',
        '- 顶层响应仍是 JSON，但 reply 字段里必须包含对应语言代码块，actions 必须是 []。',
        '- 禁止返回空 JSON、actions、update_node 或无说明的属性对象。',
        '',
    ].join('\n');
}

function shouldRejectCodeBlockForTab(
    code_block: { language: string; code: string },
    tab: WorkspaceTab | null | undefined,
) {
    const language = normalizeCodeLanguage(code_block.language);
    return isEventScriptTab(tab) && language === 'json';
}

function buildScopedVariableKey(scope_label: string, variable_name: string)
{
    const trimmed_name = String(variable_name || '').trim();
    const scoped_prefixes = ['page.', 'tag.', 'component.'];

    if (!trimmed_name) {
        return scope_label;
    }

    if (scoped_prefixes.some((prefix) => trimmed_name.startsWith(prefix))) {
        return trimmed_name;
    }

    return `${scope_label}.${trimmed_name}`;
}

function buildVariableListLine(
    variable: ComponentVariable,
    scope_label: string,
    owner_label: string,
) {
    const variable_key = buildScopedVariableKey(scope_label, variable.name);

    return [
        `- ${variable_key}`,
        `displayName=${variable.displayName || variable.summary || variable.name}`,
        `type=${variable.dataType || variable.type}`,
        `rwMode=${variable.rwMode || 'RW'}`,
        `unit=${variable.unit || ''}`,
        `initialValue=${variable.initialValue ?? ''}`,
        `owner=${owner_label}`,
    ].join('；');
}

function buildRuntimeVariableAiContext(page: PageSchema)
{
    const page_variable_lines = page.variables.map((variable) =>
        buildVariableListLine(variable, 'page', 'page'),
    );
    const component_variable_lines = flattenNodes(page.root)
        .filter((item) => item.id !== page.root.id && item.variables.length > 0)
        .flatMap((item) =>
            item.variables.map((variable) =>
                buildVariableListLine(variable, `component.${item.name}`, `${item.name}(${item.id})`),
            ),
        );

    const lines = [
        '【页面变量运行时规则】',
        '- 页面脚本和组件脚本直接使用全局对象 vars、components、message、change、page、node，不要生成 Ctx.xxx。',
        '- 页面局部变量使用 page.<变量名> 命名，变量名允许中文；脚本必须用字符串 API，例如 vars.getValue("page.温度")，不要写 vars.page.温度。',
        '- RuntimeVariable 外层包含 value、previousValue、valueTs、previousValueTs、quality、qualityTs、changeSeq、changeSource、alarm/write/display 字段。',
        '- 扩展字段按属性分类：identityExtra、ownerExtra、typeExtra、valueExtra、timeExtra、qualityExtra、changeExtra、alarmExtra、writeExtra、displayExtra、configExtra、customExtra。',
        '- 脚本写页面变量使用 vars.set("page.温度", value, options?)；source 会按页面脚本/组件脚本自动补齐，reason 仅在需要审计时再写。',
        '- 单个变量的派生逻辑优先写在该变量自己的 scripts.onChange；页面 onVariableChange 主要负责全局汇总、组件分发和跨变量联动。',
        '- 变量变化脚本直接读取 change；脚本调用组件方法使用 components.call(componentIdOrName, methodName, ...args)。文本支持 setText/clearText；图表支持 setOption/appendData/clear/resize。',
        '- customHtml 内使用 ScadaBridge.readVar/writeVar/subscribeVar/bindVarText/bindVarWriteDialog/callComponent。',
        '- 系统点位才使用 readTag/writeTag/subscribe；页面逻辑变量不要误用 tag API。',
        '【当前页面变量列表】',
        page_variable_lines.length ? page_variable_lines.join('\n') : '- 当前页面未定义 page 变量',
        '【当前组件变量列表】',
        component_variable_lines.length ? component_variable_lines.join('\n') : '- 当前组件未定义 component 变量',
        '',
    ];

    return `${lines.join('\n')}\n`;
}

function isPageWindow(window_item: EditorWindowState)
{
    return window_item.targetKind === 'page';
}

export default function ConfigPanel({
    page,
    node,
    editorOpenRequest,
    onEditorOpenRequestHandled,
    onNodeNameChange,
    onNameChange,
    onNodeTitleChange,
    onTitleChange,
    onNodePropsChange,
    onPropsChange,
    onNodePropsReplace,
    onPropsReplace,
    onNodeVariablesChange,
    onVariablesChange,
    onNodeScriptsChange,
    onScriptsChange,
    onPageVariablesChange,
    onPageScriptsChange,
    onPageSettingsChange,
    onCollapse,
}: {
    page: PageSchema;
    node: ComponentNode | null;
    editorOpenRequest: EditorOpenRequest | null;
    onEditorOpenRequestHandled: () => void;
    onNodeNameChange: (nodeId: string, name: string) => void;
    onNameChange: (name: string) => void;
    onNodeTitleChange: (nodeId: string, title: string) => void;
    onTitleChange: (title: string) => void;
    onNodePropsChange: (nodeId: string, patch: Record<string, unknown>) => void;
    onPropsChange: (patch: Record<string, unknown>) => void;
    onNodePropsReplace: (nodeId: string, nextProps: Record<string, unknown>) => void;
    onPropsReplace: (nextProps: Record<string, unknown>) => void;
    onNodeVariablesChange: (nodeId: string, variables: ComponentVariable[]) => void;
    onVariablesChange: (variables: ComponentVariable[]) => void;
    onNodeScriptsChange: (nodeId: string, patch: Partial<ComponentScripts>) => void;
    onScriptsChange: (patch: Partial<ComponentScripts>) => void;
    onPageVariablesChange: (variables: ComponentVariable[]) => void;
    onPageScriptsChange: (patch: Partial<PageScripts>) => void;
    onPageSettingsChange: (patch: Record<string, unknown>) => void;
    onCollapse?: () => void;
}) {
    const [panelSection, setPanelSection] = useState<PanelSection>('props');
    const [propsDraft, setPropsDraft] = useState('{}');
    const [openEditors, setOpenEditors] = useState<EditorWindowState[]>([]);
    const [editorOrder, setEditorOrder] = useState<string[]>([]);
    const [editorDrafts, setEditorDrafts] = useState<Record<string, string>>({});
    const [aiWindow, setAiWindow] = useState<FloatingWindowState>(default_ai_window);
    const [focusedEditorId, setFocusedEditorId] = useState<string | null>(null);
    // AI 对话窗口状态
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiHistory, setAiHistory] = useState<Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        /** 气泡中显示的文字（user 消息去掉代码上下文后的纯提问） */
        label?: string;
        /** 附加上下文的简短描述，显示在气泡下方 */
        contextHint?: string;
        /** AI 回复中提取到的代码块，用于展示 Diff 对比按钮 */
        codeBlock?: { language: string; code: string } | null;
    }>>([
        { id: 'init', role: 'assistant', content: '你好！我可以帮你编写和优化组件脚本。告诉我你想实现什么功能就行。' },
    ]);
    const aiHistoryRef = useRef<HTMLDivElement>(null);
    // 当前聚焦的 Monaco 编辑器实例（用于获取选中文本）
    const activeEditorRef = useRef<any>(null);
    /** 每个窗口对应的 Monaco DiffEditor 实例 */
    const diffEditorInstancesRef = useRef<Record<string, any>>({});
    /** 每个窗口的 diff 导航状态（当前下标 + 总数） */
    const [diffNavState, setDiffNavState] = useState<Record<string, { currentIdx: number; totalCount: number }>>({});
    const dragStateRef = useRef<FloatingWindowDragState | null>(null);
    const [pageVariableEditorOpen, setPageVariableEditorOpen] = useState(false);
    const [pageVariableDrafts, setPageVariableDrafts] = useState<ComponentVariable[]>([]);
    const [activePageVariableId, setActivePageVariableId] = useState<string | null>(null);
    const [pageVariableScriptEditorOpen, setPageVariableScriptEditorOpen] = useState(false);
    const [pageVariableScriptTargetId, setPageVariableScriptTargetId] = useState<string | null>(null);
    const [pageVariableScriptDraft, setPageVariableScriptDraft] = useState('');
    const [pageVariableScriptAiPrompt, setPageVariableScriptAiPrompt] = useState('');
    const [pageVariableScriptAiLoading, setPageVariableScriptAiLoading] = useState(false);
    const [pageVariableScriptAiHistory, setPageVariableScriptAiHistory] = useState<Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        label?: string;
        codeBlock?: { language: string; code: string } | null;
    }>>([
        {
            id: 'page-variable-script-ai-init',
            role: 'assistant',
            content: '告诉我你希望这个变量 onChange 脚本做什么，我会给出可替换代码。',
        },
    ]);
    const [pageVariableScriptDiffProposal, setPageVariableScriptDiffProposal] = useState<DiffProposal | null>(null);
    const [pageVariableAiOpen, setPageVariableAiOpen] = useState(false);
    const [pageVariableAiPrompt, setPageVariableAiPrompt] = useState('');
    const [pageVariableAiLoading, setPageVariableAiLoading] = useState(false);
    const [pageVariableAiHistory, setPageVariableAiHistory] = useState<Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        label?: string;
    }>>([
        {
            id: 'page-variable-ai-init',
            role: 'assistant',
            content: '请输入你要新增、修改或整理的页面变量要求。',
        },
    ]);
    const pageVariableAiHistoryRef = useRef<HTMLDivElement>(null);
    const pageVariableScriptAiHistoryRef = useRef<HTMLDivElement>(null);
    const pageVariableScriptDiffEditorRef = useRef<any>(null);
    const previousSelectedNodeIdRef = useRef<string | null>(null);

    // AI 历史自动滚动到底部
    useEffect(() => {
        aiHistoryRef.current?.scrollTo({ top: aiHistoryRef.current.scrollHeight, behavior: 'smooth' });
    }, [aiHistory]);
    useEffect(() => {
        pageVariableAiHistoryRef.current?.scrollTo({
            top: pageVariableAiHistoryRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }, [pageVariableAiHistory]);
    useEffect(() => {
        pageVariableScriptAiHistoryRef.current?.scrollTo({
            top: pageVariableScriptAiHistoryRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }, [pageVariableScriptAiHistory]);
    const code_button_name = useMemo(
        () => String(node?.props.editorButtonName || '代码编辑器'),
        [node],
    );
    const focusedWindow = useMemo(
        () => openEditors.find((item) => item.id === focusedEditorId) || null,
        [focusedEditorId, openEditors],
    );
    const focusedNode = useMemo(
        () => (
            focusedWindow && focusedWindow.targetKind === 'node'
                ? findNodeById(page.root, focusedWindow.targetId)
                : null
        ),
        [focusedWindow, page.root],
    );
    const componentEvents = useMemo(
        () => (node ? getComponentProtocol(node.type).supportedEvents : []),
        [node],
    );
    const pageEvents = pageCanvasProtocol.supportedEvents;
    const pageVariableOptions = useMemo(
        () => page.variables.map((variable) => {
            const variable_key = buildScopedVariableKey('page', variable.name);

            return {
                label: `${variable.displayName || variable.name}（${variable_key}）`,
                value: variable_key,
            };
        }),
        [page.variables],
    );
    const activePageVariable = useMemo(
        () => pageVariableDrafts.find((item) => item.id === activePageVariableId) || null,
        [activePageVariableId, pageVariableDrafts],
    );
    const normalizedSavedPageVariables = useMemo(
        () => cloneSchema(page.variables).map((variable) => normalizeVariableDraft(variable)),
        [page.variables],
    );
    const pageVariableScriptTarget = useMemo(
        () => pageVariableDrafts.find((item) => item.id === pageVariableScriptTargetId) || null,
        [pageVariableDrafts, pageVariableScriptTargetId],
    );
    const pageVariableEditorDirty = useMemo(
        () => JSON.stringify(pageVariableDrafts) !== JSON.stringify(normalizedSavedPageVariables),
        [normalizedSavedPageVariables, pageVariableDrafts],
    );
    const pageVariableScriptDirty = useMemo(
        () => pageVariableScriptDraft !== String(pageVariableScriptTarget?.scripts?.onChange || ''),
        [pageVariableScriptDraft, pageVariableScriptTarget],
    );

    const openPageVariableEditor = (target_variable_id?: string) => {
        const drafts = cloneSchema(page.variables).map((variable) => normalizeVariableDraft(variable));
        const initial_variable_id = target_variable_id
            || drafts[0]?.id
            || null;

        setPageVariableDrafts(drafts);
        setActivePageVariableId(initial_variable_id);
        setPageVariableAiPrompt('');
        setPageVariableEditorOpen(true);
    };

    const openPageVariableScriptEditor = (variable_id: string) => {
        const target_variable = pageVariableDrafts.find((item) => item.id === variable_id);
        if (!target_variable) {
            return;
        }

        setPageVariableScriptTargetId(variable_id);
        setPageVariableScriptDraft(String(target_variable.scripts?.onChange || ''));
        setPageVariableScriptAiPrompt('');
        setPageVariableScriptDiffProposal(null);
        setPageVariableScriptAiHistory([
            {
                id: 'page-variable-script-ai-init',
                role: 'assistant',
                content: `当前变量：${buildScopedVariableKey('page', target_variable.name)}。告诉我这个变量变化时要做什么，我会生成 onChange.js。`,
            },
        ]);
        setPageVariableScriptEditorOpen(true);
    };

    const savePageVariableScriptEditor = () => {
        if (!pageVariableScriptTargetId) {
            setPageVariableScriptEditorOpen(false);
            return;
        }

        updatePageVariableDraft(pageVariableScriptTargetId, {
            scripts: {
                onChange: pageVariableScriptDraft,
            },
        });
        setPageVariableScriptDiffProposal(null);
        setPageVariableScriptEditorOpen(false);
        message.success('变量脚本草稿已更新');
    };

    const closePageVariableScriptEditor = () => {
        if (pageVariableScriptDirty) {
            Modal.confirm({
                title: '变量脚本有未保存修改',
                content: '关闭脚本编辑器前是否保存？不保存会丢失本次脚本改动。',
                okText: '保存并关闭',
                cancelText: '直接关闭',
                onOk: () => {
                    savePageVariableScriptEditor();
                    return undefined;
                },
                onCancel: () => {
                    setPageVariableScriptDraft(String(pageVariableScriptTarget?.scripts?.onChange || ''));
                    setPageVariableScriptDiffProposal(null);
                    setPageVariableScriptEditorOpen(false);
                },
            });
            return;
        }

        setPageVariableScriptDiffProposal(null);
        setPageVariableScriptEditorOpen(false);
    };

    const openPageVariableAiModal = () => {
        setPageVariableAiOpen(true);
    };

    const closePageVariableAiModal = () => {
        setPageVariableAiOpen(false);
        setPageVariableAiPrompt('');
    };

    const closePageVariableEditor = () => {
        if (pageVariableEditorDirty) {
            Modal.confirm({
                title: '页面变量有未保存修改',
                content: '关闭变量编辑器前是否保存？不保存会丢失本次变量改动。',
                okText: '保存并关闭',
                cancelText: '直接关闭',
                onOk: () => {
                    savePageVariableEditor();
                    return undefined;
                },
                onCancel: () => {
                    setPageVariableDrafts(normalizedSavedPageVariables);
                    setActivePageVariableId(normalizedSavedPageVariables[0]?.id || null);
                    setPageVariableScriptEditorOpen(false);
                    setPageVariableAiOpen(false);
                    setPageVariableEditorOpen(false);
                    setPageVariableAiPrompt('');
                },
            });
            return;
        }

        setPageVariableScriptEditorOpen(false);
        setPageVariableAiOpen(false);
        setPageVariableEditorOpen(false);
        setPageVariableAiPrompt('');
    };

    const savePageVariableEditor = () => {
        const normalized_variables = pageVariableDrafts.map((variable) => normalizeVariableDraft(variable));
        const duplicate_names = normalized_variables.reduce<Record<string, number>>((accumulator, variable) => {
            const key = buildScopedVariableKey('page', variable.name).trim();
            if (key) {
                accumulator[key] = (accumulator[key] || 0) + 1;
            }
            return accumulator;
        }, {});
        const invalid_variable = normalized_variables.find((variable) => !String(variable.name || '').trim());
        const duplicated_variable = normalized_variables.find((variable) =>
            duplicate_names[buildScopedVariableKey('page', variable.name).trim()] > 1,
        );

        if (invalid_variable) {
            message.error('变量名不能为空');
            setActivePageVariableId(invalid_variable.id);
            return;
        }

        if (duplicated_variable) {
            message.error(`变量名重复：${buildScopedVariableKey('page', duplicated_variable.name)}`);
            setActivePageVariableId(duplicated_variable.id);
            return;
        }

        onPageVariablesChange(normalized_variables);
        if (pageVariableScriptEditorOpen && pageVariableScriptTargetId) {
            const target_variable = normalized_variables.find((item) => item.id === pageVariableScriptTargetId);
            setPageVariableScriptDraft(String(target_variable?.scripts?.onChange || ''));
        }
        setPageVariableEditorOpen(false);
        setPageVariableAiPrompt('');
        message.success('页面变量已保存');
    };

    const updatePageVariableDraft = (
        variable_id: string,
        patch: Partial<ComponentVariable>,
    ) => {
        setPageVariableDrafts((previous) =>
            previous.map((item) =>
                item.id === variable_id
                    ? normalizeVariableDraft({
                        ...item,
                        ...patch,
                        scripts: {
                            ...item.scripts,
                            ...patch.scripts,
                        },
                    })
                    : item,
            ),
        );
    };

    const addPageVariableDraft = () => {
        const next_variable = createVariableDraft();
        setPageVariableDrafts((previous) => [...previous, next_variable]);
        setActivePageVariableId(next_variable.id);
    };

    const openNewPageVariableEditor = () => {
        const drafts = cloneSchema(page.variables).map((variable) => normalizeVariableDraft(variable));
        const next_variable = createVariableDraft();
        setPageVariableDrafts([...drafts, next_variable]);
        setActivePageVariableId(next_variable.id);
        setPageVariableAiPrompt('');
        setPageVariableEditorOpen(true);
    };

    const removePageVariableDraft = (variable_id: string) => {
        setPageVariableDrafts((previous) => {
            const next_variables = previous.filter((item) => item.id !== variable_id);
            if (variable_id === activePageVariableId) {
                setActivePageVariableId(next_variables[0]?.id || null);
            }
            if (variable_id === pageVariableScriptTargetId) {
                setPageVariableScriptTargetId(next_variables[0]?.id || null);
                setPageVariableScriptDraft(String(next_variables[0]?.scripts?.onChange || ''));
                if (next_variables.length === 0) {
                    setPageVariableScriptEditorOpen(false);
                }
            }
            return next_variables;
        });
    };

    const applyPageVariableAiResult = async () => {
        const prompt_text = pageVariableAiPrompt.trim();
        if (!prompt_text) {
            message.warning('请先输入变量 AI 指令');
            return;
        }

        const edit_intent_pattern = /(新增|添加|创建|新建|修改|更新|编辑|删除|移除|重命名|改名|改成|改为|设置|调整|完善|补充|追加|合并|替换|覆盖|清空|生成|脚本|onchange|onChange)/i;
        const replace_all_pattern = /(替换全部|整表替换|覆盖全部|重置变量列表|清空全部变量|只保留)/;

        if (!edit_intent_pattern.test(prompt_text)) {
            const reject_message = '变量 AI 只接受编辑指令，不处理闲聊或查询。请直接说“新增/修改/删除/重命名哪个变量”，当前变量请查看左侧变量列表。';
            setPageVariableAiHistory((previous) => [
                ...previous,
                {
                    id: `page-variable-assistant-reject-${Date.now()}`,
                    role: 'assistant',
                    content: reject_message,
                },
            ]);
            message.warning('变量 AI 只接受编辑指令');
            return;
        }

        const user_entry = {
            id: `page-variable-user-${Date.now()}`,
            role: 'user' as const,
            content: prompt_text,
            label: prompt_text,
        };

        setPageVariableAiHistory((previous) => [...previous, user_entry]);
        setPageVariableAiLoading(true);
        try {
            const current_variables = pageVariableDrafts.length > 0
                ? pageVariableDrafts
                : page.variables.map((variable) => normalizeVariableDraft(variable));
            const active_variable = current_variables.find((item) => item.id === activePageVariableId) || null;
            const ai_result = await callAiVariablesEditTask({
                messages: [...pageVariableAiHistory, user_entry].map((entry) => ({
                    role: entry.role,
                    content: entry.content,
                })),
                target: {
                    scope: 'page_variables',
                    pageId: page.id,
                    file: 'variables.json',
                },
                context: {
                    currentVariables: current_variables,
                    activeVariable: active_variable,
                    runtimeRules: buildRuntimeVariableAiContext(page),
                },
            });

            const structured_result =
                ai_result.resultType === 'variables'
                && ai_result.result
                && typeof ai_result.result === 'object'
                    ? ai_result.result as {
                        mode?: string;
                        variables?: ComponentVariable[];
                        selectedVariableName?: string;
                    }
                    : null;

            let parsed: ComponentVariable[] | {
                mode?: string;
                variables?: ComponentVariable[];
                selectedVariableName?: string;
            } | null = structured_result;

            if (!parsed) {
                const code_block = extractCodeBlock(ai_result.reply);
                const json_source = code_block?.code || String(extractJsonCandidate(ai_result.reply) || '').trim();
                if (!json_source) {
                    throw new Error('AI 未返回可解析的变量 JSON');
                }
                parsed = parseJsonCandidate(json_source) as
                    | ComponentVariable[]
                    | {
                        mode?: string;
                        variables?: ComponentVariable[];
                        selectedVariableName?: string;
                    };
            }

            const parsed_object = parsed && !Array.isArray(parsed) ? parsed : null;
            const next_variables = Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed_object?.variables)
                    ? parsed_object.variables
                    : null;

            if (!next_variables) {
                throw new Error('AI 变量结果缺少 variables 数组');
            }

            const response_mode = Array.isArray(parsed)
                ? 'merge'
                : String(parsed_object?.mode || 'merge').trim().toLowerCase();
            const replace_all = response_mode === 'replace_all' || replace_all_pattern.test(prompt_text);
            const normalized_incoming = next_variables.map((item) => normalizeVariableDraft(item));
            const normalized_variables = replace_all
                ? normalized_incoming
                : mergePageVariableAiDrafts(current_variables, normalized_incoming);

            setPageVariableDrafts(normalized_variables);

            const selected_name = Array.isArray(parsed)
                ? ''
                : String(parsed_object?.selectedVariableName || '').trim();
            const selected_variable = normalized_variables.find((item) =>
                matchesPageVariableSelector(item, selected_name),
            );
            let reply_text = ai_result.reply || 'AI 已更新变量草稿';
            if (ai_result.warnings.length > 0) {
                reply_text += `\n\n警告：\n- ${ai_result.warnings.join('\n- ')}`;
            }
            setActivePageVariableId(selected_variable?.id || normalized_variables[0]?.id || null);
            setPageVariableAiHistory((previous) => [
                ...previous,
                {
                    id: `page-variable-assistant-${Date.now()}`,
                    role: 'assistant',
                    content: `${reply_text}\n\nAI 已按${replace_all ? '整表替换' : '增量合并'}方式更新变量草稿，请检查后保存。`,
                },
            ]);
            if (pageVariableScriptEditorOpen && pageVariableScriptTargetId) {
                const target_variable = normalized_variables.find((item) => item.id === pageVariableScriptTargetId);
                setPageVariableScriptDraft(String(target_variable?.scripts?.onChange || ''));
            }
            setPageVariableAiPrompt('');
            message.success('AI 已更新页面变量草稿，请检查后保存');
        } catch (error) {
            setPageVariableAiHistory((previous) => [
                ...previous,
                {
                    id: `page-variable-assistant-error-${Date.now()}`,
                    role: 'assistant',
                    content: error instanceof Error ? error.message : 'AI 变量编辑失败',
                },
            ]);
            message.error(error instanceof Error ? error.message : 'AI 变量编辑失败');
        } finally {
            setPageVariableAiLoading(false);
        }
    };

    const applyPageVariableScriptDiff = (code_block: { language: string; code: string }) => {
        const language = normalizeCodeLanguage(code_block.language);

        setPageVariableScriptDiffProposal({
            originalCode: pageVariableScriptDraft,
            proposedCode: code_block.code,
            language,
            guardWarnings: buildAiCodeGuardWarnings(code_block.code, 'onClick'),
        });
    };

    const acceptPageVariableScriptDiff = () => {
        const final_code = pageVariableScriptDiffEditorRef.current?.getModifiedEditor?.().getValue?.()
            ?? pageVariableScriptDiffProposal?.proposedCode
            ?? pageVariableScriptDraft;

        setPageVariableScriptDraft(final_code);
        setPageVariableScriptDiffProposal(null);
        message.success('已接受 AI 修改，请保存脚本');
    };

    const executePageVariableScriptAiPrompt = async () => {
        const prompt_text = pageVariableScriptAiPrompt.trim();
        if (!prompt_text || pageVariableScriptAiLoading || !pageVariableScriptTarget) {
            return;
        }

        const user_entry = {
            id: `page-variable-script-user-${Date.now()}`,
            role: 'user' as const,
            content: prompt_text,
            label: prompt_text,
        };
        const next_history = [...pageVariableScriptAiHistory, user_entry];
        const variable_key = buildScopedVariableKey('page', pageVariableScriptTarget.name);
        const current_variables = pageVariableDrafts.length > 0
            ? pageVariableDrafts
            : page.variables.map((variable) => normalizeVariableDraft(variable));

        setPageVariableScriptAiHistory(next_history);
        setPageVariableScriptAiPrompt('');
        setPageVariableScriptAiLoading(true);

        try {
            const ai_result = await callAiScriptEditTask({
                messages: next_history.map((entry) => ({
                    role: entry.role,
                    content: entry.content,
                })),
                target: {
                    scope: 'page_variable_script',
                    pageId: page.id,
                    variableId: pageVariableScriptTarget.id,
                    file: 'onChange.js',
                },
                context: {
                    variableKey: variable_key,
                    variable: pageVariableScriptTarget,
                    currentCode: pageVariableScriptDraft || '',
                    pageVariables: current_variables,
                    runtimeRules: buildRuntimeVariableAiContext(page),
                },
            });
            let reply_content = ai_result.reply || '已处理';
            const structured_code =
                ai_result.resultType === 'code'
                && ai_result.result
                && typeof ai_result.result === 'object'
                && typeof (ai_result.result as { code?: unknown }).code === 'string'
                && String((ai_result.result as { code?: unknown }).code || '').trim()
                    ? {
                        language: typeof (ai_result.result as { language?: unknown }).language === 'string'
                            ? String((ai_result.result as { language?: unknown }).language)
                            : 'javascript',
                        code: String((ai_result.result as { code?: unknown }).code || ''),
                    }
                    : null;
            let code_block =
                structured_code
                    || extractCodeBlock(reply_content)
                        || inferCodeBlockFromReply(reply_content, 'onClick');

            if (code_block && shouldRejectCodeBlockForTab(code_block, 'onClick')) {
                reply_content += '\n\n已拦截：变量脚本需要完整 JavaScript 代码，不能返回 JSON。';
                code_block = null;
            }

            if (ai_result.warnings.length > 0) {
                reply_content += `\n\n警告：\n- ${ai_result.warnings.join('\n- ')}`;
            }

            setPageVariableScriptAiHistory((previous) => [
                ...previous,
                {
                    id: `page-variable-script-assistant-${Date.now()}`,
                    role: 'assistant',
                    content: reply_content,
                    codeBlock: code_block,
                },
            ]);

            if (code_block) {
                applyPageVariableScriptDiff(code_block);
            }
        } catch (error) {
            const error_text = error instanceof Error ? error.message : '变量脚本 AI 调用失败';
            setPageVariableScriptAiHistory((previous) => [
                ...previous,
                {
                    id: `page-variable-script-assistant-error-${Date.now()}`,
                    role: 'assistant',
                    content: `AI 调用失败：${error_text}`,
                },
            ]);
        } finally {
            setPageVariableScriptAiLoading(false);
        }
    };

    useEffect(() => {
        if (pageVariableEditorOpen) {
            return;
        }

        const drafts = cloneSchema(page.variables).map((variable) => normalizeVariableDraft(variable));
        setPageVariableDrafts(drafts);
        setActivePageVariableId((previous) =>
            drafts.some((item) => item.id === previous)
                ? previous
                : drafts[0]?.id || null,
        );
    }, [page.variables, pageVariableEditorOpen]);

    const getStoredEditorCode = (
        window_item: EditorWindowState,
        target_node: ComponentNode | null,
        tab: WorkspaceTab = window_item.activeTab,
    ) => {
        if (tab === 'propsJson') {
            return window_item.targetKind === 'page'
                ? buildPagePropsDraft(page)
                : buildPropsDraft(target_node);
        }

        if (isCustomHtmlContentTab(tab)) {
            if (tab === customHtmlFullTab) {
                return buildCustomHtmlDocumentFromNode(target_node);
            }

            return readCustomHtmlParts(target_node)[customHtmlSplitTabMeta[tab].prop];
        }

        if (window_item.targetKind === 'page') {
            return page.scripts[tab as keyof PageScripts] || '';
        }

        return target_node?.scripts[tab as keyof ComponentScripts] || '';
    };

    const getEditorCode = (
        window_item: EditorWindowState,
        target_node: ComponentNode | null,
        tab: WorkspaceTab = window_item.activeTab,
    ) => {
        const draft_key = buildEditorDraftKey(window_item.id, tab);

        if (isCustomHtmlContentTab(tab)) {
            const full_document = hasOwnDraft(editorDrafts, draft_key)
                ? editorDrafts[draft_key]
                : buildCustomHtmlDocumentFromNode(target_node);

            if (tab === customHtmlFullTab) {
                return full_document;
            }

            return parseCustomHtmlDocument(full_document)[customHtmlSplitTabMeta[tab].prop];
        }

        return hasOwnDraft(editorDrafts, draft_key)
            ? editorDrafts[draft_key]
            : getStoredEditorCode(window_item, target_node, tab);
    };

    const updateEditorDraft = (
        window_item: EditorWindowState,
        target_node: ComponentNode | null,
        tab: WorkspaceTab,
        value: string,
    ) => {
        const draft_key = buildEditorDraftKey(window_item.id, tab);

        if (isCustomHtmlContentTab(tab)) {
            const next_document = tab === customHtmlFullTab
                ? value
                : buildCustomHtmlDocument({
                    ...parseCustomHtmlDocument(getEditorCode(window_item, target_node, customHtmlFullTab)),
                    [customHtmlSplitTabMeta[tab].prop]: value,
                });

            setEditorDrafts((previous) => ({
                ...previous,
                [draft_key]: next_document,
            }));
            return;
        }

        setEditorDrafts((previous) => ({
            ...previous,
            [draft_key]: value,
        }));
    };

    const clearEditorDraft = (window_id: string, tab: WorkspaceTab) => {
        const draft_key = buildEditorDraftKey(window_id, tab);
        setEditorDrafts((previous) => {
            const next_drafts = { ...previous };
            delete next_drafts[draft_key];
            return next_drafts;
        });
    };

    const clearEditorWindowDrafts = (window_id: string) => {
        const prefix = `${window_id}::`;
        setEditorDrafts((previous) => {
            const next_drafts = { ...previous };
            Object.keys(next_drafts).forEach((draft_key) => {
                if (draft_key === window_id || draft_key.startsWith(prefix)) {
                    delete next_drafts[draft_key];
                }
            });
            return next_drafts;
        });
    };

    const isEditorTabDirty = (
        window_item: EditorWindowState,
        target_node: ComponentNode | null,
        tab: WorkspaceTab = window_item.activeTab,
    ) => {
        const draft_key = buildEditorDraftKey(window_item.id, tab);

        if (!hasOwnDraft(editorDrafts, draft_key)) {
            return false;
        }

        const draft_value = editorDrafts[draft_key];
        const stored_value = isCustomHtmlContentTab(tab)
            ? buildCustomHtmlDocumentFromNode(target_node)
            : getStoredEditorCode(window_item, target_node, tab);

        return draft_value !== stored_value;
    };

    const getDirtyEditorTabs = (
        window_item: EditorWindowState,
        target_node: ComponentNode | null,
    ) => {
        const prefix = `${window_item.id}::`;
        const tabs: WorkspaceTab[] = [];

        Object.keys(editorDrafts).forEach((draft_key) => {
            if (draft_key !== window_item.id && !draft_key.startsWith(prefix)) {
                return;
            }

            const tab = resolveEditorDraftTab(window_item.id, draft_key);
            if (tab && isEditorTabDirty(window_item, target_node, tab)) {
                tabs.push(tab);
            }
        });

        return tabs;
    };

    const saveEditorDraft = (
        window_item: EditorWindowState,
        tab: WorkspaceTab = window_item.activeTab,
    ) => {
        const target_node = window_item.targetKind === 'node'
            ? findNodeById(page.root, window_item.targetId)
            : null;

        try {
            if (tab === 'propsJson') {
                const parsed = JSON.parse(getEditorCode(window_item, target_node, tab)) as Record<string, unknown>;
                if (window_item.targetKind === 'page') {
                    onPageSettingsChange(parsed);
                } else {
                    onNodePropsReplace(window_item.targetId, parsed);
                }
                clearEditorDraft(window_item.id, tab);
                return true;
            }

            if (isCustomHtmlContentTab(tab)) {
                if (window_item.targetKind !== 'node') {
                    return false;
                }

                const full_document = getEditorCode(window_item, target_node, customHtmlFullTab);
                onNodePropsChange(window_item.targetId, parseCustomHtmlDocument(full_document));
                clearEditorDraft(window_item.id, tab);
                return true;
            }

            updateCurrentScript(
                window_item.targetKind,
                window_item.targetId,
                tab as ScriptEntryKey,
                getEditorCode(window_item, target_node, tab),
            );
            clearEditorDraft(window_item.id, tab);
            return true;
        } catch {
            message.error(tab === 'propsJson' ? '属性 JSON 解析失败' : '代码保存失败，请检查语法');
            return false;
        }
    };

    const saveEditorWindow = (
        window_item: EditorWindowState,
        options: { saveAll?: boolean } = {},
    ) => {
        const target_node = window_item.targetKind === 'node'
            ? findNodeById(page.root, window_item.targetId)
            : null;
        const tabs = options.saveAll
            ? getDirtyEditorTabs(window_item, target_node)
            : [window_item.activeTab];

        if (tabs.length === 0) {
            return true;
        }

        const ordered_tabs = [...tabs].sort((a, b) => {
            const order: WorkspaceTab[] = ['propsJson', customHtmlFullTab, 'htmlContent', 'cssContent', 'jsContent'];
            return order.indexOf(a) - order.indexOf(b);
        });

        for (const tab of ordered_tabs) {
            if (!saveEditorDraft(window_item, tab)) {
                return false;
            }
        }

        message.success(options.saveAll ? '已保存全部修改' : '已保存');
        return true;
    };

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            const has_dirty_editor = openEditors.some((window_item) => {
                const target_node = window_item.targetKind === 'node'
                    ? findNodeById(page.root, window_item.targetId)
                    : null;

                return getDirtyEditorTabs(window_item, target_node).length > 0;
            });

            if (!has_dirty_editor) {
                return;
            }

            event.preventDefault();
            event.returnValue = '代码编辑器存在未保存修改，离开页面会丢失更改。';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [editorDrafts, openEditors, page]);

    useEffect(() => {
        setPropsDraft(buildPropsDraft(node));
        const next_node_id = node?.id || null;

        if (previousSelectedNodeIdRef.current !== next_node_id) {
            if (next_node_id) {
                setPanelSection('props');
            }
            previousSelectedNodeIdRef.current = next_node_id;
        }

        // customHtml 组件无 events tab，切回时重置到 props
        if (node?.type === 'customHtml' && panelSection === 'events') {
            setPanelSection('props');
        }
        // 非 customHtml 组件无 assets tab，切回时重置到 props
        if (node && node.type !== 'customHtml' && panelSection === 'assets') {
            setPanelSection('props');
        }
    }, [node]);

    useEffect(() => {
        const valid_window_ids = new Set<string>([`editor-page-${page.id}`]);

        flattenNodes(page.root).forEach((item) => {
            valid_window_ids.add(`editor-node-${item.id}`);
        });

        setOpenEditors((previous) =>
            previous.filter((item) => valid_window_ids.has(item.id)),
        );
        setEditorOrder((previous) =>
            previous.filter((item) => valid_window_ids.has(item)),
        );
        setEditorDrafts((previous) => {
            const next_drafts: Record<string, string> = {};
            Object.entries(previous).forEach(([draft_key, draft_value]) => {
                const window_id = draft_key.split('::')[0];
                if (valid_window_ids.has(window_id)) {
                    next_drafts[draft_key] = draft_value;
                }
            });
            return next_drafts;
        });
    }, [page.id, page.root]);

    useEffect(() => {
        const handleWindowMouseMove = (event: MouseEvent) => {
            const drag_state = dragStateRef.current;
            if (!drag_state) {
                return;
            }

            if (drag_state.target.kind === 'ai') {
                setAiWindow((previous) => {
                    if (previous.maximized) {
                        return previous;
                    }

                    const max_x = Math.max(12, window.innerWidth - previous.width - 12);
                    const max_y = Math.max(12, window.innerHeight - previous.height - 12);
                    return {
                        ...previous,
                        x: Math.min(
                            Math.max(12, drag_state.origin_x + event.clientX - drag_state.start_x),
                            max_x,
                        ),
                        y: Math.min(
                            Math.max(12, drag_state.origin_y + event.clientY - drag_state.start_y),
                            max_y,
                        ),
                    };
                });
                return;
            }

            const editor_window_id = drag_state.target.windowId;

            setOpenEditors((previous) =>
                previous.map((item) => {
                    if (item.id !== editor_window_id || item.maximized) {
                        return item;
                    }

                    const max_x = Math.max(12, window.innerWidth - item.width - 12);
                    const max_y = Math.max(12, window.innerHeight - item.height - 12);
                    return {
                        ...item,
                        x: Math.min(
                            Math.max(12, drag_state.origin_x + event.clientX - drag_state.start_x),
                            max_x,
                        ),
                        y: Math.min(
                            Math.max(12, drag_state.origin_y + event.clientY - drag_state.start_y),
                            max_y,
                        ),
                    };
                }),
            );
        };

        const handleWindowMouseUp = () => {
            dragStateRef.current = null;
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, []);

    useEffect(() => {
        if (!editorOpenRequest) {
            return;
        }

        const requestNode = findNodeById(page.root, editorOpenRequest.nodeId);
        const initialTab = requestNode?.type === 'customHtml' ? customHtmlFullTab : 'propsJson';
        openEditorForNode(editorOpenRequest.nodeId, initialTab as WorkspaceTab);
        onEditorOpenRequestHandled();
    }, [editorOpenRequest]);

    useEffect(() => {
        if (openEditors.length === 0) {
            setAiWindow((previous) => ({
                ...previous,
                visible: false,
                maximized: false,
            }));
            setFocusedEditorId(null);
        }
    }, [openEditors.length]);

    const bringEditorToFront = (window_id: string) => {
        setEditorOrder((previous) => [
            ...previous.filter((item) => item !== window_id),
            window_id,
        ]);
        setFocusedEditorId(window_id);
    };

    const ensureAiWindowVisible = () => {
        const ai_width = Math.min(420, window.innerWidth - 40);
        const ai_height = Math.min(360, window.innerHeight - 40);

        setAiWindow((previous) => ({
            ...previous,
            visible: true,
            maximized: false,
            width: ai_width,
            height: ai_height,
            x: previous.x || Math.max(16, window.innerWidth - ai_width - 24),
            y: previous.y || 88,
        }));
    };

    const openEditorForNode = (node_id: string, initial_tab: WorkspaceTab) => {
        const target_node = findNodeById(page.root, node_id);
        if (!target_node) {
            return;
        }

        const window_id = `editor-node-${node_id}`;
        const exists = openEditors.find((item) => item.id === window_id);

        if (exists) {
            setOpenEditors((previous) =>
                previous.map((item) =>
                    item.id === window_id
                        ? { ...item, visible: true, activeTab: initial_tab }
                        : item,
                ),
            );
            bringEditorToFront(window_id);
            ensureAiWindowVisible();
            return;
        }

        const next_window = createEditorWindow('node', node_id, openEditors.length);
        next_window.activeTab = initial_tab;
        setOpenEditors((previous) => [...previous, next_window]);
        setEditorOrder((previous) => [...previous, next_window.id]);
        setFocusedEditorId(next_window.id);
        ensureAiWindowVisible();
    };

    const openEditorForPage = (initial_tab: Exclude<WorkspaceTab, 'propsJson'> | 'propsJson') => {
        const window_id = `editor-page-${page.id}`;
        const exists = openEditors.find((item) => item.id === window_id);

        if (exists) {
            setOpenEditors((previous) =>
                previous.map((item) =>
                    item.id === window_id
                        ? { ...item, visible: true, activeTab: initial_tab }
                        : item,
                ),
            );
            bringEditorToFront(window_id);
            ensureAiWindowVisible();
            return;
        }

        const next_window = createEditorWindow('page', page.id, openEditors.length);
        next_window.activeTab = initial_tab;
        setOpenEditors((previous) => [...previous, next_window]);
        setEditorOrder((previous) => [...previous, next_window.id]);
        setFocusedEditorId(next_window.id);
        ensureAiWindowVisible();
    };

    const forceCloseEditorWindow = (window_id: string) => {
        dragStateRef.current = null;
        setOpenEditors((previous) => previous.filter((item) => item.id !== window_id));
        setEditorOrder((previous) => previous.filter((item) => item !== window_id));
        clearEditorWindowDrafts(window_id);
        delete diffEditorInstancesRef.current[window_id];
        setFocusedEditorId((previous) => (previous === window_id ? null : previous));
    };

    const closeEditorWindow = (window_id: string) => {
        const window_item = openEditors.find((item) => item.id === window_id);
        const target_node = window_item?.targetKind === 'node'
            ? findNodeById(page.root, window_item.targetId)
            : null;

        if (!window_item || getDirtyEditorTabs(window_item, target_node).length === 0) {
            forceCloseEditorWindow(window_id);
            return;
        }

        Modal.confirm({
            title: '有未保存的修改',
            content: '关闭前是否保存？选择不保存会丢失本次代码编辑器里的更改。',
            okText: '保存并关闭',
            cancelText: '不保存',
            onOk: () => {
                if (!saveEditorWindow(window_item, { saveAll: true })) {
                    return Promise.reject();
                }

                forceCloseEditorWindow(window_id);
                return undefined;
            },
            onCancel: () => forceCloseEditorWindow(window_id),
        });
    };

    const toggleEditorMaximize = (window_id: string) => {
        setOpenEditors((previous) =>
            previous.map((item) =>
                item.id === window_id
                    ? { ...item, maximized: !item.maximized, visible: true }
                    : item,
            ),
        );
        bringEditorToFront(window_id);
    };

    const beginDrag = (
        target: FloatingTarget,
        event: React.MouseEvent<HTMLDivElement>,
    ) => {
        event.preventDefault();

        if (target.kind === 'ai') {
            if (aiWindow.maximized) {
                return;
            }

            dragStateRef.current = {
                target,
                start_x: event.clientX,
                start_y: event.clientY,
                origin_x: aiWindow.x,
                origin_y: aiWindow.y,
            };
            return;
        }

        const target_window = openEditors.find((item) => item.id === target.windowId);
        if (!target_window || target_window.maximized) {
            return;
        }

        bringEditorToFront(target.windowId);
        dragStateRef.current = {
            target,
            start_x: event.clientX,
            start_y: event.clientY,
            origin_x: target_window.x,
            origin_y: target_window.y,
        };
    };

    const renderEditorWindowStyle = (window_item: EditorWindowState) => {
        const order_index = editorOrder.indexOf(window_item.id);
        const z_index = 110 + Math.max(order_index, 0);

        if (window_item.maximized) {
            return {
                left: 16,
                top: 16,
                width: 'calc(100vw - 32px)',
                height: 'calc(100vh - 32px)',
                zIndex: z_index,
            };
        }

        return {
            left: window_item.x,
            top: window_item.y,
            width: window_item.width,
            height: window_item.height,
            zIndex: z_index,
        };
    };

    const renderAiWindowStyle = () => {
        if (aiWindow.maximized) {
            return {
                left: 16,
                top: 16,
                width: 'calc(100vw - 32px)',
                height: 'calc(100vh - 32px)',
                zIndex: 300,
            };
        }

        return {
            left: aiWindow.x,
            top: aiWindow.y,
            width: aiWindow.width,
            height: aiWindow.height,
            zIndex: 300,
        };
    };

    /** 代码编辑 AI：将用户提问（带上当前文件与选中代码）发给后端 AI */
    const executeCodePrompt = async (raw: string) => {
        const text = raw.trim();
        if (!text || aiLoading) return;

        // 获取当前聚焦窗口的完整代码内容
        let currentCode = '';
        if (focusedWindow) {
            currentCode = getEditorCode(focusedWindow, focusedNode, focusedWindow.activeTab);
        }

        // 获取用户在编辑器中手动选中的代码片段，同时记录行号供精准替换
        let selectedText = '';
        let selectionRange: { startLine: number; endLine: number } | null = null;
        const editorInstance = activeEditorRef.current;
        if (editorInstance) {
            const selection = editorInstance.getSelection?.();
            if (selection && !selection.isEmpty?.()) {
                selectedText = (editorInstance.getModel?.()?.getValueInRange(selection)) || '';
                selectionRange = {
                    startLine: selection.startLineNumber,
                    endLine:   selection.endLineNumber,
                };
            }
        }

        // 构建包含当前编辑器上下文的用户消息
        let contextPrefix = '';
        if (focusedNode && focusedWindow) {
            const file = focusedWindow.activeTab === 'propsJson'
                ? 'props.json'
                : isCustomHtmlContentTab(focusedWindow.activeTab)
                    ? `${customHtmlTabMeta[focusedWindow.activeTab].label} 编辑`
                    : buildEventFileName(String(focusedWindow.activeTab));
            contextPrefix = `【当前文件】组件名称: ${focusedNode.name}（${focusedNode.type}），文件: ${file}\n`;
            contextPrefix += buildAiOutputContract(focusedWindow.activeTab, file);
            if (selectedText) {
                contextPrefix += `【选中代码】\n\`\`\`\n${selectedText}\n\`\`\`\n`;
            } else if (currentCode) {
                contextPrefix += `【当前完整代码】\n\`\`\`\n${currentCode}\n\`\`\`\n`;
            }
            contextPrefix += '\n';
        } else if (focusedWindow?.targetKind === 'page') {
            const file = focusedWindow.activeTab === 'propsJson'
                ? 'props.json'
                : buildEventFileName(String(focusedWindow.activeTab));
            contextPrefix = `【当前文件】页面脚本，文件: ${file}\n`;
            contextPrefix += buildAiOutputContract(focusedWindow.activeTab, file);
            if (selectedText) {
                contextPrefix += `【选中代码】\n\`\`\`\n${selectedText}\n\`\`\`\n`;
            } else if (currentCode) {
                contextPrefix += `【当前完整代码】\n\`\`\`\n${currentCode}\n\`\`\`\n`;
            }
            contextPrefix += '\n';
        }

        contextPrefix += buildRuntimeVariableAiContext(page);

        // customHtml 组件额外注入 ScadaBridge API 文档和当前完整上下文
        const custom_context_node = focusedNode?.type === 'customHtml'
            ? focusedNode
            : node?.type === 'customHtml'
                ? node
                : null;
        if (custom_context_node) {
            // 没有浮动编辑器时，也构建基础上下文
            if (!contextPrefix) {
                contextPrefix = `【当前组件】${custom_context_node.name}（customHtml）\n`;
                const sectionFileMap: Record<string, { lang: string; prop: string }> = {
                    html: { lang: 'html', prop: 'htmlContent' },
                    css: { lang: 'css', prop: 'cssContent' },
                    js: { lang: 'javascript', prop: 'jsContent' },
                };
                const activeSection = sectionFileMap[panelSection];
                if (activeSection) {
                    const code = String(custom_context_node.props[activeSection.prop] ?? '');
                    if (code.trim()) {
                        contextPrefix += `【当前编辑】${panelSection.toUpperCase()}\n\`\`\`${activeSection.lang}\n${code}\n\`\`\`\n`;
                    }
                }
            }
            const custom_parts = focusedWindow?.targetKind === 'node'
                && focusedWindow.targetId === custom_context_node.id
                ? parseCustomHtmlDocument(getEditorCode(focusedWindow, custom_context_node, customHtmlFullTab))
                : readCustomHtmlParts(custom_context_node);
            contextPrefix += '【customHtml 完整HTML】\n';
            contextPrefix += `\`\`\`html\n${buildCustomHtmlDocument(custom_parts)}\n\`\`\`\n`;
            contextPrefix += '【customHtml 拆分字段】\n';
            contextPrefix += `htmlContent:\n\`\`\`html\n${custom_parts.htmlContent}\n\`\`\`\n`;
            contextPrefix += `cssContent:\n\`\`\`css\n${custom_parts.cssContent}\n\`\`\`\n`;
            contextPrefix += `jsContent:\n\`\`\`javascript\n${custom_parts.jsContent}\n\`\`\`\n`;
            contextPrefix += '【ScadaBridge API】可用方法与硬性约束：\n';
            contextPrefix += '- 所有 ScadaBridge 调用必须放在 ScadaBridge.onReady(callback) 内，或确保 ready 后执行。\n';
            contextPrefix += '- ScadaBridge.readTag(tagName) → Promise<{ value, timestamp, unit, quality }>；读取数值必须使用 data.value。\n';
            contextPrefix += '- ScadaBridge.writeTag(tagName, value) → Promise<{ success, message }>  写入变量。\n';
            contextPrefix += '- ScadaBridge.subscribe(tagName, callback) → unsubscribe；callback 参数结构同 readTag。\n';
            contextPrefix += '- ScadaBridge.readVar(name) → Promise<RuntimeVariable | null>；读取页面局部变量完整对象。\n';
            contextPrefix += '- ScadaBridge.writeVar(name, value) → Promise<{ success, variable }>；写入页面局部变量，不写后端点位。\n';
            contextPrefix += '- ScadaBridge.subscribeVar(name, callback) → unsubscribe；订阅页面局部变量变化。\n';
            contextPrefix += '- ScadaBridge.callComponent(componentIdOrName, methodName, ...args) → Promise<any>；调用页面内组件方法。\n';
            contextPrefix += '- ScadaBridge.bindText(selector, tagName, options) → unsubscribe；初始化时调用一次，禁止放入 setInterval/循环。\n';
            contextPrefix += '- ScadaBridge.bindVarText(selector, name, options) → unsubscribe；将页面局部变量绑定到文本。\n';
            contextPrefix += '- ScadaBridge.bindWriteDialog(selector, tagName, options) → cleanup；初始化时调用一次。\n';
            contextPrefix += '- ScadaBridge.bindVarWriteDialog(selector, name, options) → cleanup；点击后写入页面局部变量。\n';
            contextPrefix += '- ScadaBridge.query(sql) → Promise<rows>  查询数据\n';
            contextPrefix += '- ScadaBridge.assetUrl(assetId) → string  获取资产文件 URL\n';
            contextPrefix += '【代码生成约束】页面局部逻辑用 readVar/writeVar/subscribeVar；系统点位才用 readTag/writeTag/subscribe。不要重复 bindText/bindVarText/bindWriteDialog。\n';
            contextPrefix += '【输出约束】默认返回当前完整 HTML 文件的完整可替换代码；如果只修改 JS/CSS/HTML 片段，必须使用对应语言代码块包裹。\n';
            contextPrefix += '\n';
        }

        const fullContent = contextPrefix + text;
        // 计算上下文标注文字（气泡中仅显示用户实际输入）
        let contextHint: string | undefined;
        if (focusedWindow) {
            const file = focusedWindow.activeTab === 'propsJson'
                ? 'props.json'
                : isCustomHtmlContentTab(focusedWindow.activeTab)
                    ? `${customHtmlTabMeta[focusedWindow.activeTab].label} 编辑`
                    : buildEventFileName(String(focusedWindow.activeTab));
            contextHint = selectedText
                ? `上下文：${file} · 选中代码片段`
                : currentCode
                    ? `上下文：${file} · 完整代码`
                    : `上下文：${file}`;
        } else if (node?.type === 'customHtml') {
            contextHint = `上下文：customHtml · 属性 + ScadaBridge API`;
        }
        const userEntry = {
            id: `user-${Date.now()}`,
            role: 'user' as const,
            content: fullContent,
            label: text,
            contextHint,
        };
        const nextHistory = [...aiHistory, userEntry];
        setAiHistory(nextHistory);
        setAiPrompt('');
        setAiLoading(true);

        // 代码 AI 不需要整页组件摘要，避免把布局上下文带入代码任务。
        const nodes: Array<{ id: string; type: string; title: string }> = [];

        // 将展示历史转换为 API 消息格式
        const messages = nextHistory.map((e) => ({ role: e.role, content: e.content }));

        try {
            const result = await callAiChat(messages, nodes);
            let replyContent = result.reply || '已处理';
            // 解析 AI 回复中的代码块，如果有则附到消息上以供对比
            let codeBlock = extractCodeBlock(replyContent)
                || inferCodeBlockFromReply(replyContent, focusedWindow?.activeTab);

            if (codeBlock && shouldRejectCodeBlockForTab(codeBlock, focusedWindow?.activeTab)) {
                replyContent += '\n\n已拦截：当前编辑的是脚本文件，但 AI 返回了 JSON。为避免用 `{}` 覆盖脚本，本次不会进入 Diff。请重试，系统会要求 AI 返回完整 JavaScript 代码块。';
                codeBlock = null;
            }

            if (!codeBlock && focusedWindow && result.actions.length > 0) {
                if (focusedWindow.activeTab === 'propsJson') {
                    const current_target_id = focusedWindow.targetKind === 'node'
                        ? focusedWindow.targetId
                        : null;
                    const only_supported_layout_actions = result.actions.every((action) =>
                        action.type === 'update_node' || action.type === 'update_page',
                    );
                    const only_current_target = Boolean(
                        current_target_id
                        && result.actions.every((action) =>
                            action.type === 'update_node'
                                ? action.nodeId === current_target_id
                                : action.type === 'update_page'
                                    ? focusedWindow.targetKind === 'page'
                                    : false,
                        ),
                    );

                    if (only_supported_layout_actions && !only_current_target) {
                        const apply_result = applyLayoutActionsToCanvas(result.actions);
                        if (apply_result.appliedCount > 0) {
                            replyContent += `\n\n已直接把 ${apply_result.appliedCount} 个布局动作应用到画布，请记得保存页面。`;
                            if (apply_result.missedCount > 0) {
                                replyContent += `\n有 ${apply_result.missedCount} 个目标节点未找到，已跳过。`;
                            }
                            if (apply_result.unsupportedCount > 0) {
                                replyContent += `\n有 ${apply_result.unsupportedCount} 个动作当前窗口不支持自动应用。`;
                            }
                            message.success(`已应用 ${apply_result.appliedCount} 个布局动作，请保存页面`);
                        }
                    } else {
                        const updateAction = result.actions.find(
                            (action) => action.type === 'update_node'
                                && action.nodeId === current_target_id
                                && action.patch,
                        );
                        if (updateAction?.patch && current_target_id) {
                            const currentNode = findNodeById(page.root, current_target_id);
                            if (currentNode) {
                                applyDiffProposal(
                                    { language: 'json', code: JSON.stringify(updateAction.patch, null, 2) },
                                    selectionRange,
                                );
                                bringEditorToFront(focusedWindow.id);
                            }
                        }
                    }
                } else {
                    replyContent += '\n\n检测到这是布局动作。当前编辑的是脚本文件，本窗口不会直接改画布；请使用 AI 编排助手或 props.json 窗口。';
                }
            }

            setAiHistory((prev) => [
                ...prev,
                { id: `assistant-${Date.now()}`, role: 'assistant' as const, content: replyContent, codeBlock },
            ]);
            // AI 回复含代码块时直接打开 Diff 对比，传入选区行号以精准替换
            if (codeBlock) applyDiffProposal(codeBlock, selectionRange);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setAiHistory((prev) => [
                ...prev,
                { id: `assistant-err-${Date.now()}`, role: 'assistant' as const, content: `AI 调用失败：${msg}` },
            ]);
        } finally {
            setAiLoading(false);
        }
    };

    const applyRawProps = (window_item: EditorWindowState) => {
        if (saveEditorDraft(window_item, 'propsJson')) {
            message.success('属性 JSON 已保存');
        }
    };

    const applyLayoutActionsToCanvas = (actions: AiAction[]) => {
        let applied_count = 0;
        let missed_count = 0;
        let unsupported_count = 0;

        actions.forEach((action) => {
            if (action.type === 'update_page' && action.patch) {
                onPageSettingsChange(action.patch);
                applied_count += 1;
                return;
            }

            if (action.type === 'update_node' && action.nodeId) {
                const target_node = findNodeById(page.root, action.nodeId);
                if (!target_node) {
                    missed_count += 1;
                    return;
                }

                if (action.patch) {
                    onNodePropsChange(action.nodeId, action.patch);
                }
                if (action.title) {
                    onNodeTitleChange(action.nodeId, action.title);
                }
                applied_count += 1;
                return;
            }

            unsupported_count += 1;
        });

        return {
            appliedCount: applied_count,
            missedCount: missed_count,
            unsupportedCount: unsupported_count,
        };
    };

    /**
     * 将 AI 代码块作为 Diff 建议推送到当前聚焦的编辑器窗口。
     * 若传入 selectionRange（用户发送时的选区行号），则精准替换该行区间，
     * 保证改动位置 100% 正确；无选区时回退到 JSON 格式统一化对比。
     */
    const applyDiffProposal = (
        code_block: { language: string; code: string },
        selectionRange?: { startLine: number; endLine: number } | null,
    ) => {
        if (!focusedWindow) {
            message.warning('请先聚焦一个编辑器窗口');
            return;
        }

        if (shouldRejectCodeBlockForTab(code_block, focusedWindow.activeTab)) {
            message.warning('当前是脚本文件，AI 返回了 JSON，已拦截以避免覆盖代码');
            return;
        }

        // 获取当前代码作为 Diff 的原始侧
        let originalCode = getEditorCode(focusedWindow, focusedNode, focusedWindow.activeTab);

        setOpenEditors((prev) =>
            prev.map((item) => {
                if (item.id !== focusedWindow.id) return item;

                let proposedCode = code_block.code;
                let proposalLanguage = normalizeCodeLanguage(code_block.language);

                if (selectionRange) {
                    // 有选区：精准行区间替换 —— 将原始代码中 [startLine, endLine] 替换为 AI 返回内容
                    const lines = originalCode.split('\n');
                    const { startLine, endLine } = selectionRange;
                    // Monaco 行号从 1 开始，转为 0-based 索引
                    const before      = lines.slice(0, startLine - 1);
                    const after       = lines.slice(endLine);          // endLine 已是 1-based，slice 不含
                    const aiLines     = code_block.code.split('\n');
                    // 保留首行缩进（与原选区首行对齐）
                    const indent      = lines[startLine - 1]?.match(/^(\s*)/)?.[1] ?? '';
                    const indented    = aiLines.map((l, i) => (i === 0 ? indent + l.trimStart() : l));
                    proposedCode      = [...before, ...indented, ...after].join('\n');
                } else if (focusedWindow.activeTab === 'propsJson' && proposalLanguage === 'json') {
                    // 无选区 + JSON：统一格式化两侧，消除 AI 返回格式差异引起的虚假 diff
                    try {
                        const current     = parseJsonCandidate(originalCode) as Record<string, unknown>;
                        originalCode      = JSON.stringify(current, null, 2);
                        const patch       = parseJsonCandidate(code_block.code) as Record<string, unknown>;
                        // 判断是否为完整 props（key 数 ≥ current 80%），否则视为补丁递归合并
                        const isFullProps = Object.keys(patch).length >= Object.keys(current).length * 0.8;
                        proposedCode      = isFullProps
                            ? JSON.stringify(patch,                       null, 2)
                            : JSON.stringify(deepMergePatch(current, patch), null, 2);
                    } catch {
                        // 非 JSON 或解析失败，直接使用原始代码块
                    }
                } else if (focusedWindow.activeTab === customHtmlFullTab && focusedNode?.type === 'customHtml') {
                    try {
                        const currentParts = parseCustomHtmlDocument(originalCode);

                        if (proposalLanguage === 'json') {
                            const patch = JSON.parse(code_block.code) as Partial<CustomHtmlParts>;
                            proposedCode = buildCustomHtmlDocument({
                                ...currentParts,
                                ...(typeof patch.htmlContent === 'string' ? { htmlContent: patch.htmlContent } : {}),
                                ...(typeof patch.cssContent === 'string' ? { cssContent: patch.cssContent } : {}),
                                ...(typeof patch.jsContent === 'string' ? { jsContent: patch.jsContent } : {}),
                            });
                            proposalLanguage = 'html';
                        } else if (proposalLanguage === 'javascript') {
                            proposedCode = buildCustomHtmlDocument({
                                ...currentParts,
                                jsContent: code_block.code,
                            });
                            proposalLanguage = 'html';
                        } else if (proposalLanguage === 'css') {
                            proposedCode = buildCustomHtmlDocument({
                                ...currentParts,
                                cssContent: code_block.code,
                            });
                            proposalLanguage = 'html';
                        } else if (proposalLanguage === 'html' && !isCompleteHtmlDocument(code_block.code)) {
                            proposedCode = buildCustomHtmlDocument({
                                ...currentParts,
                                htmlContent: code_block.code,
                            });
                            proposalLanguage = 'html';
                        }
                    } catch {
                        // 解析失败时保持 AI 原始代码，交给用户在 diff 里确认。
                    }
                }

                return {
                    ...item,
                    diffProposal: {
                        originalCode,
                        proposedCode,
                        language: proposalLanguage,
                        guardWarnings: buildAiCodeGuardWarnings(
                            proposedCode,
                            focusedWindow.activeTab,
                        ),
                    },
                };
            }),
        );
    };

    /** 接受 AI 的 Diff 建议，先进入草稿，用户保存后再写入实际状态 */
    const acceptDiff = (window_item: EditorWindowState) => {
        if (!window_item.diffProposal) return;
        // 读取用户在 modified 侧可能已手动还原部分 hunk 后的当前值
        const finalCode =
            diffEditorInstancesRef.current[window_item.id]?.getModifiedEditor?.().getValue?.()
            ?? window_item.diffProposal.proposedCode;
        const target_node = window_item.targetKind === 'node'
            ? findNodeById(page.root, window_item.targetId)
            : null;

        updateEditorDraft(window_item, target_node, window_item.activeTab, finalCode);
        setOpenEditors((prev) =>
            prev.map((item) =>
                item.id === window_item.id ? { ...item, diffProposal: null } : item,
            ),
        );
        message.success('已接受 AI 修改，请点击保存写入组件');
    };

    /** 拒绝 AI 的 Diff 建议，退回到普通编辑模式 */
    const rejectDiff = (window_id: string) => {
        setOpenEditors((prev) =>
            prev.map((item) =>
                item.id === window_id ? { ...item, diffProposal: null } : item,
            ),
        );
    };

    const updateCurrentScript = (
        target_kind: 'node' | 'page',
        target_id: string,
        script_key: ScriptEntryKey,
        value: string,
    ) => {
        if (target_kind === 'page') {
            onPageScriptsChange({
                [script_key as keyof PageScripts]: value,
            } as Partial<PageScripts>);
            return;
        }

        if (script_key === 'onOpen') {
            onNodeScriptsChange(target_id, { onOpen: value, onLoad: value });
            return;
        }

        onNodeScriptsChange(target_id, {
            [script_key as keyof ComponentScripts]: value,
        } as Partial<ComponentScripts>);
    };

    const updateVariable = (
        variable_id: string,
        patch: Partial<ComponentVariable>,
    ) => {
        if (!node) {
            return;
        }

        onVariablesChange(
            node.variables.map((item) =>
                item.id === variable_id
                    ? { ...item, ...patch }
                    : item,
            ),
        );
    };

    const addVariable = () => {
        if (!node) {
            return;
        }

        onVariablesChange([...node.variables, createVariableDraft()]);
    };

    const removeVariable = (variable_id: string) => {
        if (!node) {
            return;
        }

        onVariablesChange(node.variables.filter((item) => item.id !== variable_id));
    };

    const page_settings_panel = {
        key: 'page-settings',
        label: '页面设置',
        children: (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Paragraph className="editor-preview-hint">
                    这些属于低频初始化项，默认收起，避免干扰日常组件编辑。
                </Typography.Paragraph>
                <Typography.Text className="config-label">页面宽度</Typography.Text>
                <InputNumber
                    min={320}
                    step={10}
                    style={{ width: '100%' }}
                    value={Number(page.root.props.canvasWidth || 1600)}
                    onChange={(value) => onPageSettingsChange({ canvasWidth: Number(value || 1600) })}
                />
                <Typography.Text className="config-label">页面高度</Typography.Text>
                <InputNumber
                    min={240}
                    step={10}
                    style={{ width: '100%' }}
                    value={Number(page.root.props.canvasHeight || 900)}
                    onChange={(value) => onPageSettingsChange({ canvasHeight: Number(value || 900) })}
                />
                <Typography.Text className="config-label">背景颜色</Typography.Text>
                <Input
                    value={String(page.root.props.background || '#081622')}
                    onChange={(event) => onPageSettingsChange({ background: event.target.value })}
                />
                <Typography.Text className="config-label">网格尺寸</Typography.Text>
                <InputNumber
                    min={8}
                    max={80}
                    style={{ width: '100%' }}
                    value={Number(page.root.props.gridSize || 20)}
                    onChange={(value) => onPageSettingsChange({ gridSize: Number(value || 20) })}
                />
                <Typography.Text className="config-label">定时脚本间隔(ms)</Typography.Text>
                <InputNumber
                    min={0}
                    step={100}
                    style={{ width: '100%' }}
                    value={Number(page.root.props.timerIntervalMs || 0)}
                    onChange={(value) => onPageSettingsChange({ timerIntervalMs: Number(value || 0) })}
                />
            </Space>
        ),
    };

    return (
        <div className="editor-panel-shell config-panel-shell">
            <div className="config-panel-content">
                <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <Typography.Title level={4}>配置面板</Typography.Title>
                        <Typography.Text type="secondary">
                            {node ? `当前选中：${node.title}` : '当前正在编辑页面画布配置'}
                        </Typography.Text>
                    </div>
                    {onCollapse && (
                        <Button type="text" size="small" icon={<RightOutlined />} onClick={onCollapse} title="收起面板" style={{ marginTop: 2 }} />
                    )}
                </div>
                {!node ? (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Collapse items={[page_settings_panel]} />
                        <Alert
                            type="info"
                            showIcon
                            message="页面协议已预留给 AI"
                            description="后续 AI 副驾驶可直接读取页面画布协议和组件协议，生成坐标、属性与脚本。"
                        />
                        <div className="config-item-card">
                            <div className="config-item-card-head">
                                <div>
                                    <Typography.Text strong>页面变量</Typography.Text>
                                    <Typography.Paragraph className="editor-preview-hint">
                                        配置栏只展示摘要；详细字段、变量专属变更脚本和 AI 编辑都在弹出的变量编辑器里处理。
                                    </Typography.Paragraph>
                                </div>
                                <Space size={8}>
                                    <Button type="default" onClick={() => openPageVariableEditor()}>
                                        打开变量编辑器
                                    </Button>
                                    <Button
                                        type="dashed"
                                        icon={<PlusOutlined />}
                                        onClick={openNewPageVariableEditor}
                                    >
                                        新建变量
                                    </Button>
                                </Space>
                            </div>
                            {page.variables.length === 0 ? (
                                <Empty description="当前页面还没有变量" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8,
                                    }}
                                >
                                    {page.variables.map((item) => {
                                        const meta = buildVariableListMeta(normalizeVariableDraft(item));

                                        return (
                                            <div
                                                key={item.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    minHeight: 36,
                                                    padding: '6px 8px',
                                                    border: '1px solid #d9d9d9',
                                                    borderRadius: 6,
                                                }}
                                            >
                                                <Typography.Text strong ellipsis style={{ flex: 1, minWidth: 0 }}>
                                                    {item.displayName || item.name}
                                                </Typography.Text>
                                                <Typography.Text type="secondary" ellipsis style={{ flex: 1.3, minWidth: 0 }}>
                                                    {meta.scopedKey}
                                                </Typography.Text>
                                                <Tag>{meta.typeLabel}</Tag>
                                                <Tag color={meta.scriptEnabled ? 'blue' : 'default'}>
                                                    {meta.scriptEnabled ? '脚本已配' : '无脚本'}
                                                </Tag>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    onClick={() => openPageVariableEditor(item.id)}
                                                >
                                                    编辑
                                                </Button>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => onPageVariablesChange(page.variables.filter((variable) => variable.id !== item.id))}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <Alert
                                type="info"
                                showIcon
                                style={{ marginTop: 12 }}
                                message="变量变更脚本"
                                description="页面变量支持各自的 onChange 脚本；页面 onVariableChange 仍保留为全局兜底和总线编排入口。"
                            />
                        </div>
                        <div className="config-item-card">
                            <div className="config-item-card-head">
                                <div>
                                    <Typography.Text strong>页面事件</Typography.Text>
                                    <Typography.Paragraph className="editor-preview-hint">
                                        页面脚本通过统一协议驱动，AI 与运行时共享同一份事件定义。
                                    </Typography.Paragraph>
                                </div>
                                <Button type="primary" onClick={() => openEditorForPage('propsJson')}>
                                    打开页面编辑器
                                </Button>
                            </div>
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                {pageEvents.map((item) => (
                                    <div key={item.key} className="event-script-preview">
                                        <div className="event-script-preview-head">
                                            <Tag>{buildEventFileName(item.key)}</Tag>
                                            <Typography.Text strong>{item.label}</Typography.Text>
                                        </div>
                                        <Typography.Paragraph className="editor-preview-hint">
                                            {item.summary}
                                        </Typography.Paragraph>
                                        <pre className="event-script-preview-code">
                                            {buildScriptPreview(page.scripts[item.key as keyof PageScripts] || '')}
                                        </pre>
                                        <Button type="primary" onClick={() => openEditorForPage(item.key as ScriptEntryKey)}>
                                            编辑脚本
                                        </Button>
                                    </div>
                                ))}
                            </Space>
                        </div>
                        <Typography.Text strong>{pageCanvasProtocol.title}</Typography.Text>
                        <Typography.Paragraph type="secondary">
                            {pageCanvasProtocol.summary}
                        </Typography.Paragraph>
                    </Space>
                ) : (
                    <Space direction="vertical" size={14} style={{ width: '100%' }}>
                        <Segmented
                            block
                            value={panelSection}
                            onChange={(value) => setPanelSection(value as PanelSection)}
                            options={node.type === 'customHtml' ? [
                                { label: '属性', value: 'props' },
                                { label: '资产', value: 'assets' },
                                { label: '变量', value: 'variables' },
                            ] : [
                                { label: '属性', value: 'props' },
                                { label: '变量', value: 'variables' },
                                { label: '事件', value: 'events' },
                            ]}
                        />

                        {panelSection === 'props' ? (
                            <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                <div className="config-info-block">
                                    <div className="config-info-row">
                                        <Typography.Text type="secondary">组件 ID</Typography.Text>
                                        <Typography.Text strong copyable>
                                            {node.id}
                                        </Typography.Text>
                                    </div>
                                    <div className="config-info-row">
                                        <Typography.Text type="secondary">组件类型</Typography.Text>
                                        <Tag>{node.type}</Tag>
                                    </div>
                                </div>
                                <div>
                                    <Typography.Text className="config-label">组件 Name</Typography.Text>
                                    <Input
                                        value={node.name}
                                        onChange={(event) => onNameChange(event.target.value)}
                                    />
                                </div>
                                <div>
                                    <Typography.Text className="config-label">显示标题</Typography.Text>
                                    <Input
                                        value={node.title}
                                        onChange={(event) => onTitleChange(event.target.value)}
                                    />
                                </div>
                                <div className="config-grid-two">
                                    <div>
                                        <Typography.Text className="config-label">X 坐标</Typography.Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            value={Number(node.props.x || 0)}
                                            onChange={(value) => onPropsChange({ x: Number(value || 0) })}
                                        />
                                    </div>
                                    <div>
                                        <Typography.Text className="config-label">Y 坐标</Typography.Text>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            value={Number(node.props.y || 0)}
                                            onChange={(value) => onPropsChange({ y: Number(value || 0) })}
                                        />
                                    </div>
                                </div>
                                <div className="config-grid-two">
                                    <div>
                                        <Typography.Text className="config-label">宽度</Typography.Text>
                                        <InputNumber
                                            min={40}
                                            style={{ width: '100%' }}
                                            value={Number(node.props.width || 0)}
                                            onChange={(value) => onPropsChange({ width: Number(value || 40) })}
                                        />
                                    </div>
                                    <div>
                                        <Typography.Text className="config-label">高度</Typography.Text>
                                        <InputNumber
                                            min={24}
                                            style={{ width: '100%' }}
                                            value={Number(node.props.height || 0)}
                                            onChange={(value) => onPropsChange({ height: Number(value || 24) })}
                                        />
                                    </div>
                                </div>
                                {node.type === 'text' ? (
                                    <>
                                        <div>
                                            <Typography.Text className="config-label">文本内容</Typography.Text>
                                            <Input
                                                value={String(node.props.text || '')}
                                                onChange={(event) => onPropsChange({ text: event.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">文字颜色</Typography.Text>
                                            <Input
                                                value={String(node.props.color || '')}
                                                onChange={(event) => onPropsChange({ color: event.target.value })}
                                            />
                                        </div>
                                        <Divider style={{ margin: '8px 0' }} />
                                        <Typography.Text strong>实时绑定</Typography.Text>
                                        <div>
                                            <Typography.Text className="config-label">启用实时显示</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={readRecord(node.props.binding).enabled === true ? 'true' : 'false'}
                                                onChange={(value) => onPropsChange({
                                                    binding: {
                                                        ...readRecord(node.props.binding),
                                                        enabled: value === 'true',
                                                    },
                                                })}
                                                options={[
                                                    { label: '关闭', value: 'false' },
                                                    { label: '开启', value: 'true' },
                                                ]}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">绑定来源</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={String(readRecord(node.props.binding).source || (readRecord(node.props.binding).variableName ? 'page' : 'tag'))}
                                                onChange={(value) => onPropsChange({
                                                    binding: {
                                                        ...readRecord(node.props.binding),
                                                        source: value,
                                                        ...(value === 'page'
                                                            ? { variableName: String(readRecord(node.props.binding).variableName || pageVariableOptions[0]?.value || '') }
                                                            : {}),
                                                    },
                                                })}
                                                options={[
                                                    { label: '页面变量 page.*', value: 'page' },
                                                    { label: '系统点位 tag', value: 'tag' },
                                                ]}
                                            />
                                        </div>
                                        {String(readRecord(node.props.binding).source || (readRecord(node.props.binding).variableName ? 'page' : 'tag')) === 'page' ? (
                                            <div>
                                                <Typography.Text className="config-label">绑定页面变量</Typography.Text>
                                                <Select
                                                    showSearch
                                                    allowClear
                                                    style={{ width: '100%' }}
                                                    value={String(readRecord(node.props.binding).variableName || '') || undefined}
                                                    placeholder="选择 page 变量"
                                                    options={pageVariableOptions}
                                                    onChange={(value) => onPropsChange({
                                                        binding: {
                                                            ...readRecord(node.props.binding),
                                                            source: 'page',
                                                            variableName: value || '',
                                                        },
                                                    })}
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <Typography.Text className="config-label">绑定系统点位</Typography.Text>
                                                <Input
                                                    value={String(readRecord(node.props.binding).tagName || '')}
                                                    placeholder="temperature"
                                                    onChange={(event) => onPropsChange({
                                                        binding: {
                                                            ...readRecord(node.props.binding),
                                                            source: 'tag',
                                                            tagName: event.target.value,
                                                        },
                                                    })}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <Typography.Text className="config-label">显示模板</Typography.Text>
                                            <Input
                                                value={String(readRecord(node.props.binding).template || '')}
                                                placeholder="{value} {unit}"
                                                onChange={(event) => onPropsChange({
                                                    binding: {
                                                        ...readRecord(node.props.binding),
                                                        template: event.target.value,
                                                    },
                                                })}
                                            />
                                        </div>
                                        <Divider style={{ margin: '8px 0' }} />
                                        <Typography.Text strong>点击回写</Typography.Text>
                                        <div>
                                            <Typography.Text className="config-label">启用弹窗回写</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={readRecord(node.props.writeBack).enabled === true ? 'true' : 'false'}
                                                onChange={(value) => onPropsChange({
                                                    writeBack: {
                                                        ...readRecord(node.props.writeBack),
                                                        enabled: value === 'true',
                                                    },
                                                })}
                                                options={[
                                                    { label: '关闭', value: 'false' },
                                                    { label: '开启', value: 'true' },
                                                ]}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">回写来源</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={String(readRecord(node.props.writeBack).source || (readRecord(node.props.writeBack).variableName ? 'page' : 'tag'))}
                                                onChange={(value) => onPropsChange({
                                                    writeBack: {
                                                        ...readRecord(node.props.writeBack),
                                                        source: value,
                                                        ...(value === 'page'
                                                            ? { variableName: String(readRecord(node.props.writeBack).variableName || pageVariableOptions[0]?.value || '') }
                                                            : {}),
                                                    },
                                                })}
                                                options={[
                                                    { label: '页面变量 page.*', value: 'page' },
                                                    { label: '系统点位 tag', value: 'tag' },
                                                ]}
                                            />
                                        </div>
                                        {String(readRecord(node.props.writeBack).source || (readRecord(node.props.writeBack).variableName ? 'page' : 'tag')) === 'page' ? (
                                            <div>
                                                <Typography.Text className="config-label">回写页面变量</Typography.Text>
                                                <Select
                                                    showSearch
                                                    allowClear
                                                    style={{ width: '100%' }}
                                                    value={String(readRecord(node.props.writeBack).variableName || '') || undefined}
                                                    placeholder="选择 page 变量"
                                                    options={pageVariableOptions}
                                                    onChange={(value) => onPropsChange({
                                                        writeBack: {
                                                            ...readRecord(node.props.writeBack),
                                                            source: 'page',
                                                            variableName: value || '',
                                                        },
                                                    })}
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <Typography.Text className="config-label">回写系统点位</Typography.Text>
                                                <Input
                                                    value={String(readRecord(node.props.writeBack).tagName || '')}
                                                    placeholder="setpoint"
                                                    onChange={(event) => onPropsChange({
                                                        writeBack: {
                                                            ...readRecord(node.props.writeBack),
                                                            source: 'tag',
                                                            tagName: event.target.value,
                                                        },
                                                    })}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <Typography.Text className="config-label">回写类型</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={String(readRecord(node.props.writeBack).valueType || 'string')}
                                                onChange={(value) => onPropsChange({
                                                    writeBack: {
                                                        ...readRecord(node.props.writeBack),
                                                        valueType: value,
                                                    },
                                                })}
                                                options={[
                                                    { label: '字符串', value: 'string' },
                                                    { label: '数值', value: 'number' },
                                                    { label: '布尔', value: 'boolean' },
                                                ]}
                                            />
                                        </div>
                                    </>
                                ) : null}
                                {node.type === 'button' ? (
                                    <>
                                        <div>
                                            <Typography.Text className="config-label">按钮文案</Typography.Text>
                                            <Input
                                                value={String(node.props.text || '')}
                                                onChange={(event) => onPropsChange({ text: event.target.value })}
                                            />
                                        </div>
                                        <Divider style={{ margin: '8px 0' }} />
                                        <Typography.Text strong>控制回写</Typography.Text>
                                        <div>
                                            <Typography.Text className="config-label">启用回写</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={readRecord(node.props.writeBack).enabled === true ? 'true' : 'false'}
                                                onChange={(value) => onPropsChange({
                                                    writeBack: {
                                                        ...readRecord(node.props.writeBack),
                                                        enabled: value === 'true',
                                                    },
                                                })}
                                                options={[
                                                    { label: '关闭', value: 'false' },
                                                    { label: '开启', value: 'true' },
                                                ]}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">回写来源</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={String(readRecord(node.props.writeBack).source || (readRecord(node.props.writeBack).variableName ? 'page' : 'tag'))}
                                                onChange={(value) => onPropsChange({
                                                    writeBack: {
                                                        ...readRecord(node.props.writeBack),
                                                        source: value,
                                                        ...(value === 'page'
                                                            ? { variableName: String(readRecord(node.props.writeBack).variableName || pageVariableOptions[0]?.value || '') }
                                                            : {}),
                                                    },
                                                })}
                                                options={[
                                                    { label: '页面变量 page.*', value: 'page' },
                                                    { label: '系统点位 tag', value: 'tag' },
                                                ]}
                                            />
                                        </div>
                                        {String(readRecord(node.props.writeBack).source || (readRecord(node.props.writeBack).variableName ? 'page' : 'tag')) === 'page' ? (
                                            <div>
                                                <Typography.Text className="config-label">回写页面变量</Typography.Text>
                                                <Select
                                                    showSearch
                                                    allowClear
                                                    style={{ width: '100%' }}
                                                    value={String(readRecord(node.props.writeBack).variableName || '') || undefined}
                                                    placeholder="选择 page 变量"
                                                    options={pageVariableOptions}
                                                    onChange={(value) => onPropsChange({
                                                        writeBack: {
                                                            ...readRecord(node.props.writeBack),
                                                            source: 'page',
                                                            variableName: value || '',
                                                        },
                                                    })}
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <Typography.Text className="config-label">控制系统点位</Typography.Text>
                                                <Input
                                                    value={String(readRecord(node.props.writeBack).tagName || '')}
                                                    placeholder="pump_run"
                                                    onChange={(event) => onPropsChange({
                                                        writeBack: {
                                                            ...readRecord(node.props.writeBack),
                                                            source: 'tag',
                                                            tagName: event.target.value,
                                                        },
                                                    })}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <Typography.Text className="config-label">写入值</Typography.Text>
                                            <Input
                                                value={String(readRecord(node.props.writeBack).value ?? '')}
                                                placeholder="1"
                                                onChange={(event) => onPropsChange({
                                                    writeBack: {
                                                        ...readRecord(node.props.writeBack),
                                                        value: event.target.value,
                                                    },
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">二次确认</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={readRecord(node.props.writeBack).confirmRequired === true ? 'true' : 'false'}
                                                onChange={(value) => onPropsChange({
                                                    writeBack: {
                                                        ...readRecord(node.props.writeBack),
                                                        confirmRequired: value === 'true',
                                                    },
                                                })}
                                                options={[
                                                    { label: '关闭', value: 'false' },
                                                    { label: '开启', value: 'true' },
                                                ]}
                                            />
                                        </div>
                                    </>
                                ) : null}
                                {node.type === 'image' ? (
                                    <>
                                        <div>
                                            <Typography.Text className="config-label">图片 URL</Typography.Text>
                                            <Input
                                                value={String(node.props.src || '')}
                                                onChange={(event) => onPropsChange({ src: event.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">资产 ID</Typography.Text>
                                            <Input
                                                value={String(node.props.assetId || '')}
                                                placeholder="上传资产后填写 ID"
                                                onChange={(event) => onPropsChange({ assetId: event.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">填充方式</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={String(node.props.objectFit || 'cover')}
                                                onChange={(value) => onPropsChange({ objectFit: value })}
                                                options={[
                                                    { label: 'cover', value: 'cover' },
                                                    { label: 'contain', value: 'contain' },
                                                    { label: 'fill', value: 'fill' },
                                                ]}
                                            />
                                        </div>
                                    </>
                                ) : null}
                                {node.type === 'customHtml' ? (
                                    <>
                                        <Divider style={{ margin: '8px 0' }} />
                                        <div>
                                            <Typography.Text className="config-label">透明背景</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={node.props.transparent !== false ? 'true' : 'false'}
                                                onChange={(value) => onPropsChange({ transparent: value === 'true' })}
                                                options={[
                                                    { label: '开启（可叠加）', value: 'true' },
                                                    { label: '关闭（白色背景）', value: 'false' },
                                                ]}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">sandbox 权限</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                value={String(node.props.sandboxPermissions || 'allow-scripts')}
                                                onChange={(value) => onPropsChange({ sandboxPermissions: value })}
                                                options={[
                                                    { label: 'allow-scripts（默认，安全隔离）', value: 'allow-scripts' },
                                                    { label: 'allow-scripts allow-modals（允许弹窗）', value: 'allow-scripts allow-modals' },
                                                    { label: 'allow-scripts allow-forms', value: 'allow-scripts allow-forms' },
                                                    { label: 'allow-scripts allow-same-origin（降低隔离）', value: 'allow-scripts allow-same-origin' },
                                                ]}
                                            />
                                            {String(node.props.sandboxPermissions || '').includes('allow-same-origin') ? (
                                                <Alert
                                                    type="warning"
                                                    showIcon
                                                    style={{ marginTop: 8 }}
                                                    message="安全警告"
                                                    description="allow-same-origin 会降低 iframe 隔离级别，iframe 内代码可访问父页面 cookie 和 storage。"
                                                />
                                            ) : null}
                                        </div>
                                        <Button
                                            block
                                            icon={<CodeOutlined />}
                                            size="large"
                                            className="quick-editor-button"
                                            style={{ marginTop: 8 }}
                                            onClick={() => openEditorForNode(node.id, customHtmlFullTab)}
                                        >
                                            打开代码编辑器
                                        </Button>
                                    </>
                                ) : null}
                                <Divider />
                                <Collapse items={[page_settings_panel]} />
                            </Space>
                        ) : null}

                        {panelSection === 'variables' ? (
                            <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                <div className="config-info-block">
                                    <div className="config-info-row">
                                        <Typography.Text type="secondary">变量作用域</Typography.Text>
                                        <Typography.Text strong>{node.name}</Typography.Text>
                                    </div>
                                    <div className="config-info-row">
                                        <Typography.Text type="secondary">变量数量</Typography.Text>
                                        <Tag color="blue">{node.variables.length}</Tag>
                                    </div>
                                </div>
                                <Button block icon={<PlusOutlined />} onClick={addVariable}>
                                    新建变量
                                </Button>
                                {node.variables.length === 0 ? (
                                    <Empty description="当前组件还没有变量" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                ) : null}
                                {node.variables.map((item) => (
                                    <div key={item.id} className="config-item-card">
                                        <div className="config-item-card-head">
                                            <Typography.Text strong>{item.name}</Typography.Text>
                                            <Button
                                                type="text"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => removeVariable(item.id)}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">变量名</Typography.Text>
                                            <Input
                                                value={item.name}
                                                placeholder="例如：报警等级"
                                                onChange={(event) => updateVariable(item.id, { name: event.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">显示名称</Typography.Text>
                                            <Input
                                                value={item.displayName || ''}
                                                placeholder="例如：进水温度"
                                                onChange={(event) => updateVariable(item.id, { displayName: event.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">变量类型</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                options={variableTypeOptions}
                                                value={item.type}
                                                onChange={(value) => updateVariable(item.id, {
                                                    type: value,
                                                    dataType: value === 'number'
                                                        ? 'DOUBLE'
                                                        : value === 'boolean'
                                                            ? 'BOOL'
                                                            : value === 'json'
                                                                ? 'JSON'
                                                                : 'STRING',
                                                })}
                                            />
                                        </div>
                                        <div className="config-grid-two">
                                            <div>
                                                <Typography.Text className="config-label">读写模式</Typography.Text>
                                                <Select
                                                    style={{ width: '100%' }}
                                                    value={item.rwMode || 'RW'}
                                                    onChange={(value) => updateVariable(item.id, { rwMode: value })}
                                                    options={[
                                                        { label: 'R 只读', value: 'R' },
                                                        { label: 'W 只写', value: 'W' },
                                                        { label: 'RW 读写', value: 'RW' },
                                                    ]}
                                                />
                                            </div>
                                            <div>
                                                <Typography.Text className="config-label">单位</Typography.Text>
                                                <Input
                                                    value={item.unit || ''}
                                                    placeholder="℃"
                                                    onChange={(event) => updateVariable(item.id, { unit: event.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">初始值</Typography.Text>
                                            <Input
                                                value={item.initialValue}
                                                onChange={(event) => updateVariable(item.id, { initialValue: event.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">说明</Typography.Text>
                                            <Input
                                                value={item.summary}
                                                onChange={(event) => updateVariable(item.id, { summary: event.target.value })}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </Space>
                        ) : null}

                        {panelSection === 'assets' && node.type === 'customHtml' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Typography.Text type="secondary">
                                    上传图片、JS/CSS 库文件。JS/CSS 文件可点击关联后自动注入到 iframe 中。
                                </Typography.Text>
                                <AssetManager
                                    pageId={page.id !== 'demo' ? Number(page.id) : undefined}
                                    selectedIds={(node.props.libraryAssetIds as number[]) || []}
                                    onSelectedChange={(ids) => onPropsChange({ libraryAssetIds: ids })}
                                />
                            </div>
                        ) : null}

                        {panelSection === 'events' ? (
                            <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                <div className="quick-editor-launcher">
                                    <Typography.Text className="config-label">代码入口名称</Typography.Text>
                                    <Input
                                        value={code_button_name}
                                        onChange={(event) => onPropsChange({ editorButtonName: event.target.value })}
                                    />
                                    <Typography.Paragraph className="editor-preview-hint">
                                        选中别的组件后，双击那个组件即可再打开一个新的代码编辑器。
                                    </Typography.Paragraph>
                                    <Button
                                        block
                                        icon={<CodeOutlined />}
                                        size="large"
                                        className="quick-editor-button"
                                        onClick={() => openEditorForNode(
                                            node.id,
                                            node.type === 'customHtml' ? customHtmlFullTab : 'propsJson',
                                        )}
                                    >
                                        {code_button_name}
                                    </Button>
                                </div>
                                {componentEvents.map((item) => (
                                    <div key={item.key} className="config-item-card">
                                        <div className="config-item-card-head">
                                            <div>
                                                <Typography.Text strong>{item.label}</Typography.Text>
                                                <Typography.Paragraph className="editor-preview-hint">
                                                    {item.summary}
                                                </Typography.Paragraph>
                                            </div>
                                            <Button
                                                type="primary"
                                                onClick={() => openEditorForNode(node.id, item.key as WorkspaceTab)}
                                            >
                                                编辑脚本
                                            </Button>
                                        </div>
                                        <div className="event-script-preview">
                                            <div className="event-script-preview-head">
                                                <Tag>{buildEventFileName(item.key)}</Tag>
                                                <Typography.Text type="secondary">{node.name}</Typography.Text>
                                            </div>
                                            <pre className="event-script-preview-code">
                                                {buildScriptPreview(
                                                    node.scripts[item.key as keyof ComponentScripts] || '',
                                                )}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </Space>
                        ) : null}
                    </Space>
                )}
            </div>
            <Modal
                title={`页面变量编辑器${pageVariableEditorDirty ? ' · 未保存' : ''}`}
                open={pageVariableEditorOpen}
                width={1360}
                destroyOnClose={false}
                maskClosable={false}
                okText="保存变量"
                cancelText="关闭"
                onOk={savePageVariableEditor}
                onCancel={closePageVariableEditor}
                styles={{
                    body: {
                        paddingTop: 12,
                    },
                }}
            >
                <div style={{ display: 'flex', gap: 16, minHeight: 680 }}>
                    <div
                        style={{
                            width: 320,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            borderRight: '1px solid #f0f0f0',
                            paddingRight: 16,
                        }}
                    >
                        <div>
                            <Typography.Text strong>变量列表</Typography.Text>
                            <Typography.Paragraph className="editor-preview-hint" style={{ marginBottom: 0 }}>
                                左侧只保留紧凑摘要；脚本和 AI 都通过独立弹窗编辑。
                            </Typography.Paragraph>
                        </div>
                        <Space size={8} wrap>
                            <Button type="primary" icon={<PlusOutlined />} onClick={addPageVariableDraft}>
                                新建变量
                            </Button>
                            <Button onClick={openPageVariableAiModal}>
                                变量 AI
                            </Button>
                            <Tag color="blue">{pageVariableDrafts.length} 个变量</Tag>
                        </Space>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                minHeight: 0,
                                maxHeight: 540,
                                overflowY: 'auto',
                            }}
                        >
                            {pageVariableDrafts.length === 0 ? (
                                <Empty description="还没有页面变量" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            ) : null}
                            {pageVariableDrafts.map((item) => {
                                const selected = item.id === activePageVariableId;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setActivePageVariableId(item.id)}
                                        style={{
                                            border: selected ? '1px solid #1677ff' : '1px solid #d9d9d9',
                                            borderRadius: 6,
                                            background: selected ? '#e6f4ff' : '#ffffff',
                                            padding: '6px 8px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            minHeight: 38,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Typography.Text strong ellipsis style={{ flex: 1, minWidth: 0 }}>
                                                {item.displayName || item.name || '未命名变量'}
                                            </Typography.Text>
                                            <Typography.Text type="secondary" ellipsis style={{ flex: 1.1, minWidth: 0 }}>
                                                {buildScopedVariableKey('page', item.name)}
                                            </Typography.Text>
                                            <Tag color={selected ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
                                                {String(item.dataType || item.type || 'STRING')}
                                            </Tag>
                                            <Tag color={item.scripts?.onChange?.trim() ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
                                                {item.scripts?.onChange?.trim() ? '脚本' : '无脚本'}
                                            </Tag>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                        {activePageVariable ? (
                            <>
                                <Alert
                                    type="info"
                                    showIcon
                                    message={`当前变量：${buildScopedVariableKey('page', activePageVariable.name || '未命名变量')}`}
                                    description="变量专属 onChange 脚本会先于页面 onVariableChange 执行；页面级脚本仍保留为全局汇总和跨变量编排入口。"
                                />
                                <div className="config-grid-two">
                                    <div>
                                        <Typography.Text className="config-label">变量名</Typography.Text>
                                        <Input
                                            value={activePageVariable.name}
                                            placeholder="例如：温度"
                                            onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                                name: event.target.value,
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <Typography.Text className="config-label">显示名称</Typography.Text>
                                        <Input
                                            value={activePageVariable.displayName || ''}
                                            placeholder="例如：页面温度"
                                            onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                                displayName: event.target.value,
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className="config-grid-two">
                                    <div>
                                        <Typography.Text className="config-label">变量类型</Typography.Text>
                                        <Select
                                            style={{ width: '100%' }}
                                            options={variableTypeOptions}
                                            value={activePageVariable.type}
                                            onChange={(value) => updatePageVariableDraft(activePageVariable.id, {
                                                type: value,
                                                dataType: mapVariableTypeToDataType(value),
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <Typography.Text className="config-label">数据类型</Typography.Text>
                                        <Select
                                            style={{ width: '100%' }}
                                            options={runtimeDataTypeOptions}
                                            value={String(activePageVariable.dataType || mapVariableTypeToDataType(activePageVariable.type))}
                                            onChange={(value) => updatePageVariableDraft(activePageVariable.id, {
                                                dataType: value,
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className="config-grid-two">
                                    <div>
                                        <Typography.Text className="config-label">读写模式</Typography.Text>
                                        <Select
                                            style={{ width: '100%' }}
                                            value={activePageVariable.rwMode || 'RW'}
                                            onChange={(value) => updatePageVariableDraft(activePageVariable.id, {
                                                rwMode: value,
                                            })}
                                            options={[
                                                { label: 'R 只读', value: 'R' },
                                                { label: 'W 只写', value: 'W' },
                                                { label: 'RW 读写', value: 'RW' },
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <Typography.Text className="config-label">单位</Typography.Text>
                                        <Input
                                            value={activePageVariable.unit || ''}
                                            placeholder="例如：℃"
                                            onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                                unit: event.target.value,
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className="config-grid-two">
                                    <div>
                                        <Typography.Text className="config-label">格式</Typography.Text>
                                        <Input
                                            value={activePageVariable.format || ''}
                                            placeholder="例如：{value} ℃"
                                            onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                                format: event.target.value,
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <Typography.Text className="config-label">精度</Typography.Text>
                                        <InputNumber
                                            min={0}
                                            max={6}
                                            style={{ width: '100%' }}
                                            value={typeof activePageVariable.precision === 'number' ? activePageVariable.precision : null}
                                            onChange={(value) => updatePageVariableDraft(activePageVariable.id, {
                                                precision: value === null ? undefined : Number(value),
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className="config-grid-two">
                                    <div>
                                        <Typography.Text className="config-label">颜色</Typography.Text>
                                        <Input
                                            value={activePageVariable.color || ''}
                                            placeholder="例如：#7dd3fc"
                                            onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                                color: event.target.value,
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <Typography.Text className="config-label">图标</Typography.Text>
                                        <Input
                                            value={activePageVariable.icon || ''}
                                            placeholder="例如：thermometer"
                                            onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                                icon: event.target.value,
                                            })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Typography.Text className="config-label">初始值</Typography.Text>
                                    <Input.TextArea
                                        autoSize={{ minRows: 2, maxRows: 5 }}
                                        value={String(activePageVariable.initialValue ?? '')}
                                        placeholder="JSON 变量可直接输入 JSON 字符串"
                                        onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                            initialValue: event.target.value,
                                        })}
                                    />
                                </div>
                                <div>
                                    <Typography.Text className="config-label">摘要说明</Typography.Text>
                                    <Input.TextArea
                                        autoSize={{ minRows: 2, maxRows: 4 }}
                                        value={String(activePageVariable.summary || '')}
                                        placeholder="说明这个变量的用途、来源和主要联动关系"
                                        onChange={(event) => updatePageVariableDraft(activePageVariable.id, {
                                            summary: event.target.value,
                                        })}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                    <div>
                                        <Typography.Text strong>变量专属 onChange 脚本</Typography.Text>
                                        <Typography.Paragraph className="editor-preview-hint" style={{ marginBottom: 0 }}>
                                            这里只展示摘要；详细脚本请在独立脚本弹窗里编辑。
                                        </Typography.Paragraph>
                                    </div>
                                    <Space size={8}>
                                        <Button onClick={() => openPageVariableScriptEditor(activePageVariable.id)}>
                                            编辑脚本
                                        </Button>
                                        <Button
                                            danger
                                            onClick={() => updatePageVariableDraft(activePageVariable.id, {
                                                scripts: {
                                                    onChange: '',
                                                },
                                            })}
                                        >
                                            清空脚本
                                        </Button>
                                        <Button
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => removePageVariableDraft(activePageVariable.id)}
                                        >
                                            删除当前变量
                                        </Button>
                                    </Space>
                                </div>
                                <div
                                    style={{
                                        border: '1px solid #d9d9d9',
                                        borderRadius: 6,
                                        padding: '10px 12px',
                                        background: '#fafafa',
                                    }}
                                >
                                    <Space size={8} wrap>
                                        <Tag color={activePageVariable.scripts?.onChange?.trim() ? 'blue' : 'default'}>
                                            {activePageVariable.scripts?.onChange?.trim() ? '已配置变量脚本' : '未配置变量脚本'}
                                        </Tag>
                                        <Typography.Text type="secondary">
                                            文件名：{`variables/${activePageVariable.name || 'unnamed'}/onChange.js`}
                                        </Typography.Text>
                                    </Space>
                                    <pre className="event-script-preview-code" style={{ marginTop: 8, marginBottom: 0 }}>
                                        {buildScriptPreview(String(activePageVariable.scripts?.onChange || ''))}
                                    </pre>
                                </div>
                                <Alert
                                    type="warning"
                                    showIcon
                                    message="扩展字段说明"
                                    description="identityExtra、ownerExtra、typeExtra、valueExtra 等高级字段先通过变量 AI 弹窗维护，避免主弹窗表单过长；后续再补专门的高级属性面板。"
                                />
                            </>
                        ) : (
                            <Empty
                                description="请先在左侧新建或选择一个页面变量"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        )}
                    </div>
                </div>
            </Modal>
            <Modal
                title={null}
                open={pageVariableScriptEditorOpen}
                width={1500}
                destroyOnClose={false}
                maskClosable={false}
                footer={null}
                onCancel={closePageVariableScriptEditor}
                styles={{
                    body: {
                        paddingTop: 12,
                    },
                }}
            >
                <div style={{ display: 'flex', gap: 16, minHeight: 680 }}>
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid #d0d7de',
                            borderRadius: 8,
                            overflow: 'hidden',
                        }}
                    >
                        <div className="floating-tool-window-head" style={{ cursor: 'default' }}>
                            <div>
                                <Typography.Text strong>
                                    {pageVariableScriptTarget ? buildScopedVariableKey('page', pageVariableScriptTarget.name) : '未选中变量'}
                                </Typography.Text>
                                <div className="floating-tool-window-subtitle">
                                    变量专属 onChange.js，运行时可直接使用 vars、components、message、change
                                </div>
                            </div>
                            <Tag color="blue">onChange.js</Tag>
                        </div>
                        {pageVariableScriptDiffProposal?.guardWarnings?.length ? (
                            <Alert
                                type="warning"
                                showIcon
                                style={{ margin: 8 }}
                                message="AI 代码防护提示"
                                description={
                                    <Space direction="vertical" size={2}>
                                        {pageVariableScriptDiffProposal.guardWarnings.map((item) => (
                                            <Typography.Text key={item} type="warning">
                                                {item}
                                            </Typography.Text>
                                        ))}
                                    </Space>
                                }
                            />
                        ) : null}
                        <div className="floating-tool-window-body floating-tool-window-body-editor">
                            {pageVariableScriptDiffProposal ? (
                                <DiffEditor
                                    height="560px"
                                    language={normalizeCodeLanguage(pageVariableScriptDiffProposal.language)}
                                    theme={shared_editor_theme}
                                    beforeMount={configureMonacoForScriptEditor}
                                    original={pageVariableScriptDiffProposal.originalCode}
                                    modified={pageVariableScriptDiffProposal.proposedCode}
                                    onMount={(diffEditor) => {
                                        pageVariableScriptDiffEditorRef.current = diffEditor;
                                        diffEditor.onDidUpdateDiff(() => {
                                            const changes = diffEditor.getLineChanges() ?? [];
                                            if (changes.length > 0) {
                                                const first = changes[0];
                                                const line = first.modifiedEndLineNumber > 0
                                                    ? first.modifiedStartLineNumber
                                                    : first.originalStartLineNumber;
                                                diffEditor.getModifiedEditor().revealLineInCenter(line);
                                            }
                                        });
                                    }}
                                    options={{
                                        renderSideBySide: true,
                                        minimap: { enabled: false },
                                        fontSize: 13,
                                    }}
                                />
                            ) : (
                                <Editor
                                    height="560px"
                                    language="javascript"
                                    theme={shared_editor_theme}
                                    beforeMount={configureMonacoForScriptEditor}
                                    value={pageVariableScriptDraft}
                                    onChange={(value) => setPageVariableScriptDraft(value || '')}
                                    options={{
                                        minimap: { enabled: true },
                                        fontSize: 13,
                                        lineNumbers: 'on',
                                        wordWrap: 'on',
                                        scrollBeyondLastLine: false,
                                    }}
                                />
                            )}
                        </div>
                        <div className="floating-tool-window-footer">
                            <Typography.Text type="secondary">
                                {pageVariableScriptDiffProposal
                                    ? 'AI 建议对比 — 左侧为原始代码，右侧为 AI 修改'
                                    : `当前文件：onChange.js${pageVariableScriptDirty ? ' · 未保存' : ''}`}
                            </Typography.Text>
                            {pageVariableScriptDiffProposal ? (
                                <Space size={8}>
                                    <Button onClick={() => setPageVariableScriptDiffProposal(null)}>
                                        关闭对比
                                    </Button>
                                    <Button type="primary" onClick={acceptPageVariableScriptDiff}>
                                        接受全部
                                    </Button>
                                </Space>
                            ) : (
                                <Space size={8}>
                                    <Button onClick={closePageVariableScriptEditor}>
                                        关闭
                                    </Button>
                                    <Button type="primary" onClick={savePageVariableScriptEditor}>
                                        保存脚本
                                    </Button>
                                </Space>
                            )}
                        </div>
                    </div>
                    <div
                        className="floating-tool-window-ai"
                        style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            width: 400,
                            minWidth: 400,
                            minHeight: 0,
                            border: '1px solid #30363d',
                            borderRadius: 8,
                            overflow: 'hidden',
                        }}
                    >
                        <div className="floating-tool-window-head floating-tool-window-head-ai" style={{ cursor: 'default' }}>
                            <div>
                                <Typography.Text strong>AI 对话窗口</Typography.Text>
                                <div className="floating-tool-window-subtitle">
                                    当前变量脚本的专属上下文，返回完整 onChange.js 代码
                                </div>
                            </div>
                            <Tag color="gold">置顶</Tag>
                        </div>
                        <div className="floating-tool-window-body floating-tool-window-body-ai">
                            <div className="ai-assistant-history" ref={pageVariableScriptAiHistoryRef} style={{ flex: 1, minHeight: 0 }}>
                                {pageVariableScriptAiHistory.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className={
                                            entry.role === 'user'
                                                ? 'ai-msg ai-msg-user'
                                                : 'ai-msg ai-msg-assistant'
                                        }
                                    >
                                        <div className="ai-msg-header">
                                            <span className="ai-msg-role">
                                                {entry.role === 'user' ? '你' : 'AI'}
                                            </span>
                                            <button
                                                className="ai-msg-copy"
                                                title="复制"
                                                onClick={() =>
                                                    void navigator.clipboard.writeText(entry.content)
                                                }
                                            >
                                                <CopyOutlined />
                                            </button>
                                        </div>
                                        <span className="ai-msg-content">{entry.label ?? entry.content}</span>
                                        {entry.role === 'assistant' && entry.codeBlock ? (
                                            <Button
                                                size="small"
                                                style={{ marginTop: 6, alignSelf: 'flex-start' }}
                                                onClick={() => {
                                                    if (entry.codeBlock) {
                                                        applyPageVariableScriptDiff(entry.codeBlock);
                                                    }
                                                }}
                                            >
                                                在编辑器中对比
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                                {pageVariableScriptAiLoading ? (
                                    <div className="ai-msg ai-msg-assistant">
                                        <span className="ai-msg-role">AI</span>
                                        <span className="ai-msg-content ai-msg-thinking">思考中…</span>
                                    </div>
                                ) : null}
                            </div>
                            <div style={{ padding: '4px 8px', fontSize: 11, color: '#8b949e', flexShrink: 0 }}>
                                上下文：{pageVariableScriptTarget ? buildScopedVariableKey('page', pageVariableScriptTarget.name) : '未选中变量'} / onChange.js
                            </div>
                            <div className="ai-assistant-footer" style={{ flexShrink: 0 }}>
                                <Input.TextArea
                                    value={pageVariableScriptAiPrompt}
                                    disabled={pageVariableScriptAiLoading}
                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                    placeholder="描述你想让这个变量变化时执行什么逻辑…"
                                    onChange={(event) => setPageVariableScriptAiPrompt(event.target.value)}
                                    onPressEnter={(event) => {
                                        if (event.shiftKey) {
                                            return;
                                        }
                                        event.preventDefault();
                                        void executePageVariableScriptAiPrompt();
                                    }}
                                />
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<SendOutlined />}
                                    loading={pageVariableScriptAiLoading}
                                    onClick={() => void executePageVariableScriptAiPrompt()}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
            <Modal
                title={null}
                open={pageVariableAiOpen}
                width={980}
                destroyOnClose={false}
                maskClosable={false}
                footer={null}
                onCancel={closePageVariableAiModal}
                styles={{
                    body: {
                        paddingTop: 12,
                    },
                }}
            >
                <div
                    className="floating-tool-window-ai"
                    style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 620,
                        border: '1px solid #30363d',
                        borderRadius: 8,
                        overflow: 'hidden',
                    }}
                >
                    <div className="floating-tool-window-head floating-tool-window-head-ai" style={{ cursor: 'default' }}>
                        <div>
                            <Typography.Text strong>AI 对话窗口</Typography.Text>
                            <div className="floating-tool-window-subtitle">
                                变量批量编辑、重命名、高级字段和变量脚本都可以从这里生成
                            </div>
                        </div>
                        <Tag color="gold">置顶</Tag>
                    </div>
                    <div className="floating-tool-window-body floating-tool-window-body-ai">
                        <div className="ai-assistant-history" ref={pageVariableAiHistoryRef} style={{ flex: 1, minHeight: 0 }}>
                            {pageVariableAiHistory.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={
                                        entry.role === 'user'
                                            ? 'ai-msg ai-msg-user'
                                            : 'ai-msg ai-msg-assistant'
                                    }
                                >
                                    <div className="ai-msg-header">
                                        <span className="ai-msg-role">
                                            {entry.role === 'user' ? '你' : 'AI'}
                                        </span>
                                        <button
                                            className="ai-msg-copy"
                                            title="复制"
                                            onClick={() =>
                                                void navigator.clipboard.writeText(entry.content)
                                            }
                                        >
                                            <CopyOutlined />
                                        </button>
                                    </div>
                                    <span className="ai-msg-content">{entry.label ?? entry.content}</span>
                                </div>
                            ))}
                            {pageVariableAiLoading ? (
                                <div className="ai-msg ai-msg-assistant">
                                    <span className="ai-msg-role">AI</span>
                                    <span className="ai-msg-content ai-msg-thinking">思考中…</span>
                                </div>
                            ) : null}
                        </div>
                        <div style={{ padding: '4px 8px', fontSize: 11, color: '#8b949e', flexShrink: 0 }}>
                            当前变量数：{pageVariableDrafts.length}；当前聚焦：
                            {activePageVariable ? ` ${buildScopedVariableKey('page', activePageVariable.name)}` : ' 无'}
                        </div>
                        <div className="ai-assistant-footer" style={{ flexShrink: 0 }}>
                            <Input.TextArea
                                value={pageVariableAiPrompt}
                                disabled={pageVariableAiLoading}
                                autoSize={{ minRows: 3, maxRows: 6 }}
                                placeholder="例如：新增 page.设备状态 变量，字符串类型，只读；给 page.温度 增加 onChange 脚本，超过 75 时写日志。"
                                onChange={(event) => setPageVariableAiPrompt(event.target.value)}
                                onPressEnter={(event) => {
                                    if (event.shiftKey) {
                                        return;
                                    }
                                    event.preventDefault();
                                    void applyPageVariableAiResult();
                                }}
                            />
                            <Space size={8}>
                                <Button onClick={() => setPageVariableAiPrompt('')}>
                                    清空
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    loading={pageVariableAiLoading}
                                    onClick={() => void applyPageVariableAiResult()}
                                >
                                    发送
                                </Button>
                            </Space>
                        </div>
                    </div>
                </div>
            </Modal>
            <div className="floating-window-layer">
                {openEditors.map((window_item) => {
                    const target_node =
                        window_item.targetKind === 'node'
                            ? findNodeById(page.root, window_item.targetId)
                            : null;
                    const window_events =
                        window_item.targetKind === 'page'
                            ? pageEvents
                            : target_node
                                ? getComponentProtocol(target_node.type).supportedEvents
                                : [];
                    const props_draft = getEditorCode(window_item, target_node, 'propsJson');
                    const active_script =
                        window_item.activeTab !== 'propsJson' && !isCustomHtmlContentTab(window_item.activeTab)
                            ? getEditorCode(window_item, target_node, window_item.activeTab)
                            : '';
                    // customHtml 组件的 HTML/CSS/JS 内容
                    const customHtmlContent = isCustomHtmlContentTab(window_item.activeTab) && target_node
                        ? getEditorCode(window_item, target_node, window_item.activeTab)
                        : '';
                    const active_tab_dirty = isEditorTabDirty(window_item, target_node);
                    const dirty_tabs = getDirtyEditorTabs(window_item, target_node);

                    if (!window_item.visible) {
                        return null;
                    }

                    if (window_item.targetKind === 'node' && !target_node) {
                        return null;
                    }

                    return (
                        <div
                            key={window_item.id}
                            className={
                                focusedEditorId === window_item.id
                                    ? 'floating-tool-window floating-tool-window-focused'
                                    : 'floating-tool-window'
                            }
                            style={renderEditorWindowStyle(window_item)}
                            onMouseDown={() => bringEditorToFront(window_item.id)}
                        >
                            <div
                                className="floating-tool-window-head"
                                onMouseDown={(event) => beginDrag({ kind: 'editor', windowId: window_item.id }, event)}
                            >
                                <div>
                                    <Typography.Text strong>
                                        {window_item.targetKind === 'page' ? page.name : target_node?.name}
                                    </Typography.Text>
                                    <div className="floating-tool-window-subtitle">
                                        {window_item.targetKind === 'page'
                                            ? `页面脚本工作区 / ${page.id}`
                                            : `${target_node?.title} / ${target_node?.id}`}
                                    </div>
                                </div>
                                <Space size={8}>
                                    <Button size="small" onClick={() => toggleEditorMaximize(window_item.id)}>
                                        {window_item.maximized ? '还原' : '全屏'}
                                    </Button>
                                    <Button size="small" onClick={() => closeEditorWindow(window_item.id)}>
                                        关闭
                                    </Button>
                                </Space>
                            </div>
                            <div className="floating-tool-window-toolbar">
                                <div className="floating-toolbar-meta">
                                    <Typography.Text type="secondary">
                                        {window_item.targetKind === 'page'
                                            ? `页面 ID：${page.id}`
                                            : `组件 ID：${target_node?.id}`}
                                    </Typography.Text>
                                    <Typography.Text type="secondary">
                                        {window_item.targetKind === 'page'
                                            ? `页面 Name：${page.name}`
                                            : `组件 Name：${target_node?.name}`}
                                    </Typography.Text>
                                </div>
                                {target_node?.type === 'customHtml' ? (
                                    <Button
                                        size="small"
                                        disabled={!!window_item.diffProposal}
                                        onClick={() => {
                                            bringEditorToFront(window_item.id);
                                            setOpenEditors((previous) =>
                                                previous.map((item) =>
                                                    item.id === window_item.id
                                                        ? {
                                                            ...item,
                                                            activeTab: item.activeTab === customHtmlFullTab
                                                                ? 'htmlContent'
                                                                : customHtmlFullTab,
                                                        }
                                                        : item,
                                                ),
                                            );
                                        }}
                                    >
                                        {window_item.activeTab === customHtmlFullTab ? '分开显示' : '完整HTML'}
                                    </Button>
                                ) : null}
                                <Segmented
                                    block
                                    value={window_item.activeTab}
                                    onChange={(value) => {
                                        bringEditorToFront(window_item.id);
                                        setOpenEditors((previous) =>
                                            previous.map((item) =>
                                                item.id === window_item.id
                                                    ? { ...item, activeTab: value as WorkspaceTab }
                                                    : item,
                                            ),
                                        );
                                    }}
                                    options={
                                        target_node?.type === 'customHtml'
                                            ? [
                                                ...customHtmlContentTabs.map((tab) => ({
                                                    label: customHtmlTabMeta[tab].label,
                                                    value: tab,
                                                })),
                                                { label: 'props.json', value: 'propsJson' },
                                                ...window_events.map((item) => ({
                                                    label: buildEventFileName(item.key),
                                                    value: item.key,
                                                })),
                                            ]
                                            : [
                                                { label: 'props.json', value: 'propsJson' },
                                                ...window_events.map((item) => ({
                                                    label: buildEventFileName(item.key),
                                                    value: item.key,
                                                })),
                                            ]
                                    }
                                    disabled={!!window_item.diffProposal}
                                />
                            </div>
                            <div className="floating-tool-window-body floating-tool-window-body-editor">
                                {window_item.diffProposal?.guardWarnings?.length ? (
                                    <Alert
                                        type="warning"
                                        showIcon
                                        style={{ margin: 8 }}
                                        message="AI 代码防护提示"
                                        description={
                                            <Space direction="vertical" size={2}>
                                                {window_item.diffProposal.guardWarnings.map((item) => (
                                                    <Typography.Text key={item} type="warning">
                                                        {item}
                                                    </Typography.Text>
                                                ))}
                                            </Space>
                                        }
                                    />
                                ) : null}
                                {window_item.diffProposal ? (
                                    // Diff 对比模式：左侧原始、右侧 AI 修改（可编辑），点 gutter「←」可逐处还原
                                    <DiffEditor
                                        key={`${window_item.id}-diff`}
                                        height="100%"
                                        language={normalizeCodeLanguage(window_item.diffProposal.language)}
                                        theme={shared_editor_theme}
                                        beforeMount={configureMonacoForScriptEditor}
                                        original={window_item.diffProposal.originalCode}
                                        modified={window_item.diffProposal.proposedCode}
                                        onMount={(diffEditor) => {
                                            // 保存实例以便「接受全部」时读取 modified 侧当前值
                                            diffEditorInstancesRef.current[window_item.id] = diffEditor;
                                            // diff 计算完成后自动跳到第一处改动
                                            diffEditor.onDidUpdateDiff(() => {
                                                const changes = diffEditor.getLineChanges() ?? [];
                                                if (changes.length > 0) {
                                                    const first = changes[0];
                                                    const line  = first.modifiedEndLineNumber > 0
                                                        ? first.modifiedStartLineNumber
                                                        : first.originalStartLineNumber;
                                                    diffEditor.getModifiedEditor().revealLineInCenter(line);
                                                }
                                            });
                                        }}
                                        options={{
                                            renderSideBySide: true,
                                            minimap: { enabled: false },
                                            fontSize: 13,
                                        }}
                                    />
                                ) : isCustomHtmlContentTab(window_item.activeTab) ? (
                                    <Editor
                                        key={`${window_item.id}-${window_item.activeTab}`}
                                        height="100%"
                                        language={customHtmlTabMeta[window_item.activeTab].language}
                                        theme={shared_editor_theme}
                                        beforeMount={configureMonacoForScriptEditor}
                                        value={customHtmlContent}
                                        onMount={(editor) => {
                                            activeEditorRef.current = editor;
                                            editor.onDidFocusEditorWidget(() => {
                                                activeEditorRef.current = editor;
                                                bringEditorToFront(window_item.id);
                                            });
                                        }}
                                        onChange={(value) => {
                                            updateEditorDraft(
                                                window_item,
                                                target_node,
                                                window_item.activeTab,
                                                value ?? '',
                                            );
                                        }}
                                        options={{ minimap: { enabled: true }, fontSize: 13, wordWrap: 'on', lineNumbers: 'on' }}
                                    />
                                ) : window_item.activeTab === 'propsJson' ? (
                                    <Editor
                                        key={`${window_item.id}-props-json`}
                                        height="100%"
                                        language="json"
                                        theme={shared_editor_theme}
                                        beforeMount={configureMonacoForScriptEditor}
                                        value={props_draft}
                                        onMount={(editor) => {
                                            // 记录当前活跃编辑器实例以供获取选中文本
                                            activeEditorRef.current = editor;
                                            editor.onDidFocusEditorWidget(() => {
                                                activeEditorRef.current = editor;
                                                bringEditorToFront(window_item.id);
                                            });
                                        }}
                                        onChange={(value) => {
                                            updateEditorDraft(window_item, target_node, 'propsJson', value || '{}');
                                        }}
                                        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                                    />
                                ) : (
                                    <Editor
                                        key={`${window_item.id}-${window_item.activeTab}`}
                                        height="100%"
                                        language="javascript"
                                        theme={shared_editor_theme}
                                        beforeMount={configureMonacoForScriptEditor}
                                        value={active_script}
                                        onMount={(editor) => {
                                            // 记录当前活跃编辑器实例以供获取选中文本
                                            activeEditorRef.current = editor;
                                            editor.onDidFocusEditorWidget(() => {
                                                activeEditorRef.current = editor;
                                                bringEditorToFront(window_item.id);
                                            });
                                        }}
                                        onChange={(value) => {
                                            updateEditorDraft(
                                                window_item,
                                                target_node,
                                                window_item.activeTab,
                                                value || '',
                                            );
                                        }}
                                        options={{
                                            minimap: { enabled: true },
                                            fontSize: 13,
                                            lineNumbers: 'on',
                                            roundedSelection: false,
                                            scrollBeyondLastLine: false,
                                            wordWrap: 'on',
                                        }}
                                    />
                                )}
                            </div>
                            <div className="floating-tool-window-footer">
                                <Typography.Text type="secondary">
                                    {window_item.diffProposal
                                        ? 'AI 建议对比 — 左侧为原始代码，右侧为 AI 修改'
                                        : `当前文件：${
                                            window_item.activeTab === 'propsJson'
                                                ? 'props.json'
                                                : isCustomHtmlContentTab(window_item.activeTab)
                                                    ? `${customHtmlTabMeta[window_item.activeTab].label} 编辑`
                                                    : buildEventFileName(String(window_item.activeTab))
                                        }${active_tab_dirty ? ' · 未保存' : dirty_tabs.length > 0 ? ` · ${dirty_tabs.length} 个未保存` : ''}`
                                    }
                                </Typography.Text>
                                {window_item.diffProposal ? (
                                    <Space size={8}>
                                        <Button size="small" onClick={() => rejectDiff(window_item.id)}>关闭对比</Button>
                                        <Button size="small" type="primary" onClick={() => acceptDiff(window_item)}>接受全部</Button>
                                    </Space>
                                ) : (
                                    <Space size={8}>
                                        {dirty_tabs.length > 1 || (!active_tab_dirty && dirty_tabs.length > 0) ? (
                                            <Button size="small" onClick={() => saveEditorWindow(window_item, { saveAll: true })}>
                                                保存全部
                                            </Button>
                                        ) : null}
                                        <Button
                                            size="small"
                                            type="primary"
                                            disabled={!active_tab_dirty}
                                            onClick={() => {
                                                if (window_item.activeTab === 'propsJson') {
                                                    applyRawProps(window_item);
                                                    return;
                                                }

                                                saveEditorWindow(window_item);
                                            }}
                                        >
                                            保存
                                        </Button>
                                    </Space>
                                )}
                            </div>
                        </div>
                    );
                })}
                {aiWindow.visible ? (
                    <div
                        className="floating-tool-window floating-tool-window-ai"
                        style={renderAiWindowStyle()}
                    >
                        <div
                            className="floating-tool-window-head floating-tool-window-head-ai"
                            onMouseDown={(event) => beginDrag({ kind: 'ai' }, event)}
                        >
                            <div>
                                <Typography.Text strong>AI 对话窗口</Typography.Text>
                                <div className="floating-tool-window-subtitle">
                                    单实例置顶窗口，始终跟随当前聚焦编辑器的内容上下文
                                </div>
                            </div>
                            <Tag color="gold">置顶</Tag>
                        </div>
                        <div className="floating-tool-window-body floating-tool-window-body-ai">
                            {/* AI 对话历史 */}
                            <div className="ai-assistant-history" ref={aiHistoryRef} style={{ flex: 1, minHeight: 0 }}>
                                {aiHistory.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className={
                                            entry.role === 'user'
                                                ? 'ai-msg ai-msg-user'
                                                : 'ai-msg ai-msg-assistant'
                                        }
                                    >
                                        <div className="ai-msg-header">
                                            <span className="ai-msg-role">
                                                {entry.role === 'user' ? '你' : 'AI'}
                                            </span>
                                            <button
                                                className="ai-msg-copy"
                                                title="复制"
                                                onClick={() =>
                                                    void navigator.clipboard.writeText(entry.content)
                                                }
                                            >
                                                <CopyOutlined />
                                            </button>
                                        </div>
                                        <span className="ai-msg-content">{entry.label ?? entry.content}</span>
                                        {/* user 消息附带的上下文简短描述 */}
                                        {entry.role === 'user' && entry.contextHint ? (
                                            <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                {entry.contextHint}
                                            </span>
                                        ) : null}
                                        {entry.role === 'assistant' && entry.codeBlock ? (
                                            <Button
                                                size="small"
                                                style={{ marginTop: 6, alignSelf: 'flex-start' }}
                                                onClick={() => {
                                                    if (entry.codeBlock) {
                                                        applyDiffProposal(entry.codeBlock, null);
                                                    }
                                                }}
                                            >
                                                在编辑器中对比
                                            </Button>
                                        ) : null}

                                    </div>
                                ))}
                                {aiLoading && (
                                    <div className="ai-msg ai-msg-assistant">
                                        <span className="ai-msg-role">AI</span>
                                        <span className="ai-msg-content ai-msg-thinking">思考中…</span>
                                    </div>
                                )}
                            </div>
                            {/* 当前聚焦文件提示 */}
                            {focusedWindow && (
                                <div style={{ padding: '4px 8px', fontSize: 11, color: '#64748b', flexShrink: 0 }}>
                                    上下文：
                                    {focusedNode
                                        ? `${focusedNode.name}（${focusedNode.type}）`
                                        : `页面 ${page.name}`}
                                    {' / '}
                                    {focusedWindow.activeTab === 'propsJson'
                                        ? 'props.json'
                                        : isCustomHtmlContentTab(focusedWindow.activeTab)
                                            ? `${customHtmlTabMeta[focusedWindow.activeTab].label} 编辑`
                                            : buildEventFileName(String(focusedWindow.activeTab))}
                                </div>
                            )}
                            {/* 输入区域 */}
                            <div className="ai-assistant-footer" style={{ flexShrink: 0 }}>
                                <Input.TextArea
                                    value={aiPrompt}
                                    disabled={aiLoading}
                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                    placeholder="描述你想实现的脚本功能…"
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    onPressEnter={(e) => {
                                        if (e.shiftKey) return;
                                        e.preventDefault();
                                        void executeCodePrompt(aiPrompt);
                                    }}
                                />
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<SendOutlined />}
                                    loading={aiLoading}
                                    onClick={() => void executeCodePrompt(aiPrompt)}
                                />
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
