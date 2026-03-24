'use client';

/**
 * Financial Closing — Calendar
 * Year/Month 선택은 귀속(결산) 월이며, 그리드는 항상 귀속월의 다음 달을 표시합니다 (예: 3월 결산 → 4월 캘린더).
 */

import { useState, useMemo, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isSameDay,
  parseISO,
  addMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useScheduleData } from '@/lib/hooks/useScheduleData';
import { getCategoryById } from '@/lib/constants/closing-categories';

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export default function CalendarTPage() {
  const {
    quarter,
    subsidiaries,
    scheduleItems,
    submissions,
    loading,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    activeClosingCategories,
    refetch,
  } = useScheduleData();

  const attributionMonthNum = parseInt(selectedMonth, 10) || 1;
  const attributionYearNum = parseInt(selectedYear, 10);

  /** 겉으로 보이는 캘린더 월 = 귀속월 + 1 */
  const currentMonth = useMemo(() => {
    const attributionStart = new Date(attributionYearNum, attributionMonthNum - 1, 1);
    return addMonths(attributionStart, 1);
  }, [attributionYearNum, attributionMonthNum]);

  const calendarYmPrefix = format(currentMonth, 'yyyy-MM');

  const activeCategoryIds = useMemo(
    () => new Set(activeClosingCategories.map((c) => c.id)),
    [activeClosingCategories],
  );

  const shiftCalendarMonth = (delta: number) => {
    const y = parseInt(selectedYear, 10);
    const m = parseInt(selectedMonth, 10);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedYear(String(d.getFullYear()));
    setSelectedMonth(String(d.getMonth() + 1));
  };
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [legendCategory, setLegendCategory] = useState<string | null>(null);
  const [legendSubsidiary, setLegendSubsidiary] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Compute: category planned dates (one date per category — the consensus date)
  // -------------------------------------------------------------------------
  const categoryPlannedDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of scheduleItems) {
      if (
        item.planned_date &&
        item.planned_date.startsWith(calendarYmPrefix) &&
        activeCategoryIds.has(item.category) &&
        !map.has(item.category)
      ) {
        map.set(item.category, item.planned_date);
      }
    }
    return map;
  }, [scheduleItems, calendarYmPrefix, activeCategoryIds]);

  // dateStr → array of category entries planned on that date
  const plannedByDate = useMemo(() => {
    const map = new Map<
      string,
      { categoryId: string; categoryLabel: string; categoryColor: string }[]
    >();
    for (const [catId, dateStr] of categoryPlannedDates) {
      const cat = getCategoryById(catId);
      if (!cat) continue;
      const existing = map.get(dateStr) ?? [];
      existing.push({
        categoryId: catId,
        categoryLabel: cat.label,
        categoryColor: cat.color,
      });
      map.set(dateStr, existing);
    }
    return map;
  }, [categoryPlannedDates]);

  // -------------------------------------------------------------------------
  // Compute: submissions per date
  // -------------------------------------------------------------------------
  const submissionsByDate = useMemo(() => {
    const map = new Map<
      string,
      { subsidiaryName: string; category: string; color: string }[]
    >();
    for (const sub of submissions) {
      const dateStr = sub.submitted_at.split('T')[0];
      if (!dateStr.startsWith(calendarYmPrefix)) continue;
      if (!activeCategoryIds.has(sub.category)) continue;
      const subsidiary = subsidiaries.find((s) => s.id === sub.subsidiary_id);
      if (!subsidiary) continue;
      const cat = getCategoryById(sub.category);
      const existing = map.get(dateStr) ?? [];
      existing.push({
        subsidiaryName: subsidiary.name.replace('InBody ', ''),
        category: cat?.label ?? sub.category,
        color: cat?.color ?? '#9CA3AF',
      });
      map.set(dateStr, existing);
    }
    return map;
  }, [submissions, subsidiaries, calendarYmPrefix, activeCategoryIds]);

  // -------------------------------------------------------------------------
  // Legend selection: filtered views for calendar cells
  // -------------------------------------------------------------------------
  const activePlannedByDate = useMemo(() => {
    if (!legendCategory) return plannedByDate;
    const filtered = new Map<string, typeof plannedByDate extends Map<string, infer V> ? V : never>();
    for (const [date, cats] of plannedByDate) {
      const match = cats.filter((c) => c.categoryId === legendCategory);
      if (match.length) filtered.set(date, match);
    }
    return filtered;
  }, [plannedByDate, legendCategory]);

  const activeSubmissionsByDate = useMemo(() => {
    if (!legendCategory && !legendSubsidiary) return submissionsByDate;
    const filtered = new Map<string, typeof submissionsByDate extends Map<string, infer V> ? V : never>();
    for (const [date, subs] of submissionsByDate) {
      const match = subs.filter((s) => {
        if (legendCategory) return s.color === getCategoryById(legendCategory)?.color;
        if (legendSubsidiary) {
          const sub = subsidiaries.find(x => x.id === legendSubsidiary);
          return sub ? s.subsidiaryName === sub.name.replace('InBody ', '') : false;
        }
        return true;
      });
      if (match.length) filtered.set(date, match);
    }
    return filtered;
  }, [submissionsByDate, legendCategory, legendSubsidiary, subsidiaries]);

  // Legend panel: category summary
  const legendCategoryInfo = useMemo(() => {
    if (!legendCategory) return null;
    const cat = getCategoryById(legendCategory);
    if (!cat) return null;
    const plannedDate = categoryPlannedDates.get(legendCategory) ?? null;
    const submittedSubIds = new Set(
      submissions
        .filter((s) => {
          const d = (s.submitted_at || '').split('T')[0];
          return s.category === legendCategory && d.startsWith(calendarYmPrefix);
        })
        .map((s) => s.subsidiary_id),
    );
    return {
      cat,
      plannedDate,
      submitted: subsidiaries.filter((s) => submittedSubIds.has(s.id)),
      notSubmitted: subsidiaries.filter((s) => !submittedSubIds.has(s.id)),
    };
  }, [legendCategory, categoryPlannedDates, submissions, subsidiaries, calendarYmPrefix]);

  // Legend panel: subsidiary summary
  const legendSubsidiaryInfo = useMemo(() => {
    if (!legendSubsidiary) return null;
    const sub = subsidiaries.find((s) => s.id === legendSubsidiary);
    if (!sub) return null;
    const submittedCatIds = new Set(
      submissions
        .filter((s) => {
          const d = (s.submitted_at || '').split('T')[0];
          return s.subsidiary_id === legendSubsidiary && d.startsWith(calendarYmPrefix);
        })
        .map((s) => s.category),
    );
    return {
      sub,
      submitted: activeClosingCategories.filter((c) => submittedCatIds.has(c.id)),
      notSubmitted: activeClosingCategories.filter((c) => !submittedCatIds.has(c.id)),
    };
  }, [legendSubsidiary, submissions, subsidiaries, calendarYmPrefix, activeClosingCategories]);

  const isLegendActive = legendCategory !== null || legendSubsidiary !== null;

  const handleLegendCategoryClick = (catId: string) => {
    setLegendCategory((prev) => (prev === catId ? null : catId));
    setLegendSubsidiary(null);
    setSelectedDate(null);
  };

  const handleLegendSubsidiaryClick = (subId: string) => {
    setLegendSubsidiary((prev) => (prev === subId ? null : subId));
    setLegendCategory(null);
    setSelectedDate(null);
  };

  // -------------------------------------------------------------------------
  // Calendar grid days (padded to fill 7-column rows)
  // -------------------------------------------------------------------------
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startPad = getDay(start); // 0 = Sun
    const padded: (Date | null)[] = [...Array(startPad).fill(null), ...days];
    const tail = padded.length % 7;
    if (tail !== 0) padded.push(...Array(7 - tail).fill(null));
    return padded;
  }, [currentMonth]);

  // -------------------------------------------------------------------------
  // Handler: set planned_date for a category across all subsidiaries
  // -------------------------------------------------------------------------
  const handleSetPlannedDate = useCallback(
    async (categoryId: string, dateStr: string) => {
      if (!quarter) {
        toast.error('분기 데이터가 없습니다.');
        return;
      }
      if (quarter.id.startsWith('temp-') || quarter.id.startsWith('custom-')) {
        toast.error('분기가 아직 저장되지 않았습니다. Overview 등에서 분기를 먼저 준비한 뒤 다시 시도해주세요.');
        return;
      }

      setSaving(true);
      try {
        const upserts = subsidiaries.map((sub) => ({
          quarter_id: quarter.id,
          subsidiary_id: sub.id,
          category: categoryId,
          planned_date: dateStr,
          status: 'planned' as const,
        }));

        const { error } = await supabase
          .from('schedule_items')
          .upsert(upserts, { onConflict: 'quarter_id,subsidiary_id,category' });

        if (error) throw error;
        toast.success('완료 기한이 설정되었습니다.');
        await refetch();
      } catch (err: unknown) {
        toast.error(`설정 실패: ${getErrorMessage(err)}`);
      } finally {
        setSaving(false);
      }
    },
    [quarter, subsidiaries, refetch],
  );

  // -------------------------------------------------------------------------
  // Handler: remove planned items for a category
  // -------------------------------------------------------------------------
  const handleRemovePlannedDate = useCallback(
    async (categoryId: string) => {
      if (!quarter || quarter.id.startsWith('temp-') || quarter.id.startsWith('custom-')) return;

      setSaving(true);
      try {
        const { error } = await supabase
          .from('schedule_items')
          .delete()
          .eq('quarter_id', quarter.id)
          .eq('category', categoryId)
          .eq('status', 'planned');

        if (error) throw error;
        toast.success('완료 기한이 삭제되었습니다.');
        await refetch();
      } catch (err: unknown) {
        toast.error(`삭제 실패: ${getErrorMessage(err)}`);
      } finally {
        setSaving(false);
      }
    },
    [quarter, refetch],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
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

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const categoriesOnSelected = selectedDateStr ? (plannedByDate.get(selectedDateStr) ?? []) : [];
  const categoryIdsOnSelected = new Set(categoriesOnSelected.map((c) => c.categoryId));
  const submissionsOnSelected = selectedDateStr
    ? (submissionsByDate.get(selectedDateStr) ?? [])
    : [];
  // 아직 어떤 날짜에도 설정되지 않은 카테고리 (추가 가능)
  const unassignedCategories = activeClosingCategories.filter(
    (cat) => !categoryIdsOnSelected.has(cat.id) && !categoryPlannedDates.has(cat.id),
  );
  // 다른 날짜에 이미 설정된 카테고리 (잠금 표시)
  const lockedCategories = activeClosingCategories.filter(
    (cat) => !categoryIdsOnSelected.has(cat.id) && categoryPlannedDates.has(cat.id),
  );

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex-1 p-6 overflow-auto">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>

            {/* Year / Month selector */}
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Year:</Label>
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
          <p className="text-xs text-gray-500">
            귀속 월 기준 · 캘린더는 다음 달({format(currentMonth, 'M')}월)을 표시합니다
          </p>

          {/* Month navigation + legend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => shiftCalendarMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold w-36 text-center">
                {format(currentMonth, 'yyyy년 M월')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shiftCalendarMonth(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-sm text-gray-500"
                onClick={() => {
                  const t = new Date();
                  const thisMonthStart = new Date(t.getFullYear(), t.getMonth(), 1);
                  const attribution = addMonths(thisMonthStart, -1);
                  setSelectedYear(String(attribution.getFullYear()));
                  setSelectedMonth(String(attribution.getMonth() + 1));
                }}
              >
                오늘
              </Button>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-blue-400" />
                <span>완료 기한 (카테고리)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-green-400" />
                <span>제출 내역</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Calendar + Side panel ───────────────────────────────────────── */}
        <div className="flex gap-4">
          {/* Calendar grid */}
          <div className="flex-1 min-w-0">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    'text-center text-xs font-semibold py-2',
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500',
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <div key={`pad-${idx}`} className="bg-gray-50 min-h-[110px]" />;
                }

                const dateStr = format(day, 'yyyy-MM-dd');
                const dayPlanned = activePlannedByDate.get(dateStr) ?? [];
                const daySubs = activeSubmissionsByDate.get(dateStr) ?? [];
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                const hasActiveData = !isLegendActive || dayPlanned.length > 0 || daySubs.length > 0;
                const today = isToday(day);
                const dow = getDay(day);

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      'bg-white min-h-[110px] p-1.5 cursor-pointer transition-colors',
                      isSelected
                        ? 'ring-2 ring-inset ring-[#971B2F] bg-red-50'
                        : 'hover:bg-gray-50',
                      isLegendActive && !hasActiveData && 'opacity-30',
                    )}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                  >
                    {/* Date number */}
                    <div
                      className={cn(
                        'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                        today
                          ? 'bg-[#971B2F] text-white'
                          : dow === 0
                            ? 'text-red-500'
                            : dow === 6
                              ? 'text-blue-500'
                              : 'text-gray-700',
                      )}
                    >
                      {format(day, 'd')}
                    </div>

                    {/* Planned category badges */}
                    <div className="space-y-0.5">
                      {dayPlanned.slice(0, 3).map((cat) => (
                        <div
                          key={cat.categoryId}
                          className="text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium text-white"
                          style={{ backgroundColor: cat.categoryColor }}
                          title={cat.categoryLabel}
                        >
                          {cat.categoryLabel}
                        </div>
                      ))}
                      {dayPlanned.length > 3 && (
                        <div className="text-[10px] text-gray-400 px-1">
                          +{dayPlanned.length - 3}개
                        </div>
                      )}
                    </div>

                    {/* Submission badges */}
                    {daySubs.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {daySubs.slice(0, 2).map((sub, i) => (
                          <div
                            key={i}
                            className="text-[10px] leading-tight px-1 py-0.5 rounded truncate bg-green-100 text-green-700"
                            title={`${sub.subsidiaryName} — ${sub.category}`}
                          >
                            ↑ {sub.subsidiaryName}
                          </div>
                        ))}
                        {daySubs.length > 2 && (
                          <div className="text-[10px] text-gray-400 px-1">
                            +{daySubs.length - 2}건
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Side panel ────────────────────────────────────────────────── */}
          {selectedDate ? (
            <div className="w-72 flex-shrink-0">
              <div className="border border-gray-200 rounded-lg overflow-hidden sticky top-0">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900">
                    {format(selectedDate, 'M월 d일 (EEE)', { locale: undefined })}
                    {' — '}
                    {format(selectedDate, 'yyyy-MM-dd')}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setSelectedDate(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-4 space-y-5 max-h-[calc(100vh-22rem)] overflow-y-auto">
                  {/* Categories already on this date */}
                  {categoriesOnSelected.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        완료 기한 카테고리
                      </p>
                      <div className="space-y-1.5">
                        {categoriesOnSelected.map((cat) => (
                          <div key={cat.categoryId} className="flex items-center gap-2">
                            <div
                              className="flex-1 text-xs px-2 py-1 rounded font-medium text-white truncate"
                              style={{ backgroundColor: cat.categoryColor }}
                              title={cat.categoryLabel}
                            >
                              {cat.categoryLabel}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                              title="기한 삭제"
                              disabled={saving}
                              onClick={() => handleRemovePlannedDate(cat.categoryId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unassigned categories → can assign to this date */}
                  {unassignedCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        기한 추가
                      </p>
                      <div className="space-y-1">
                        {unassignedCategories.map((cat) => (
                          <button
                            key={cat.id}
                            className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                            disabled={saving}
                            onClick={() =>
                              handleSetPlannedDate(cat.id, format(selectedDate, 'yyyy-MM-dd'))
                            }
                          >
                            <div
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Already locked categories (assigned to a different date) */}
                  {lockedCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        기한 설정됨 (변경 불가)
                      </p>
                      <div className="space-y-1">
                        {lockedCategories.map((cat) => {
                          const assignedDate = categoryPlannedDates.get(cat.id)!;
                          return (
                            <div
                              key={cat.id}
                              className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded border border-dashed border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                              title={`${format(parseISO(assignedDate), 'M월 d일')}에 이미 설정됨`}
                            >
                              <div
                                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate flex-1">{cat.label}</span>
                              <span className="text-gray-400 whitespace-nowrap">
                                {format(parseISO(assignedDate), 'M/d')} 설정됨
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {unassignedCategories.length === 0 && lockedCategories.length === 0 && categoriesOnSelected.length > 0 && (
                    <p className="text-xs text-gray-400">모든 카테고리의 기한이 설정됨</p>
                  )}

                  {/* Submission log for this date */}
                  {submissionsOnSelected.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        제출 내역
                      </p>
                      <div className="space-y-1.5">
                        {submissionsOnSelected.map((sub, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-xs bg-green-50 border border-green-100 rounded px-2 py-1.5"
                          >
                            <div
                              className="h-2 w-2 rounded-full mt-0.5 flex-shrink-0"
                              style={{ backgroundColor: sub.color }}
                            />
                            <div>
                              <div className="font-semibold text-green-800">{sub.subsidiaryName}</div>
                              <div className="text-green-600">{sub.category}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {categoriesOnSelected.length === 0 &&
                    unassignedCategories.length === 0 &&
                    lockedCategories.length === 0 &&
                    submissionsOnSelected.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">
                        이 날짜에 데이터가 없습니다.
                      </p>
                    )}
                </div>
              </div>
            </div>
          ) : legendCategoryInfo ? (
            /* Legend: category summary panel */
            <div className="w-72 flex-shrink-0">
              <div className="border border-gray-200 rounded-lg overflow-hidden sticky top-0">
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-200"
                  style={{ backgroundColor: legendCategoryInfo.cat.color + '20' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: legendCategoryInfo.cat.color }} />
                    <h4 className="font-semibold text-gray-900 text-sm">{legendCategoryInfo.cat.label}</h4>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setLegendCategory(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">완료 기한</p>
                    <p className="text-sm font-medium text-gray-800">
                      {legendCategoryInfo.plannedDate
                        ? format(parseISO(legendCategoryInfo.plannedDate), 'yyyy년 M월 d일')
                        : '미설정'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      제출 완료 ({legendCategoryInfo.submitted.length}/{subsidiaries.length})
                    </p>
                    {legendCategoryInfo.submitted.length > 0 ? (
                      <div className="space-y-1">
                        {legendCategoryInfo.submitted.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                            <span className="text-green-500">✓</span>
                            <span>{s.name.replace('InBody ', '')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">제출 없음</p>
                    )}
                  </div>
                  {legendCategoryInfo.notSubmitted.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        미제출 ({legendCategoryInfo.notSubmitted.length})
                      </p>
                      <div className="space-y-1">
                        {legendCategoryInfo.notSubmitted.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                            <span className="text-gray-300">○</span>
                            <span>{s.name.replace('InBody ', '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : legendSubsidiaryInfo ? (
            /* Legend: subsidiary summary panel */
            <div className="w-72 flex-shrink-0">
              <div className="border border-gray-200 rounded-lg overflow-hidden sticky top-0">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm">
                    {legendSubsidiaryInfo.sub.name.replace('InBody ', '')}
                  </h4>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setLegendSubsidiary(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      제출 완료 ({legendSubsidiaryInfo.submitted.length}/{activeClosingCategories.length})
                    </p>
                    {legendSubsidiaryInfo.submitted.length > 0 ? (
                      <div className="space-y-1">
                        {legendSubsidiaryInfo.submitted.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="flex-1 truncate">{c.label}</span>
                            <span className="text-green-500">✓</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">제출 없음</p>
                    )}
                  </div>
                  {legendSubsidiaryInfo.notSubmitted.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        미제출 ({legendSubsidiaryInfo.notSubmitted.length})
                      </p>
                      <div className="space-y-1">
                        {legendSubsidiaryInfo.notSubmitted.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                            <div className="h-2 w-2 rounded-full flex-shrink-0 opacity-40" style={{ backgroundColor: c.color }} />
                            <span className="flex-1 truncate">{c.label}</span>
                            <span className="text-gray-300">○</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Hint when nothing is selected */
            <div className="w-64 flex-shrink-0 flex items-start pt-12 justify-center">
              <p className="text-sm text-gray-400 text-center leading-relaxed">
                날짜 또는 하단 범례를 클릭하면
                <br />
                제출 현황을 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* ── Legends at bottom ──────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Category legend */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-semibold text-gray-500 mb-2">카테고리 범례 <span className="font-normal text-gray-400">(클릭하여 필터)</span></p>
            <div className="flex flex-wrap gap-2">
              {activeClosingCategories.map((cat) => {
                const plannedDate = categoryPlannedDates.get(cat.id);
                const isSelected = legendCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all',
                      isSelected ? 'shadow-md scale-105' : 'opacity-70 hover:opacity-100',
                    )}
                    style={{
                      borderColor: cat.color,
                      color: cat.color,
                      backgroundColor: isSelected ? cat.color + '18' : undefined,
                    }}
                    onClick={() => handleLegendCategoryClick(cat.id)}
                  >
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{cat.label}</span>
                    {plannedDate && (
                      <span className="text-gray-400 ml-1">{format(parseISO(plannedDate), 'M/d')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entity legend */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-semibold text-gray-500 mb-2">법인 범례 <span className="font-normal text-gray-400">(클릭하여 필터)</span></p>
            <div className="flex flex-wrap gap-2">
              {subsidiaries.map((sub) => {
                const isSelected = legendSubsidiary === sub.id;
                return (
                  <button
                    key={sub.id}
                    className={cn(
                      'text-xs px-2 py-1 rounded-full border transition-all',
                      isSelected
                        ? 'border-[#971B2F] text-[#971B2F] bg-red-50 shadow-md scale-105'
                        : 'border-gray-300 text-gray-700 opacity-70 hover:opacity-100',
                    )}
                    onClick={() => handleLegendSubsidiaryClick(sub.id)}
                  >
                    {sub.name.replace('InBody ', '')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
