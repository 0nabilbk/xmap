import { memo } from 'react';

export interface GroupNodeData {
  label: string;
  color: string;
  width: number;
  height: number;
}

function GroupNode({ data }: { data: GroupNodeData }) {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        background: data.color,
        borderRadius: 20,
        cursor: 'grab',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          opacity: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

export default memo(GroupNode);
