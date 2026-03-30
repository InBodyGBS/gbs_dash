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
} from 'lucide-react';
import {
  getAllEntityPLSummaries,
  getPLResults,
  calculatePLSummary,
  getBSResultsForPeriods,
  getPLResultsForPeriods,
  computeBSPeriodMetrics,
} from '@/lib/services/monthlyClosingService';
import type { PLSummary, PLResult, BSPeriodMetrics } from '@/lib/types/monthly-closing';
import type { Subsidiary } from '@/lib/supabase/types';
import {
  BarChart,
  Bar,
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

  // B/S state
  const [bsTrend, setBsTrend] = useState<BSPeriodMetrics[]>([]);
  const [bsCurrent, setBsCurrent] = useState<BSPeriodMetrics | null>(null);
  const [bsCompare, setBsCompare] = useState<BSPeriodMetrics | null>(null);
  const [bsLoading, setBsLoading] = useState(false);

  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const loadSubsidiaries = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('subsidiaries').select('*').order('name');
      if (error) throw error;
      setSubsidiaries(data || []);
    } catch (error: unknown) {
      console.error('Failed to load subsidiaries:', getErrorMessage(error));
    }
  }, []);

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
  // P/L 요약 계산
  // ============================================
  const dashboardData = useMemo(() => {
    const totalSales = summaries.reduce((sum, s) => sum + s.sales, 0);
    const totalGP = summaries.reduce((sum, s) => sum + s.grossProfit, 0);
    const totalOperatingIncome = summaries.reduce((sum, s) => sum + s.operatingIncome, 0);
    const totalNetIncome = summaries.reduce((sum, s) => sum + s.netIncome, 0);
    const gpPercent = totalSales !== 0 ? (totalGP / totalSales) * 100 : 0;
    const opPercent = totalSales !== 0 ? (totalOperatingIncome / totalSales) * 100 : 0;

    const prevTotalSales = prevSummaries.reduce((sum, s) => sum + s.sales, 0);
    const prevTotalGP = prevSummaries.reduce((sum, s) => sum + s.grossProfit, 0);
    const prevGPPercent = prevTotalSales !== 0 ? (prevTotalGP / prevTotalSales) * 100 : 0;
    const prevTotalNetIncome = prevSummaries.reduce((sum, s) => sum + s.netIncome, 0);

    const salesChange =
      prevTotalSales !== 0
        ? ((totalSales - prevTotalSales) / Math.abs(prevTotalSales)) * 100
        : null;
    const gpPercentChange = prevGPPercent !== 0 ? gpPercent - prevGPPercent : null;
    const netIncomeChange =
      prevTotalNetIncome !== 0
        ? ((totalNetIncome - prevTotalNetIncome) / Math.abs(prevTotalNetIncome)) * 100
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
      salesChange,
      gpPercentChange,
      netIncomeChange,
      changeLabel: getChangeLabel(),
    };
  }, [summaries, prevSummaries, comparisonType]);

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
                <SelectItem value="all">전체</SelectItem>
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
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sales & Net Income by Entity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {salesChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={salesChartData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="entity" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}K`} />
                          <Tooltip formatter={(value: number, name: string) => [`$${value.toLocaleString()}K`, name]} />
                          <Legend />
                          <Bar dataKey="Sales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Net Income" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
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
  icon: Icon,
  iconColor,
  bgColor,
}: {
  title: string;
  value: string;
  change: number | null;
  changeLabel: string;
  changeSuffix?: string;
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
