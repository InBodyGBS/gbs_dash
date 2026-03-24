'use client';

/**
 * Quarterly Closing - Calendar 페이지
 * 분기별 결산 일정 캘린더 뷰
 */

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getCategoryById } from '@/lib/constants/closing-categories';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';
import { CategoryBar } from '@/components/quarterly-closing/CategoryBar';
import { ScheduleGrid } from '@/components/quarterly-closing/ScheduleGrid';
import { useScheduleData } from '@/lib/hooks/useScheduleData';

export default function CalendarPage() {
  const {
    quarter,
    subsidiaries,
    loading,
    selectedYear,
    selectedQuarter,
    selectedCategory,
    setSelectedYear,
    setSelectedQuarter,
    setSelectedCategory,
    handleCategorySelect,
    handleEntityOrderChange,
    handleCategoryDrop,
    handleItemDelete,
    handleItemConfirm,
    handleCellClick,
    handleExportExcel,
    filteredScheduleItems,
    filteredSubmissions,
    achievementRate,
  } = useScheduleData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: '#971B2F' }}
          />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!quarter) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">분기 데이터를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
              {selectedCategory && (
                <p className="text-sm text-gray-600 mt-1">
                  필터: {getCategoryById(selectedCategory as ClosingCategoryId)?.label || selectedCategory}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-6 px-2 text-xs"
                    onClick={() => setSelectedCategory(null)}
                  >
                    필터 해제
                  </Button>
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {selectedCategory ? '필터된 성사율' : '전체 성사율'}
                </p>
                <p className="text-3xl font-bold" style={{ color: '#971B2F' }}>
                  {achievementRate}%
                </p>
              </div>

              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Year / Quarter selector + Category bar */}
          <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-lg mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">귀속연도:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => 2020 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1Q</SelectItem>
                  <SelectItem value="2">2Q</SelectItem>
                  <SelectItem value="3">3Q</SelectItem>
                  <SelectItem value="4">4Q</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <CategoryBar
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
              onItemDelete={handleItemDelete}
            />
          </div>
        </div>

        {/* Schedule grid */}
        <ScheduleGrid
          quarter={quarter}
          subsidiaries={subsidiaries}
          scheduleItems={filteredScheduleItems}
          submissions={filteredSubmissions}
          selectedCategory={selectedCategory}
          onCellClick={handleCellClick}
          onCategoryDrop={handleCategoryDrop}
          onItemDelete={handleItemDelete}
          onItemConfirm={handleItemConfirm}
          onEntityOrderChange={handleEntityOrderChange}
        />
      </div>
    </div>
  );
}
