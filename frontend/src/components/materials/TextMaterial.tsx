/*
 * 文本物料组件。
 * 支持静态文本、实时变量绑定，以及运行态点击弹窗回写变量。
 */
import { Input, InputNumber, Modal, Typography, message } from 'antd';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  usePageRuntime,
  usePageRuntimeVariable,
  type RuntimeVariable,
} from '../../runtime/pageRuntime';
import { realtimeService, type RealtimePoint } from '../../services/realtimeService';
import type { MaterialRenderProps } from './materialTypes';

interface TextBindingConfig {
  enabled?: boolean;
  source?: 'tag' | 'page';
  tagName?: string;
  variableName?: string;
  template?: string;
  precision?: number;
  fallback?: string;
}

interface TextWriteBackConfig {
  enabled?: boolean;
  source?: 'tag' | 'page';
  tagName?: string;
  variableName?: string;
  valueType?: 'string' | 'number' | 'boolean';
  title?: string;
  placeholder?: string;
}

function readObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readBinding(value: unknown): TextBindingConfig {
  const config = readObject(value);

  return {
    enabled: config.enabled === true,
    source: config.source === 'page' ? 'page' : 'tag',
    tagName: String(config.tagName || ''),
    variableName: String(config.variableName || ''),
    template: String(config.template || '{value} {unit}'),
    precision: typeof config.precision === 'number' ? config.precision : undefined,
    fallback: String(config.fallback || '--'),
  };
}

function readWriteBack(value: unknown): TextWriteBackConfig {
  const config = readObject(value);
  const valueType = String(config.valueType || 'string');

  return {
    enabled: config.enabled === true,
    source: config.source === 'page' ? 'page' : 'tag',
    tagName: String(config.tagName || ''),
    variableName: String(config.variableName || ''),
    valueType: valueType === 'number' || valueType === 'boolean' ? valueType : 'string',
    title: String(config.title || '写入变量值'),
    placeholder: String(config.placeholder || '请输入回写值'),
  };
}

function formatRealtimeText(
  point: RealtimePoint | null,
  binding: TextBindingConfig,
) {
  if (!point || point.value === null || point.value === undefined) {
    return binding.fallback || '--';
  }

  let valueText = String(point.value);

  if (typeof point.value === 'number' && typeof binding.precision === 'number') {
    valueText = point.value.toFixed(binding.precision);
  }

  return String(binding.template || '{value} {unit}')
    .replaceAll('{value}', valueText)
    .replaceAll('{unit}', point.unit || '')
    .replaceAll('{tag}', point.tag)
    .replaceAll('{quality}', point.quality);
}

function isPageVariableName(name: string, source?: string)
{
  return source === 'page' || name.trim().startsWith('page.');
}

function formatRuntimeVariableText(
  variable: RuntimeVariable | null,
  binding: TextBindingConfig,
) {
  if (!variable || variable.value === null || variable.value === undefined) {
    return binding.fallback || '--';
  }

  let valueText = String(variable.value);

  if (typeof variable.value === 'number' && typeof binding.precision === 'number') {
    valueText = variable.value.toFixed(binding.precision);
  }

  return String(binding.template || '{value} {unit}')
    .replaceAll('{value}', valueText)
    .replaceAll('{unit}', variable.unit || '')
    .replaceAll('{tag}', variable.key)
    .replaceAll('{quality}', variable.quality)
    .replaceAll('{previousValue}', String(variable.previousValue ?? ''));
}

export default function TextMaterial({ node, interactive }: MaterialRenderProps) {
  const binding = useMemo(() => readBinding(node.props.binding), [node.props.binding]);
  const writeBack = useMemo(() => readWriteBack(node.props.writeBack), [node.props.writeBack]);
  const runtime = usePageRuntime();
  const bindingName = String(binding.variableName || binding.tagName || '');
  const bindingUsesPageVariable = isPageVariableName(bindingName, binding.source);
  const pageVariable = usePageRuntimeVariable(
    binding.enabled && bindingUsesPageVariable ? bindingName : undefined,
  );
  const [point, setPoint] = useState<RealtimePoint | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<string | number>('');

  useEffect(() => {
    return runtime?.registerComponent(node.id, {
      setText: (value) => setManualText(String(value ?? '')),
      clearText: () => setManualText(null),
    }, [node.name]);
  }, [runtime, node.id, node.name]);

  useEffect(() => {
    if (!binding.enabled || !binding.tagName || bindingUsesPageVariable) {
      setPoint(null);
      return undefined;
    }

    return realtimeService.subscribeTag(binding.tagName, setPoint);
  }, [binding.enabled, binding.tagName, bindingUsesPageVariable]);

  const displayText = manualText ?? (binding.enabled
    ? bindingUsesPageVariable
      ? formatRuntimeVariableText(pageVariable, binding)
      : formatRealtimeText(point, binding)
    : String(node.props.text || node.title));
  const writable = Boolean(interactive && writeBack.enabled);
  const targetName = String(writeBack.variableName || writeBack.tagName || bindingName || '');
  const writeUsesPageVariable = isPageVariableName(targetName, writeBack.source);

  const submitWriteBack = async () => {
    if (!targetName) {
      message.error('未配置回写变量点位');
      return;
    }

    let value: unknown = draftValue;
    if (writeBack.valueType === 'number') {
      value = Number(draftValue);
      if (!Number.isFinite(value)) {
        message.error('请输入有效数字');
        return;
      }
    }

    if (writeBack.valueType === 'boolean') {
      value = String(draftValue).trim() === 'true' || String(draftValue).trim() === '1';
    }

    if (writeUsesPageVariable) {
      const result = runtime?.setVar(targetName, value, { source: 'user' });
      if (result) {
        message.success('页面变量已写入');
        setModalOpen(false);
        return;
      }

      message.error('页面运行时未就绪');
      return;
    }

    const result = await realtimeService.writeTag(targetName, value);
    if (result.success) {
      message.success(result.message);
      setModalOpen(false);
      return;
    }

    message.error(result.message);
  };

  const style = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    cursor: writable ? 'pointer' : 'default',
  } as CSSProperties;

  return (
    <div
      style={style}
      onClick={() => {
        if (writable) {
          const currentValue = writeUsesPageVariable ? pageVariable?.value : point?.value;
          setDraftValue(currentValue === undefined || currentValue === null ? '' : String(currentValue));
          setModalOpen(true);
        }
      }}
    >
      <Typography.Text
        style={{
          color: String(node.props.color || '#1f2937'),
          fontSize: Number(node.props.fontSize || 18),
          display: 'inline-block',
        }}
      >
        {displayText}
      </Typography.Text>
      <Modal
        title={writeBack.title}
        open={modalOpen}
        okText="写入"
        cancelText="取消"
        onOk={() => void submitWriteBack()}
        onCancel={() => setModalOpen(false)}
      >
        {writeBack.valueType === 'number' ? (
          <InputNumber
            style={{ width: '100%' }}
            value={typeof draftValue === 'number' ? draftValue : Number(draftValue)}
            placeholder={writeBack.placeholder}
            onChange={(value) => setDraftValue(value ?? '')}
          />
        ) : (
          <Input
            value={String(draftValue)}
            placeholder={writeBack.placeholder}
            onChange={(event) => setDraftValue(event.target.value)}
          />
        )}
      </Modal>
    </div>
  );
}
