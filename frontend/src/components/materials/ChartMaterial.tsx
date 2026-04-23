import ReactECharts from 'echarts-for-react';
import { useEffect, useRef } from 'react';
import { usePageRuntime } from '../../runtime/pageRuntime';
import type { MaterialRenderProps } from './materialTypes';

export default function ChartMaterial({ node }: MaterialRenderProps) {
  const runtime = usePageRuntime();
  const chartRef = useRef<any>(null);

  useEffect(() => {
    return runtime?.registerComponent(node.id, {
      setOption: (option) => chartRef.current?.getEchartsInstance?.().setOption(option),
      appendData: (payload) => chartRef.current?.getEchartsInstance?.().appendData(payload),
      clear: () => chartRef.current?.getEchartsInstance?.().clear(),
      resize: () => chartRef.current?.getEchartsInstance?.().resize(),
    }, [node.name]);
  }, [runtime, node.id, node.name]);

  return (
    <ReactECharts
      ref={chartRef}
      option={(node.props.option as Record<string, unknown>) || {}}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
