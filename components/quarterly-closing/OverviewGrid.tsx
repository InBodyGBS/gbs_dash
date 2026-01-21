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
  // 디버깅: scheduleItems와 submissions 데이터 확인
  useEffect(() => {
    const employeeJdItems = scheduleItems.filter(item => item.category === 'employee-jd');
    const employeeJdSubmissions = submissions.filter(sub => sub.category === 'employee-jd');
    
    console.log(`📊 OverviewGrid 데이터 확인:`, {
      quarterId: quarter.id,
      scheduleItemsCount: scheduleItems.length,
      submissionsCount: submissions.length,
      employeeJdItemsCount: employeeJdItems.length,
      employeeJdSubmissionsCount: employeeJdSubmissions.length,
      employeeJdItems: employeeJdItems.map(item => ({
        id: item.id,
        quarter_id: item.quarter_id,
        subsidiary_id: item.subsidiary_id,
        category: item.category,
        status: item.status,
      })),
      employeeJdSubmissions: employeeJdSubmissions.map(s => ({
        id: s.id,
        quarter_id: s.quarter_id,
        subsidiary_id: s.subsidiary_id,
        category: s.category,
      })),
      allScheduleItems: scheduleItems.map(item => ({
        id: item.id,
        quarter_id: item.quarter_id,
        subsidiary_id: item.subsidiary_id,
        category: item.category,
        status: item.status,
      })),
      subsidiaries: subsidiaries.map(s => ({ id: s.id, name: s.name })),
    });
  }, [scheduleItems, submissions, subsidiaries, quarter]);
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
        item.category === categoryId
        // quarter_id 비교 제거: Submissions는 fiscalQuarterId를, ScheduleItems는 workPeriod의 quarter_id를 사용하므로
    );
  };

  // ScheduleItem의 status 확인 (Calendar 로직과 동일)
  const getScheduleItemStatus = (subsidiaryId: string, categoryId: string): 'confirmed' | 'planned' | null => {
    // 모든 ScheduleItem 확인 (quarter_id 무관)
    const matchingItems = scheduleItems.filter(
      (item) =>
        item.subsidiary_id === subsidiaryId &&
        item.category === categoryId
    );
    
    if (matchingItems.length === 0) {
      return null;
    }
    
    // 여러 개가 있을 경우, 'confirmed' 상태인 항목을 우선 선택
    // 없으면 가장 최근 항목 사용 (updated_at 기준)
    const confirmedItem = matchingItems.find(item => item.status === 'confirmed');
    const item = confirmedItem || matchingItems[0];
    
    // 디버깅 로그 (employee-jd 카테고리만)
    if (categoryId === 'employee-jd' && matchingItems.length > 0) {
      console.log(`🔍 OverviewGrid getScheduleItemStatus [${categoryId}]:`, {
        subsidiaryId,
        categoryId,
        quarterId: quarter.id,
        totalScheduleItems: scheduleItems.length,
        matchingItemsCount: matchingItems.length,
        matchingItems: matchingItems.map(i => ({
          id: i.id,
          quarter_id: i.quarter_id,
          status: i.status,
          subsidiary_id: i.subsidiary_id,
          category: i.category,
          updated_at: i.updated_at,
        })),
        foundItem: item ? { id: item.id, status: item.status } : null,
        hasConfirmed: !!confirmedItem,
      });
    }
    
    return item.status === 'confirmed' ? 'confirmed' : 'planned';
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
                  // Calendar 로직과 동일: ScheduleItem의 status를 확인
                  const itemStatus = getScheduleItemStatus(subsidiary.id, category.id);
                  
                  // 디버깅: 특정 케이스 로깅 (employee-jd 카테고리만)
                  if (category.id === 'employee-jd' && (subsidiary.name.includes('BWA') || subsidiary.name.includes('Asia') || subsidiary.name.includes('Turkey'))) {
                    const allEmployeeJdItems = scheduleItems.filter(item => item.category === 'employee-jd');
                    const matchingItems = scheduleItems.filter(
                      item => item.subsidiary_id === subsidiary.id && item.category === category.id
                    );
                    
                    console.log(`🔍 OverviewGrid 상태 확인 [${subsidiary.name} - ${category.id}]:`, {
                      subsidiaryId: subsidiary.id,
                      subsidiaryName: subsidiary.name,
                      categoryId: category.id,
                      itemStatus,
                      totalScheduleItems: scheduleItems.length,
                      allEmployeeJdItemsCount: allEmployeeJdItems.length,
                      allEmployeeJdItems: allEmployeeJdItems.map(item => ({
                        id: item.id,
                        quarter_id: item.quarter_id,
                        subsidiary_id: item.subsidiary_id,
                        status: item.status,
                      })),
                      matchingItemsCount: matchingItems.length,
                      matchingItems: matchingItems.map(item => ({
                        id: item.id,
                        quarter_id: item.quarter_id,
                        subsidiary_id: item.subsidiary_id,
                        status: item.status,
                      })),
                      matchingSubmissions: submissions.filter(
                        sub => sub.subsidiary_id === subsidiary.id && sub.category === category.id
                      ).map(sub => ({
                        id: sub.id,
                        quarter_id: sub.quarter_id,
                        subsidiary_id: sub.subsidiary_id,
                      })),
                    });
                  }
                  
                  // 렌더링 시점에 실제 itemStatus 값 확인 (디버깅)
                  const actualStatus = itemStatus;
                  
                  // 상태에 따른 색상 결정 (인라인 스타일 사용)
                  let backgroundColor: string;
                  let statusTitle: string;
                  
                  if (actualStatus === 'confirmed') {
                    backgroundColor = '#16a34a'; // green-600
                    statusTitle = '확정';
                  } else if (actualStatus === 'planned') {
                    backgroundColor = '#2563eb'; // blue-600
                    statusTitle = '검토중';
                  } else {
                    backgroundColor = '#9ca3af'; // gray-400
                    statusTitle = '미제출';
                  }
                  
                  if (category.id === 'employee-jd' && (subsidiary.name.includes('BWA') || subsidiary.name.includes('Asia') || subsidiary.name.includes('Turkey'))) {
                    console.log(`🎨 OverviewGrid 렌더링 [${subsidiary.name} - ${category.id}]:`, {
                      itemStatus: actualStatus,
                      backgroundColor,
                      statusTitle,
                      willRenderGreen: actualStatus === 'confirmed',
                      willRenderBlue: actualStatus === 'planned',
                      willRenderGray: actualStatus === null,
                    });
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
