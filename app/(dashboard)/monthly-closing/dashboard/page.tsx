'use client';

/**
 * Monthly Closing - Dashboard 페이지
 * 전체 법인 재무성과 요약 & 인사이트 (PRD Section 3.4 기반)
 * Entity별 Dashboard + 비교 탭 (전년도 동월, 전년도 동월 누적, 직전월)
 */

import { useState, useEffect, useMemo } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { getAllEntityPLSummaries, getPLResults, calculatePLSummary } from '@/lib/services/monthlyClosingService';
import type { PLSummary, PLResult } from '@/lib/types/monthly-closing';
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

type ComparisonType = 'mom' | 'yoy' | 'yoy_ytd';

// 월별값 계산 헬퍼 함수 (Result 페이지와 동일한 로직)
function calculateMonthlyDifference(
  currentCumulative: PLResult[],
  prevCumulative: PLResult[],
  entityCode: string,
  year: number,
  month: number
): PLResult[] {
  // 현재 월 누적값 Map
  const currMap = new Map<string, number>();
  currentCumulative.forEach((r) => {
    currMap.set(r.std_pl_code, (currMap.get(r.std_pl_code) || 0) + r.amount);
  });
  
  // 직전월 누적값 Map
  const prevMap = new Map<string, number>();
  prevCumulative.forEach((r) => {
    prevMap.set(r.std_pl_code, (prevMap.get(r.std_pl_code) || 0) + r.amount);
  });
  
  // 차이 계산 (월별값 = 현재 누적 - 직전월 누적)
  const allCodes = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
  const monthlyResults: PLResult[] = Array.from(allCodes).map((code) => ({
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
  
  return monthlyResults;
}

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() || 12));
  const [selectedEntity, setSelectedEntity] = useState<string>('all'); // 'all' or entity code
  const [comparisonType, setComparisonType] = useState<ComparisonType>('mom');
  const [summaries, setSummaries] = useState<PLSummary[]>([]);
  const [prevSummaries, setPrevSummaries] = useState<PLSummary[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Subsidiaries 로드
  useEffect(() => {
    loadSubsidiaries();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, selectedEntity, comparisonType]);

  const loadSubsidiaries = async () => {
    try {
      const { data, error } = await supabase
        .from('subsidiaries')
        .select('*')
        .order('name');
      if (error) throw error;
      setSubsidiaries(data || []);
    } catch (error: any) {
      console.error('Failed to load subsidiaries:', error);
    }
  };

  const loadData = async () => {
    setDataLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);

      // 비교 데이터 로드
      let currentData: PLSummary[] = [];
      let compareData: PLSummary[] = [];
      
      if (comparisonType === 'mom') {
        // 직전월 비교: Result의 월별값 계산 방식 사용
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        
        // 모든 Entity 목록 가져오기
        const allEntities = selectedEntity === 'all' 
          ? subsidiaries.map(s => s.code)
          : [selectedEntity];
        
        // 각 Entity별로 월별값 계산
        const currentMonthlySummaries: PLSummary[] = [];
        const prevMonthlySummaries: PLSummary[] = [];
        
        for (const entityCode of allEntities) {
          const entityName = subsidiaries.find(s => s.code === entityCode)?.name || entityCode;
          
          // 현재 월 누적값
          const currentCumulative = await getPLResults(entityCode, year, month);
          // 직전월 누적값
          const prevCumulative = await getPLResults(entityCode, prevYear, prevMonth);
          
          if (month === 1) {
            // 1월: 누적값 = 월별값
            if (currentCumulative.length > 0) {
              currentMonthlySummaries.push(
                calculatePLSummary(currentCumulative, entityCode, entityName, year, month)
              );
            }
            // 직전월(12월)의 월별값 계산
            if (prevMonth === 12) {
              const prevPrevCumulative = await getPLResults(entityCode, prevYear - 1, 11);
              const prevMonthlyResults = calculateMonthlyDifference(prevCumulative, prevPrevCumulative, entityCode, prevYear, prevMonth);
              if (prevMonthlyResults.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(prevMonthlyResults, entityCode, entityName, prevYear, prevMonth)
                );
              }
            } else {
              // prevMonth가 12월이 아니면 (이론적으로 불가능하지만 안전 처리)
              if (prevCumulative.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(prevCumulative, entityCode, entityName, prevYear, prevMonth)
                );
              }
            }
          } else {
            // 2월~12월: 현재 월 누적 - 직전월 누적
            const currentMonthlyResults = calculateMonthlyDifference(currentCumulative, prevCumulative, entityCode, year, month);
            if (currentMonthlyResults.length > 0) {
              currentMonthlySummaries.push(
                calculatePLSummary(currentMonthlyResults, entityCode, entityName, year, month)
              );
            }
            
            // 직전월의 월별값 계산
            const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
            const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;
            const prevPrevCumulative = await getPLResults(entityCode, prevPrevYear, prevPrevMonth);
            
            if (prevMonth === 1) {
              // 직전월이 1월이면 누적값 = 월별값
              if (prevCumulative.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(prevCumulative, entityCode, entityName, prevYear, prevMonth)
                );
              }
            } else {
              // 직전월이 2월~12월이면: 직전월 누적 - 직전월의 직전월 누적
              const prevMonthlyResults = calculateMonthlyDifference(prevCumulative, prevPrevCumulative, entityCode, prevYear, prevMonth);
              if (prevMonthlyResults.length > 0) {
                prevMonthlySummaries.push(
                  calculatePLSummary(prevMonthlyResults, entityCode, entityName, prevYear, prevMonth)
                );
              }
            }
          }
        }
        
        currentData = currentMonthlySummaries;
        compareData = prevMonthlySummaries;
      } else {
        // 전년도 동월 또는 전년도 동월(누적): 누적값 사용
        currentData = await getAllEntityPLSummaries(year, month);
        
        if (comparisonType === 'yoy') {
          // 전년도 동월
          compareData = await getAllEntityPLSummaries(year - 1, month);
        } else if (comparisonType === 'yoy_ytd') {
        // 전년도 동월(누적) - 1월부터 현재 월까지 합계
        const allMonths: PLSummary[] = [];
        for (let m = 1; m <= month; m++) {
          const monthData = await getAllEntityPLSummaries(year - 1, m);
          allMonths.push(...monthData);
        }
        
        // Entity별로 누적 합계 계산
        const entityMap = new Map<string, PLSummary>();
        allMonths.forEach((summary) => {
          const key = summary.entityCode;
          if (!entityMap.has(key)) {
            entityMap.set(key, {
              ...summary,
              periodMonth: month, // 누적이므로 현재 월로 표시
            });
          } else {
            const existing = entityMap.get(key)!;
            entityMap.set(key, {
              ...existing,
              sales: existing.sales + summary.sales,
              costOfSales: existing.costOfSales + summary.costOfSales,
              grossProfit: existing.grossProfit + summary.grossProfit,
              sellingAndAdminExpense: existing.sellingAndAdminExpense + summary.sellingAndAdminExpense,
              operatingIncome: existing.operatingIncome + summary.operatingIncome,
              otherRevenue: existing.otherRevenue + summary.otherRevenue,
              otherExpense: existing.otherExpense + summary.otherExpense,
              financialRevenue: existing.financialRevenue + summary.financialRevenue,
              financialExpense: existing.financialExpense + summary.financialExpense,
              incomeBeforeTax: existing.incomeBeforeTax + summary.incomeBeforeTax,
              corporateIncomeTax: existing.corporateIncomeTax + summary.corporateIncomeTax,
              netIncome: existing.netIncome + summary.netIncome,
              gpMargin: existing.sales + summary.sales !== 0 
                ? ((existing.grossProfit + summary.grossProfit) / (existing.sales + summary.sales)) * 100 
                : 0,
              operatingMargin: existing.sales + summary.sales !== 0
                ? ((existing.operatingIncome + summary.operatingIncome) / (existing.sales + summary.sales)) * 100
                : 0,
              netMargin: existing.sales + summary.sales !== 0
                ? ((existing.netIncome + summary.netIncome) / (existing.sales + summary.sales)) * 100
                : 0,
            });
          }
        });
        compareData = Array.from(entityMap.values());
        }
      }
      
      // Entity 필터링
      if (selectedEntity !== 'all') {
        currentData = currentData.filter(s => s.entityCode === selectedEntity);
        compareData = compareData.filter(s => s.entityCode === selectedEntity);
      }
      
      setSummaries(currentData);
      setPrevSummaries(compareData);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      toast.error('데이터 로드 실패');
    } finally {
      setDataLoading(false);
      setLoading(false);
    }
  };

  // Summary 계산 (PRD 기반: Sales, GP%, Operating Income, Net Income)
  const dashboardData = useMemo(() => {
    const totalSales = summaries.reduce((sum, s) => sum + s.sales, 0);
    const totalGP = summaries.reduce((sum, s) => sum + s.grossProfit, 0);
    const totalOperatingIncome = summaries.reduce((sum, s) => sum + s.operatingIncome, 0);
    const totalNetIncome = summaries.reduce((sum, s) => sum + s.netIncome, 0);
    const gpPercent = totalSales !== 0 ? (totalGP / totalSales) * 100 : 0;
    const opPercent = totalSales !== 0 ? (totalOperatingIncome / totalSales) * 100 : 0;

    const prevTotalSales = prevSummaries.reduce((sum, s) => sum + s.sales, 0);
    const prevTotalGP = prevSummaries.reduce((sum, s) => sum + s.grossProfit, 0);
    const prevTotalOperatingIncome = prevSummaries.reduce((sum, s) => sum + s.operatingIncome, 0);
    const prevGPPercent = prevTotalSales !== 0 ? (prevTotalGP / prevTotalSales) * 100 : 0;
    const prevTotalNetIncome = prevSummaries.reduce((sum, s) => sum + s.netIncome, 0);

    const salesChange = prevTotalSales !== 0
      ? ((totalSales - prevTotalSales) / Math.abs(prevTotalSales)) * 100
      : null;
    const gpPercentChange = prevGPPercent !== 0 ? gpPercent - prevGPPercent : null;
    const netIncomeChange = prevTotalNetIncome !== 0
      ? ((totalNetIncome - prevTotalNetIncome) / Math.abs(prevTotalNetIncome)) * 100
      : null;

    // 비교 타입에 따른 라벨
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

  // 인사이트 생성
  const insights = useMemo(() => {
    const items: Array<{ type: 'warning' | 'success' | 'info'; message: string }> = [];

    summaries.forEach((s) => {
      // GP% 35% 미만 경고
      if (s.gpMargin < 35 && s.sales > 0) {
        items.push({
          type: 'warning',
          message: `${s.entityName}: GP% ${s.gpMargin.toFixed(1)}% (업계 평균 이하)`,
        });
      }

      // 적자 entity
      if (s.netIncome < 0) {
        items.push({
          type: 'warning',
          message: `${s.entityName}: 당기순손실 ${formatCompact(-s.netIncome)}`,
        });
      }

      // GP% 50% 이상 우수
      if (s.gpMargin >= 50 && s.sales > 0) {
        items.push({
          type: 'success',
          message: `${s.entityName}: GP% ${s.gpMargin.toFixed(1)}% (우수)`,
        });
      }

      // Operating Margin 개선
      if (s.operatingMargin > 0 && s.sales > 0) {
        const prevSummary = prevSummaries.find((p) => p.entityCode === s.entityCode);
        if (prevSummary && prevSummary.operatingMargin <= 0) {
          items.push({
            type: 'success',
            message: `${s.entityName}: Operating margin turned positive for first time this year`,
          });
        }
      }

      // SG&A 급증 경고
      const prevSummary = prevSummaries.find((p) => p.entityCode === s.entityCode);
      if (prevSummary && prevSummary.sellingAndAdminExpense > 0) {
        const sgaChange = ((s.sellingAndAdminExpense - prevSummary.sellingAndAdminExpense) / prevSummary.sellingAndAdminExpense) * 100;
        if (sgaChange > 25) {
          items.push({
            type: 'warning',
            message: `${s.entityName}: SG&A spiked ${sgaChange.toFixed(0)}% - review breakdown`,
          });
        }
      }
    });

    // 비교 변동
    if (dashboardData.salesChange !== null && Math.abs(dashboardData.salesChange) >= 10) {
      items.push({
        type: dashboardData.salesChange > 0 ? 'success' : 'warning',
        message: `전체 Sales ${dashboardData.salesChange > 0 ? '+' : ''}${dashboardData.salesChange.toFixed(1)}% ${dashboardData.changeLabel} 변동`,
      });
    }

    return items;
  }, [summaries, dashboardData]);

  // 차트 데이터: Profitability Comparison
  const profitabilityChartData = useMemo(() => {
    return summaries.map((s) => ({
      entity: s.entityName.replace('InBody ', ''),
      'GP%': Number(s.gpMargin.toFixed(1)),
      'Operating Margin%': Number(s.operatingMargin.toFixed(1)),
      'Net%': Number(s.netMargin.toFixed(1)),
    }));
  }, [summaries]);

  // 차트 데이터: Sales by Entity
  const salesChartData = useMemo(() => {
    return summaries
      .sort((a, b) => b.sales - a.sales)
      .map((s) => ({
        entity: s.entityName.replace('InBody ', ''),
        Sales: Math.round(s.sales / 1000), // $K 단위
        'Net Income': Math.round(s.netIncome / 1000),
      }));
  }, [summaries]);

  // 연도/월 옵션
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
      <div className="flex-shrink-0 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Monthly Dashboard</h1>
          <p className="text-gray-600">
            {selectedEntity === 'all' 
              ? '전체 법인 재무성과 요약 및 인사이트'
              : `${subsidiaries.find(s => s.code === selectedEntity)?.name || selectedEntity} 재무성과`}
          </p>
        </div>
        <div className="flex items-center gap-4">
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

      {/* 비교 탭 */}
      <Tabs value={comparisonType} onValueChange={(v) => setComparisonType(v as ComparisonType)} className="mb-6">
        <TabsList>
          <TabsTrigger value="mom">직전월 (MoM)</TabsTrigger>
          <TabsTrigger value="yoy">전년도 동월 (YoY)</TabsTrigger>
          <TabsTrigger value="yoy_ytd">전년도 동월(누적) (YoY YTD)</TabsTrigger>
        </TabsList>
      </Tabs>

      {dataLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="mb-2">해당 기간의 데이터가 없습니다.</p>
            <p className="text-sm">Upload 탭에서 TB 파일을 업로드하고, Mapping을 완료한 후 확인해주세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards (PRD 기반) */}
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
            {/* Sales & Net Income by Entity */}
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
                      <Tooltip
                        formatter={(value: number, name: string) => [`$${value.toLocaleString()}K`, name]}
                      />
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

            {/* Profitability Comparison */}
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

          {/* Insights Panel */}
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

          {/* Entity Detail Table */}
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
                    {/* Total Row */}
                    <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCompact(summaries.reduce((s, e) => s + e.sales, 0))}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCompact(summaries.reduce((s, e) => s + e.grossProfit, 0))}
                      </td>
                      <td className="py-2 px-3 text-right">{dashboardData.gpPercent.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCompact(summaries.reduce((s, e) => s + e.operatingIncome, 0))}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {dashboardData.opPercent.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCompact(summaries.reduce((s, e) => s + e.netIncome, 0))}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {(summaries.reduce((s, e) => s + e.sales, 0) !== 0
                          ? (summaries.reduce((s, e) => s + e.netIncome, 0) / summaries.reduce((s, e) => s + e.sales, 0) * 100)
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
    </div>
  );
}

// ============================================
// Summary Card 컴포넌트
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

// 금액 포맷팅 (컴팩트)
function formatCompact(amount: number): string {
  if (amount === 0) return '$0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
