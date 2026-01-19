'use client';

/**
 * 카테고리 바 컴포넌트
 * 카테고리를 가로로 배치하여 상단에 표시
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CategoryBarProps {
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string) => void;
  onItemDelete?: (itemId: string) => void;
}

export const CategoryBar = ({
  selectedCategory,
  onCategorySelect,
  onItemDelete,
}: CategoryBarProps) => {
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [isDraggingOverTrash, setIsDraggingOverTrash] = useState(false);

  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategory(categoryId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('categoryId', categoryId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedCategory(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">카테고리:</span>
      <div className="flex items-center gap-2 flex-wrap">
        {CLOSING_CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.id;
          const isDragging = draggedCategory === category.id;

          return (
            <Button
              key={category.id}
              variant={isSelected ? 'default' : 'outline'}
              draggable
              onDragStart={(e) => handleDragStart(e, category.id)}
              onDragEnd={handleDragEnd}
              size="sm"
              className={cn(
                'h-8 px-3 transition-all cursor-grab active:cursor-grabbing',
                isSelected && 'ring-2 ring-offset-1',
                isDragging && 'opacity-50'
              )}
              style={{
                backgroundColor: isSelected ? category.color : undefined,
                borderColor: !isSelected ? category.color : undefined,
                color: isSelected ? 'white' : category.color,
              }}
              onClick={() => {
                onCategorySelect(category.id);
              }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? 'white' : category.color }}
                />
                <span className="text-xs font-medium">{category.label}</span>
              </div>
            </Button>
          );
        })}
      </div>

      {/* 휴지통 삭제 영역 */}
      <div
        className={cn(
          'flex items-center justify-center gap-3 px-6 py-3 rounded border-2 border-dashed transition-all ml-2',
          isDraggingOverTrash
            ? 'bg-red-100 border-red-400'
            : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const itemId = e.dataTransfer.getData('itemId');
          if (itemId) {
            e.dataTransfer.dropEffect = 'move';
            setIsDraggingOverTrash(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingOverTrash(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOverTrash(false);
          
          const itemId = e.dataTransfer.getData('itemId');
          if (itemId && onItemDelete) {
            onItemDelete(itemId);
          }
        }}
      >
        <Trash2 
          className={cn(
            'w-8 h-8 transition-colors',
            isDraggingOverTrash ? 'text-red-600' : 'text-gray-400'
          )} 
        />
        <span className={cn(
          'text-base font-medium',
          isDraggingOverTrash ? 'text-red-600' : 'text-gray-600'
        )}>
          삭제
        </span>
      </div>
    </div>
  );
};
