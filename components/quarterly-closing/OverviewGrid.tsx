'use client';

/**
 * Overview 그리드 컴포넌트
 * Entity가 행, 카테고리가 열로 표시
 * 제출 여부에 따라 초록불/빨간불 표시
 */

import { useState, useEffect, useMemo } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter, ScheduleItem, DocumentSubmission } from '@/lib/types/quarterly-closing';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';

const ENTITY_ORDER_KEY = 'quarterly-closing-entity-order';
const CATEGORY_ORDER_KEY = 'quarterly-closing-overview-category-order';

interface OverviewGridProps {
  quarter: Quarter;
  subsidiaries: Subsidiary[];
  scheduleItems: ScheduleItem[];
  submissions: DocumentSubmission[];
  onEntityOrderChange?: (newOrder: Subsidiary[]) => void;
  onCategoryOrderChange?: (newOrder: typeof CLOSING_CATEGORIES) => void;
}

export const OverviewGrid = ({
  quarter,
  subsidiaries,
  scheduleItems,
  submissions,
  onEntityOrderChange,
  onCategoryOrderChange,
}: OverviewGridProps) => {
  // Entity 순서 관리
  const [orderedSubsidiaries, setOrderedSubsidiaries] = useState<Subsidiary[]>(subsidiaries);
  const [draggedEntityIndex, setDraggedEntityIndex] = useState<number | null>(null);

  // 카테고리 순서 관리
  const [orderedCategories, setOrderedCategories] = useState<typeof CLOSING_CATEGORIES>(CLOSING_CATEGORIES);
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
  const saveCategoryOrder = (order: typeof CLOSING_CATEGORIES) => {
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
        item.category === categoryId &&
        item.quarter_id === quarter.id
    );
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

  return (
    <div className="overflow-auto">
      <div className="min-w-full inline-block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 min-w-[200px]">
                Entity
              </th>
              {orderedCategories.map((category, index) => (
                <th
                  key={category.id}
                  draggable
                  onDragStart={(e) => handleCategoryDragStart(e, index)}
                  onDragEnd={handleCategoryDragEnd}
                  onDragOver={(e) => handleCategoryDragOver(e, index)}
                  onDrop={(e) => handleCategoryDrop(e, index)}
                  className={cn(
                    'border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 min-w-[120px] cursor-move',
                    draggedCategoryIndex === index && 'opacity-50'
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
              ))}
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
                {orderedCategories.map((category) => {
                  const hasItem = hasScheduleItem(subsidiary.id, category.id);
                  return (
                    <td
                      key={category.id}
                      className="border border-gray-300 px-4 py-3 text-center"
                    >
                      {hasItem ? (
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-red-600" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-gray-400" />
                        </div>
                      )}
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
