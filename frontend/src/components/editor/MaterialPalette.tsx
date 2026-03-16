import { Card, Tag, Typography } from 'antd';
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

export default function MaterialPalette() {
  const groups = Array.from(new Set(materialCatalog.map((item) => item.category)));

  return (
    <div className="editor-panel-shell">
      <div className="panel-heading">
        <Typography.Title level={4}>物料面板</Typography.Title>
        <Typography.Text type="secondary">按任务书预置 AntD 与图表物料。</Typography.Text>
      </div>
      {groups.map((group) => (
        <div key={group} className="panel-group">
          <Tag color="cyan" className="panel-group-tag">
            {group}
          </Tag>
          <div className="material-card-grid">
            {materialCatalog
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