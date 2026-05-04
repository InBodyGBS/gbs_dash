'use client';

/**
 * 차트를 카드로 감싸고, 우상단 확대 버튼 클릭 시 큰 다이얼로그로 펼쳐 보여주는 래퍼.
 *
 * 사용법:
 *   <ZoomableChartCard title="Cash Status">
 *     {(mode) => (
 *       <ResponsiveContainer width="100%" height={mode === 'zoomed' ? '100%' : 240}>
 *         <LineChart data={chartData}>...</LineChart>
 *       </ResponsiveContainer>
 *     )}
 *   </ZoomableChartCard>
 *
 * - card 모드: 컴포넌트 안에 고정 높이(240px 등)
 * - zoomed 모드: 다이얼로그 내부의 남은 공간을 모두 채움
 */

import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Maximize2 } from 'lucide-react';

interface ZoomableChartCardProps {
  /** CardTitle 본문 */
  title: ReactNode;
  /** 비어있을 때 표시할 메시지 (chart 대신) */
  isEmpty?: boolean;
  emptyMessage?: ReactNode;
  /** mode='card' 또는 'zoomed' 에 맞춰 차트를 렌더하는 함수 */
  children: (mode: 'card' | 'zoomed') => ReactNode;
}

export function ZoomableChartCard({
  title,
  isEmpty = false,
  emptyMessage,
  children,
}: ZoomableChartCardProps) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold text-gray-800 flex-1 min-w-0">
            {title}
          </CardTitle>
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded p-1 transition-colors flex-shrink-0 -mt-1"
            title="확대 보기"
            aria-label="확대 보기"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <div className="text-center text-gray-400 py-10 text-sm">
              {emptyMessage ?? '데이터 없음'}
            </div>
          ) : (
            children('card')
          )}
        </CardContent>
      </Card>

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4">
            {isEmpty ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                {emptyMessage ?? '데이터 없음'}
              </div>
            ) : (
              children('zoomed')
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
