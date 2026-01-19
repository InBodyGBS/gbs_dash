'use client';

/**
 * Overview 그리드 컴포넌트
 * Entity가 행, 카테고리가 열로 표시
 * 제출 여부에 따라 파란색(제출)/빨간색(미제출)/회색(검토중) 원형 표시
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
  selectedCategory?: string | null;
  onEntityOrderChange?: (newOrder: Subsidiary[]) => void;
  onCategoryOrderChange?: (newOrder: typeof CLOSING_CATEGORIES) => void;
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
  // 디버깅: submissions 데이터 확인
  useEffect(() => {
    if (submissions.length > 0) {
      console.log(`📊 OverviewGrid submissions:`, {
        totalCount: submissions.length,
        submissions: submissions.map(s => ({
          id: s.id,
          category: s.category,
          subsidiary_id: s.subsidiary_id,
          file_name: s.file_name,
        })),
        subsidiaries: subsidiaries.map(s => ({ id: s.id, name: s.name })),
      });
    } else {
      console.log(`⚠️ OverviewGrid submissions: 빈 배열`);
    }
  }, [submissions, subsidiaries]);
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

  // 제출 여부 확인 (submissions에 항목이 있는지)
  const hasSubmission = (subsidiaryId: string, categoryId: string): boolean => {
    const found = submissions.some(
      (sub) =>
        sub.subsidiary_id === subsidiaryId &&
        sub.category === categoryId
    );
    
    // 디버깅 로그 (첫 번째 호출 시만)
    if (subsidiaryId && categoryId && submissions.length > 0) {
      const matchingSubs = submissions.filter(
        (sub) => sub.subsidiary_id === subsidiaryId && sub.category === categoryId
      );
      if (matchingSubs.length > 0) {
        console.log(`✅ 제출 발견:`, {
          subsidiaryId,
          categoryId,
          submissions: matchingSubs.map(s => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            file_name: s.file_name,
          })),
        });
      }
    }
    
    return found;
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
                {filteredCategories.map((category) => {
                  const hasItem = hasScheduleItem(subsidiary.id, category.id);
                  const hasSub = hasSubmission(subsidiary.id, category.id);
                  return (
                    <td
                      key={category.id}
                      className="border border-gray-300 px-4 py-3 text-center"
                    >
                      {hasSub ? (
                        // 제출됨: 파란색 원형
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-blue-600" title="제출 완료" />
                        </div>
                      ) : hasItem ? (
                        // 미제출: 빨간색 원형
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-red-600" title="미제출" />
                        </div>
                      ) : (
                        // 검토중: 회색 원형
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-gray-400" title="검토중" />
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
