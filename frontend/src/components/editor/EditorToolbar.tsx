import { Button, Space, Tag, Typography } from 'antd';
import type { PageSchema } from '../../schema/pageSchema';

export default function EditorToolbar({
  schema,
  canUndo,
  canRedo,
  onSave,
  onUndo,
  onRedo,
  onPreview,
}: {
  schema: PageSchema;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
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