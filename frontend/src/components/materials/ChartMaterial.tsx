import ReactECharts from 'echarts-for-react';
import type { MaterialRenderProps } from './materialTypes';

export default function ChartMaterial({ node }: MaterialRenderProps) {
  return (
    <ReactECharts
      option={(node.props.option as Record<string, unknown>) || {}}
      style={{ width: '100%', height: '100%' }}
    />
  );
}