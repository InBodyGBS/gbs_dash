'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ISSUE_CATEGORIES, CATEGORY_COLORS } from '@/lib/constants/issue-categories';
import type { IssueCategory } from '@/lib/types/issue';

interface CategoryFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategories: IssueCategory[];
  onApply: (categories: IssueCategory[]) => void;
}

export function CategoryFilterDialog({
  open,
  onOpenChange,
  selectedCategories,
  onApply,
}: CategoryFilterDialogProps) {
  const [tempSelected, setTempSelected] = useState<IssueCategory[]>(selectedCategories);

  const handleToggle = (category: IssueCategory) => {
    if (tempSelected.includes(category)) {
      setTempSelected(tempSelected.filter((c) => c !== category));
    } else {
      setTempSelected([...tempSelected, category]);
    }
  };

  const handleApply = () => {
    onApply(tempSelected);
    onOpenChange(false);
  };

  const handleClear = () => {
    setTempSelected([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>카테고리 필터</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="grid grid-cols-2 gap-4">
            {ISSUE_CATEGORIES.map((category) => {
              const isChecked = tempSelected.includes(category);
              const categoryColor = CATEGORY_COLORS[category];

              return (
                <div key={category} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id={`category-${category}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(category)}
                  />
                  <Label
                    htmlFor={`category-${category}`}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: categoryColor }}
                    />
                    <span>{category}</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClear}>
            전체 해제
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleApply}>
              적용 ({tempSelected.length}개 선택)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

