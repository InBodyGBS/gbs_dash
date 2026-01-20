/**
 * Entity View - 필터 옵션 컴포넌트
 */

'use client';

import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface FilterState {
  showOnlyWithData: boolean;
  hideNoData: boolean;
  showLowerTriangle: boolean;
  showOnlySubmitted: boolean;
  searchQuery: string;
}

interface FilterOptionsProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export function FilterOptions({ filters, onFilterChange }: FilterOptionsProps) {
  const handleFilterChange = (key: keyof FilterState, value: boolean | string) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  const resetFilters = () => {
    onFilterChange({
      showOnlyWithData: false,
      hideNoData: false,
      showLowerTriangle: false,
      showOnlySubmitted: false,
      searchQuery: '',
    });
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span>🔧</span>
        표시 옵션
      </h3>
      
      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showOnlyWithData}
            onChange={(e) => handleFilterChange('showOnlyWithData', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">데이터가 있는 항목만 표시</span>
          <span className="text-xs text-gray-500 ml-auto">
            (한쪽이라도 제출한 거래쌍만)
          </span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hideNoData}
            onChange={(e) => handleFilterChange('hideNoData', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">미제출(회색) 항목 숨기기</span>
          <span className="text-xs text-gray-500 ml-auto">
            (양쪽 모두 미제출인 항목 제외)
          </span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showLowerTriangle}
            onChange={(e) => handleFilterChange('showLowerTriangle', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">대각선 아래만 표시 (중복 제거)</span>
          <span className="text-xs text-gray-500 ml-auto">
            (매트릭스 크기 50% 감소)
          </span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showOnlySubmitted}
            onChange={(e) => handleFilterChange('showOnlySubmitted', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">제출한 법인만 표시</span>
          <span className="text-xs text-gray-500 ml-auto">
            (해당 기간에 데이터 제출한 법인만)
          </span>
        </label>
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="법인 검색 (예: BWA, Korea, US)"
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            className="w-full pr-8"
          />
          {filters.searchQuery && (
            <button
              onClick={() => handleFilterChange('searchQuery', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetFilters}
        >
          초기화
        </Button>
      </div>
    </div>
  );
}
