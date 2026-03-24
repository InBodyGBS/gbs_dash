'use client';

/**
 * 프로세스 플로우차트 에디터 컴포넌트
 * React Flow 기반 프로세스 플로우차트 에디터
 */

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { updateProcess } from '@/lib/services/processService';
import { ShapePalette } from './ShapePalette';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { ProcessNode, DecisionNode, StartEndNode, type ProcessNodeData } from './ProcessNodes';

type FlowShape = {
  id: string;
  type: 'process' | 'decision' | 'startEnd';
  x?: number;
  y?: number;
  text?: string;
  assignee?: string;
  estimatedHours?: number;
};

type FlowConnection = {
  id?: string;
  from?: string;
  to?: string;
  fromShapeId?: string;
  toShapeId?: string;
  label?: unknown;
};

type FlowchartData = {
  swimlanes: unknown[];
  columns: unknown[];
  shapes: FlowShape[];
  connections: FlowConnection[];
};

// Props 인터페이스
interface ProcessFlowEditorProps {
  processId: string;
  initialData?: FlowchartData;
  onSave?: (data: FlowchartData) => void;
  readonly?: boolean;
}

// 노드 타입 정의
const nodeTypes: NodeTypes = {
  process: ProcessNode,
  decision: DecisionNode,
  startEnd: StartEndNode,
};

// 메인 컴포넌트
function ProcessFlowEditorInner({
  processId,
  initialData,
  onSave,
  readonly = false,
}: ProcessFlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<ProcessNodeData> | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    if (initialData) {
      // JSONB의 shapes를 React Flow nodes로 변환
      const loadedNodes: Node<ProcessNodeData>[] =
        initialData.shapes?.map((shape) => ({
          id: shape.id,
          type: shape.type === 'process' ? 'process' : shape.type === 'decision' ? 'decision' : 'startEnd',
          position: { x: shape.x || 250, y: shape.y || 100 },
          data: {
            label: shape.text || '',
            type: shape.type,
            assignee: shape.assignee,
            estimatedHours: shape.estimatedHours,
          },
        })) || [];

      // JSONB의 connections를 React Flow edges로 변환
      const loadedEdges: Edge[] = (initialData.connections || []).reduce<Edge[]>((acc, conn) => {
        const source = conn.from || conn.fromShapeId;
        const target = conn.to || conn.toShapeId;
        if (!source || !target) return acc;
        acc.push({
          id: conn.id || `edge-${source}-${target}`,
          source,
          target,
          type: 'smoothstep',
          animated: false,
          label: typeof conn.label === 'string' ? conn.label : undefined,
        });
        return acc;
      }, []);

      setNodes(loadedNodes);
      setEdges(loadedEdges);
    }
  }, [initialData, setNodes, setEdges]);

  // 노드 추가
  const handleAddNode = useCallback(
    (type: 'process' | 'decision' | 'startEnd') => {
      if (readonly) return;

      const newNode: Node<ProcessNodeData> = {
        id: `node-${Date.now()}`,
        type,
        position: { x: 250, y: 100 },
        data: {
          label: type === 'process' ? '프로세스' : type === 'decision' ? '의사결정' : '시작',
          type,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [readonly, setNodes]
  );

  // 엣지 연결
  const onConnect = useCallback(
    (connection: Connection) => {
      if (readonly) return;
      setEdges((eds) => addEdge(connection, eds));
    },
    [readonly, setEdges]
  );

  // 노드 선택
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<ProcessNodeData>) => {
    setSelectedNode(node);
  }, []);

  // 노드 업데이트
  const handleUpdateNode = useCallback(
    (nodeId: string, newData: Partial<ProcessNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
        )
      );
      // 선택된 노드도 업데이트
      setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev));
    },
    [setNodes]
  );

  // 노드 삭제
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [selectedNode, setNodes, setEdges]
  );

  // Delete 키로 노드 삭제
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (readonly) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNode) {
          handleDeleteNode(selectedNode.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, readonly, handleDeleteNode]);

  // 저장
  const handleSave = useCallback(async () => {
    if (readonly) return;

    // React Flow 데이터를 JSONB 형식으로 변환
    const shapes = nodes.map((node) => ({
      id: node.id,
      type: node.data.type,
      text: node.data.label,
      x: node.position.x,
      y: node.position.y,
      assignee: node.data.assignee,
      estimatedHours: node.data.estimatedHours,
    }));

    const connections = edges.map((edge) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      label: edge.label,
    }));

    const flowchartData = {
      swimlanes: initialData?.swimlanes || [],
      columns: initialData?.columns || [],
      shapes,
      connections,
    };

    try {
      await updateProcess(processId, { flowchart_data: flowchartData });
      toast.success('프로세스가 저장되었습니다');
      console.log('✅ 저장 완료');
      if (onSave) onSave(flowchartData);
    } catch (error) {
      console.error('❌ 저장 실패:', error);
      toast.error('저장에 실패했습니다');
    }
  }, [nodes, edges, initialData, processId, onSave, readonly]);

  return (
    <div className="flex h-[700px]">
      {/* 왼쪽: 도형 팔레트 */}
      {!readonly && <ShapePalette onAddNode={handleAddNode} readonly={readonly} />}

      {/* 중앙: React Flow 캔버스 */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {!readonly && onSave && (
          <div className="absolute bottom-4 right-4 z-10">
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              저장
            </Button>
          </div>
        )}
      </div>

      {/* 오른쪽: 속성 패널 */}
      {!readonly && (
        <NodePropertiesPanel
          selectedNode={selectedNode}
          onUpdate={handleUpdateNode}
          onDelete={handleDeleteNode}
          readonly={readonly}
        />
      )}
    </div>
  );
}

// ReactFlowProvider로 래핑된 메인 컴포넌트
export function ProcessFlowEditor(props: ProcessFlowEditorProps) {
  return (
    <ReactFlowProvider>
      <ProcessFlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}

export default ProcessFlowEditor;
