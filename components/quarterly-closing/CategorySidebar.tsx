'use client';

/**
 * 카테고리 사이드바 컴포넌트
 * 10개 결산 카테고리를 드래그 가능한 버튼으로 표시
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CategorySidebarProps {
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string) => void;
  onItemDelete?: (itemId: string) => void;
}

export const CategorySidebar = ({
  selectedCategory,
  onCategorySelect,
  onItemDelete,
}: CategorySidebarProps) => {
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [isDraggingOverTrash, setIsDraggingOverTrash] = useState(false);

  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategory(categoryId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('categoryId', categoryId);
    // 드래그 중인 요소에 스타일 적용
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedCategory(null);
    // 드래그 종료 시 스타일 복원
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  return (
    <div className="w-64 border-r border-gray-200 p-4 bg-white">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span>📋</span>
        <span>카테고리</span>
      </h3>

      <p className="text-xs text-gray-500 mb-3">
        카테고리를 드래그하여 그리드에 추가하세요
      </p>

      <div className="space-y-2">
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
              className={cn(
                'w-full justify-start text-left h-auto py-3 px-4 transition-all cursor-grab active:cursor-grabbing',
                isSelected && 'ring-2 ring-offset-2',
                isDragging && 'opacity-50'
              )}
              style={{
                backgroundColor: isSelected ? category.color : undefined,
                borderColor: !isSelected ? category.color : undefined,
                color: isSelected ? 'white' : category.color,
              }}
              onClick={() => {
                console.log('🏷️ 카테고리 선택:', category.id, category.label);
                onCategorySelect(category.id);
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm font-medium">{category.label}</span>
              </div>
            </Button>
          );
        })}
      </div>

      {selectedCategory && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-medium text-blue-900">
            💡 선택됨: {CLOSING_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            카테고리를 드래그하여 그리드에 추가하거나 클릭하여 선택하세요
          </p>
        </div>
      )}

      {/* 휴지통 삭제 영역 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div
          className={cn(
            'flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed transition-all',
            isDraggingOverTrash
              ? 'bg-red-100 border-red-400 scale-105'
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
            // 자식 요소로 이동하는 경우는 제외
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
              'w-6 h-6 transition-colors',
              isDraggingOverTrash ? 'text-red-600' : 'text-gray-400'
            )} 
          />
          <span className={cn(
            'text-sm font-medium',
            isDraggingOverTrash ? 'text-red-600' : 'text-gray-600'
          )}>
            일정을 여기로 드래그하여 삭제
          </span>
        </div>
      </div>
    </div>
  );
};

