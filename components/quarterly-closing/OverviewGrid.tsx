'use client';

/**
 * Overview 그리드 컴포넌트
 * Entity가 행, 카테고리가 열로 표시
 * 제출 여부에 따라 회색(미제출)/파란색(검토중)/초록색(확정) 원형 표시
 */

import { useState, useEffect, useMemo } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter, ScheduleItem, DocumentSubmission } from '@/lib/types/quarterly-closing';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import type { ClosingCategory } from '@/lib/constants/closing-categories';

const ENTITY_ORDER_KEY = 'quarterly-closing-entity-order';
const CATEGORY_ORDER_KEY = 'quarterly-closing-overview-category-order';

interface OverviewGridProps {
  quarter: Quarter;
  subsidiaries: Subsidiary[];
  scheduleItems: ScheduleItem[];
  submissions: DocumentSubmission[];
  selectedCategory?: string | null;
  onEntityOrderChange?: (newOrder: Subsidiary[]) => void;
  onCategoryOrderChange?: (newOrder: ClosingCategory[]) => void;
}

export const OverviewGrid = ({
  quarter,
  subsidiaries,
  scheduleItems,
  submissions,
  selectedCategory,
  onEntityOrderChange,
  onCategoryOrderChange,
}: OverviewGridProps) => {
  // Entity 순서 관리
  const [orderedSubsidiaries, setOrderedSubsidiaries] = useState<Subsidiary[]>(subsidiaries);
  const [draggedEntityIndex, setDraggedEntityIndex] = useState<number | null>(null);

  // 카테고리 순서 관리
  const [orderedCategories, setOrderedCategories] = useState<ClosingCategory[]>([...CLOSING_CATEGORIES]);
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);

  // localStorage에서 카테고리 순서 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedOrder = localStorage.getItem(CATEGORY_ORDER_KEY);
      if (savedOrder) {
        const order: string[] = JSON.parse(savedOrder);
        const ordered = [...CLOSING_CATEGORIES].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        setOrderedCategories(ordered);
      }
    } catch (error) {
      console.error('Failed to load category order:', error);
    }
  }, []);

  // subsidiaries가 변경되면 orderedSubsidiaries 업데이트
  useEffect(() => {
    setOrderedSubsidiaries(subsidiaries);
  }, [subsidiaries]);

  // 카테고리 순서 저장
  const saveCategoryOrder = (order: ClosingCategory[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(order.map(cat => cat.id)));
      if (onCategoryOrderChange) {
        onCategoryOrderChange(order);
      }
      toast.success('카테고리 순서가 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save category order:', error);
    }
  };

  // Calendar 그리드에 반영 여부 확인 (scheduleItems에 항목이 있는지)
  const hasScheduleItem = (subsidiaryId: string, categoryId: string): boolean => {
    return scheduleItems.some(
      (item) =>
        item.subsidiary_id === subsidiaryId &&
        item.category === categoryId
        // quarter_id 비교 제거: Submissions는 fiscalQuarterId를, ScheduleItems는 workPeriod의 quarter_id를 사용하므로
    );
  };

  // ScheduleItem의 status 확인 (Calendar 로직과 동일)
  const getScheduleItemStatus = (subsidiaryId: string, categoryId: string): 'confirmed' | 'planned' | null => {
    const matchingItems = scheduleItems.filter(
      (item) => item.subsidiary_id === subsidiaryId && item.category === categoryId
    );
    if (matchingItems.length === 0) return null;
    const confirmedItem = matchingItems.find((item) => item.status === 'confirmed');
    const item = confirmedItem || matchingItems[0];
    return item.status === 'confirmed' ? 'confirmed' : 'planned';
  };

  // 제출 여부 확인 (submissions에 항목이 있는지)
  const hasSubmission = (subsidiaryId: string, categoryId: string): boolean => {
    return submissions.some(
      (sub) => sub.subsidiary_id === subsidiaryId && sub.category === categoryId
    );
  };

  // 법인별 제출 현황 요약 (완료 / 기한초과 / 대기중)
  const getSubsidiarySummary = (subsidiaryId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const items = scheduleItems.filter((i) => i.subsidiary_id === subsidiaryId);
    const submitted = items.filter((i) => i.status === 'confirmed').length;
    const overdue = items.filter(
      (i) => i.status === 'planned' && i.planned_date < today
    ).length;
    const pending = items.filter(
      (i) => i.status === 'planned' && i.planned_date >= today
    ).length;
    return { submitted, overdue, pending };
  };

  // Entity 드래그 핸들러
  const handleEntityDragStart = (e: React.DragEvent, index: number) => {
    setDraggedEntityIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleEntityDragEnd = (e: React.DragEvent) => {
    setDraggedEntityIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleEntityDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = draggedEntityIndex;
    if (draggedIndex !== null && draggedIndex !== index) {
      const newOrder = [...orderedSubsidiaries];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedSubsidiaries(newOrder);
      setDraggedEntityIndex(index);
    }
  };

  const handleEntityDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = draggedEntityIndex;
    if (draggedIndex !== null && draggedIndex !== index) {
      const newOrder = [...orderedSubsidiaries];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedSubsidiaries(newOrder);
      if (onEntityOrderChange) {
        onEntityOrderChange(newOrder);
      }
    }
    setDraggedEntityIndex(null);
  };

  // 카테고리 드래그 핸들러
  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleCategoryDragEnd = (e: React.DragEvent) => {
    setDraggedCategoryIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleCategoryDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = draggedCategoryIndex;
    if (draggedIndex !== null && draggedIndex !== index) {
      const newOrder = [...orderedCategories];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedCategories(newOrder);
      setDraggedCategoryIndex(index);
    }
  };

  const handleCategoryDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = draggedCategoryIndex;
    if (draggedIndex !== null && draggedIndex !== index) {
      const newOrder = [...orderedCategories];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedCategories(newOrder);
      saveCategoryOrder(newOrder);
    }
    setDraggedCategoryIndex(null);
  };

  // 필터링된 카테고리 목록
  const filteredCategories = selectedCategory
    ? orderedCategories.filter((cat) => cat.id === selectedCategory)
    : orderedCategories;

  return (
    <div className="overflow-auto">
      <div className="min-w-full inline-block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 min-w-[200px]">
                Entity
              </th>
              <th className="border border-gray-300 px-3 py-3 text-center font-semibold text-gray-900 min-w-[90px] bg-gray-50 text-xs">
                현황
              </th>
              {filteredCategories.map((category, index) => {
                const originalIndex = orderedCategories.findIndex((c) => c.id === category.id);
                return (
                <th
                  key={category.id}
                  draggable
                  onDragStart={(e) => handleCategoryDragStart(e, originalIndex)}
                  onDragEnd={handleCategoryDragEnd}
                  onDragOver={(e) => handleCategoryDragOver(e, originalIndex)}
                  onDrop={(e) => handleCategoryDrop(e, originalIndex)}
                  className={cn(
                    'border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 min-w-[120px] cursor-move',
                    draggedCategoryIndex === originalIndex && 'opacity-50',
                    selectedCategory === category.id && 'bg-blue-50 border-blue-300'
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-3 h-3 text-gray-400" />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                    </div>
                    <span className="text-xs">{category.label}</span>
                  </div>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {orderedSubsidiaries.map((subsidiary, entityIndex) => (
              <tr 
                key={subsidiary.id} 
                className="hover:bg-gray-50"
                draggable
                onDragStart={(e) => handleEntityDragStart(e, entityIndex)}
                onDragEnd={handleEntityDragEnd}
                onDragOver={(e) => handleEntityDragOver(e, entityIndex)}
                onDrop={(e) => handleEntityDrop(e, entityIndex)}
              >
                <td
                  className={cn(
                    'sticky left-0 z-10 bg-white border border-gray-300 px-4 py-3 font-medium text-gray-900 cursor-move',
                    draggedEntityIndex === entityIndex && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span>{subsidiary.name}</span>
                  </div>
                </td>
                {/* 법인별 현황 요약 컬럼 */}
                {(() => {
                  const summary = getSubsidiarySummary(subsidiary.id);
                  return (
                    <td className="border border-gray-300 px-3 py-3 text-xs bg-gray-50">
                      <div className="flex flex-col gap-0.5 items-center">
                        <span className="text-green-700 font-semibold">✓ {summary.submitted}</span>
                        {summary.overdue > 0 && (
                          <span className="text-red-600 font-semibold">! {summary.overdue}</span>
                        )}
                        <span className="text-gray-400">○ {summary.pending}</span>
                      </div>
                    </td>
                  );
                })()}
                {filteredCategories.map((category) => {
                  const itemStatus = getScheduleItemStatus(subsidiary.id, category.id);

                  let backgroundColor: string;
                  let statusTitle: string;

                  if (itemStatus === 'confirmed') {
                    backgroundColor = '#16a34a';
                    statusTitle = '확정';
                  } else if (itemStatus === 'planned') {
                    backgroundColor = '#2563eb';
                    statusTitle = '검토중';
                  } else {
                    backgroundColor = '#9ca3af';
                    statusTitle = '미제출';
                  }

                  return (
                    <td
                      key={category.id}
                      className="border border-gray-300 px-4 py-3 text-center"
                    >
                      <div className="flex items-center justify-center">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor }}
                          title={statusTitle}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
