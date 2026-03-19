'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Subsidiary } from '@/lib/supabase/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MonthlyOverviewGrid } from '@/components/monthly-closing/MonthlyOverviewGrid';
import type { MonthlyReviewStatus, MonthlySubmission } from '@/lib/types/monthly-closing-submissions';
import {
  getMonthlyReviewStatuses,
  getMonthlySubmissions,
  upsertMonthlyReviewStatus,
} from '@/lib/services/monthlySubmissionService';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MonthlyOverviewPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);

  const [submissions, setSubmissions] = useState<MonthlySubmission[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<MonthlyReviewStatus[]>([]);

  const [loading, setLoading] = useState(true);

  const periodYear = selectedYear;
  const periodMonth = selectedMonth;

  useEffect(() => {
    const loadSubsidiaries = async () => {
      try {
        const { data, error } = await supabase.from('subsidiaries').select('*').order('name');
        if (error) throw error;
        setSubsidiaries(data || []);
      } catch (error: any) {
        console.error('Failed to load subsidiaries:', error);
        toast.error('법인 목록 로드 실패', { description: error.message || '알 수 없는 오류' });
      }
    };
    loadSubsidiaries();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [subsData, reviewData] = await Promise.all([
          getMonthlySubmissions(periodYear, periodMonth, null, null),
          getMonthlyReviewStatuses(periodYear, periodMonth),
        ]);
        setSubmissions(subsData);
        setReviewStatuses(reviewData);
      } catch (error: any) {
        console.error('Failed to load monthly overview:', error);
        toast.error('Overview 데이터 로드 실패', { description: error.message || '알 수 없는 오류' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [periodYear, periodMonth]);

  const handleReviewToggle = async (
    subsidiaryId: string,
    patch: { reviewing?: boolean; confirm?: boolean }
  ) => {
    // optimistic update
    setReviewStatuses((prev) => {
      const existing = prev.find((s) => s.subsidiary_id === subsidiaryId);
      if (existing) {
        return prev.map((s) =>
          s.subsidiary_id !== subsidiaryId
            ? s
            : {
                ...s,
                reviewing: patch.reviewing ?? s.reviewing,
                confirm: patch.confirm ?? s.confirm,
              }
        );
      }

      return [
        ...prev,
        {
          id: `temp-${subsidiaryId}-${periodYear}-${periodMonth}`,
          period_year: periodYear,
          period_month: periodMonth,
          subsidiary_id: subsidiaryId,
          reviewing: patch.reviewing ?? false,
          confirm: patch.confirm ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    });

    await upsertMonthlyReviewStatus(subsidiaryId, periodYear, periodMonth, {
      reviewing: patch.reviewing ?? false,
      confirm: patch.confirm ?? false,
    });
  };

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => now - i + 1).sort((a, b) => b - a);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-semibold text-gray-900">Monthly Closing Overview</h1>
        <p className="text-gray-600 mt-1">
          귀속연도/월을 선택하면 카테고리별 제출 현황과 Stamp(제출일자)를 확인할 수 있습니다.
        </p>
      </div>

      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">귀속연도:</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">월:</Label>
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, idx) => (
                  <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>
        ) : (
          <MonthlyOverviewGrid
            periodYear={periodYear}
            periodMonth={periodMonth}
            subsidiaries={subsidiaries}
            submissions={submissions}
            reviewStatuses={reviewStatuses}
            onReviewToggle={handleReviewToggle}
          />
        )}
      </div>
    </div>
  );
}

