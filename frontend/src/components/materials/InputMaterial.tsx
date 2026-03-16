import { Input } from 'antd';
import type { MaterialRenderProps } from './materialTypes';

export default function InputMaterial({ node }: MaterialRenderProps) {
  return (
    <Input
      placeholder={String(node.props.placeholder || '请输入内容')}
      style={{ width: '100%', height: '100%' }}
    />
  );
}