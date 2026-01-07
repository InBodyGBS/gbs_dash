'use client';

/**
 * 스케줄 그리드 컴포넌트
 * 법인 x 날짜 매트릭스로 일정 표시
 */

import { useState, useEffect } from 'react';
import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Subsidiary } from '@/lib/supabase/types';
import type { ScheduleItem, Quarter } from '@/lib/types/quarterly-closing';
import { getCategoryById } from '@/lib/constants/closing-categories';
import { calculateBySubsidiary } from '@/lib/utils/achievement-rate';

interface ScheduleGridProps {
  quarter: Quarter;
  subsidiaries: Subsidiary[];
  scheduleItems: ScheduleItem[];
  selectedCategory: string | null;
  onCellClick: (subsidiaryId: string, date: string) => void;
  onCategoryDrop?: (subsidiaryId: string, date: string, categoryId: string) => void;
  onItemDelete?: (itemId: string) => void;
  onItemConfirm?: (itemId: string) => void;
}

export const ScheduleGrid = ({
  quarter,
  subsidiaries,
  scheduleItems,
  selectedCategory,
  onCellClick,
  onCategoryDrop,
  onItemDelete,
  onItemConfirm,
}: ScheduleGridProps) => {
  // 현재 표시할 월 (분기 시작월로 초기화)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => parseISO(quarter.start_date));

  // quarter가 변경되면 현재 월을 초기화
  useEffect(() => {
    setCurrentMonth(parseISO(quarter.start_date));
  }, [quarter.start_date]);

  // 전체 분기 기간의 모든 날짜
  const allDates = eachDayOfInterval({
    start: parseISO(quarter.start_date),
    end: parseISO(quarter.end_date),
  });

  // 현재 월의 날짜만 필터링
  const dates = allDates.filter((date) => isSameMonth(date, currentMonth));

  // 분기 내에서 월 이동
  const quarterStart = parseISO(quarter.start_date);
  const quarterEnd = parseISO(quarter.end_date);

  const canGoPrevMonth = startOfMonth(currentMonth) > startOfMonth(quarterStart);
  const canGoNextMonth = endOfMonth(currentMonth) < endOfMonth(quarterEnd);

  const handlePrevMonth = () => {
    if (canGoPrevMonth) {
      setCurrentMonth(addMonths(currentMonth, -1));
    }
  };

  const handleNextMonth = () => {
    if (canGoNextMonth) {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  // 특정 법인/날짜의 스케줄 항목들 찾기 (여러 개 가능)
  const getScheduleItems = (subsidiaryId: string, date: Date): ScheduleItem[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scheduleItems.filter(
      (item) =>
        item.subsidiary_id === subsidiaryId &&
        format(parseISO(item.planned_date), 'yyyy-MM-dd') === dateStr
    );
  };

  // 드롭 핸들러
  const handleDrop = (e: React.DragEvent, subsidiaryId: string, date: Date) => {
    e.preventDefault();
    e.stopPropagation();
    
    // itemId가 있으면 삭제는 배경에서 처리하도록 무시
    const itemId = e.dataTransfer.getData('itemId');
    if (itemId) {
      return;
    }
    
    const categoryId = e.dataTransfer.getData('categoryId');
    if (categoryId && onCategoryDrop) {
      onCategoryDrop(subsidiaryId, format(date, 'yyyy-MM-dd'), categoryId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const itemId = e.dataTransfer.getData('itemId');
    const categoryId = e.dataTransfer.getData('categoryId');
    
    // 카테고리 드롭 또는 항목 삭제를 위한 드래그인 경우
    if (itemId || categoryId) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  // Badge 드래그 핸들러 (삭제용)
  const handleBadgeDragStart = (e: React.DragEvent, itemId: string) => {
    e.stopPropagation(); // 셀 클릭 이벤트 방지
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', itemId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleBadgeDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  // Badge 클릭 핸들러 (확정용)
  const handleBadgeClick = (e: React.MouseEvent, item: ScheduleItem) => {
    e.stopPropagation(); // 셀 클릭 이벤트 방지
    if (onItemConfirm && item.status === 'planned') {
      onItemConfirm(item.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between bg-white border rounded-lg p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevMonth}
          disabled={!canGoPrevMonth}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          이전 월
        </Button>

        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900">
            {format(currentMonth, 'yyyy년 M월')}
          </h3>
          <p className="text-xs text-gray-500">
            {format(dates[0], 'M/d')} ~ {format(dates[dates.length - 1], 'M/d')}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNextMonth}
          disabled={!canGoNextMonth}
        >
          다음 월
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* 스케줄 테이블 */}
      <div className="overflow-x-auto border rounded-lg relative">
        <table className="w-full border-collapse bg-white">
        {/* 헤더 */}
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm sticky left-0 bg-gray-50 z-20">
              Entity
            </th>
            {dates.map((date) => {
              const dayOfWeek = format(date, 'E'); // Sun, Mon, etc.
              const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';

              return (
                <th
                  key={date.toISOString()}
                  className={cn(
                    'border border-gray-200 px-2 py-2 text-center font-semibold text-xs w-[70px] min-w-[70px] max-w-[70px]',
                    isWeekend && 'bg-red-50'
                  )}
                >
                  <div className="flex flex-col">
                    <span className={cn('text-xs', isWeekend && 'text-red-600')}>
                      {dayOfWeek}
                    </span>
                    <span className="text-sm font-bold">
                      {format(date, 'd')}
                    </span>
                  </div>
                </th>
              );
            })}
            <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm bg-blue-50">
              성사율
            </th>
          </tr>
        </thead>

        {/* 바디 */}
        <tbody>
          {subsidiaries.map((subsidiary) => {
            const achievementRate = calculateBySubsidiary(scheduleItems, subsidiary.id);

            return (
              <tr key={subsidiary.id} className="hover:bg-gray-50">
                {/* 법인명 */}
                <td className="border border-gray-200 px-4 py-3 font-medium text-sm sticky left-0 bg-white z-10">
                  {subsidiary.name.replace('InBody ', '')}
                </td>

                {/* 날짜별 셀 */}
                {dates.map((date) => {
                  const items = getScheduleItems(subsidiary.id, date);

                  return (
                    <td
                      key={date.toISOString()}
                      className={cn(
                        'border border-gray-200 px-1 py-1 cursor-pointer transition-colors align-top',
                        items.length === 0 && selectedCategory && 'hover:bg-blue-50',
                        items.length === 0 && !selectedCategory && 'bg-gray-50'
                      )}
                      onDrop={(e) => handleDrop(e, subsidiary.id, date)}
                      onDragOver={handleDragOver}
                      onClick={() => onCellClick(subsidiary.id, format(date, 'yyyy-MM-dd'))}
                    >
                  {items.length > 0 ? (
                    <div className="flex flex-col gap-0.5 min-h-[2rem] max-h-[6rem] overflow-y-auto">
                      {items.map((item) => {
                        const category = getCategoryById(item.category);
                        if (!category) return null;

                        // 레이블 축약 (첫 단어의 첫 3글자)
                        const shortLabel = category.label.split(' ')[0].substring(0, 3).toUpperCase();

                        return (
                          <Badge
                            key={item.id}
                            variant={item.status === 'confirmed' ? 'default' : 'secondary'}
                            className={cn(
                              "text-[10px] px-1 py-0 h-5 whitespace-nowrap",
                              item.status === 'planned' ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : 'cursor-move'
                            )}
                            draggable
                            onDragStart={(e) => handleBadgeDragStart(e, item.id)}
                            onDragEnd={handleBadgeDragEnd}
                            onClick={(e) => handleBadgeClick(e, item)}
                            style={{
                              backgroundColor:
                                item.status === 'confirmed' ? category.color : undefined,
                            }}
                            title={
                              item.status === 'confirmed' 
                                ? `${category.label} - 확정 (드래그하여 삭제)` 
                                : `${category.label} - 예정 (클릭하여 확정 또는 드래그하여 삭제)`
                            }
                          >
                            {item.status === 'confirmed' ? '✓' : '○'} {shortLabel}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-8" />
                  )}
                </td>
                  );
                })}

                {/* 성사율 */}
                <td className="border border-gray-200 px-4 py-3 text-center font-semibold bg-blue-50">
                  <span
                    className={cn(
                      'text-lg',
                      achievementRate >= 80
                        ? 'text-green-600'
                        : achievementRate >= 50
                        ? 'text-blue-600'
                        : 'text-gray-600'
                    )}
                  >
                    {achievementRate}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};

