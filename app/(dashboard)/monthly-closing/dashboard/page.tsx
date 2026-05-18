'use client';

/**
 * Monthly Closing - Dashboard 페이지
 * P/L 탭: 전체 법인 손익 요약 & 인사이트
 * B/S 탭: Assets Status · Working Capital · Inventories
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Check,
  ChevronDown,
  Download,
} from 'lucide-react';
import {
  getAllEntityPLSummaries,
  getPLResults,
  calculatePLSummary,
  getBSResultsForPeriods,
  getPLResultsForPeriods,
  computeBSPeriodMetrics,
  getStdPLMaster,
} from '@/lib/services/monthlyClosingService';
import { fetchSubsidiariesForCurrentUser } from '@/lib/services/subsidiariesAccessService';
import {
  generateFinancialStatementsHtml,
  downloadHtml,
} from '@/lib/utils/financialStatementsHtmlExport';
import {
  generateAnalyticsHtml,
  downloadAnalyticsHtml,
} from '@/lib/utils/analyticsHtmlExport';
import type { PLSummary, PLResult, BSPeriodMetrics } from '@/lib/types/monthly-closing';
import type { Subsidiary } from '@/lib/supabase/types';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AssetsStatus } from '@/components/monthly-closing/AssetsStatus';
import { WorkingCapital } from '@/components/monthly-closing/WorkingCapital';
import { InventoriesPanel } from '@/components/monthly-closing/InventoriesPanel';

type ComparisonType = 'mom' | 'yoy' | 'yoy_ytd';
type ActiveView = 'pl' | 'bs';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

// ============================================
// B/S 기간 계산 헬퍼
// ============================================

function getLast12Months(year: number, month: number): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const totalMonths = year * 12 + (month - 1) - i;
    result.push({ year: Math.floor(totalMonths / 12), month: (totalMonths % 12) + 1 });
  }
  return result;
}

function prevPeriod(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// ============================================
// 월별 P&L 차이 계산 (MoM 누적 → 월별 변환)
// ============================================
function calculateMonthlyDifference(
  currentCumulative: PLResult[],
  prevCumulative: PLResult[],
  entityCode: string,
  year: number,
  month: number
): PLResult[] {
  const currMap = new Map<string, number>();
  currentCumulative.forEach((r) => {
    currMap.set(r.std_pl_code, (currMap.get(r.std_pl_code) || 0) + r.amount);
  });
  const prevMap = new Map<string, number>();
  prevCumulative.forEach((r) => {
    prevMap.set(r.std_pl_code, (prevMap.get(r.std_pl_code) || 0) + r.amount);
  });
  const allCodes = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
  return Array.from(allCodes).map((code) => ({
    id: `${code}-${month}`,
    upload_id: '',
    entity_code: entityCode,
    subsidiary_id: null,
    period_year: year,
    period_month: month,
    std_pl_code: code,
    amount: (currMap.get(code) || 0) - (prevMap.get(code) || 0),
    currency: currentCumulative[0]?.currency || 'KRW',
    created_at: new Date().toISOString(),
    std_pl_master: undefined,
  }));
}

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() || 12));
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [comparisonType, setComparisonType] = useState<ComparisonType>('mom');
  const [activeView, setActiveView] = useState<ActiveView>('pl');

  // P/L state
  const [summaries, setSummaries] = useState<PLSummary[]>([]);
  const [prevSummaries, setPrevSummaries] = useState<PLSummary[]>([]);
  // 비교 탭과 무관하게 항상 YoY(전년 동월) 단월값을 별도로 로드 — YoY Revenue Growth 카드용
  const [yoySummaries, setYoySummaries] = useState<PLSummary[]>([]);
  // SG&A 계정과목별 분석을 위해 std_pl_master 도 로드
  const [plMaster, setPLMaster] = useState<Array<{ pl_code: string; pl_line: string; display_order: number }>>([]);
  // SG&A 계정과목별 단월 합계 — 코드별 amount (당기 / 비교기간)
  const [sgaByAccountCurrent, setSgaByAccountCurrent] = useState<Map<string, number>>(new Map());
  const [sgaByAccountPrev, setSgaByAccountPrev] = useState<Map<string, number>>(new Map());
  // SG&A 12개월 단월 트렌드 — 코드별 [label, value] 12쌍
  const [sgaTrendLabels, setSgaTrendLabels] = useState<string[]>([]);
  const [sgaTrendByCode, setSgaTrendByCode] = useState<Map<string, number[]>>(new Map());
  // 그래프에서 보고 싶은 SG&A 계정(들) — 멀티 선택 (기본: 가장 큰 계정 1개)
  const [selectedSgaCodes, setSelectedSgaCodes] = useState<string[]>([]);
  // 12개월 P/L 트렌드 (꺾은선 그래프용) — Sales / Operating Margin / Net Income
  const [monthlyTrendData, setMonthlyTrendData] = useState<
    Array<{ label: string; sales: number; operatingMargin: number | null; netIncome: number }>
  >([]);
  // HTML 다운로드 진행 상태
  const [downloadingHtml, setDownloadingHtml] = useState<boolean>(false);
  const [downloadingAnalytics, setDownloadingAnalytics] = useState<boolean>(false);

  // B/S state
  const [bsTrend, setBsTrend] = useState<BSPeriodMetrics[]>([]);
  const [bsCurrent, setBsCurrent] = useState<BSPeriodMetrics | null>(null);
  const [bsCompare, setBsCompare] = useState<BSPeriodMetrics | null>(null);
  const [bsLoading, setBsLoading] = useState(false);

  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [canSeeAllEntities, setCanSeeAllEntities] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // ============================================
  // P/L · B/S HTML 다운로드 핸들러
  // ============================================
  const handleDownloadStatements = useCallback(async () => {
    if (downloadingHtml) return;
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const entityCodes =
      selectedEntity === 'all' ? subsidiaries.map((s) => s.code) : [selectedEntity];
    if (entityCodes.length === 0) {
      toast.error('선택된 Entity 가 없습니다.');
      return;
    }
    const entityLabel =
      selectedEntity === 'all'
        ? `전체 (${entityCodes.length}개 법인)`
        : subsidiaries.find((s) => s.code === selectedEntity)?.name || selectedEntity;
    setDownloadingHtml(true);
    const toastId = toast.loading('재무제표 HTML 생성 중...');
    try {
      const html = await generateFinancialStatementsHtml({
        entityCodes,
        entityLabel,
        year,
        month,
      });
      const filenameEntity =
        selectedEntity === 'all'
          ? 'All'
          : selectedEntity.replace(/[^a-zA-Z0-9_-]+/g, '');
      const filename = `FS_${filenameEntity}_${year}${String(month).padStart(2, '0')}.html`;
      downloadHtml(filename, html);
      toast.dismiss(toastId);
      toast.success('HTML 다운로드 완료');
    } catch (error: unknown) {
      toast.dismiss(toastId);
      toast.error(
        `HTML 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setDownloadingHtml(false);
    }
  }, [downloadingHtml, selectedYear, selectedMonth, selectedEntity, subsidiaries]);

  // 분석 지표 HTML 다운로드
  const handleDownloadAnalytics = useCallback(async () => {
    if (downloadingAnalytics) return;
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const entityCodes =
      selectedEntity === 'all' ? subsidiaries.map((s) => s.code) : [selectedEntity];
    if (entityCodes.length === 0) {
      toast.error('선택된 Entity 가 없습니다.');
      return;
    }
    const entityLabel =
      selectedEntity === 'all'
        ? `전체 (${entityCodes.length}개 법인)`
        : subsidiaries.find((s) => s.code === selectedEntity)?.name || selectedEntity;
    setDownloadingAnalytics(true);
    const toastId = toast.loading('분석 지표 HTML 생성 중...');
    try {
      const html = await generateAnalyticsHtml({
        entityCodes,
        entityLabel,
        year,
        month,
      });
      const filenameEntity =
        selectedEntity === 'all'
          ? 'All'
          : selectedEntity.replace(/[^a-zA-Z0-9_-]+/g, '');
      const filename = `Analytics_${filenameEntity}_${year}${String(month).padStart(2, '0')}.html`;
      downloadAnalyticsHtml(filename, html);
      toast.dismiss(toastId);
      toast.success('분석 지표 HTML 다운로드 완료');
    } catch (error: unknown) {
      toast.dismiss(toastId);
      toast.error(
        `분석 지표 HTML 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setDownloadingAnalytics(false);
    }
  }, [downloadingAnalytics, selectedYear, selectedMonth, selectedEntity, subsidiaries]);

  const loadSubsidiaries = useCallback(async () => {
    try {
      // 권한에 따라 필터된 법인만 노출 (entity_user 는 본인 담당 법인만)
      const access = await fetchSubsidiariesForCurrentUser();
      setSubsidiaries(access.subsidiaries);
      setCanSeeAllEntities(access.canSeeAll);
      // entity_user 가 '전체' 또는 본인 외 entity 를 갖고 있으면 본인 첫 법인으로 보정
      if (!access.canSeeAll && access.subsidiaries.length > 0) {
        const validCodes = new Set(access.subsidiaries.map((s) => s.code));
        setSelectedEntity((prev) =>
          prev === 'all' || !validCodes.has(prev) ? access.subsidiaries[0].code : prev,
        );
      }
    } catch (error: unknown) {
      console.error('Failed to load subsidiaries:', getErrorMessage(error));
    }
  }, []);

  // ============================================
  // YoY/SG&A 보조 데이터 로드용 헬퍼
  // ============================================

  /**
   * 특정 entity codes 의 (year, month) 단월값을 P/L code별 합계 Map 으로 반환.
   * 단월값 = (year, month) 누계 − (year, month-1) 누계
   * 1월이면 누계 자체가 단월값
   */
  const loadSingleMonthByCode = useCallback(
    async (entityCodes: string[], year: number, month: number): Promise<Map<string, number>> => {
      const byCode = new Map<string, number>();
      for (const entityCode of entityCodes) {
        const cumulative = await getPLResults(entityCode, year, month);
        if (cumulative.length === 0) continue;

        if (month === 1) {
          cumulative.forEach((r) => {
            byCode.set(r.std_pl_code, (byCode.get(r.std_pl_code) || 0) + r.amount);
          });
        } else {
          const prevMonth = month - 1;
          const prevCumulative = await getPLResults(entityCode, year, prevMonth);
          const currMap = new Map<string, number>();
          cumulative.forEach((r) =>
            currMap.set(r.std_pl_code, (currMap.get(r.std_pl_code) || 0) + r.amount),
          );
          const prevMap = new Map<string, number>();
          prevCumulative.forEach((r) =>
            prevMap.set(r.std_pl_code, (prevMap.get(r.std_pl_code) || 0) + r.amount),
          );
          const allCodes = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
          allCodes.forEach((code) => {
            const diff = (currMap.get(code) || 0) - (prevMap.get(code) || 0);
            byCode.set(code, (byCode.get(code) || 0) + diff);
          });
        }
      }
      return byCode;
    },
    [],
  );

  /**
   * 특정 entity codes 의 (year, month) 누계(YTD)값을 P/L code별 합계 Map 으로 반환.
   */
  const loadCumulativeByCode = useCallback(
    async (entityCodes: string[], year: number, month: number): Promise<Map<string, number>> => {
      const byCode = new Map<string, number>();
      for (const entityCode of entityCodes) {
        const cumulative = await getPLResults(entityCode, year, month);
        cumulative.forEach((r) => {
          byCode.set(r.std_pl_code, (byCode.get(r.std_pl_code) || 0) + r.amount);
        });
      }
      return byCode;
    },
    [],
  );

  // ============================================
  // P/L 데이터 로드
  // ============================================
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      let currentData: PLSummary[] = [];
      let compareData: PLSummary[] = [];

      if (comparisonType === 'mom') {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const allEntities =
          selectedEntity === 'all' ? subsidiaries.map((s) => s.code) : [selectedEntity];
        const currentMonthlySummaries: PLSummary[] = [];
        const prevMonthlySummaries: PLSummary[] = [];

        for (const entityCode of allEntities) {
          const entityName = subsidiaries.find((s) => s.code === entityCode)?.name || entityCode;
          const currentCumulative = await getPLResults(entityCode, year, month);
          const prevCumulative = await getPLResults(entityCode, prevYear, prevMonth);

          if (month === 1) {
            if (currentCumulative.length > 0) {
              currentMonthlySummaries.push(
                calculatePLSummary(currentCumulative, entityCode, entityName, year, month)
              );
            }
            if (prevMonth === 12) {
              const prevPrevCumulative = await getPLResults(entityCode, prevYear - 1, 11);
              const prevMonthlyResults = calculateMonthlyDifference(
                prevCumulative,
                prevPrevCumulative,
                entityCode,
                prevYear,
                prevMonth
              );
              if (prevMonthlyResults.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(
                    prevMonthlyResults,
                    entityCode,
                    entityName,
                    prevYear,
                    prevMonth
                  )
                );
              }
            } else {
              if (prevCumulative.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(prevCumulative, entityCode, entityName, prevYear, prevMonth)
                );
              }
            }
          } else {
            const currentMonthlyResults = calculateMonthlyDifference(
              currentCumulative,
              prevCumulative,
              entityCode,
              year,
              month
            );
            if (currentMonthlyResults.length > 0) {
              currentMonthlySummaries.push(
                calculatePLSummary(currentMonthlyResults, entityCode, entityName, year, month)
              );
            }
            const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
            const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;
            const prevPrevCumulative = await getPLResults(entityCode, prevPrevYear, prevPrevMonth);

            if (prevMonth === 1) {
              if (prevCumulative.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(prevCumulative, entityCode, entityName, prevYear, prevMonth)
                );
              }
            } else {
              const prevMonthlyResults = calculateMonthlyDifference(
                prevCumulative,
                prevPrevCumulative,
                entityCode,
                prevYear,
                prevMonth
              );
              if (prevMonthlyResults.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(
                    prevMonthlyResults,
                    entityCode,
                    entityName,
                    prevYear,
                    prevMonth
                  )
                );
              }
            }
          }
        }
        currentData = currentMonthlySummaries;
        compareData = prevMonthlySummaries;
      } else {
        currentData = await getAllEntityPLSummaries(year, month);
        if (comparisonType === 'yoy') {
          compareData = await getAllEntityPLSummaries(year - 1, month);
        } else if (comparisonType === 'yoy_ytd') {
          const allMonths: PLSummary[] = [];
          for (let m = 1; m <= month; m++) {
            const monthData = await getAllEntityPLSummaries(year - 1, m);
            allMonths.push(...monthData);
          }
          const entityMap = new Map<string, PLSummary>();
          allMonths.forEach((summary) => {
            const key = summary.entityCode;
            if (!entityMap.has(key)) {
              entityMap.set(key, { ...summary, periodMonth: month });
            } else {
              const existing = entityMap.get(key)!;
              entityMap.set(key, {
                ...existing,
                sales: existing.sales + summary.sales,
                costOfSales: existing.costOfSales + summary.costOfSales,
                grossProfit: existing.grossProfit + summary.grossProfit,
                sellingAndAdminExpense:
                  existing.sellingAndAdminExpense + summary.sellingAndAdminExpense,
                operatingIncome: existing.operatingIncome + summary.operatingIncome,
                otherRevenue: existing.otherRevenue + summary.otherRevenue,
                otherExpense: existing.otherExpense + summary.otherExpense,
                financialRevenue: existing.financialRevenue + summary.financialRevenue,
                financialExpense: existing.financialExpense + summary.financialExpense,
                incomeBeforeTax: existing.incomeBeforeTax + summary.incomeBeforeTax,
                corporateIncomeTax: existing.corporateIncomeTax + summary.corporateIncomeTax,
                netIncome: existing.netIncome + summary.netIncome,
                gpMargin:
                  existing.sales + summary.sales !== 0
                    ? ((existing.grossProfit + summary.grossProfit) /
                        (existing.sales + summary.sales)) *
                      100
                    : 0,
                operatingMargin:
                  existing.sales + summary.sales !== 0
                    ? ((existing.operatingIncome + summary.operatingIncome) /
                        (existing.sales + summary.sales)) *
                      100
                    : 0,
                netMargin:
                  existing.sales + summary.sales !== 0
                    ? ((existing.netIncome + summary.netIncome) /
                        (existing.sales + summary.sales)) *
                      100
                    : 0,
              });
            }
          });
          compareData = Array.from(entityMap.values());
        }
      }

      if (selectedEntity !== 'all') {
        currentData = currentData.filter((s) => s.entityCode === selectedEntity);
        compareData = compareData.filter((s) => s.entityCode === selectedEntity);
      }

      setSummaries(currentData);
      setPrevSummaries(compareData);
    } catch (error: unknown) {
      console.error('Failed to load dashboard:', getErrorMessage(error));
      toast.error('데이터 로드 실패', { description: getErrorMessage(error) });
    } finally {
      setDataLoading(false);
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedEntity, comparisonType, subsidiaries]);

  // ============================================
  // B/S 데이터 로드
  // ============================================
  const loadBSData = useCallback(async () => {
    if (subsidiaries.length === 0) return;
    setBsLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);

      const entityCodes =
        selectedEntity === 'all' ? subsidiaries.map((s) => s.code) : [selectedEntity];

      // 최근 12개월 추이용 기간
      const trendPeriods = getLast12Months(year, month);
      // P&L 월별값 계산을 위한 이전 기간 (trendPeriods[0]의 직전월)
      const extraPLPeriod = prevPeriod(trendPeriods[0].year, trendPeriods[0].month);
      const plPeriods = [extraPLPeriod, ...trendPeriods];

      // BS 데이터: 12개월 (+ YoY 비교용 동월 전년)
      const yoyPeriod = { year: year - 1, month };
      const bsPeriodsToFetch = [...trendPeriods, yoyPeriod];

      const [bsRaw, plRaw] = await Promise.all([
        getBSResultsForPeriods(entityCodes, bsPeriodsToFetch),
        getPLResultsForPeriods(entityCodes, plPeriods),
      ]);

      // 각 추이 기간의 BSPeriodMetrics 계산
      const trendMetrics: BSPeriodMetrics[] = trendPeriods.map((period, i) => {
        const bsForPeriod = bsRaw.filter(
          (r) => r.period_year === period.year && r.period_month === period.month
        );
        const plPrevPeriod = plPeriods[i]; // plPeriods[i] = trendPeriods[i]의 직전 기간
        const plCurr = plRaw.filter(
          (r) => r.period_year === period.year && r.period_month === period.month
        );
        const plPrev = plRaw.filter(
          (r) => r.period_year === plPrevPeriod.year && r.period_month === plPrevPeriod.month
        );
        return computeBSPeriodMetrics(bsForPeriod, plCurr, plPrev, period.year, period.month, period.month === 1);
      });

      // 현재 기간 (trendMetrics 마지막)
      const currentMetrics = trendMetrics[trendMetrics.length - 1] ?? null;

      // 비교 기간 산출
      let compareMetrics: BSPeriodMetrics | null = null;
      if (comparisonType === 'mom') {
        // 직전월 = trendMetrics에서 현재 직전 인덱스
        compareMetrics = trendMetrics[trendMetrics.length - 2] ?? null;
      } else {
        // YoY / YoY YTD: 전년 동월
        const yoyBS = bsRaw.filter(
          (r) => r.period_year === yoyPeriod.year && r.period_month === yoyPeriod.month
        );
        // YoY P&L 월별값을 위한 직전 기간 (전년 동월의 직전월)
        const yoyPrev = prevPeriod(yoyPeriod.year, yoyPeriod.month);
        const yoyPlCurr = plRaw.filter(
          (r) => r.period_year === yoyPeriod.year && r.period_month === yoyPeriod.month
        );
        const yoyPlPrev = plRaw.filter(
          (r) => r.period_year === yoyPrev.year && r.period_month === yoyPrev.month
        );
        if (yoyBS.length > 0) {
          compareMetrics = computeBSPeriodMetrics(
            yoyBS,
            yoyPlCurr,
            yoyPlPrev,
            yoyPeriod.year,
            yoyPeriod.month,
            yoyPeriod.month === 1
          );
        }
      }

      setBsTrend(trendMetrics);
      setBsCurrent(currentMetrics);
      setBsCompare(compareMetrics);
    } catch (error: unknown) {
      console.error('Failed to load B/S data:', getErrorMessage(error));
      toast.error('B/S 데이터 로드 실패', { description: getErrorMessage(error) });
    } finally {
      setBsLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedEntity, comparisonType, subsidiaries]);

  useEffect(() => {
    void loadSubsidiaries();
  }, [loadSubsidiaries]);

  useEffect(() => {
    if (subsidiaries.length === 0) return;
    if (activeView === 'pl') {
      void loadData();
    } else {
      void loadBSData();
    }
  }, [activeView, subsidiaries, loadData, loadBSData]);

  // ============================================
  // YoY 카드 + SG&A 계정과목별 분석 보조 데이터 로드
  //   - YoY: 비교 탭과 무관하게 항상 (year-1, month) 단월값을 fetch
  //   - SG&A breakdown: 현재 비교탭(MoM/YoY/YoY YTD)에 맞춰 prev period 정의
  // ============================================
  const loadSupplementaryPL = useCallback(async () => {
    if (subsidiaries.length === 0 || activeView !== 'pl') return;
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const entityCodes =
        selectedEntity === 'all' ? subsidiaries.map((s) => s.code) : [selectedEntity];
      if (entityCodes.length === 0) {
        setYoySummaries([]);
        setSgaByAccountCurrent(new Map());
        setSgaByAccountPrev(new Map());
        return;
      }

      // ── YoY 단월값 (전년 동월): 항상 동일 ──
      // YoY 카드 요구 = Sales 단월값. summary 형태로 entity 별 PLSummary 를 만든다.
      const yoyByCodeByEntity: PLSummary[] = [];
      for (const entityCode of entityCodes) {
        const entityName =
          subsidiaries.find((s) => s.code === entityCode)?.name || entityCode;
        const cumulative = await getPLResults(entityCode, year - 1, month);
        if (cumulative.length === 0) continue;
        let monthlyResults: PLResult[] = cumulative;
        if (month !== 1) {
          const prevCumulative = await getPLResults(entityCode, year - 1, month - 1);
          monthlyResults = calculateMonthlyDifference(
            cumulative,
            prevCumulative,
            entityCode,
            year - 1,
            month,
          );
        }
        if (monthlyResults.length > 0) {
          yoyByCodeByEntity.push(
            calculatePLSummary(monthlyResults, entityCode, entityName, year - 1, month),
          );
        }
      }
      setYoySummaries(yoyByCodeByEntity);

      // ── SG&A 계정과목별 breakdown ──
      // 비교탭에 따라 current/prev period 의 단월(또는 YTD) 합계를 코드별로 집계
      if (comparisonType === 'yoy_ytd') {
        // YTD : 현재 (year, month) 누계 vs 전년 (year-1, month) 누계
        const [curr, prev] = await Promise.all([
          loadCumulativeByCode(entityCodes, year, month),
          loadCumulativeByCode(entityCodes, year - 1, month),
        ]);
        setSgaByAccountCurrent(curr);
        setSgaByAccountPrev(prev);
      } else {
        // 단월값
        const curr = await loadSingleMonthByCode(entityCodes, year, month);
        let prev: Map<string, number>;
        if (comparisonType === 'mom') {
          const prevMonth = month === 1 ? 12 : month - 1;
          const prevYear = month === 1 ? year - 1 : year;
          prev = await loadSingleMonthByCode(entityCodes, prevYear, prevMonth);
        } else {
          // yoy
          prev = await loadSingleMonthByCode(entityCodes, year - 1, month);
        }
        setSgaByAccountCurrent(curr);
        setSgaByAccountPrev(prev);
      }

      // ── SG&A 12개월 단월 트렌드 ──
      // 최근 12개월 단월값을 한 번의 벌크 쿼리로 가져와 코드별 시계열을 만든다
      const trendPeriods = getLast12Months(year, month);
      const anchorPeriod = prevPeriod(trendPeriods[0].year, trendPeriods[0].month);
      const allPeriodsForTrend = [anchorPeriod, ...trendPeriods];
      const plRaw = await getPLResultsForPeriods(entityCodes, allPeriodsForTrend);

      // (year, month) → Map<code, sum across entities>
      const cumulativeByPeriod = new Map<string, Map<string, number>>();
      for (const p of allPeriodsForTrend) {
        cumulativeByPeriod.set(`${p.year}-${p.month}`, new Map<string, number>());
      }
      plRaw.forEach((r) => {
        const key = `${r.period_year}-${r.period_month}`;
        const codeMap = cumulativeByPeriod.get(key);
        if (codeMap) {
          codeMap.set(r.std_pl_code, (codeMap.get(r.std_pl_code) || 0) + r.amount);
        }
      });

      // 각 trend period 의 단월값
      //   - 1월: YTD 가 매년 0 으로 리셋되므로 단월값 = 누계 자체 (빼지 않는다)
      //   - 2~12월: 단월값 = 당월 누계 − 직전월(같은 해) 누계
      //   - 당월 미업로드: 0 으로 (음수 폭주 회피)
      //   - 직전월 미업로드: 차이값을 신뢰할 수 없어 0 으로
      const trendByCode = new Map<string, number[]>();
      const labels: string[] = [];
      trendPeriods.forEach((p, idx) => {
        labels.push(`${p.year}.${String(p.month).padStart(2, '0')}`);
        const currMap =
          cumulativeByPeriod.get(`${p.year}-${p.month}`) ?? new Map<string, number>();

        // 당월 업로드 자체가 없으면 모든 코드 값을 0 으로 두고 다음 달로
        if (currMap.size === 0) return;

        // 1월: 누계 = 단월
        if (p.month === 1) {
          currMap.forEach((amount, code) => {
            const arr = trendByCode.get(code) ?? new Array(12).fill(0);
            arr[idx] = amount;
            trendByCode.set(code, arr);
          });
          return;
        }

        // 2~12월: 같은 해 직전월 누계와의 차이
        const prevYear = p.year;
        const prevMonth = p.month - 1;
        const prevMap =
          cumulativeByPeriod.get(`${prevYear}-${prevMonth}`) ?? new Map<string, number>();
        if (prevMap.size === 0) {
          // 직전월 미업로드 → 신뢰 불가, 0 유지
          return;
        }
        const allCodes = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
        allCodes.forEach((code) => {
          const diff = (currMap.get(code) || 0) - (prevMap.get(code) || 0);
          const arr = trendByCode.get(code) ?? new Array(12).fill(0);
          arr[idx] = diff;
          trendByCode.set(code, arr);
        });
      });
      setSgaTrendLabels(labels);
      setSgaTrendByCode(trendByCode);

      // ── 12개월 P/L 트렌드 (Sales / OP Margin / Net Income) ──
      // trendByCode 와 동일한 단월 diff 를 이용해 손익 항목별 12개월 시계열 생성.
      const SALES_CODES = ['41000', '42000', '43000', '44000', '45000', '46000'];
      const COGS_CODES = ['51000', '52000', '53000', '54000'];
      const OTHER_REV_CODES = Array.from(
        { length: 9 },
        (_, i) => `710${String(i + 1).padStart(2, '0')}`,
      );
      const OTHER_EXP_CODES = Array.from(
        { length: 13 },
        (_, i) => `720${String(i + 1).padStart(2, '0')}`,
      );
      const FIN_REV_CODES = Array.from(
        { length: 5 },
        (_, i) => `730${String(i + 1).padStart(2, '0')}`,
      );
      const FIN_EXP_CODES = Array.from(
        { length: 4 },
        (_, i) => `740${String(i + 1).padStart(2, '0')}`,
      );
      const TAX_CODE = '80001';

      const sumByCodes = (codes: readonly string[], i: number): number => {
        return codes.reduce((s, c) => s + ((trendByCode.get(c)?.[i] ?? 0)), 0);
      };
      const sgaSumByMonth = (i: number): number => {
        let total = 0;
        trendByCode.forEach((arr, code) => {
          if (code.startsWith('600')) total += arr[i] ?? 0;
        });
        return total;
      };

      const monthly = labels.map((label, i) => {
        const sales = sumByCodes(SALES_CODES, i);
        const cogs = sumByCodes(COGS_CODES, i);
        const gp = sales - cogs;
        const sga = sgaSumByMonth(i);
        const opIncome = gp - sga;
        const otherRev = sumByCodes(OTHER_REV_CODES, i);
        const otherExp = sumByCodes(OTHER_EXP_CODES, i);
        const finRev = sumByCodes(FIN_REV_CODES, i);
        const finExp = sumByCodes(FIN_EXP_CODES, i);
        const tax = trendByCode.get(TAX_CODE)?.[i] ?? 0;
        const ibt = opIncome + otherRev - otherExp + finRev - finExp;
        const netIncome = ibt - tax;
        const operatingMargin = sales !== 0 ? (opIncome / sales) * 100 : null;
        return { label, sales, operatingMargin, netIncome };
      });
      setMonthlyTrendData(monthly);
    } catch (error: unknown) {
      console.error('Failed to load supplementary P/L data:', getErrorMessage(error));
    }
  }, [
    activeView,
    subsidiaries,
    selectedYear,
    selectedMonth,
    selectedEntity,
    comparisonType,
    loadSingleMonthByCode,
    loadCumulativeByCode,
  ]);

  useEffect(() => {
    if (activeView !== 'pl') return;
    void loadSupplementaryPL();
  }, [activeView, loadSupplementaryPL]);

  // std_pl_master 1회 로드 (SG&A 계정명 표시용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getStdPLMaster();
        if (!cancelled) setPLMaster(data);
      } catch (e) {
        console.warn('PL master load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 그래프 기본 선택: 데이터가 로드되면 당기 절댓값이 가장 큰 SG&A 계정으로 자동 선택
  useEffect(() => {
    if (selectedSgaCodes.length > 0) return;
    if (sgaByAccountCurrent.size === 0) return;
    let topCode = '';
    let topVal = 0;
    sgaByAccountCurrent.forEach((amount, code) => {
      if (!code.startsWith('600')) return;
      const abs = Math.abs(amount);
      if (abs > topVal) {
        topVal = abs;
        topCode = code;
      }
    });
    if (topCode) setSelectedSgaCodes([topCode]);
  }, [sgaByAccountCurrent, selectedSgaCodes]);

  // ============================================
  // P/L 요약 계산
  // ============================================
  const dashboardData = useMemo(() => {
    const totalSales = summaries.reduce((sum, s) => sum + s.sales, 0);
    const totalGP = summaries.reduce((sum, s) => sum + s.grossProfit, 0);
    const totalOperatingIncome = summaries.reduce((sum, s) => sum + s.operatingIncome, 0);
    const totalNetIncome = summaries.reduce((sum, s) => sum + s.netIncome, 0);
    const totalSGA = summaries.reduce((sum, s) => sum + s.sellingAndAdminExpense, 0);
    const gpPercent = totalSales !== 0 ? (totalGP / totalSales) * 100 : 0;
    const opPercent = totalSales !== 0 ? (totalOperatingIncome / totalSales) * 100 : 0;
    const sgaSalesPercent = totalSales !== 0 ? (totalSGA / totalSales) * 100 : 0;

    const prevTotalSales = prevSummaries.reduce((sum, s) => sum + s.sales, 0);
    const prevTotalGP = prevSummaries.reduce((sum, s) => sum + s.grossProfit, 0);
    const prevGPPercent = prevTotalSales !== 0 ? (prevTotalGP / prevTotalSales) * 100 : 0;
    const prevTotalNetIncome = prevSummaries.reduce((sum, s) => sum + s.netIncome, 0);
    const prevTotalSGA = prevSummaries.reduce((sum, s) => sum + s.sellingAndAdminExpense, 0);
    const prevSgaSalesPercent =
      prevTotalSales !== 0 ? (prevTotalSGA / prevTotalSales) * 100 : 0;

    // YoY 단월 Sales — 비교 탭과 무관하게 항상 (year-1, month) 단월값
    const yoyTotalSales = yoySummaries.reduce((sum, s) => sum + s.sales, 0);

    const salesChange =
      prevTotalSales !== 0
        ? ((totalSales - prevTotalSales) / Math.abs(prevTotalSales)) * 100
        : null;
    const gpPercentChange = prevGPPercent !== 0 ? gpPercent - prevGPPercent : null;
    const netIncomeChange =
      prevTotalNetIncome !== 0
        ? ((totalNetIncome - prevTotalNetIncome) / Math.abs(prevTotalNetIncome)) * 100
        : null;
    const sgaSalesPercentChange =
      prevSgaSalesPercent !== 0 ? sgaSalesPercent - prevSgaSalesPercent : null;

    // YoY Revenue Growth %: 항상 전년 동월 단월 대비
    const yoyRevenueGrowth =
      yoyTotalSales !== 0
        ? ((totalSales - yoyTotalSales) / Math.abs(yoyTotalSales)) * 100
        : null;

    const getChangeLabel = () => {
      if (comparisonType === 'mom') return 'MoM';
      if (comparisonType === 'yoy') return 'YoY';
      if (comparisonType === 'yoy_ytd') return 'YoY YTD';
      return '';
    };

    return {
      totalSales,
      totalGP,
      gpPercent,
      totalOperatingIncome,
      opPercent,
      totalNetIncome,
      totalSGA,
      sgaSalesPercent,
      yoyRevenueGrowth,
      salesChange,
      gpPercentChange,
      netIncomeChange,
      sgaSalesPercentChange,
      changeLabel: getChangeLabel(),
    };
  }, [summaries, prevSummaries, yoySummaries, comparisonType]);

  // ============================================
  // SG&A 계정과목별 증감 (현재 비교탭 기준)
  // ============================================
  const sgaBreakdown = useMemo(() => {
    if (plMaster.length === 0) return [];
    const sgaCodes = plMaster
      .filter((m) => m.pl_code.startsWith('600'))
      .sort((a, b) => a.display_order - b.display_order);

    return sgaCodes
      .map((m) => {
        const current = sgaByAccountCurrent.get(m.pl_code) || 0;
        const prev = sgaByAccountPrev.get(m.pl_code) || 0;
        const diff = current - prev;
        const changePct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : null;
        return {
          code: m.pl_code,
          label: m.pl_line,
          current,
          prev,
          diff,
          changePct,
        };
      })
      .filter((r) => r.current !== 0 || r.prev !== 0); // 둘 다 0 인 계정은 숨김
  }, [plMaster, sgaByAccountCurrent, sgaByAccountPrev]);

  // ── 계정과목 멀티 선택 차트용 옵션 (Sales / COGS / SG&A 통합) ──
  // sgaTrendByCode 와 sgaByAccountCurrent 는 이미 모든 코드를 담고 있어
  // 4xxxx, 5xxxx, 6xxxx 까지 확장만 하면 됨.
  const accountChartOptions = useMemo(() => {
    if (plMaster.length === 0) return [];
    const isInScope = (code: string) =>
      code.startsWith('4') || code.startsWith('5') || code.startsWith('6');
    const categoryOf = (code: string): 'Sales' | 'COGS' | 'SG&A' => {
      if (code.startsWith('4')) return 'Sales';
      if (code.startsWith('5')) return 'COGS';
      return 'SG&A';
    };
    const categoryOrder = { Sales: 0, COGS: 1, 'SG&A': 2 } as const;
    return plMaster
      .filter((m) => isInScope(m.pl_code))
      .map((m) => {
        const current = sgaByAccountCurrent.get(m.pl_code) || 0;
        const prev = sgaByAccountPrev.get(m.pl_code) || 0;
        return {
          code: m.pl_code,
          label: m.pl_line,
          category: categoryOf(m.pl_code),
          current,
          prev,
          displayOrder: m.display_order,
        };
      })
      .filter((r) => r.current !== 0 || r.prev !== 0)
      .sort((a, b) => {
        const c = categoryOrder[a.category] - categoryOrder[b.category];
        if (c !== 0) return c;
        return a.code.localeCompare(b.code);
      });
  }, [plMaster, sgaByAccountCurrent, sgaByAccountPrev]);

  const insights = useMemo(() => {
    const items: Array<{ type: 'warning' | 'success' | 'info'; message: string }> = [];
    summaries.forEach((s) => {
      if (s.gpMargin < 35 && s.sales > 0) {
        items.push({ type: 'warning', message: `${s.entityName}: GP% ${s.gpMargin.toFixed(1)}% (업계 평균 이하)` });
      }
      if (s.netIncome < 0) {
        items.push({ type: 'warning', message: `${s.entityName}: 당기순손실 ${formatCompact(-s.netIncome)}` });
      }
      if (s.gpMargin >= 50 && s.sales > 0) {
        items.push({ type: 'success', message: `${s.entityName}: GP% ${s.gpMargin.toFixed(1)}% (우수)` });
      }
      if (s.operatingMargin > 0 && s.sales > 0) {
        const prevSummary = prevSummaries.find((p) => p.entityCode === s.entityCode);
        if (prevSummary && prevSummary.operatingMargin <= 0) {
          items.push({ type: 'success', message: `${s.entityName}: Operating margin turned positive` });
        }
      }
      const prevSummary = prevSummaries.find((p) => p.entityCode === s.entityCode);
      if (prevSummary && prevSummary.sellingAndAdminExpense > 0) {
        const sgaChange =
          ((s.sellingAndAdminExpense - prevSummary.sellingAndAdminExpense) /
            prevSummary.sellingAndAdminExpense) *
          100;
        if (sgaChange > 25) {
          items.push({ type: 'warning', message: `${s.entityName}: SG&A spiked ${sgaChange.toFixed(0)}% - review breakdown` });
        }
      }
    });
    if (dashboardData.salesChange !== null && Math.abs(dashboardData.salesChange) >= 10) {
      items.push({
        type: dashboardData.salesChange > 0 ? 'success' : 'warning',
        message: `전체 Sales ${dashboardData.salesChange > 0 ? '+' : ''}${dashboardData.salesChange.toFixed(1)}% ${dashboardData.changeLabel} 변동`,
      });
    }
    return items;
  }, [summaries, dashboardData, prevSummaries]);

  const profitabilityChartData = useMemo(() =>
    summaries.map((s) => ({
      entity: s.entityName.replace('InBody ', ''),
      'GP%': Number(s.gpMargin.toFixed(1)),
      'Operating Margin%': Number(s.operatingMargin.toFixed(1)),
      'Net%': Number(s.netMargin.toFixed(1)),
    })),
  [summaries]);

  const salesChartData = useMemo(() =>
    summaries
      .sort((a, b) => b.sales - a.sales)
      .map((s) => ({
        entity: s.entityName.replace('InBody ', ''),
        Sales: Math.round(s.sales / 1_000),
        'Net Income': Math.round(s.netIncome / 1_000),
      })),
  [summaries]);

  const compareLabel = comparisonType === 'mom' ? 'MoM' : comparisonType === 'yoy' ? 'YoY' : 'YoY YTD';
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => String(2020 + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto py-6 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Monthly Dashboard</h1>
          <p className="text-gray-600">
            {selectedEntity === 'all'
              ? '전체 법인 재무성과 요약 및 인사이트'
              : `${subsidiaries.find((s) => s.code === selectedEntity)?.name || selectedEntity} 재무성과`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="entity-select">Entity</Label>
            <Select value={selectedEntity} onValueChange={setSelectedEntity}>
              <SelectTrigger id="entity-select" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {canSeeAllEntities && <SelectItem value="all">전체</SelectItem>}
                {subsidiaries.map((sub) => (
                  <SelectItem key={sub.id} value={sub.code}>
                    {sub.name.replace('InBody ', '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadStatements()}
            disabled={downloadingHtml || subsidiaries.length === 0}
            title="현재 선택된 Entity / 기간 기준 P/L · B/S 를 HTML 파일로 저장"
          >
            <Download className="h-4 w-4 mr-1.5" />
            {downloadingHtml ? '생성 중...' : 'P/L · B/S HTML'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadAnalytics()}
            disabled={downloadingAnalytics || subsidiaries.length === 0}
            title="성장성 · 수익성 · 비용구조 · SG&A breakdown · 위험 신호 분석 지표를 HTML 파일로 저장"
          >
            <Download className="h-4 w-4 mr-1.5" />
            {downloadingAnalytics ? '생성 중...' : '분석 지표 HTML'}
          </Button>
        </div>
      </div>

      {/* P/L | B/S 토글 */}
      <div className="flex-shrink-0 mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
          <button
            onClick={() => setActiveView('pl')}
            className={cn(
              'px-5 py-1.5 text-sm font-medium rounded-md transition-all',
              activeView === 'pl'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            P/L
          </button>
          <button
            onClick={() => setActiveView('bs')}
            className={cn(
              'px-5 py-1.5 text-sm font-medium rounded-md transition-all',
              activeView === 'bs'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            B/S
          </button>
        </div>
      </div>

      {/* 비교 탭 */}
      <Tabs
        value={comparisonType}
        onValueChange={(v) => setComparisonType(v as ComparisonType)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="mom">직전월 (MoM)</TabsTrigger>
          <TabsTrigger value="yoy">전년도 동월 (YoY)</TabsTrigger>
          <TabsTrigger value="yoy_ytd">전년도 동월(누적) (YoY YTD)</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ============================================================
          P/L 뷰
      ============================================================ */}
      {activeView === 'pl' && (
        <>
          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : summaries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="mb-2">해당 기간의 데이터가 없습니다.</p>
                <p className="text-sm">Upload 탭에서 TB 파일을 업로드하고 Mapping을 완료한 후 확인해주세요.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards — 5칸 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <SummaryCard
                  title="Total Sales"
                  value={formatCompact(dashboardData.totalSales)}
                  change={dashboardData.salesChange}
                  changeLabel={dashboardData.changeLabel}
                  icon={DollarSign}
                  iconColor="text-blue-600"
                  bgColor="bg-blue-50"
                />
                <SummaryCard
                  title="Gross Profit %"
                  value={`${dashboardData.gpPercent.toFixed(1)}%`}
                  change={dashboardData.gpPercentChange}
                  changeLabel={dashboardData.changeLabel}
                  changeSuffix="pp"
                  icon={Activity}
                  iconColor="text-green-600"
                  bgColor="bg-green-50"
                />
                <SummaryCard
                  title="Net Income"
                  value={formatCompact(dashboardData.totalNetIncome)}
                  change={dashboardData.netIncomeChange}
                  changeLabel={dashboardData.changeLabel}
                  icon={TrendingUp}
                  iconColor="text-purple-600"
                  bgColor="bg-purple-50"
                />
                <SummaryCard
                  title="YoY Revenue Growth"
                  value={
                    dashboardData.yoyRevenueGrowth !== null
                      ? `${dashboardData.yoyRevenueGrowth >= 0 ? '+' : ''}${dashboardData.yoyRevenueGrowth.toFixed(1)}%`
                      : '-'
                  }
                  change={null}
                  changeLabel=""
                  note={
                    dashboardData.yoyRevenueGrowth === null
                      ? `전년 동월(${parseInt(selectedYear) - 1}년 ${selectedMonth}월) 데이터 없음`
                      : undefined
                  }
                  icon={TrendingUp}
                  iconColor="text-rose-600"
                  bgColor="bg-rose-50"
                />
                <SummaryCard
                  title="SG&A / Sales"
                  value={`${dashboardData.sgaSalesPercent.toFixed(1)}%`}
                  change={dashboardData.sgaSalesPercentChange}
                  changeLabel={dashboardData.changeLabel}
                  changeSuffix="pp"
                  icon={Activity}
                  iconColor="text-amber-600"
                  bgColor="bg-amber-50"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">12개월 추이 (Sales / OP Margin / Net Income)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthlyTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={monthlyTrendData}
                          margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          {/* 좌측 축: 금액 (Sales / Net Income) */}
                          <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) =>
                              Math.abs(v) >= 1_000_000
                                ? `${(v / 1_000_000).toFixed(1)}M`
                                : Math.abs(v) >= 1_000
                                  ? `${(v / 1_000).toFixed(0)}K`
                                  : `${v}`
                            }
                          />
                          {/* 우측 축: 비율 (Operating Margin %) */}
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === 'Operating Margin') {
                                return [`${value.toFixed(1)}%`, name];
                              }
                              return [`${value.toLocaleString()}`, name];
                            }}
                          />
                          <Legend />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="sales"
                            name="Sales"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="netIncome"
                            name="Net Income"
                            stroke="#8B5CF6"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="operatingMargin"
                            name="Operating Margin"
                            stroke="#F59E0B"
                            strokeWidth={2}
                            strokeDasharray="4 2"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-gray-400 text-center py-8">차트 데이터 없음</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profitability Comparison (%)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {profitabilityChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={profitabilityChartData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="entity" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                          <Tooltip formatter={(value: number, name: string) => [`${value}%`, name]} />
                          <Legend />
                          <Bar dataKey="GP%" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Operating Margin%" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Net%" fill="#6366F1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-gray-400 text-center py-8">차트 데이터 없음</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* SG&A 12개월 단월 추이 — 멀티 계정 선택형 차트 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-lg">
                      계정과목 12개월 추이
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (Sales / COGS / SG&A 다중 선택)
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">계정과목</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-[280px] justify-between font-normal"
                          >
                            <span className="truncate text-sm">
                              {selectedSgaCodes.length === 0
                                ? '계정과목 선택'
                                : selectedSgaCodes.length === 1
                                  ? (() => {
                                      const r = accountChartOptions.find(
                                        (b) => b.code === selectedSgaCodes[0],
                                      );
                                      return r ? `${r.code} ${r.label}` : selectedSgaCodes[0];
                                    })()
                                  : `${selectedSgaCodes.length}개 선택됨`}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[360px] p-0" align="end">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-500">
                              {selectedSgaCodes.length}/{accountChartOptions.length} 선택
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() =>
                                  setSelectedSgaCodes(accountChartOptions.map((r) => r.code))
                                }
                              >
                                전체
                              </button>
                              <button
                                type="button"
                                className="text-xs text-gray-500 hover:underline"
                                onClick={() => setSelectedSgaCodes([])}
                              >
                                해제
                              </button>
                            </div>
                          </div>
                          <div className="max-h-[400px] overflow-y-auto py-1">
                            {accountChartOptions.length === 0 ? (
                              <p className="text-xs text-gray-400 px-3 py-3 text-center">
                                해당 기간 계정 데이터가 없습니다.
                              </p>
                            ) : (
                              (['Sales', 'COGS', 'SG&A'] as const).map((cat) => {
                                const rowsInCat = accountChartOptions.filter(
                                  (r) => r.category === cat,
                                );
                                if (rowsInCat.length === 0) return null;
                                const allChecked = rowsInCat.every((r) =>
                                  selectedSgaCodes.includes(r.code),
                                );
                                return (
                                  <div key={cat}>
                                    <div className="flex items-center justify-between px-3 py-1 bg-gray-50 text-[11px] font-semibold text-gray-600 sticky top-0">
                                      <span>{cat} ({rowsInCat.length})</span>
                                      <button
                                        type="button"
                                        className="text-[10px] text-blue-600 hover:underline"
                                        onClick={() => {
                                          const catCodes = rowsInCat.map((r) => r.code);
                                          if (allChecked) {
                                            // 카테고리 전체 해제
                                            setSelectedSgaCodes(
                                              selectedSgaCodes.filter(
                                                (c) => !catCodes.includes(c),
                                              ),
                                            );
                                          } else {
                                            // 카테고리 전체 선택
                                            setSelectedSgaCodes(
                                              Array.from(
                                                new Set([...selectedSgaCodes, ...catCodes]),
                                              ),
                                            );
                                          }
                                        }}
                                      >
                                        {allChecked ? '카테고리 해제' : '카테고리 전체'}
                                      </button>
                                    </div>
                                    {rowsInCat.map((row) => {
                                      const checked = selectedSgaCodes.includes(row.code);
                                      return (
                                        <label
                                          key={row.code}
                                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                                        >
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={(v) => {
                                              const next = v
                                                ? [...selectedSgaCodes, row.code]
                                                : selectedSgaCodes.filter(
                                                    (c) => c !== row.code,
                                                  );
                                              setSelectedSgaCodes(next);
                                            }}
                                          />
                                          <span className="text-gray-500 font-mono text-xs">
                                            {row.code}
                                          </span>
                                          <span className="flex-1 truncate">{row.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    if (selectedSgaCodes.length === 0) {
                      return (
                        <p className="text-sm text-gray-400 py-8 text-center">
                          계정과목을 선택해 주세요.
                        </p>
                      );
                    }
                    // 각 row = { label, code1: value, code2: value, ... }
                    const chartData = sgaTrendLabels.map((label, i) => {
                      const row: Record<string, number | string> = { label };
                      selectedSgaCodes.forEach((code) => {
                        const arr = sgaTrendByCode.get(code) ?? new Array(12).fill(0);
                        row[code] = arr[i] ?? 0;
                      });
                      return row;
                    });
                    const allZero = selectedSgaCodes.every((code) => {
                      const arr = sgaTrendByCode.get(code) ?? new Array(12).fill(0);
                      return arr.every((v) => v === 0);
                    });
                    if (allZero) {
                      return (
                        <p className="text-sm text-gray-400 py-8 text-center">
                          선택한 계정(들)의 최근 12개월 데이터가 없습니다.
                        </p>
                      );
                    }
                    // 색상 팔레트
                    const PALETTE = [
                      '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444',
                      '#14B8A6', '#F472B6', '#6366F1', '#EAB308', '#06B6D4',
                      '#84CC16', '#F97316',
                    ];
                    return (
                      <>
                        <ResponsiveContainer width="100%" height={320}>
                          <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) =>
                                Math.abs(v) >= 1_000_000
                                  ? `${(v / 1_000_000).toFixed(1)}M`
                                  : Math.abs(v) >= 1_000
                                  ? `${(v / 1_000).toFixed(0)}K`
                                  : `${v}`
                              }
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                const row = accountChartOptions.find((r) => r.code === name);
                                return [
                                  value.toLocaleString(),
                                  row ? `[${row.category}] ${row.code} ${row.label}` : name,
                                ];
                              }}
                            />
                            <Legend
                              formatter={(value: string) => {
                                const row = accountChartOptions.find((r) => r.code === value);
                                return row
                                  ? `[${row.category}] ${row.code} · ${row.label}`
                                  : value;
                              }}
                              wrapperStyle={{ fontSize: '11px' }}
                            />
                            {selectedSgaCodes.map((code, idx) => (
                              <Line
                                key={code}
                                type="monotone"
                                dataKey={code}
                                name={code}
                                stroke={PALETTE[idx % PALETTE.length]}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-gray-400 mt-3">
                          * 각 점은 해당 월의 단월값(누계 차이) 입니다. 1월은 누계 자체가 단월값.
                        </p>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* SG&A 계정과목별 증감 — 현재 비교탭(MoM/YoY/YoY YTD) 기준 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    SG&A 계정과목별 증감
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({dashboardData.changeLabel || '—'} 기준)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sgaBreakdown.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">
                      SG&A 데이터가 없습니다.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-2 px-3 font-semibold">계정과목</th>
                            <th className="text-right py-2 px-3 font-semibold">당기</th>
                            <th className="text-right py-2 px-3 font-semibold">
                              비교기간
                            </th>
                            <th className="text-right py-2 px-3 font-semibold">증감</th>
                            <th className="text-right py-2 px-3 font-semibold">증감 %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sgaBreakdown
                            .slice()
                            .sort((a, b) => a.code.localeCompare(b.code))
                            .map((row) => {
                              const isUp = row.diff > 0;
                              const isDown = row.diff < 0;
                              return (
                                <tr
                                  key={row.code}
                                  className="border-b hover:bg-gray-50"
                                >
                                  <td className="py-2 px-3">
                                    <span className="text-gray-500 mr-2 font-mono text-xs">
                                      {row.code}
                                    </span>
                                    {row.label}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    {formatCompact(row.current)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-gray-500">
                                    {formatCompact(row.prev)}
                                  </td>
                                  <td
                                    className={cn(
                                      'py-2 px-3 text-right font-mono',
                                      isUp && 'text-rose-600',
                                      isDown && 'text-emerald-600',
                                    )}
                                  >
                                    {row.diff > 0 ? '+' : ''}
                                    {formatCompact(row.diff)}
                                  </td>
                                  <td
                                    className={cn(
                                      'py-2 px-3 text-right',
                                      isUp && 'text-rose-600',
                                      isDown && 'text-emerald-600',
                                    )}
                                  >
                                    {row.changePct !== null
                                      ? `${row.changePct > 0 ? '+' : ''}${row.changePct.toFixed(1)}%`
                                      : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          {/* Total */}
                          <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                            <td className="py-2 px-3">Total</td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatCompact(
                                sgaBreakdown.reduce((s, r) => s + r.current, 0),
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-gray-500">
                              {formatCompact(
                                sgaBreakdown.reduce((s, r) => s + r.prev, 0),
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {(() => {
                                const totalDiff = sgaBreakdown.reduce(
                                  (s, r) => s + r.diff,
                                  0,
                                );
                                return `${totalDiff > 0 ? '+' : ''}${formatCompact(totalDiff)}`;
                              })()}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {(() => {
                                const totalCurr = sgaBreakdown.reduce(
                                  (s, r) => s + r.current,
                                  0,
                                );
                                const totalPrev = sgaBreakdown.reduce(
                                  (s, r) => s + r.prev,
                                  0,
                                );
                                if (totalPrev === 0) return '-';
                                const pct = ((totalCurr - totalPrev) / Math.abs(totalPrev)) * 100;
                                return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-xs text-gray-400 mt-3">
                        * 비교 기간은 상단 비교 탭(MoM/YoY/YoY YTD) 선택을 따릅니다. 증감 컬러 — 비용
                        증가는 <span className="text-rose-600">빨강</span>, 감소는{' '}
                        <span className="text-emerald-600">초록</span>.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Insights */}
              {insights.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Insights & Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg',
                            insight.type === 'warning' && 'bg-orange-50 border border-orange-200',
                            insight.type === 'success' && 'bg-green-50 border border-green-200',
                            insight.type === 'info' && 'bg-blue-50 border border-blue-200'
                          )}
                        >
                          {insight.type === 'warning' && <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />}
                          {insight.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />}
                          {insight.type === 'info' && <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />}
                          <span className="text-sm">{insight.message}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Entity P&L Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Entity P&L Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left py-2 px-3 font-semibold">Entity</th>
                          <th className="text-right py-2 px-3 font-semibold">Sales</th>
                          <th className="text-right py-2 px-3 font-semibold">GP</th>
                          <th className="text-right py-2 px-3 font-semibold">GP%</th>
                          <th className="text-right py-2 px-3 font-semibold">Operating Income</th>
                          <th className="text-right py-2 px-3 font-semibold">Op. Margin%</th>
                          <th className="text-right py-2 px-3 font-semibold">Net Income</th>
                          <th className="text-right py-2 px-3 font-semibold">Net%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaries
                          .sort((a, b) => b.sales - a.sales)
                          .map((s) => (
                            <tr key={s.entityCode} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-3 font-medium">{s.entityName}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCompact(s.sales)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCompact(s.grossProfit)}</td>
                              <td className="py-2 px-3 text-right">{s.gpMargin.toFixed(1)}%</td>
                              <td className={cn('py-2 px-3 text-right font-mono', s.operatingIncome < 0 && 'text-red-600')}>
                                {formatCompact(s.operatingIncome)}
                              </td>
                              <td className="py-2 px-3 text-right">{s.operatingMargin.toFixed(1)}%</td>
                              <td className={cn('py-2 px-3 text-right font-mono', s.netIncome < 0 && 'text-red-600')}>
                                {formatCompact(s.netIncome)}
                              </td>
                              <td className="py-2 px-3 text-right">{s.netMargin.toFixed(1)}%</td>
                            </tr>
                          ))}
                        <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCompact(summaries.reduce((s, e) => s + e.sales, 0))}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCompact(summaries.reduce((s, e) => s + e.grossProfit, 0))}</td>
                          <td className="py-2 px-3 text-right">{dashboardData.gpPercent.toFixed(1)}%</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCompact(summaries.reduce((s, e) => s + e.operatingIncome, 0))}</td>
                          <td className="py-2 px-3 text-right">{dashboardData.opPercent.toFixed(1)}%</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCompact(summaries.reduce((s, e) => s + e.netIncome, 0))}</td>
                          <td className="py-2 px-3 text-right">
                            {(summaries.reduce((s, e) => s + e.sales, 0) !== 0
                              ? (summaries.reduce((s, e) => s + e.netIncome, 0) /
                                  summaries.reduce((s, e) => s + e.sales, 0)) *
                                100
                              : 0
                            ).toFixed(1)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ============================================================
          B/S 뷰
      ============================================================ */}
      {activeView === 'bs' && (
        <>
          {bsLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : bsTrend.length === 0 && !bsCurrent ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="mb-2">해당 기간의 B/S 데이터가 없습니다.</p>
                <p className="text-sm">Upload 탭에서 TB 파일을 업로드하고 Mapping을 완료한 후 확인해주세요.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-10">
              {/* 1. Assets Status */}
              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                  1. Assets Status
                </h2>
                <AssetsStatus
                  trendData={bsTrend}
                  currentData={bsCurrent}
                  compareData={bsCompare}
                  compareLabel={compareLabel}
                />
              </section>

              {/* 2. Working Capital */}
              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                  2. Working Capital
                </h2>
                <WorkingCapital trendData={bsTrend} currentData={bsCurrent} />
              </section>

              {/* 3. Inventories */}
              <section>
                <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                  3. Inventories
                </h2>
                <InventoriesPanel trendData={bsTrend} />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// Summary Card (P/L용)
// ============================================
function SummaryCard({
  title,
  value,
  change,
  changeLabel,
  changeSuffix = '%',
  note,
  icon: Icon,
  iconColor,
  bgColor,
}: {
  title: string;
  value: string;
  change: number | null;
  changeLabel: string;
  changeSuffix?: string;
  /** change 가 null 일 때 대신 노출할 안내 문구 (예: "전년 동월 데이터 없음") */
  note?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change !== null && (
              <div className="flex items-center gap-1 mt-1">
                {change > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : change < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : null}
                <span
                  className={cn(
                    'text-sm',
                    change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                  )}
                >
                  {change > 0 ? '+' : ''}{change.toFixed(1)}{changeSuffix} {changeLabel}
                </span>
              </div>
            )}
            {change === null && note && (
              <p className="text-xs text-gray-400 mt-1 leading-tight">{note}</p>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', bgColor)}>
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCompact(amount: number): string {
  if (amount === 0) return '$0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
