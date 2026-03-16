import { Button } from 'antd';
import type { MaterialRenderProps } from './materialTypes';

export default function ButtonMaterial({
  node,
  interactive,
  onRunScript,
}: MaterialRenderProps) {
  return (
    <Button
      style={{ width: '100%', height: '100%' }}
      type={String(node.props.buttonType || 'primary') as 'primary' | 'default' | 'dashed' | 'link' | 'text'}
      onClick={() => interactive && onRunScript?.(node.scripts.onClick, node)}
    >
      {String(node.props.text || node.title)}
    </Button>
  );
}