'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Issue } from '@/lib/types/issue';

interface AuthorFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAuthors: string[];
  issues: Issue[];
  onApply: (authors: string[]) => void;
}

export function AuthorFilterDialog({
  open,
  onOpenChange,
  selectedAuthors,
  issues,
  onApply,
}: AuthorFilterDialogProps) {
  const [tempSelected, setTempSelected] = useState<string[]>(selectedAuthors);
  const [search, setSearch] = useState('');

  // issues에서 고유한 작성자 목록 추출
  const uniqueAuthors = Array.from(new Set(issues.map((issue) => issue.created_by).filter(Boolean))).sort();

  useEffect(() => {
    setTempSelected(selectedAuthors);
  }, [selectedAuthors, open]);

  const handleToggle = (author: string) => {
    if (tempSelected.includes(author)) {
      setTempSelected(tempSelected.filter((a) => a !== author));
    } else {
      setTempSelected([...tempSelected, author]);
    }
  };

  const handleApply = () => {
    onApply(tempSelected);
    onOpenChange(false);
  };

  const handleClear = () => {
    setTempSelected([]);
  };

  // 검색 필터
  const filteredAuthors = uniqueAuthors.filter((author) =>
    author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>작성자 필터</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* 검색 */}
          <Input
            placeholder="작성자 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* 작성자 목록 */}
          <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
            {filteredAuthors.length === 0 ? (
              <div className="col-span-2 text-center text-gray-500 py-8">
                {search ? '검색 결과가 없습니다' : '작성자가 없습니다'}
              </div>
            ) : (
              filteredAuthors.map((author) => {
                const isChecked = tempSelected.includes(author);
                const count = issues.filter((issue) => issue.created_by === author).length;

                return (
                  <div
                    key={author}
                    className="flex items-center justify-between space-x-3 p-3 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <Checkbox
                        id={`author-${author}`}
                        checked={isChecked}
                        onCheckedChange={() => handleToggle(author)}
                      />
                      <Label
                        htmlFor={`author-${author}`}
                        className="cursor-pointer flex-1"
                        title={author}
                      >
                        {author}
                      </Label>
                    </div>
                    <span className="text-sm text-gray-500">({count})</span>
                  </div>
                );
              })
            )}
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
