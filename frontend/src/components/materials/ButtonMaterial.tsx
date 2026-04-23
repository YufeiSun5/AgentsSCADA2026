/*
 * 按钮物料组件。
 * 支持普通脚本点击，也支持统一实时服务回写控制指令。
 */
import { Button, Modal, message } from 'antd';
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

  const executeClick = async () => {
    if (!interactive) {
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
    if (!interactive) {
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
      style={{ width: '100%', height: '100%' }}
      type={String(node.props.buttonType || 'primary') as 'primary' | 'default' | 'dashed' | 'link' | 'text'}
      onClick={handleClick}
    >
      {String(node.props.text || node.title)}
    </Button>
  );
}
