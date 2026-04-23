import { Button, Card, Tag, Typography } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { materialCatalog } from '../../schema/pageSchema';

function MaterialCard({ type, label, description }: { type: string; label: string; description: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `material-${type}`,
    data: {
      kind: 'palette',
      componentType: type,
    },
  });

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      hoverable
      size="small"
      className="material-card"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.48 : 1,
      }}
    >
      <Typography.Text strong>{label}</Typography.Text>
      <Typography.Paragraph type="secondary" className="material-card-description">
        {description}
      </Typography.Paragraph>
    </Card>
  );
}

export default function MaterialPalette({ onCollapse }: { onCollapse?: () => void }) {
  const visibleMaterials = materialCatalog.filter((item) => item.visible !== false);
  const groups = Array.from(new Set(visibleMaterials.map((item) => item.category)));

  return (
    <div className="editor-panel-shell">
      <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Typography.Title level={4}>物料面板</Typography.Title>
          <Typography.Text type="secondary">按任务书预置 AntD 与图表物料。</Typography.Text>
        </div>
        {onCollapse && (
          <Button type="text" size="small" icon={<LeftOutlined />} onClick={onCollapse} title="收起面板" style={{ marginTop: 2 }} />
        )}
      </div>
      {groups.map((group) => (
        <div key={group} className="panel-group">
          <Tag color="cyan" className="panel-group-tag">
            {group}
          </Tag>
          <div className="material-card-grid">
            {visibleMaterials
              .filter((item) => item.category === group)
              .map((item) => (
                <MaterialCard key={item.type} type={item.type} label={item.label} description={item.description} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
