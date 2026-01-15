'use client';

/**
 * 노드 속성 패널 컴포넌트
 * 오른쪽 사이드바용 노드 편집 패널
 */

import { Node } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Trash2 } from 'lucide-react';
import type { ProcessNodeData } from './ProcessNodes';

interface NodePropertiesPanelProps {
  selectedNode: Node<ProcessNodeData> | null;
  onUpdate: (nodeId: string, data: Partial<ProcessNodeData>) => void;
  onDelete: (nodeId: string) => void;
  readonly?: boolean;
}

export function NodePropertiesPanel({
  selectedNode,
  onUpdate,
  onDelete,
  readonly = false,
}: NodePropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <Card className="w-80 border-l rounded-none h-full">
        <CardContent className="p-4 pt-6">
          <p className="text-gray-500 text-sm text-center">노드를 선택하세요</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 border-l rounded-none h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">속성</CardTitle>
        <CardDescription className="text-xs">선택된 노드 편집</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="label">텍스트</Label>
          <Input
            id="label"
            value={selectedNode.data.label || ''}
            onChange={(e) =>
              onUpdate(selectedNode.id, {
                label: e.target.value,
              })
            }
            disabled={readonly}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="assignee">담당자</Label>
          <Input
            id="assignee"
            value={selectedNode.data.assignee || ''}
            onChange={(e) =>
              onUpdate(selectedNode.id, {
                assignee: e.target.value,
              })
            }
            placeholder="담당자 이름"
            disabled={readonly}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="hours">예상시간 (hours)</Label>
          <Input
            id="hours"
            type="number"
            value={selectedNode.data.estimatedHours || ''}
            onChange={(e) =>
              onUpdate(selectedNode.id, {
                estimatedHours: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="예상 시간"
            disabled={readonly}
            className="mt-2"
          />
        </div>

        <Separator />

        <div>
          <Label>타입</Label>
          <div className="mt-2 px-3 py-2 border rounded-md bg-gray-50 text-sm">
            {selectedNode.data.type === 'process'
              ? '프로세스'
              : selectedNode.data.type === 'decision'
                ? '의사결정'
                : '시작/종료'}
          </div>
        </div>

        <div>
          <Label>위치</Label>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <div>X: {Math.round(selectedNode.position.x)}</div>
            <div>Y: {Math.round(selectedNode.position.y)}</div>
          </div>
        </div>

        {!readonly && (
          <>
            <Separator />
            <Button
              variant="destructive"
              onClick={() => onDelete(selectedNode.id)}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              삭제
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

