'use client';

/**
 * React Flow 커스텀 노드 컴포넌트
 */

import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';

// 노드 데이터 타입
export interface ProcessNodeData {
  label: string;
  assignee?: string;
  estimatedHours?: number;
  type: 'process' | 'decision' | 'startEnd';
}

// ProcessNode (프로세스) - 파란색 사각형
export function ProcessNode({ data, selected }: NodeProps<ProcessNodeData>) {
  return (
    <div
      className={cn(
        'px-4 py-3 bg-blue-500 text-white rounded-lg border-2 min-w-[120px] text-center shadow-lg',
        selected ? 'border-blue-700 ring-2 ring-blue-300 ring-offset-2' : 'border-blue-600'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-600 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-blue-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-blue-600 !w-3 !h-3" />

      <div className="font-medium">{data.label || '프로세스'}</div>
      {data.assignee && (
        <div className="text-xs text-blue-100 mt-1">담당: {data.assignee}</div>
      )}
      {data.estimatedHours && (
        <div className="text-xs text-blue-100 mt-1">{data.estimatedHours}시간</div>
      )}
    </div>
  );
}

// DecisionNode (의사결정) - 노란색 다이아몬드
export function DecisionNode({ data, selected }: NodeProps<ProcessNodeData>) {
  return (
    <div
      className={cn(
        'px-4 py-3 bg-yellow-500 text-white border-2 min-w-[100px] text-center shadow-lg relative',
        'transform rotate-45',
        selected ? 'border-yellow-700 ring-2 ring-yellow-300 ring-offset-2' : 'border-yellow-600'
      )}
      style={{ width: '100px', height: '100px' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-600 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-yellow-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-yellow-600 !w-3 !h-3" />

      <div className="transform -rotate-45 absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-medium text-sm">{data.label || '의사결정'}</div>
        {data.assignee && (
          <div className="text-xs text-yellow-100 mt-1">담당: {data.assignee}</div>
        )}
        {data.estimatedHours && (
          <div className="text-xs text-yellow-100 mt-1">{data.estimatedHours}시간</div>
        )}
      </div>
    </div>
  );
}

// StartEndNode (시작/종료) - 초록색 원형
export function StartEndNode({ data, selected }: NodeProps<ProcessNodeData>) {
  return (
    <div
      className={cn(
        'px-4 py-3 bg-green-500 text-white rounded-full border-2 min-w-[80px] text-center shadow-lg',
        'flex flex-col items-center justify-center',
        selected ? 'border-green-700 ring-2 ring-green-300 ring-offset-2' : 'border-green-600'
      )}
      style={{ width: '100px', height: '100px' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-600 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-green-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-green-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-green-600 !w-3 !h-3" />

      <div className="font-medium text-sm">{data.label || '시작'}</div>
      {data.assignee && (
        <div className="text-xs text-green-100 mt-1">담당: {data.assignee}</div>
      )}
      {data.estimatedHours && (
        <div className="text-xs text-green-100 mt-1">{data.estimatedHours}시간</div>
      )}
    </div>
  );
}

