'use client';

/**
 * 도형 팔레트 컴포넌트
 * 왼쪽 사이드바용 도형 추가 버튼들
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Diamond, Circle } from 'lucide-react';

interface ShapePaletteProps {
  onAddNode: (type: 'process' | 'decision' | 'startEnd') => void;
  readonly?: boolean;
}

export function ShapePalette({ onAddNode, readonly = false }: ShapePaletteProps) {
  return (
    <Card className="w-48 border-r rounded-none h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">도형</CardTitle>
        <CardDescription className="text-xs">도형을 클릭하여 추가</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          onClick={() => onAddNode('process')}
          disabled={readonly}
          className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4" />
          프로세스
        </Button>

        <Button
          onClick={() => onAddNode('decision')}
          disabled={readonly}
          className="w-full p-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Diamond className="w-4 h-4" />
          의사결정
        </Button>

        <Button
          onClick={() => onAddNode('startEnd')}
          disabled={readonly}
          className="w-full p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Circle className="w-4 h-4" />
          시작/종료
        </Button>
      </CardContent>
    </Card>
  );
}

