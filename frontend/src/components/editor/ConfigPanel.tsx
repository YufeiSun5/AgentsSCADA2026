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
    Segmented,
    Select,
    Space,
    Tag,
    Typography,
    message,
} from 'antd';
import {
    CodeOutlined,
    DeleteOutlined,
    PlusOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findNodeById, type ComponentNode, type ComponentScripts, type ComponentVariable, type ComponentVariableType, type PageSchema } from '../../schema/pageSchema';
import { pageCanvasProtocol } from '../../schema/componentProtocol';

type PanelSection = 'props' | 'variables' | 'events';
type ScriptEntryKey = 'onOpen' | 'onClose' | 'onClick';
type WorkspaceTab = 'propsJson' | ScriptEntryKey;

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
    nodeId: string;
    activeTab: WorkspaceTab;
}

interface FloatingWindowDragState {
    target: FloatingTarget;
    start_x: number;
    start_y: number;
    origin_x: number;
    origin_y: number;
}

interface EditorOpenRequest {
    nodeId: string;
    nonce: number;
}

const scriptEntries: Array<{
    key: ScriptEntryKey;
    fileName: string;
    label: string;
    summary: string;
}> = [
    {
        key: 'onOpen',
        fileName: 'onOpen.js',
        label: '打开时',
        summary: '组件进入页面或预览初始化时执行。',
    },
    {
        key: 'onClose',
        fileName: 'onClose.js',
        label: '关闭时',
        summary: '组件离开页面或预览销毁时执行。',
    },
    {
        key: 'onClick',
        fileName: 'onClick.js',
        label: '被点击时',
        summary: '用户点击组件后执行。',
    },
];

const variableTypeOptions: Array<{
    label: string;
    value: ComponentVariableType;
}> = [
    { label: '字符串', value: 'string' },
    { label: '数值', value: 'number' },
    { label: '布尔', value: 'boolean' },
    { label: 'JSON', value: 'json' },
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
        name: 'new_variable',
        type: 'string' as ComponentVariableType,
        initialValue: '',
        summary: '',
    };
}

function createEditorWindow(node_id: string, offset_index: number)
{
    const width = Math.min(920, window.innerWidth - 80);
    const height = Math.min(620, window.innerHeight - 120);
    const center_x = Math.max(20, Math.round((window.innerWidth - width) / 2));
    const center_y = Math.max(20, Math.round((window.innerHeight - height) / 2));

    return {
        id: `editor-${node_id}`,
        nodeId: node_id,
        activeTab: 'propsJson' as WorkspaceTab,
        visible: true,
        maximized: false,
        width,
        height,
        x: center_x + offset_index * 26,
        y: center_y + offset_index * 20,
    };
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
    onPageSettingsChange,
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
    onPageSettingsChange: (patch: Record<string, unknown>) => void;
}) {
    const [panelSection, setPanelSection] = useState<PanelSection>('props');
    const [propsDraft, setPropsDraft] = useState('{}');
    const [openEditors, setOpenEditors] = useState<EditorWindowState[]>([]);
    const [editorOrder, setEditorOrder] = useState<string[]>([]);
    const [editorDrafts, setEditorDrafts] = useState<Record<string, string>>({});
    const [aiWindow, setAiWindow] = useState<FloatingWindowState>(default_ai_window);
    const [focusedEditorId, setFocusedEditorId] = useState<string | null>(null);
    const dragStateRef = useRef<FloatingWindowDragState | null>(null);
    const code_button_name = useMemo(
        () => String(node?.props.editorButtonName || '代码编辑器'),
        [node],
    );
    const focusedWindow = useMemo(
        () => openEditors.find((item) => item.id === focusedEditorId) || null,
        [focusedEditorId, openEditors],
    );
    const focusedNode = useMemo(
        () => (focusedWindow ? findNodeById(page.root, focusedWindow.nodeId) : null),
        [focusedWindow, page.root],
    );

    useEffect(() => {
        setPropsDraft(buildPropsDraft(node));
    }, [node]);

    useEffect(() => {
        setOpenEditors((previous) =>
            previous.filter((item) => findNodeById(page.root, item.nodeId)),
        );
        setEditorOrder((previous) =>
            previous.filter((item) => findNodeById(page.root, item.replace('editor-', ''))),
        );
    }, [page.root]);

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

        openEditorForNode(editorOpenRequest.nodeId, 'propsJson');
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

        const window_id = `editor-${node_id}`;
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
            if (!editorDrafts[window_id]) {
                setEditorDrafts((previous) => ({
                    ...previous,
                    [window_id]: buildPropsDraft(target_node),
                }));
            }
            return;
        }

        const next_window = createEditorWindow(node_id, openEditors.length);
        next_window.activeTab = initial_tab;
        setOpenEditors((previous) => [...previous, next_window]);
        setEditorOrder((previous) => [...previous, next_window.id]);
        setEditorDrafts((previous) => ({
            ...previous,
            [next_window.id]: buildPropsDraft(target_node),
        }));
        setFocusedEditorId(next_window.id);
        ensureAiWindowVisible();
    };

    const closeEditorWindow = (window_id: string) => {
        dragStateRef.current = null;
        setOpenEditors((previous) => previous.filter((item) => item.id !== window_id));
        setEditorOrder((previous) => previous.filter((item) => item !== window_id));
        setEditorDrafts((previous) => {
            const next_drafts = { ...previous };
            delete next_drafts[window_id];
            return next_drafts;
        });
        setFocusedEditorId((previous) => (previous === window_id ? null : previous));
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

    const applyRawPropsForNode = (window_id: string, node_id: string) => {
        const draft_value = editorDrafts[window_id] || '{}';

        try {
            const parsed = JSON.parse(draft_value) as Record<string, unknown>;
            onNodePropsReplace(node_id, parsed);
            message.success('属性 JSON 已应用');
        } catch {
            message.error('属性 JSON 解析失败');
        }
    };

    const updateCurrentScript = (
        node_id: string,
        script_key: ScriptEntryKey,
        value: string,
    ) => {
        if (script_key === 'onOpen') {
            onNodeScriptsChange(node_id, { onOpen: value, onLoad: value });
            return;
        }

        onNodeScriptsChange(node_id, { [script_key]: value });
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
            </Space>
        ),
    };

    return (
        <div className="editor-panel-shell config-panel-shell">
            <div className="config-panel-content">
                <div className="panel-heading">
                    <Typography.Title level={4}>配置面板</Typography.Title>
                    <Typography.Text type="secondary">
                        {node ? `当前选中：${node.title}` : '当前正在编辑页面画布配置'}
                    </Typography.Text>
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
                            options={[
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
                                    </>
                                ) : null}
                                {node.type === 'button' ? (
                                    <div>
                                        <Typography.Text className="config-label">按钮文案</Typography.Text>
                                        <Input
                                            value={String(node.props.text || '')}
                                            onChange={(event) => onPropsChange({ text: event.target.value })}
                                        />
                                    </div>
                                ) : null}
                                {node.type === 'input' ? (
                                    <div>
                                        <Typography.Text className="config-label">占位提示</Typography.Text>
                                        <Input
                                            value={String(node.props.placeholder || '')}
                                            onChange={(event) => onPropsChange({ placeholder: event.target.value })}
                                        />
                                    </div>
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
                                                onChange={(event) => updateVariable(item.id, { name: event.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Typography.Text className="config-label">变量类型</Typography.Text>
                                            <Select
                                                style={{ width: '100%' }}
                                                options={variableTypeOptions}
                                                value={item.type}
                                                onChange={(value) => updateVariable(item.id, { type: value })}
                                            />
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
                                        onClick={() => openEditorForNode(node.id, 'propsJson')}
                                    >
                                        {code_button_name}
                                    </Button>
                                </div>
                                {scriptEntries.map((item) => (
                                    <div key={item.key} className="config-item-card">
                                        <div className="config-item-card-head">
                                            <div>
                                                <Typography.Text strong>{item.label}</Typography.Text>
                                                <Typography.Paragraph className="editor-preview-hint">
                                                    {item.summary}
                                                </Typography.Paragraph>
                                            </div>
                                            <Button type="primary" onClick={() => openEditorForNode(node.id, item.key)}>
                                                编辑脚本
                                            </Button>
                                        </div>
                                        <div className="event-script-preview">
                                            <div className="event-script-preview-head">
                                                <Tag>{item.fileName}</Tag>
                                                <Typography.Text type="secondary">{node.name}</Typography.Text>
                                            </div>
                                            <pre className="event-script-preview-code">
                                                {buildScriptPreview(node.scripts[item.key] || '')}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </Space>
                        ) : null}
                    </Space>
                )}
            </div>
            <div className="floating-window-layer">
                {openEditors.map((window_item) => {
                    const target_node = findNodeById(page.root, window_item.nodeId);
                    const props_draft = editorDrafts[window_item.id] || buildPropsDraft(target_node);
                    const active_script =
                        target_node && window_item.activeTab !== 'propsJson'
                            ? target_node.scripts[window_item.activeTab] || ''
                            : '';

                    if (!target_node || !window_item.visible) {
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
                                    <Typography.Text strong>{target_node.name}</Typography.Text>
                                    <div className="floating-tool-window-subtitle">
                                        {target_node.title} / {target_node.id}
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
                                    <Typography.Text type="secondary">组件 ID：{target_node.id}</Typography.Text>
                                    <Typography.Text type="secondary">组件 Name：{target_node.name}</Typography.Text>
                                </div>
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
                                    options={[
                                        { label: 'props.json', value: 'propsJson' },
                                        ...scriptEntries.map((item) => ({
                                            label: item.fileName,
                                            value: item.key,
                                        })),
                                    ]}
                                />
                            </div>
                            <div className="floating-tool-window-body floating-tool-window-body-editor">
                                {window_item.activeTab === 'propsJson' ? (
                                    <Editor
                                        key={`${window_item.id}-props-json`}
                                        height="100%"
                                        language="json"
                                        theme={shared_editor_theme}
                                        value={props_draft}
                                        onMount={(editor) => {
                                            editor.onDidFocusEditorWidget(() => {
                                                bringEditorToFront(window_item.id);
                                            });
                                        }}
                                        onChange={(value) => {
                                            setEditorDrafts((previous) => ({
                                                ...previous,
                                                [window_item.id]: value || '{}',
                                            }));
                                        }}
                                        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                                    />
                                ) : (
                                    <Editor
                                        key={`${window_item.id}-${window_item.activeTab}`}
                                        height="100%"
                                        language="javascript"
                                        theme={shared_editor_theme}
                                        value={active_script}
                                        onMount={(editor) => {
                                            editor.onDidFocusEditorWidget(() => {
                                                bringEditorToFront(window_item.id);
                                            });
                                        }}
                                        onChange={(value) => {
                                            updateCurrentScript(
                                                target_node.id,
                                                window_item.activeTab as ScriptEntryKey,
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
                                    当前文件：{
                                        window_item.activeTab === 'propsJson'
                                            ? 'props.json'
                                            : scriptEntries.find((item) => item.key === window_item.activeTab)?.fileName
                                    }
                                </Typography.Text>
                                {window_item.activeTab === 'propsJson' ? (
                                    <Button size="small" type="primary" onClick={() => applyRawPropsForNode(window_item.id, target_node.id)}>
                                        应用 JSON
                                    </Button>
                                ) : null}
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
                            <Tag color="gold">占位中</Tag>
                            <Typography.Title level={5}>AI 功能暂未接入</Typography.Title>
                            <Typography.Paragraph>
                                {focusedNode && focusedWindow
                                    ? `当前准备处理 ${focusedNode.name} 的 ${
                                        focusedWindow.activeTab === 'propsJson'
                                            ? 'props.json'
                                            : scriptEntries.find((item) => item.key === focusedWindow.activeTab)?.fileName
                                    }。`
                                    : '当前还没有聚焦的编辑器，点击任意打开的编辑器后，AI 会跟随该内容。'}
                            </Typography.Paragraph>
                            <div className="ai-window-placeholder-list">
                                <Typography.Paragraph className="protocol-paragraph">
                                    组件：{focusedNode ? `${focusedNode.title} / ${focusedNode.name}` : '未聚焦'}
                                </Typography.Paragraph>
                                <Typography.Paragraph className="protocol-paragraph">
                                    文件：{focusedWindow
                                        ? focusedWindow.activeTab === 'propsJson'
                                            ? 'props.json'
                                            : scriptEntries.find((item) => item.key === focusedWindow.activeTab)?.fileName
                                        : '未聚焦'}
                                </Typography.Paragraph>
                                <Typography.Paragraph className="protocol-paragraph">
                                    后续这里会基于当前聚焦编辑器做问答、生成、比对和局部采纳。
                                </Typography.Paragraph>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
