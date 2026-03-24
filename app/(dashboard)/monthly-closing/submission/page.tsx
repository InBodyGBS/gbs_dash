'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Subsidiary } from '@/lib/supabase/types';
import { MONTHLY_CLOSING_CATEGORIES, MonthlyClosingCategoryId } from '@/lib/constants/monthly-closing-categories';
import { SubmissionCategorySidebar } from '@/components/monthly-closing/SubmissionCategorySidebar';
import { SubmissionUpload } from '@/components/monthly-closing/SubmissionUpload';
import { SubmissionList } from '@/components/monthly-closing/SubmissionList';

const STORAGE_KEY = 'monthly-closing-submission-state';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export default function MonthlySubmissionPage() {
  const savedState = (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {
        selectedYear?: string;
        selectedMonth?: string;
        selectedSubsidiaryId?: string;
        selectedCategory?: MonthlyClosingCategoryId;
      };
    } catch {
      return null;
    }
  })();

  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedYear, setSelectedYear] = useState<string>(savedState?.selectedYear || String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(savedState?.selectedMonth || String(new Date().getMonth() + 1));
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string>(savedState?.selectedSubsidiaryId || 'all');
  const [selectedCategory, setSelectedCategory] = useState<MonthlyClosingCategoryId>(
    savedState?.selectedCategory || MONTHLY_CLOSING_CATEGORIES[0].id
  );

  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loadingSubsidiaries, setLoadingSubsidiaries] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedYear, selectedMonth, selectedSubsidiaryId, selectedCategory })
    );
  }, [selectedYear, selectedMonth, selectedSubsidiaryId, selectedCategory]);

  useEffect(() => {
    const loadSubsidiaries = async () => {
      setLoadingSubsidiaries(true);
      try {
        const { data, error } = await supabase.from('subsidiaries').select('*').order('name');
        if (error) throw error;
        setSubsidiaries(data || []);
      } catch (error: unknown) {
        console.error('Failed to load subsidiaries:', error);
        toast.error('법인 목록 로드 실패', { description: getErrorMessage(error) });
      } finally {
        setLoadingSubsidiaries(false);
      }
    };

    loadSubsidiaries();
  }, []);

  const handleUploadSuccess = () => setRefreshKey((prev) => prev + 1);

  const periodYear = parseInt(selectedYear);
  const periodMonth = parseInt(selectedMonth);
  const subsidiaryId = selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Monthly Reports Submission</h1>
        <p className="text-gray-600">
          월별 결산 서류를 업로드하고, Storage에 저장된 제출 파일을 관리합니다.
        </p>
      </div>

      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4 flex-wrap">
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
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">월:</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Entity:</Label>
            <Select value={selectedSubsidiaryId} onValueChange={setSelectedSubsidiaryId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Entity 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {!loadingSubsidiaries &&
                  subsidiaries.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <SubmissionCategorySidebar
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SubmissionUpload
            onUploadSuccess={() => handleUploadSuccess()}
            category={selectedCategory}
            periodYear={periodYear}
            periodMonth={periodMonth}
            subsidiaryId={subsidiaryId}
          />

          <SubmissionList
            periodYear={periodYear}
            periodMonth={periodMonth}
            selectedCategory={selectedCategory}
            selectedSubsidiaryId={subsidiaryId}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}

