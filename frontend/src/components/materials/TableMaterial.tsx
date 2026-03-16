import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MaterialRenderProps } from './materialTypes';

export default function TableMaterial({ node }: MaterialRenderProps) {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <Table
        size="small"
        pagination={false}
        columns={(node.props.columns as ColumnsType<Record<string, unknown>>) || []}
        dataSource={(node.props.dataSource as Record<string, unknown>[]) || []}
        rowKey={(record) => String(record.key || record.id || JSON.stringify(record))}
      />
    </div>
  );
}