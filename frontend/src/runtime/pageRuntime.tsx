/*
 * 页面运行时变量中心。
 * 当前先落地前端页面局部变量模型；后续系统变量可接入同一事件管道。
 */
import {
    createContext,
    useContext,
    useSyncExternalStore,
    type ReactNode,
} from 'react';
import type {
    ComponentVariable,
    ComponentVariableType,
    PageSchema,
} from '../schema/pageSchema';

export type RuntimeVariableScope = 'page' | 'tag' | 'component';
export type RuntimeDataType = 'BOOL' | 'INT16' | 'INT32' | 'INT64' | 'FLOAT' | 'DOUBLE' | 'STRING' | 'JSON';
export type RuntimeRwMode = 'R' | 'W' | 'RW';
export type RuntimeQuality = 'GOOD' | 'BAD' | 'UNCERTAIN' | 'STALE' | 'OFFLINE' | 'INIT';
export type RuntimeChangeSource = 'backend' | 'page_script' | 'component_script' | 'html_bridge' | 'user' | 'system';
export type RuntimeAlarmState = 'NONE' | 'LL' | 'L' | 'H' | 'HH';

export interface RuntimeVariable {
    // 基础标识
    id: string | number;
    scope: RuntimeVariableScope;
    key: string;
    name: string;
    displayName?: string;

    // 归属信息
    pageId?: string | number;
    deviceId?: string | number;
    deviceName?: string;
    componentId?: string;

    // 数据描述
    dataType: RuntimeDataType;
    rwMode: RuntimeRwMode;
    unit?: string;

    // 当前值与上次值
    value: unknown;
    valueText?: string;
    previousValue?: unknown;
    previousValueText?: string;

    // 两次变化时间
    valueTs: number;
    valueTime?: string;
    previousValueTs?: number;
    previousValueTime?: string;
    receiveTs?: number;
    processTs?: number;

    // 质量戳
    quality: RuntimeQuality;
    qualityCode?: number;
    qualityTs: number;
    qualityMessage?: string;

    // 变化信息
    changed: boolean;
    changeSeq: number;
    changeSource: RuntimeChangeSource;
    changeReason?: string;

    // 报警状态
    alarmActive?: boolean;
    alarmState?: RuntimeAlarmState;
    alarmMessage?: string;
    alarmTs?: number;

    // 写入状态
    writePending?: boolean;
    writeRequestId?: string;
    writeTs?: number;
    writeError?: string;

    // 显示相关
    format?: string;
    precision?: number;
    color?: string;
    icon?: string;

    // 每类属性一个扩展字段，避免无语义 ext1/ext2。
    identityExtra?: Record<string, unknown>;
    ownerExtra?: Record<string, unknown>;
    typeExtra?: Record<string, unknown>;
    valueExtra?: Record<string, unknown>;
    timeExtra?: Record<string, unknown>;
    qualityExtra?: Record<string, unknown>;
    changeExtra?: Record<string, unknown>;
    alarmExtra?: Record<string, unknown>;
    writeExtra?: Record<string, unknown>;
    displayExtra?: Record<string, unknown>;
    configExtra?: Record<string, unknown>;
    customExtra?: Record<string, unknown>;
}

export interface RuntimeVariableChange {
    seq: number;
    key: string;
    scope: RuntimeVariableScope;
    name: string;
    value: unknown;
    previousValue: unknown;
    variable: RuntimeVariable;
    previousVariable?: RuntimeVariable;
    ts: number;
    source: RuntimeChangeSource;
    reason?: string;
}

export interface SetRuntimeVariableOptions {
    source?: RuntimeChangeSource;
    reason?: string;
    silent?: boolean;
    patch?: Partial<RuntimeVariable>;
}

export type RuntimeVariableListener = (
    variable: RuntimeVariable,
    change?: RuntimeVariableChange,
) => void;

export type RuntimeChangeListener = (change: RuntimeVariableChange) => void;
export type RuntimeComponentMethod = (...args: unknown[]) => unknown | Promise<unknown>;
export type RuntimeComponentMethods = Record<string, RuntimeComponentMethod>;

export interface RuntimeVarsApi {
    get: (name: string) => RuntimeVariable | null;
    getValue: (name: string) => unknown;
    set: (name: string, value: unknown, options?: SetRuntimeVariableOptions) => RuntimeVariable | null;
    patch: (name: string, patch: Partial<RuntimeVariable>, options?: SetRuntimeVariableOptions) => RuntimeVariable | null;
    all: () => Record<string, RuntimeVariable>;
    values: () => Record<string, unknown>;
    subscribe: (name: string, listener: RuntimeVariableListener) => () => void;
}

export interface RuntimeComponentsApi {
    call: (componentIdOrName: string, methodName: string, ...args: unknown[]) => unknown | Promise<unknown>;
    setStyle: (componentIdOrName: string, style: Record<string, unknown>) => unknown | Promise<unknown>;
    setProps: (componentIdOrName: string, props: Record<string, unknown>) => unknown | Promise<unknown>;
    show: (componentIdOrName: string) => unknown | Promise<unknown>;
    hide: (componentIdOrName: string) => unknown | Promise<unknown>;
    enable: (componentIdOrName: string) => unknown | Promise<unknown>;
    disable: (componentIdOrName: string) => unknown | Promise<unknown>;
}

const variableScopes: RuntimeVariableScope[] = ['page', 'tag', 'component'];
const dataTypes: RuntimeDataType[] = ['BOOL', 'INT16', 'INT32', 'INT64', 'FLOAT', 'DOUBLE', 'STRING', 'JSON'];

function nowText(ts: number)
{
    return new Date(ts).toISOString();
}

function readRecord(value: unknown): Record<string, unknown> | undefined
{
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function normalizeRuntimeDataType(value: unknown, fallback: RuntimeDataType = 'STRING'): RuntimeDataType
{
    const normalized = String(value || '').trim().toUpperCase();
    return dataTypes.includes(normalized as RuntimeDataType)
        ? normalized as RuntimeDataType
        : fallback;
}

function mapComponentVariableType(type: ComponentVariableType): RuntimeDataType
{
    if (type === 'number') return 'DOUBLE';
    if (type === 'boolean') return 'BOOL';
    if (type === 'json') return 'JSON';
    return 'STRING';
}

function normalizeRwMode(value: unknown, fallback: RuntimeRwMode = 'RW'): RuntimeRwMode
{
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'R' || normalized === 'W' || normalized === 'RW'
        ? normalized
        : fallback;
}

function parseInitialValue(variable: ComponentVariable)
{
    const raw_value = variable.initialValue;
    const data_type = normalizeRuntimeDataType(
        (variable as { dataType?: string }).dataType,
        mapComponentVariableType(variable.type),
    );

    if (data_type === 'BOOL') {
        const normalized_value = String(raw_value).trim().toLowerCase();
        return normalized_value === 'true' || normalized_value === '1' || normalized_value === 'yes';
    }

    if (['INT16', 'INT32', 'INT64', 'FLOAT', 'DOUBLE'].includes(data_type)) {
        const number_value = Number(raw_value);
        return Number.isFinite(number_value) ? number_value : 0;
    }

    if (data_type === 'JSON') {
        const trimmed_value = String(raw_value || '').trim();
        if (!trimmed_value) {
            return null;
        }

        try {
            return JSON.parse(trimmed_value);
        } catch {
            return raw_value;
        }
    }

    return String(raw_value ?? '');
}

export function splitRuntimeVariableKey(
    name: string,
    defaultScope: RuntimeVariableScope = 'page',
) {
    const trimmed_name = String(name || '').trim();
    const [maybe_scope, ...rest] = trimmed_name.split('.');

    if (variableScopes.includes(maybe_scope as RuntimeVariableScope) && rest.length > 0) {
        return {
            scope: maybe_scope as RuntimeVariableScope,
            name: rest.join('.'),
            key: `${maybe_scope}.${rest.join('.')}`,
        };
    }

    return {
        scope: defaultScope,
        name: trimmed_name,
        key: trimmed_name ? `${defaultScope}.${trimmed_name}` : '',
    };
}

export function normalizeRuntimeVariableKey(
    name: string,
    defaultScope: RuntimeVariableScope = 'page',
) {
    return splitRuntimeVariableKey(name, defaultScope).key;
}

function buildPageRuntimeVariable(
    variable: ComponentVariable,
    page: PageSchema,
    ts: number,
): RuntimeVariable {
    const metadata = variable as ComponentVariable & Partial<RuntimeVariable>;
    const keyParts = splitRuntimeVariableKey(variable.name, 'page');
    const value = parseInitialValue(variable);
    const dataType = normalizeRuntimeDataType(metadata.dataType, mapComponentVariableType(variable.type));

    return {
        id: variable.id || keyParts.key,
        scope: 'page',
        key: keyParts.key,
        name: keyParts.name,
        displayName: metadata.displayName || variable.summary || variable.name,
        pageId: page.id,
        dataType,
        rwMode: normalizeRwMode(metadata.rwMode, 'RW'),
        unit: metadata.unit,
        value,
        valueText: String(value ?? ''),
        previousValue: undefined,
        previousValueText: undefined,
        valueTs: ts,
        valueTime: nowText(ts),
        previousValueTs: undefined,
        previousValueTime: undefined,
        quality: metadata.quality || 'GOOD',
        qualityCode: metadata.qualityCode,
        qualityTs: metadata.qualityTs || ts,
        qualityMessage: metadata.qualityMessage,
        changed: false,
        changeSeq: 0,
        changeSource: 'system',
        alarmActive: metadata.alarmActive,
        alarmState: metadata.alarmState || 'NONE',
        alarmMessage: metadata.alarmMessage,
        alarmTs: metadata.alarmTs,
        writePending: false,
        writeRequestId: undefined,
        writeTs: undefined,
        writeError: undefined,
        format: metadata.format,
        precision: metadata.precision,
        color: metadata.color,
        icon: metadata.icon,
        identityExtra: readRecord(metadata.identityExtra),
        ownerExtra: readRecord(metadata.ownerExtra),
        typeExtra: readRecord(metadata.typeExtra),
        valueExtra: readRecord(metadata.valueExtra),
        timeExtra: readRecord(metadata.timeExtra),
        qualityExtra: readRecord(metadata.qualityExtra),
        changeExtra: readRecord(metadata.changeExtra),
        alarmExtra: readRecord(metadata.alarmExtra),
        writeExtra: readRecord(metadata.writeExtra),
        displayExtra: readRecord(metadata.displayExtra),
        configExtra: readRecord(metadata.configExtra),
        customExtra: readRecord(metadata.customExtra),
    };
}

function normalizeComponentKey(value: string)
{
    return String(value || '').trim();
}

export class PageRuntime {
    private variables = new Map<string, RuntimeVariable>();
    private variableListeners = new Map<string, Set<RuntimeVariableListener>>();
    private storeListeners = new Map<string, Set<() => void>>();
    private changeListeners = new Set<RuntimeChangeListener>();
    private componentMethods = new Map<string, RuntimeComponentMethods>();
    private componentMethodStacks = new Map<string, Record<string, RuntimeComponentMethod[]>>();
    private changeSeq = 0;

    constructor(page: PageSchema)
    {
        this.reset(page);
    }

    reset(page: PageSchema)
    {
        const ts = Date.now();
        this.variables.clear();
        this.changeSeq = 0;

        page.variables.forEach((variable) => {
            const runtimeVariable = buildPageRuntimeVariable(variable, page, ts);
            if (runtimeVariable.key) {
                this.variables.set(runtimeVariable.key, runtimeVariable);
            }
        });
    }

    getVar(name: string)
    {
        return this.variables.get(normalizeRuntimeVariableKey(name, 'page')) || null;
    }

    getVarValue(name: string)
    {
        return this.getVar(name)?.value;
    }

    getAllVars()
    {
        return Object.fromEntries(this.variables.entries());
    }

    getAllValues()
    {
        return Object.fromEntries(
            Array.from(this.variables.entries()).map(([key, variable]) => [key, variable.value]),
        );
    }

    setVar(
        name: string,
        value: unknown,
        options: SetRuntimeVariableOptions = {},
    ) {
        const keyParts = splitRuntimeVariableKey(name, 'page');
        if (!keyParts.key) {
            return null;
        }

        const previous = this.variables.get(keyParts.key);
        if (previous && Object.is(previous.value, value) && !options.patch) {
            return previous;
        }

        const ts = Date.now();
        const seq = ++this.changeSeq;
        const nextVariable: RuntimeVariable = {
            id: previous?.id || keyParts.key,
            scope: previous?.scope || keyParts.scope,
            key: keyParts.key,
            name: previous?.name || keyParts.name,
            displayName: previous?.displayName || keyParts.name,
            pageId: previous?.pageId,
            deviceId: previous?.deviceId,
            deviceName: previous?.deviceName,
            componentId: previous?.componentId,
            dataType: previous?.dataType || 'STRING',
            rwMode: previous?.rwMode || 'RW',
            unit: previous?.unit,
            ...previous,
            ...options.patch,
            value,
            valueText: options.patch?.valueText ?? String(value ?? ''),
            previousValue: previous?.value,
            previousValueText: previous?.valueText ?? (previous ? String(previous.value ?? '') : undefined),
            valueTs: options.patch?.valueTs || ts,
            valueTime: options.patch?.valueTime || nowText(options.patch?.valueTs || ts),
            previousValueTs: previous?.valueTs,
            previousValueTime: previous?.valueTime,
            receiveTs: options.patch?.receiveTs || ts,
            processTs: options.patch?.processTs || ts,
            quality: options.patch?.quality || previous?.quality || 'GOOD',
            qualityTs: options.patch?.qualityTs || ts,
            changed: true,
            changeSeq: seq,
            changeSource: options.source || options.patch?.changeSource || 'system',
            changeReason: options.reason || options.patch?.changeReason,
        };
        const change: RuntimeVariableChange = {
            seq,
            key: keyParts.key,
            scope: nextVariable.scope,
            name: nextVariable.name,
            value,
            previousValue: previous?.value,
            variable: nextVariable,
            previousVariable: previous,
            ts: nextVariable.valueTs,
            source: nextVariable.changeSource,
            reason: nextVariable.changeReason,
        };

        this.variables.set(keyParts.key, nextVariable);

        if (!options.silent) {
            this.emitVariableChange(nextVariable, change);
        }

        return nextVariable;
    }

    patchVar(
        name: string,
        patch: Partial<RuntimeVariable>,
        options: SetRuntimeVariableOptions = {},
    ) {
        const current = this.getVar(name);
        return this.setVar(
            name,
            Object.prototype.hasOwnProperty.call(patch, 'value') ? patch.value : current?.value,
            {
                ...options,
                patch: {
                    ...patch,
                    ...options.patch,
                },
            },
        );
    }

    subscribeVar(name: string, listener: RuntimeVariableListener)
    {
        const key = normalizeRuntimeVariableKey(name, 'page');
        if (!key) {
            return () => undefined;
        }

        if (!this.variableListeners.has(key)) {
            this.variableListeners.set(key, new Set());
        }

        this.variableListeners.get(key)!.add(listener);
        const variable = this.variables.get(key);
        if (variable) {
            window.setTimeout(() => listener(variable), 0);
        }

        return () => {
            this.variableListeners.get(key)?.delete(listener);
        };
    }

    subscribeVarStore(name: string, listener: () => void)
    {
        const key = normalizeRuntimeVariableKey(name, 'page');
        if (!key) {
            return () => undefined;
        }

        if (!this.storeListeners.has(key)) {
            this.storeListeners.set(key, new Set());
        }

        this.storeListeners.get(key)!.add(listener);
        return () => {
            this.storeListeners.get(key)?.delete(listener);
        };
    }

    subscribeChanges(listener: RuntimeChangeListener)
    {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }

    registerComponent(
        componentId: string,
        methods: RuntimeComponentMethods,
        aliases: string[] = [],
    ) {
        const keys = [componentId, ...aliases]
            .map(normalizeComponentKey)
            .filter(Boolean);

        keys.forEach((key) => {
            const stacks = this.componentMethodStacks.get(key) || {};
            Object.entries(methods).forEach(([method_name, method]) => {
                stacks[method_name] = [...(stacks[method_name] || []), method];
            });
            this.componentMethodStacks.set(key, stacks);
            this.refreshComponentMethods(key);
        });

        return () => {
            keys.forEach((key) => {
                const stacks = this.componentMethodStacks.get(key);
                if (!stacks) {
                    return;
                }

                Object.entries(methods).forEach(([method_name, method]) => {
                    const stack = stacks[method_name] || [];
                    const index = stack.lastIndexOf(method);
                    if (index >= 0) {
                        stack.splice(index, 1);
                    }
                    if (stack.length === 0) {
                        delete stacks[method_name];
                    } else {
                        stacks[method_name] = stack;
                    }
                });

                if (Object.keys(stacks).length === 0) {
                    this.componentMethodStacks.delete(key);
                } else {
                    this.componentMethodStacks.set(key, stacks);
                }
                this.refreshComponentMethods(key);
            });
        };
    }

    private refreshComponentMethods(key: string)
    {
        const stacks = this.componentMethodStacks.get(key);
        if (!stacks) {
            this.componentMethods.delete(key);
            return;
        }

        const methods: RuntimeComponentMethods = {};
        Object.entries(stacks).forEach(([method_name, stack]) => {
            const method = stack[stack.length - 1];
            if (method) {
                methods[method_name] = method;
            }
        });

        if (Object.keys(methods).length === 0) {
            this.componentMethods.delete(key);
            return;
        }

        this.componentMethods.set(key, methods);
    }

    callComponent(
        componentIdOrName: string,
        methodName: string,
        ...args: unknown[]
    ) {
        const component_key = normalizeComponentKey(componentIdOrName);
        const methods = this.componentMethods.get(component_key);
        const method = methods?.[methodName];

        if (!method) {
            throw new Error(`页面组件方法不存在: ${componentIdOrName}.${methodName}`);
        }

        return method(...args);
    }

    setComponentStyle(componentIdOrName: string, style: Record<string, unknown>)
    {
        return this.callComponent(componentIdOrName, 'setStyle', style);
    }

    setComponentProps(componentIdOrName: string, props: Record<string, unknown>)
    {
        return this.callComponent(componentIdOrName, 'setProps', props);
    }

    showComponent(componentIdOrName: string)
    {
        return this.callComponent(componentIdOrName, 'show');
    }

    hideComponent(componentIdOrName: string)
    {
        return this.callComponent(componentIdOrName, 'hide');
    }

    enableComponent(componentIdOrName: string)
    {
        return this.callComponent(componentIdOrName, 'setDisabled', false);
    }

    disableComponent(componentIdOrName: string)
    {
        return this.callComponent(componentIdOrName, 'setDisabled', true);
    }

    getVarsApi(): RuntimeVarsApi
    {
        return {
            get: this.getVar.bind(this),
            getValue: this.getVarValue.bind(this),
            set: this.setVar.bind(this),
            patch: this.patchVar.bind(this),
            all: this.getAllVars.bind(this),
            values: this.getAllValues.bind(this),
            subscribe: this.subscribeVar.bind(this),
        };
    }

    getComponentsApi(): RuntimeComponentsApi
    {
        return {
            call: this.callComponent.bind(this),
            setStyle: this.setComponentStyle.bind(this),
            setProps: this.setComponentProps.bind(this),
            show: this.showComponent.bind(this),
            hide: this.hideComponent.bind(this),
            enable: this.enableComponent.bind(this),
            disable: this.disableComponent.bind(this),
        };
    }

    private emitVariableChange(
        variable: RuntimeVariable,
        change: RuntimeVariableChange,
    ) {
        this.variableListeners.get(variable.key)?.forEach((listener) => listener(variable, change));
        this.storeListeners.get(variable.key)?.forEach((listener) => listener());
        this.changeListeners.forEach((listener) => listener(change));
    }
}

const PageRuntimeContext = createContext<PageRuntime | null>(null);

export function PageRuntimeProvider({
    runtime,
    children,
}: {
    runtime: PageRuntime | null;
    children: ReactNode;
}) {
    return (
        <PageRuntimeContext.Provider value={runtime}>
            {children}
        </PageRuntimeContext.Provider>
    );
}

export function usePageRuntime()
{
    return useContext(PageRuntimeContext);
}

export function usePageRuntimeVariable(name: string | undefined)
{
    const runtime = usePageRuntime();
    const variable_key = name ? normalizeRuntimeVariableKey(name, 'page') : '';

    return useSyncExternalStore(
        (listener) => (
            runtime && variable_key
                ? runtime.subscribeVarStore(variable_key, listener)
                : () => undefined
        ),
        () => (
            runtime && variable_key
                ? runtime.getVar(variable_key)
                : null
        ),
        () => null,
    );
}

export function usePageRuntimeVariableValue(name: string | undefined)
{
    return usePageRuntimeVariable(name)?.value;
}
