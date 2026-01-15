'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ProcessPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Process Management</h1>
        <p className="text-sm text-gray-600 mt-1">
          업무 프로세스 플로우차트 시각화 및 편집
        </p>
      </div>

      <Card className="p-12">
        <div className="text-center space-y-6">
          <div className="text-6xl">🚧</div>

          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">
              프로세스 플로우 에디터
            </h3>
            <p className="text-gray-600 mb-2">
              업무 프로세스 시각화 기능 준비 중
            </p>
            <p className="text-sm text-gray-400">
              곧 업데이트 예정입니다
            </p>
          </div>

          <div className="pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <span className="text-sm font-medium">
                예정 기능: Swimming Lane 차트, 도형 편집, 버전 관리
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="text-4xl mb-3">📊</div>
          <h4 className="font-semibold mb-2">플로우차트</h4>
          <p className="text-sm text-gray-600">
            업무 프로세스를 시각적으로 표현
          </p>
        </Card>

        <Card className="p-6">
          <div className="text-4xl mb-3">✏️</div>
          <h4 className="font-semibold mb-2">실시간 편집</h4>
          <p className="text-sm text-gray-600">
            드래그 앤 드롭으로 쉽게 편집
          </p>
        </Card>

        <Card className="p-6">
          <div className="text-4xl mb-3">🔄</div>
          <h4 className="font-semibold mb-2">버전 관리</h4>
          <p className="text-sm text-gray-600">
            프로세스 변경 이력 추적
          </p>
        </Card>
      </div>
    </div>
  );
}
