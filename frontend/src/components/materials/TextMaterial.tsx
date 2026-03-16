import { Typography } from 'antd';
import type { CSSProperties } from 'react';
import type { MaterialRenderProps } from './materialTypes';

export default function TextMaterial({ node }: MaterialRenderProps) {
  const style = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
  } as CSSProperties;

  return (
    <div style={style}>
      <Typography.Text
        style={{
          color: String(node.props.color || '#1f2937'),
          fontSize: Number(node.props.fontSize || 18),
          display: 'inline-block',
        }}
      >
        {String(node.props.text || node.title)}
      </Typography.Text>
    </div>
  );
}