import { RobotOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Typography } from 'antd';
import type { PageSchema } from '../../schema/pageSchema';

export default function EditorToolbar({
  schema,
  canUndo,
  canRedo,
  aiVisible,
  onSave,
  onUndo,
  onRedo,
  onPreview,
  onToggleAiAssistant,
}: {
  schema: PageSchema;
  canUndo: boolean;
  canRedo: boolean;
  aiVisible: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onToggleAiAssistant: () => void;
}) {
  return (
    <div className="editor-toolbar">
      <div>
        <Typography.Title level={3} className="editor-toolbar-title">
          {schema.name}
        </Typography.Title>
        <Space size={8}>
          <Tag color="processing">{schema.status}</Tag>
          <Typography.Text type="secondary">最近更新：{new Date(schema.updatedAt).toLocaleString()}</Typography.Text>
        </Space>
      </div>
      <Space wrap>
        <Button icon={<RobotOutlined />} type={aiVisible ? 'primary' : 'default'} onClick={onToggleAiAssistant}>
          {aiVisible ? '隐藏 AI 编排' : '打开 AI 编排'}
        </Button>
        <Button onClick={onUndo} disabled={!canUndo}>
          撤销
        </Button>
        <Button onClick={onRedo} disabled={!canRedo}>
          重做
        </Button>
        <Button onClick={onPreview}>预览</Button>
        <Button type="primary" onClick={onSave}>
          保存 JSON Schema
        </Button>
      </Space>
    </div>
  );
}