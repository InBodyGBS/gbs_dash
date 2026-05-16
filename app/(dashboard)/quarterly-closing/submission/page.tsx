'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
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
import { SubmissionList } from '@/components/quarterly-closing/SubmissionList';
import { SubmissionCommentDialog } from '@/components/quarterly-closing/SubmissionCommentDialog';
import { Button } from '@/components/ui/button';
import { getClosingCategoriesForMonth } from '@/lib/constants/closing-categories';
import { getCategoryReviewStatuses } from '@/lib/services/categoryReviewService';
import {
  buildReviewStatusMap,
  isSubmissionBlockedByOverviewConfirm,
  scopeScheduleItemsToClosingMonth,
} from '@/lib/utils/submissionUploadConfirmed';
import { toast } from 'sonner';
import { fetchSubmissionCommentsForExcelExport } from '@/lib/services/submissionService';
import { downloadSubmissionCommentsExcel } from '@/lib/utils/submissionCommentsExcel';
import type { Submission } from '@/lib/types/submission';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter, ScheduleItem } from '@/lib/types/quarterly-closing';
import type { CategoryReviewStatus } from '@/lib/types/category-review';

const STORAGE_KEY = 'quarterly-closing-submission-state';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

/** SSR과 첫 클라이언트 렌더가 동일해야 하므로, localStorage는 마운트 후에만 읽습니다. */
function loadSavedSubmissionFilters(): {
  selectedYear: string;
  selectedMonth: string;
  selectedSubsidiaryId: string;
} | null {
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
        selectedYear: parsed.selectedYear || String(new Date().getFullYear()),
        selectedMonth: selectedMonth || String(new Date().getMonth() + 1),
        selectedSubsidiaryId: parsed.selectedSubsidiaryId || 'all',
      };
    }
  } catch (error) {
    console.error('Failed to load saved state:', error);
  }
  return null;
}

export default function SubmissionPage() {
  // Next.js 15: useSearchParams 사용 컴포넌트는 Suspense 경계 안에 있어야 정적 생성 가능
  return (
    <Suspense fallback={null}>
      <SubmissionPageInner />
    </Suspense>
  );
}

function SubmissionPageInner() {
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

  const router = useRouter();
  const searchParams = useSearchParams();

  const [refreshKey, setRefreshKey] = useState(0);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [pendingCategoryFromQuery, setPendingCategoryFromQuery] = useState<ClosingCategoryId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ClosingCategoryId>(() =>
    getClosingCategoriesForMonth(parseInt(String(new Date().getMonth() + 1), 10) || 1)[0].id,
  );
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => String(new Date().getMonth() + 1));
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string>('all');
  const [quarter, setQuarter] = useState<Quarter | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [exportingComments, setExportingComments] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [categoryReviewList, setCategoryReviewList] = useState<CategoryReviewStatus[]>([]);

  // 마운트 후 localStorage 복원 (서버 HTML과 첫 클라이언트 트리 일치)
  // 단, query params (year/month/subsidiary_id/category) 가 있으면 딥링크 우선.
  useEffect(() => {
    const qpYear = searchParams.get('year');
    const qpMonth = searchParams.get('month');
    const qpSubsidiary = searchParams.get('subsidiary_id');
    const qpCategory = searchParams.get('category');
    const hasDeepLink = Boolean(qpYear || qpMonth || qpSubsidiary || qpCategory);

    if (hasDeepLink) {
      if (qpYear) setSelectedYear(qpYear);
      if (qpMonth) {
        const m = parseInt(qpMonth, 10);
        if (m >= 1 && m <= 12) setSelectedMonth(String(m));
      }
      if (qpSubsidiary) setSelectedSubsidiaryId(qpSubsidiary);
      // category 는 selectedMonth 변경 effect 가 덮어쓰므로 pending 으로 보관 후 별도 effect 에서 적용
      if (qpCategory) setPendingCategoryFromQuery(qpCategory);
    } else {
      const saved = loadSavedSubmissionFilters();
      if (saved) {
        setSelectedYear(saved.selectedYear);
        setSelectedMonth(saved.selectedMonth);
        setSelectedSubsidiaryId(saved.selectedSubsidiaryId);
      }
    }
    setPrefsHydrated(true);
    // searchParams 는 마운트 시점 값만 사용 (이후 사용자 조작이 우선)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 복원 전에는 저장하지 않음 — 기본값으로 기존 저장을 덮어쓰지 않음
  useEffect(() => {
    if (!prefsHydrated) return;
    saveState({
      selectedYear,
      selectedMonth,
      selectedSubsidiaryId,
    });
  }, [prefsHydrated, selectedYear, selectedMonth, selectedSubsidiaryId]);

  useEffect(() => {
    const m = parseInt(selectedMonth, 10) || 1;
    const cats = getClosingCategoriesForMonth(m);
    // 딥링크로 들어온 카테고리가 현재 월에 유효하면 한 번 적용 후 소비
    if (pendingCategoryFromQuery) {
      if (cats.some((c) => c.id === pendingCategoryFromQuery)) {
        setSelectedCategory(pendingCategoryFromQuery);
      } else {
        setSelectedCategory(cats[0].id);
      }
      setPendingCategoryFromQuery(null);
      return;
    }
    setSelectedCategory((prev) => (cats.some((c) => c.id === prev) ? prev : cats[0].id));
  }, [selectedMonth, pendingCategoryFromQuery]);

  const submissionCategories = getClosingCategoriesForMonth(parseInt(selectedMonth, 10) || 1);

  const activeClosingCategoryIds = useMemo(
    () => new Set(submissionCategories.map((c) => c.id)),
    [submissionCategories],
  );

  const scheduleItemsScopedToMonth = useMemo(
    () =>
      scopeScheduleItemsToClosingMonth(
        scheduleItems,
        selectedYear,
        selectedMonth,
        activeClosingCategoryIds,
      ),
    [scheduleItems, selectedYear, selectedMonth, activeClosingCategoryIds],
  );

  const reviewStatusMap = useMemo(
    () => buildReviewStatusMap(categoryReviewList),
    [categoryReviewList],
  );

  const submissionUploadBlocked = useMemo(
    () =>
      isSubmissionBlockedByOverviewConfirm({
        subsidiaryId: selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null,
        categoryId: selectedCategory,
        reviewMap: reviewStatusMap,
        scheduleItemsScopedToMonth,
      }),
    [
      selectedSubsidiaryId,
      selectedCategory,
      reviewStatusMap,
      scheduleItemsScopedToMonth,
    ],
  );

  const loadData = useCallback(async () => {
    try {
      const fy = parseInt(selectedYear, 10);
      const monthNum = parseInt(selectedMonth, 10) || 1;
      const calendarQuarter = Math.min(4, Math.max(1, Math.ceil(monthNum / 3)));

      // API를 통해 quarter 조회/생성 (service_role로 RLS 우회 → 모든 사용자 가능)
      const response = await fetch(`/api/quarters?year=${fy}&quarter=${calendarQuarter}`);
      let quarterData: Quarter | null = null;
      if (response.ok) {
        const json = await response.json() as { quarter: Quarter };
        quarterData = json.quarter;
        setQuarter(quarterData);
      } else {
        console.warn('Quarter API 실패, quarter_id 없이 진행');
        setQuarter(null);
      }

      // 법인 데이터
      const { data: subsData, error: subsError } = await supabase
        .from('subsidiaries')
        .select('*')
        .order('name');

      if (subsError) throw subsError;
      setSubsidiaries(subsData || []);

      const qid = quarterData?.id;
      if (qid && !qid.startsWith('temp-') && !qid.startsWith('custom-')) {
        const [schedRes, revList] = await Promise.all([
          supabase.from('schedule_items').select('*').eq('quarter_id', qid),
          getCategoryReviewStatuses(qid).catch(() => [] as CategoryReviewStatus[]),
        ]);
        if (schedRes.error) {
          console.warn('schedule_items 로드 실패:', schedRes.error.message);
          setScheduleItems([]);
        } else {
          setScheduleItems((schedRes.data || []) as ScheduleItem[]);
        }
        setCategoryReviewList(revList);
      } else {
        setScheduleItems([]);
        setCategoryReviewList([]);
      }
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
    router.refresh(); // Overview, Calendar 페이지 라우터 캐시 무효화
  };

  const handleDeleteSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSubmissionClick = (submission: Submission) => {
    setSelectedSubmission(submission);
    setCommentDialogOpen(true);
  };

  const handleDownloadCommentsExcel = async () => {
    if (!quarter?.id) {
      toast.error('분기 정보를 불러온 뒤 다시 시도해 주세요.');
      return;
    }
    setExportingComments(true);
    try {
      const monthNum = parseInt(selectedMonth, 10) || 1;
      const entityNameBySubsidiaryId = new Map(subsidiaries.map((s) => [s.id, s.name]));
      const rows = await fetchSubmissionCommentsForExcelExport({
        fiscalYear: selectedYear,
        calendarMonth: monthNum,
        quarterId: quarter.id,
        subsidiaryId: selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null,
        entityNameBySubsidiaryId,
      });
      if (rows.length === 0) {
        toast.error('선택한 범위에 내보낼 메모가 없습니다.');
        return;
      }
      await downloadSubmissionCommentsExcel(rows);
      toast.success(`메모 ${rows.length}건을 엑셀로 저장했습니다.`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
    } finally {
      setExportingComments(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Closing — Submission</h1>
            <p className="text-gray-600">
              해외 법인이 표준화된 Excel 형식으로 월·분기 일정에 맞춰 보고서를 제출할 수 있습니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => void handleDownloadCommentsExcel()}
            disabled={exportingComments}
          >
            {exportingComments ? '준비 중…' : '메모 엑셀 내려받기'}
          </Button>
        </div>
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
          {/* 파일 업로드 */}
          <SubmissionUpload
            onUploadSuccess={handleUploadSuccess}
            category={selectedCategory}
            quarterId={quarter?.id || null}
            subsidiaryId={selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null}
            fiscalYear={selectedYear}
            closingMonth={selectedMonth}
            entityName={selectedSubsidiaryId !== 'all'
              ? subsidiaries.find(s => s.id === selectedSubsidiaryId)?.name || null
              : null}
            uploadBlocked={submissionUploadBlocked}
          />

          {/* 제출 목록 */}
          <SubmissionList
            selectedCategory={selectedCategory}
            quarterId={quarter?.id || null}
            subsidiaryId={selectedSubsidiaryId !== 'all' ? selectedSubsidiaryId : null}
            fiscalYear={selectedYear}
            closingMonth={selectedMonth}
            onSubmissionClick={handleSubmissionClick}
            refreshKey={refreshKey}
            onDeleteSuccess={handleDeleteSuccess}
          />
        </div>
      </div>

      {/* 메모 다이얼로그 */}
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
