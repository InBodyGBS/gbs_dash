'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SubmissionCategorySidebar } from '@/components/quarterly-closing/SubmissionCategorySidebar';
import { SubmissionUpload } from '@/components/quarterly-closing/SubmissionUpload';
import { PreliminarySalesSGAForm } from '@/components/quarterly-closing/PreliminarySalesSGAForm';
import { SubmissionList } from '@/components/quarterly-closing/SubmissionList';
import { SubmissionCommentDialog } from '@/components/quarterly-closing/SubmissionCommentDialog';
import { getClosingCategoriesForMonth } from '@/lib/constants/closing-categories';
import { toast } from 'sonner';
import type { Submission } from '@/lib/types/submission';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter } from '@/lib/types/quarterly-closing';

const STORAGE_KEY = 'quarterly-closing-submission-state';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export default function SubmissionPage() {
  // localStorage에서 저장된 상태 복원
  const loadSavedState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          selectedYear?: string;
          selectedMonth?: string;
          selectedQuarter?: string;
          selectedSubsidiaryId?: string;
        };
        let selectedMonth = parsed.selectedMonth;
        if (selectedMonth == null && parsed.selectedQuarter != null) {
          const q = parseInt(String(parsed.selectedQuarter), 10);
          const endMonthByQ: Record<number, string> = { 1: '3', 2: '6', 3: '9', 4: '12' };
          selectedMonth = endMonthByQ[q] || String(new Date().getMonth() + 1);
        }
        return {
          selectedYear: parsed.selectedYear || '2025',
          selectedMonth: selectedMonth || String(new Date().getMonth() + 1),
          selectedSubsidiaryId: parsed.selectedSubsidiaryId || 'all',
        };
      }
    } catch (error) {
      console.error('Failed to load saved state:', error);
    }
    return null;
  };

  // 상태 저장
  const saveState = (state: {
    selectedYear: string;
    selectedMonth: string;
    selectedSubsidiaryId: string;
  }) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  };

  const savedState = loadSavedState();
  const initialMonth = savedState?.selectedMonth || String(new Date().getMonth() + 1);

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<ClosingCategoryId>(
    () => getClosingCategoriesForMonth(parseInt(initialMonth, 10) || 1)[0].id,
  );
  const [selectedYear, setSelectedYear] = useState<string>(savedState?.selectedYear || '2025');
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string>(
    savedState?.selectedSubsidiaryId || 'all'
  );
  const [quarter, setQuarter] = useState<Quarter | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);

  // 상태 변경 시 저장
  useEffect(() => {
    saveState({
      selectedYear,
      selectedMonth,
      selectedSubsidiaryId,
    });
  }, [selectedYear, selectedMonth, selectedSubsidiaryId]);

  useEffect(() => {
    const m = parseInt(selectedMonth, 10) || 1;
    const cats = getClosingCategoriesForMonth(m);
    setSelectedCategory((prev) => (cats.some((c) => c.id === prev) ? prev : cats[0].id));
  }, [selectedMonth]);

  const submissionCategories = getClosingCategoriesForMonth(parseInt(selectedMonth, 10) || 1);

  const loadData = useCallback(async () => {
    try {
      const fy = parseInt(selectedYear, 10);
      const monthNum = parseInt(selectedMonth, 10) || 1;
      const calendarQuarter = Math.min(4, Math.max(1, Math.ceil(monthNum / 3)));

      const { data: quarterData } = await supabase
        .from('quarters')
        .select('*')
        .eq('year', fy)
        .eq('quarter', calendarQuarter)
        .maybeSingle();

      if (quarterData) {
        console.log(`✅ Submission 페이지 - Quarter 조회 성공:`, {
          id: quarterData.id,
          year: quarterData.year,
          quarter: quarterData.quarter,
        });
        setQuarter(quarterData);
      } else {
        console.log(`⚠️ Submission 페이지 - Quarter 없음, 생성 시도...`);
        const quarterStartDate = new Date(fy, (calendarQuarter - 1) * 3, 1);
        const quarterEndDate = new Date(fy, calendarQuarter * 3, 0);

        const { data: newQuarter, error: insertError } = await supabase
          .from('quarters')
          .insert({
            year: fy,
            quarter: calendarQuarter,
            start_date: format(quarterStartDate, 'yyyy-MM-dd'),
            end_date: format(quarterEndDate, 'yyyy-MM-dd'),
          })
          .select()
          .single();

        if (insertError) {
          console.warn('Quarter 생성 실패, 임시 데이터 사용:', insertError);
          setQuarter({
            id: `temp-${selectedYear}-${calendarQuarter}`,
            year: fy,
            quarter: calendarQuarter,
            start_date: format(quarterStartDate, 'yyyy-MM-dd'),
            end_date: format(quarterEndDate, 'yyyy-MM-dd'),
            created_at: new Date().toISOString(),
          });
        } else {
          console.log(`✅ Submission 페이지 - Quarter 생성 성공:`, {
            id: newQuarter.id,
            year: newQuarter.year,
            quarter: newQuarter.quarter,
          });
          setQuarter(newQuarter);
        }
      }

      // 법인 데이터
      const { data: subsData, error: subsError } = await supabase
        .from('subsidiaries')
        .select('*')
        .order('name');

      if (subsError) throw subsError;
      setSubsidiaries(subsData || []);
    } catch (error: unknown) {
      console.error('Failed to load data:', error);
      toast.error(`데이터 로딩 실패: ${getErrorMessage(error)}`);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleDeleteSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSubmissionClick = (submission: Submission) => {
    setSelectedSubmission(submission);
    setCommentDialogOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Closing — Submission</h1>
        <p className="text-gray-600">
          해외 법인이 표준화된 Excel 형식으로 월·분기 일정에 맞춰 보고서를 제출할 수 있습니다.
        </p>
      </div>

      {/* 필터 영역 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Year:</Label>
            <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Entity:</Label>
            <Select value={selectedSubsidiaryId} onValueChange={setSelectedSubsidiaryId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {subsidiaries.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content - 좌우 레이아웃 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 좌측 카테고리 사이드바 */}
        <SubmissionCategorySidebar
          categories={submissionCategories}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />

        {/* 우측 메인 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preliminary Sales/SG&A 입력 폼 또는 파일 업로드 */}
          {selectedCategory === 'preliminary-sales' ? (
            <PreliminarySalesSGAForm
              quarterId={quarter?.id || null}
              subsidiaryId={selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null}
              onSaveSuccess={handleUploadSuccess}
            />
          ) : (
            <SubmissionUpload
              onUploadSuccess={handleUploadSuccess}
              category={selectedCategory}
              quarterId={quarter?.id || null}
              subsidiaryId={selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null}
              fiscalYear={selectedYear}
              entityName={selectedSubsidiaryId !== 'all' 
                ? subsidiaries.find(s => s.id === selectedSubsidiaryId)?.name || null
                : null}
            />
          )}

          {/* 제출 목록 */}
          <SubmissionList
            selectedCategory={selectedCategory}
            quarterId={quarter?.id || null}
            subsidiaryId={selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null}
            onSubmissionClick={handleSubmissionClick}
            refreshKey={refreshKey}
            onDeleteSuccess={handleDeleteSuccess}
          />
        </div>
      </div>

      {/* 댓글 다이얼로그 */}
      <SubmissionCommentDialog
        open={commentDialogOpen}
        onClose={() => {
          setCommentDialogOpen(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
      />
    </div>
  );
}
