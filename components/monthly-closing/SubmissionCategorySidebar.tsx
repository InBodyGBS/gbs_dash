'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MONTHLY_CLOSING_CATEGORIES,
  MonthlyClosingCategoryId,
} from '@/lib/constants/monthly-closing-categories';
import { downloadMonthlySubmissionTemplate } from '@/lib/utils/monthlySubmissionTemplate';
import { toast } from 'sonner';

interface SubmissionCategorySidebarProps {
  selectedCategory: MonthlyClosingCategoryId;
  onCategorySelect: (category: MonthlyClosingCategoryId) => void;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export function SubmissionCategorySidebar({
  selectedCategory,
  onCategorySelect,
}: SubmissionCategorySidebarProps) {
  const handleTemplateDownload = async (categoryId: MonthlyClosingCategoryId, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await downloadMonthlySubmissionTemplate(categoryId);
      const category = MONTHLY_CLOSING_CATEGORIES.find((cat) => cat.id === categoryId);
      toast.success('템플릿 다운로드 완료', {
        description: `${category?.label || categoryId} 템플릿이 다운로드되었습니다.`,
      });
    } catch (error: unknown) {
      toast.error('템플릿 다운로드 실패', {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">카테고리</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {MONTHLY_CLOSING_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <div
                key={category.id}
                className={cn(
                  'group relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
                  isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                )}
                onClick={() => onCategorySelect(category.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium truncate',
                      isSelected ? 'text-gray-900' : 'text-gray-700'
                    )}
                  >
                    {category.label}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => handleTemplateDownload(category.id, e)}
                  title="템플릿 다운로드"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

