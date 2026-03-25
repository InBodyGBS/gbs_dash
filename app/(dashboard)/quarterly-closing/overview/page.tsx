'use client';

/**
 * Financial Closing - Overview 페이지
 * 분기별 결산 제출 현황 개요
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
import { OverviewGrid } from '@/components/quarterly-closing/OverviewGrid';
import { SubmissionSummary } from '@/components/quarterly-closing/SubmissionSummary';
import { useScheduleData } from '@/lib/hooks/useScheduleData';

export default function OverviewPage() {
  const {
    quarter,
    subsidiaries,
    submissionsScopedToMonth,
    loading,
    selectedYear,
    selectedMonth,
    activeClosingCategories,
    selectedCategory,
    selectedEntityId,
    setSelectedYear,
    setSelectedMonth,
    setSelectedCategory,
    setSelectedEntityId,
    handleEntityOrderChange,
    handleExportOverviewExcel,
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
        <p className="text-gray-500">해당 연·월에 맞는 결산 분기 데이터를 찾을 수 없습니다.</p>
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
              <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
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

              <Button variant="outline" onClick={handleExportOverviewExcel}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Year / Month selector */}
          <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-lg mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Year:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: new Date().getFullYear() + 2 - 2023 + 1 }, (_, i) => 2023 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Month:</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[4.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Submission summary + overview grid */}
        <div className="space-y-6">
          {submissionsScopedToMonth.length > 0 && (
            <div className="space-y-4">
              <SubmissionSummary
                submissions={submissionsScopedToMonth}
                subsidiaries={subsidiaries}
                activeCategories={activeClosingCategories}
                onEntityFilter={setSelectedEntityId}
                onCategoryFilter={setSelectedCategory}
                selectedEntityId={selectedEntityId}
                selectedCategoryId={selectedCategory}
              />
              {(selectedEntityId || selectedCategory) && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedEntityId(null);
                      setSelectedCategory(null);
                    }}
                  >
                    필터 초기화
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg border p-4">
            <OverviewGrid
              quarter={quarter}
              subsidiaries={
                selectedEntityId
                  ? subsidiaries.filter((s) => s.id === selectedEntityId)
                  : subsidiaries
              }
              scheduleItems={filteredScheduleItems}
              submissions={filteredSubmissions}
              categories={activeClosingCategories}
              periodLabel={`${selectedYear}년 ${selectedMonth}월`}
              selectedCategory={selectedCategory}
              onEntityOrderChange={handleEntityOrderChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
