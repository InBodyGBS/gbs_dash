'use client';

/**
 * 제출 현황 필터 컴포넌트
 * Overview 페이지에 Entity 및 카테고리 필터를 드롭다운으로 제공
 */

import { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { DocumentSubmission } from '@/lib/types/quarterly-closing';
import type { Subsidiary } from '@/lib/supabase/types';
import type { ClosingCategory } from '@/lib/constants/closing-categories';

interface SubmissionSummaryProps {
  submissions: DocumentSubmission[];
  subsidiaries: Subsidiary[];
  activeCategories: ClosingCategory[];
  onEntityFilter?: (subsidiaryId: string | null) => void;
  onCategoryFilter?: (categoryId: string | null) => void;
  selectedEntityId?: string | null;
  selectedCategoryId?: string | null;
}

export function SubmissionSummary({ 
  submissions, 
  subsidiaries,
  activeCategories,
  onEntityFilter,
  onCategoryFilter,
  selectedEntityId,
  selectedCategoryId,
}: SubmissionSummaryProps) {
  // Entity별 제출 건수 계산
  const entityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    subsidiaries.forEach((sub) => {
      counts.set(sub.id, 0);
    });
    submissions.forEach((sub) => {
      if (sub.subsidiary_id) {
        const count = counts.get(sub.subsidiary_id) || 0;
        counts.set(sub.subsidiary_id, count + 1);
      }
    });
    return counts;
  }, [submissions, subsidiaries]);

  // 카테고리별 제출 건수 계산
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    activeCategories.forEach((cat) => {
      counts.set(cat.id, 0);
    });
    submissions.forEach((sub) => {
      const count = counts.get(sub.category) || 0;
      counts.set(sub.category, count + 1);
    });
    return counts;
  }, [submissions, activeCategories]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">필터:</span>
        </div>

        {/* Entity 필터 */}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-600 whitespace-nowrap">Entity:</Label>
          <Select
            value={selectedEntityId || 'all'}
            onValueChange={(value) => onEntityFilter?.(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {subsidiaries.map((sub) => {
                const count = entityCounts.get(sub.id) || 0;
                return (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name.replace('InBody ', '')} ({count}건)
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-600 whitespace-nowrap">카테고리:</Label>
          <Select
            value={selectedCategoryId || 'all'}
            onValueChange={(value) => onCategoryFilter?.(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {activeCategories.map((cat) => {
                const count = categoryCounts.get(cat.id) || 0;
                return (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.label} ({count}건)</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 필터 초기화 버튼 */}
        {(selectedEntityId || selectedCategoryId) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onEntityFilter?.(null);
              onCategoryFilter?.(null);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  );
}
