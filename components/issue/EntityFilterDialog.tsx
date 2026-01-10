'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Subsidiary } from '@/lib/supabase/types';

interface EntityFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntities: string[];
  subsidiaries: Subsidiary[];
  onApply: (entityIds: string[]) => void;
}

export function EntityFilterDialog({
  open,
  onOpenChange,
  selectedEntities,
  subsidiaries,
  onApply,
}: EntityFilterDialogProps) {
  const [tempSelected, setTempSelected] = useState<string[]>(selectedEntities);
  const [search, setSearch] = useState('');

  const handleToggle = (entityId: string) => {
    if (tempSelected.includes(entityId)) {
      setTempSelected(tempSelected.filter((id) => id !== entityId));
    } else {
      setTempSelected([...tempSelected, entityId]);
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
  const filteredSubsidiaries = subsidiaries.filter((sub) =>
    sub.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entity 필터</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* 검색 */}
          <Input
            placeholder="법인명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* 법인 목록 */}
          <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
            {filteredSubsidiaries.map((subsidiary) => {
              const isChecked = tempSelected.includes(subsidiary.id);
              // "InBody " 제거
              let displayName = subsidiary.name.replace('InBody ', '');
              if (subsidiary.name === 'InBody Healthcare') {
                displayName = 'IHC';
              }

              return (
                <div
                  key={subsidiary.id}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50"
                >
                  <Checkbox
                    id={`entity-${subsidiary.id}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(subsidiary.id)}
                  />
                  <Label
                    htmlFor={`entity-${subsidiary.id}`}
                    className="cursor-pointer flex-1"
                    title={subsidiary.name}
                  >
                    {displayName}
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

