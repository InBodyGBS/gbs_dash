'use client';

/**
 * Overview 그리드 컴포넌트
 * Entity가 행, 카테고리가 열로 표시
 * 제출 여부에 따라 회색(미제출)/파란색(검토중)/초록색(확정) 원형 표시
 */

import { useState, useEffect } from 'react';
import { GripVertical, MessageSquare, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter, ScheduleItem, DocumentSubmission } from '@/lib/types/quarterly-closing';
import type { ClosingCategory } from '@/lib/constants/closing-categories';
import type { ReviewStatus } from '@/lib/types/category-review';
import { getCategoryReviewStatuses, upsertCategoryReviewStatus } from '@/lib/services/categoryReviewService';
import { ReviewCommentDialog } from './ReviewCommentDialog';

const CATEGORY_ORDER_KEY = 'quarterly-closing-overview-category-order';

interface OverviewGridProps {
  quarter: Quarter;
  subsidiaries: Subsidiary[];
  scheduleItems: ScheduleItem[];
  submissions: DocumentSubmission[];
  /** 표시·드래그 순서 기준 카테고리 (귀속 월별 세트) */
  categories: ClosingCategory[];
  periodLabel: string;
  selectedCategory?: string | null;
  onEntityOrderChange?: (newOrder: Subsidiary[]) => void;
  onCategoryOrderChange?: (newOrder: ClosingCategory[]) => void;
}

/** review status 맵의 키: `${subsidiaryId}__${categoryId}` */
const reviewKey = (subsidiaryId: string, categoryId: string) => `${subsidiaryId}__${categoryId}`;

export const OverviewGrid = ({
  quarter,
  subsidiaries,
  scheduleItems,
  categories,
  periodLabel,
  selectedCategory,
  onEntityOrderChange,
  onCategoryOrderChange,
}: OverviewGridProps) => {
  const [orderedSubsidiaries, setOrderedSubsidiaries] = useState<Subsidiary[]>(subsidiaries);
  const [draggedEntityIndex, setDraggedEntityIndex] = useState<number | null>(null);
  const [orderedCategories, setOrderedCategories] = useState<ClosingCategory[]>([...categories]);
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);

  /** 셀별 review status 맵 */
  const [reviewMap, setReviewMap] = useState<Map<string, ReviewStatus>>(new Map());
  const [reviewSaving, setReviewSaving] = useState<Set<string>>(new Set());

  /** 코멘트 다이얼로그 상태 */
  const [commentDialog, setCommentDialog] = useState<{
    subsidiaryId: string;
    subsidiaryName: string;
    categoryId: string;
    categoryLabel: string;
  } | null>(null);

  const categoryIdsKey = categories.map((c) => c.id).join(',');

  // 카테고리 세트가 바뀌면 순서 복원(로컬 스토리지 기준) 또는 기본 순서
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedOrder = localStorage.getItem(CATEGORY_ORDER_KEY);
      if (savedOrder) {
        const order: string[] = JSON.parse(savedOrder);
        const ordered = [...categories].sort((a, b) => {
          const ia = order.indexOf(a.id);
          const ib = order.indexOf(b.id);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        setOrderedCategories(ordered);
      } else {
        setOrderedCategories([...categories]);
      }
    } catch {
      setOrderedCategories([...categories]);
    }
  }, [categoryIdsKey, categories]);

  useEffect(() => { setOrderedSubsidiaries(subsidiaries); }, [subsidiaries]);

  // Review status 로드
  useEffect(() => {
    if (!quarter?.id) return;
    getCategoryReviewStatuses(quarter.id)
      .then((list) => {
        const map = new Map<string, ReviewStatus>();
        list.forEach((r) => map.set(reviewKey(r.subsidiary_id, r.category), r.status));
        setReviewMap(map);
      })
      .catch(() => { /* 테이블 없으면 무시 */ });
  }, [quarter?.id]);

  const saveCategoryOrder = (order: ClosingCategory[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(order.map((c) => c.id)));
      onCategoryOrderChange?.(order);
      toast.success('카테고리 순서가 저장되었습니다.');
    } catch { /* ignore */ }
  };

  const getScheduleItemStatus = (subsidiaryId: string, categoryId: string): 'confirmed' | 'planned' | null => {
    const items = scheduleItems.filter((i) => i.subsidiary_id === subsidiaryId && i.category === categoryId);
    if (!items.length) return null;
    return items.find((i) => i.status === 'confirmed') ? 'confirmed' : 'planned';
  };

  const getSubsidiarySummary = (subsidiaryId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const items = scheduleItems.filter((i) => i.subsidiary_id === subsidiaryId);
    return {
      submitted: items.filter((i) => i.status === 'confirmed').length,
      overdue: items.filter((i) => i.status === 'planned' && i.planned_date < today).length,
      pending: items.filter((i) => i.status === 'planned' && i.planned_date >= today).length,
    };
  };

  /** Review status 토글 */
  const handleReviewToggle = async (
    subsidiaryId: string,
    subsidiaryName: string,
    categoryId: string,
    categoryLabel: string,
    targetStatus: ReviewStatus
  ) => {
    const key = reviewKey(subsidiaryId, categoryId);
    const current = reviewMap.get(key) ?? 'none';
    // 같은 버튼 재클릭 시 → none으로 해제
    const next: ReviewStatus = current === targetStatus ? 'none' : targetStatus;

    setReviewSaving((prev) => new Set(prev).add(key));
    try {
      await upsertCategoryReviewStatus(quarter.id, subsidiaryId, categoryId, next);
      setReviewMap((prev) => new Map(prev).set(key, next));

      // Reviewing 으로 변경 시 코멘트 다이얼로그 오픈
      if (next === 'reviewing') {
        setCommentDialog({ subsidiaryId, subsidiaryName, categoryId, categoryLabel });
      }
    } catch {
      toast.error('저장 실패');
    } finally {
      setReviewSaving((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  // ── 드래그 핸들러 ──────────────────────────────────────────────

  const handleEntityDragStart = (e: React.DragEvent, index: number) => {
    setDraggedEntityIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };
  const handleEntityDragEnd = (e: React.DragEvent) => {
    setDraggedEntityIndex(null);
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };
  const handleEntityDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedEntityIndex !== null && draggedEntityIndex !== index) {
      const next = [...orderedSubsidiaries];
      [next[draggedEntityIndex], next[index]] = [next[index], next[draggedEntityIndex]];
      setOrderedSubsidiaries(next);
      setDraggedEntityIndex(index);
    }
  };
  const handleEntityDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedEntityIndex !== null && draggedEntityIndex !== index) {
      const next = [...orderedSubsidiaries];
      [next[draggedEntityIndex], next[index]] = [next[index], next[draggedEntityIndex]];
      setOrderedSubsidiaries(next);
      onEntityOrderChange?.(next);
    }
    setDraggedEntityIndex(null);
  };

  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };
  const handleCategoryDragEnd = (e: React.DragEvent) => {
    setDraggedCategoryIndex(null);
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };
  const handleCategoryDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedCategoryIndex !== null && draggedCategoryIndex !== index) {
      const next = [...orderedCategories];
      [next[draggedCategoryIndex], next[index]] = [next[index], next[draggedCategoryIndex]];
      setOrderedCategories(next);
      setDraggedCategoryIndex(index);
    }
  };
  const handleCategoryDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedCategoryIndex !== null && draggedCategoryIndex !== index) {
      const next = [...orderedCategories];
      [next[draggedCategoryIndex], next[index]] = [next[index], next[draggedCategoryIndex]];
      setOrderedCategories(next);
      saveCategoryOrder(next);
    }
    setDraggedCategoryIndex(null);
  };

  const filteredCategories = selectedCategory
    ? orderedCategories.filter((c) => c.id === selectedCategory)
    : orderedCategories;

  return (
    <>
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
                {filteredCategories.map((category) => {
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
                        'border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 min-w-[140px] cursor-move',
                        draggedCategoryIndex === originalIndex && 'opacity-50',
                        selectedCategory === category.id && 'bg-blue-50 border-blue-300'
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3 h-3 text-gray-400" />
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
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

                  {/* 현황 요약 */}
                  {(() => {
                    const s = getSubsidiarySummary(subsidiary.id);
                    return (
                      <td className="border border-gray-300 px-3 py-3 text-xs bg-gray-50">
                        <div className="flex flex-col gap-0.5 items-center">
                          <span className="text-green-700 font-semibold">✓ {s.submitted}</span>
                          {s.overdue > 0 && <span className="text-red-600 font-semibold">! {s.overdue}</span>}
                          <span className="text-gray-400">○ {s.pending}</span>
                        </div>
                      </td>
                    );
                  })()}

                  {/* 카테고리별 셀 */}
                  {filteredCategories.map((category) => {
                    const itemStatus = getScheduleItemStatus(subsidiary.id, category.id);
                    const key = reviewKey(subsidiary.id, category.id);
                    const reviewStatus = reviewMap.get(key) ?? 'none';
                    const isSaving = reviewSaving.has(key);

                    let dotColor: string;
                    if (itemStatus === 'confirmed') dotColor = '#16a34a';
                    else if (itemStatus === 'planned') dotColor = '#2563eb';
                    else dotColor = '#9ca3af';

                    return (
                      <td
                        key={category.id}
                        className={cn(
                          'border border-gray-300 px-3 py-2 text-center',
                          reviewStatus === 'reviewing' && 'bg-yellow-50',
                          reviewStatus === 'confirmed' && 'bg-green-50',
                        )}
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          {/* 제출 상태 dot */}
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: dotColor }} />

                          {/* Review 버튼 */}
                          <div className="flex gap-1">
                            {/* Reviewing 버튼 */}
                            <button
                              disabled={isSaving}
                              onClick={() => handleReviewToggle(
                                subsidiary.id,
                                subsidiary.name,
                                category.id,
                                category.label,
                                'reviewing'
                              )}
                              title={reviewStatus === 'reviewing' ? 'Reviewing 해제' : 'Reviewing 설정'}
                              className={cn(
                                'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium transition-colors',
                                reviewStatus === 'reviewing'
                                  ? 'bg-yellow-400 text-white'
                                  : 'bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-700',
                                isSaving && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <MessageSquare className="w-2.5 h-2.5" />
                              R
                            </button>

                            {/* Confirm 버튼 */}
                            <button
                              disabled={isSaving}
                              onClick={() => handleReviewToggle(
                                subsidiary.id,
                                subsidiary.name,
                                category.id,
                                category.label,
                                'confirmed'
                              )}
                              title={reviewStatus === 'confirmed' ? 'Confirm 해제' : 'Confirm 설정'}
                              className={cn(
                                'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium transition-colors',
                                reviewStatus === 'confirmed'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700',
                                isSaving && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <CheckCheck className="w-2.5 h-2.5" />
                              C
                            </button>
                          </div>

                          {/* 추가 코멘트 아이콘 (Reviewing 상태일 때) */}
                          {reviewStatus === 'reviewing' && (
                            <button
                              onClick={() => setCommentDialog({
                                subsidiaryId: subsidiary.id,
                                subsidiaryName: subsidiary.name,
                                categoryId: category.id,
                                categoryLabel: category.label,
                              })}
                              title="추가 문의 전송"
                              className="text-yellow-600 hover:text-yellow-800 transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                          )}
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

      {/* 코멘트 다이얼로그 */}
      {commentDialog && (
        <ReviewCommentDialog
          open={!!commentDialog}
          onClose={() => setCommentDialog(null)}
          onSubmitted={() => toast.success('문의가 법인 VOE에 전송되었습니다.')}
          entityName={commentDialog.subsidiaryName}
          categoryLabel={commentDialog.categoryLabel}
          categoryId={commentDialog.categoryId}
          quarterId={quarter.id}
          quarterLabel={periodLabel}
        />
      )}
    </>
  );
};
