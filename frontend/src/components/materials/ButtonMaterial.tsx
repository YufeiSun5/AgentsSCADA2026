/*
 * 按钮物料组件。
 * 支持普通脚本点击，也支持统一实时服务回写控制指令。
 */
import { Button, Modal, message } from 'antd';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { usePageRuntime } from '../../runtime/pageRuntime';
import { realtimeService } from '../../services/realtimeService';
import type { MaterialRenderProps } from './materialTypes';

interface ButtonWriteBackConfig {
  enabled?: boolean;
  source?: 'tag' | 'page';
  tagName?: string;
  variableName?: string;
  value?: unknown;
  action?: string;
  confirmRequired?: boolean;
  confirmTitle?: string;
  successMessage?: string;
  errorMessage?: string;
}

function readObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readWriteBack(value: unknown): ButtonWriteBackConfig {
  const config = readObject(value);

  return {
    enabled: config.enabled === true,
    source: config.source === 'page' ? 'page' : 'tag',
    tagName: String(config.tagName || ''),
    variableName: String(config.variableName || ''),
    value: config.value,
    action: String(config.action || 'set'),
    confirmRequired: config.confirmRequired === true,
    confirmTitle: String(config.confirmTitle || '确认下发控制指令？'),
    successMessage: String(config.successMessage || '控制指令已下发'),
    errorMessage: String(config.errorMessage || '控制指令下发失败'),
  };
}

export default function ButtonMaterial({
  node,
  interactive,
  onRunScript,
}: MaterialRenderProps) {
  const writeBack = readWriteBack(node.props.writeBack);
  const runtime = usePageRuntime();
  const [runtimeText, setRuntimeText] = useState<string | null>(null);
  const [runtimeButtonType, setRuntimeButtonType] = useState<string | null>(null);
  const [runtimeStyle, setRuntimeStyle] = useState<CSSProperties>({});
  const [runtimeDisabled, setRuntimeDisabled] = useState<boolean | null>(null);

  useEffect(() => {
    setRuntimeText(null);
    setRuntimeButtonType(null);
    setRuntimeStyle({});
    setRuntimeDisabled(null);
  }, [node.id]);

  useEffect(() => {
    return runtime?.registerComponent(node.id, {
      setText: (value) => setRuntimeText(String(value ?? '')),
      clearText: () => setRuntimeText(null),
      setButtonType: (value) => setRuntimeButtonType(String(value || 'primary')),
      setDisabled: (value) => setRuntimeDisabled(Boolean(value)),
      setBackgroundColor: (value) =>
        setRuntimeStyle((previous) => ({
          ...previous,
          backgroundColor: String(value || ''),
          borderColor: String(value || ''),
        })),
      setStyle: (patch) => {
        const stylePatch = readObject(patch) as CSSProperties;
        setRuntimeStyle((previous) => ({ ...previous, ...stylePatch }));
      },
      clearRuntimeState: () => {
        setRuntimeText(null);
        setRuntimeButtonType(null);
        setRuntimeStyle({});
        setRuntimeDisabled(null);
      },
    }, [node.name]);
  }, [runtime, node.id, node.name]);

  const executeClick = async () => {
    if (!interactive || runtimeDisabled === true || node.props.disabled === true) {
      return;
    }

    if (!writeBack.enabled) {
      onRunScript?.(node.scripts.onClick, node);
      return;
    }

    const targetName = String(writeBack.variableName || writeBack.tagName || '');
    const writeUsesPageVariable = writeBack.source === 'page' || targetName.trim().startsWith('page.');

    if (!targetName) {
      message.error('未配置按钮回写变量点位');
      return;
    }

    if (writeUsesPageVariable) {
      const result = runtime?.setVar(targetName, writeBack.value, { source: 'user' });
      if (result) {
        message.success(writeBack.successMessage);
        onRunScript?.(node.scripts.onClick, node);
        return;
      }

      message.error('页面运行时未就绪');
      return;
    }

    const result = await realtimeService.writeTag(
      targetName,
      writeBack.value,
      { action: writeBack.action },
    );

    if (result.success) {
      message.success(writeBack.successMessage);
      onRunScript?.(node.scripts.onClick, node);
      return;
    }

    message.error(`${writeBack.errorMessage}：${result.message}`);
  };

  const handleClick = () => {
    if (!interactive || runtimeDisabled === true || node.props.disabled === true) {
      return;
    }

    if (writeBack.enabled && writeBack.confirmRequired) {
      Modal.confirm({
        title: writeBack.confirmTitle,
        okText: '确认下发',
        cancelText: '取消',
        onOk: () => executeClick(),
      });
      return;
    }

    void executeClick();
  };

  return (
    <Button
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: String(node.props.backgroundColor || '') || undefined,
        borderColor: String(node.props.borderColor || node.props.backgroundColor || '') || undefined,
        color: String(node.props.color || '') || undefined,
        ...runtimeStyle,
      }}
      disabled={runtimeDisabled ?? node.props.disabled === true}
      type={String(runtimeButtonType || node.props.buttonType || 'primary') as 'primary' | 'default' | 'dashed' | 'link' | 'text'}
      onClick={handleClick}
    >
      {runtimeText ?? String(node.props.text || node.title)}
    </Button>
  );
}
