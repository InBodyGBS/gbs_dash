'use client';

/**
 * 법인 정보 카드 컴포넌트
 * 선택된 법인의 기본 정보와 최근 재무 데이터를 표시
 */

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import {
  getLatestFinancialData,
  getFinancialTrend,
  getFinancialDataByYear,
  getAvailableYears,
} from '@/lib/services/financialService';
import { formatKRW, formatMargin, formatPeriod, calculateMargin } from '@/lib/utils/format';
import type { FinancialData, FinancialDataWithSubsidiary } from '@/lib/supabase/types';
import { FinancialChart } from './FinancialChart';

interface SubsidiaryCardProps {
  subsidiaryId: string | null;
  onClose: () => void;
}

/**
 * 법인 상세 정보 패널
 * 우측 슬라이드인 형태로 표시
 */
type ViewMode = 'quarter' | 'year';
type CurrencyMode = 'KRW' | 'FCY';

export const SubsidiaryCard = ({ subsidiaryId, onClose }: SubsidiaryCardProps) => {
  const [data, setData] = useState<FinancialDataWithSubsidiary | null>(null);
  const [trendData, setTrendData] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('quarter');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearData, setYearData] = useState<FinancialData[]>([]);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('KRW');

  // 연도별 집계 데이터 계산
  const aggregatedYearData = useMemo(() => {
    if (yearData.length === 0) return null;

    const aggregated = yearData.reduce(
      (acc, item) => ({
        revenue_krw: acc.revenue_krw + (item.revenue_krw || 0),
        operating_profit_krw: acc.operating_profit_krw + (item.operating_profit_krw || 0),
        revenue_fcy: acc.revenue_fcy + (item.revenue_fcy || 0),
        operating_profit_fcy: acc.operating_profit_fcy + (item.operating_profit_fcy || 0),
        sga_krw: acc.sga_krw + (item.sga_krw || 0),
        sga_fcy: acc.sga_fcy + (item.sga_fcy || 0),
        currency: item.currency || acc.currency,
      }),
      {
        revenue_krw: 0,
        operating_profit_krw: 0,
        revenue_fcy: 0,
        operating_profit_fcy: 0,
        sga_krw: 0,
        sga_fcy: 0,
        currency: null as string | null,
      }
    );

    return aggregated;
  }, [yearData]);

  useEffect(() => {
    if (!subsidiaryId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [latest, trend, years] = await Promise.all([
          getLatestFinancialData(subsidiaryId),
          getFinancialTrend(subsidiaryId, 4),
          getAvailableYears(subsidiaryId),
        ]);

        if (!latest) {
          setError('No financial data available for this subsidiary.');
          return;
        }

        setData(latest);
        setTrendData(trend);
        setAvailableYears(years);
        if (years.length > 0 && !selectedYear) {
          setSelectedYear(years[0]);
        }
      } catch (err) {
        setError('Failed to load financial data. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [subsidiaryId]);

  // 연도별 데이터 로드
  useEffect(() => {
    if (!subsidiaryId || !selectedYear || viewMode !== 'year') return;

    const fetchYearData = async () => {
      try {
        const yearDataList = await getFinancialDataByYear(subsidiaryId, selectedYear);
        setYearData(yearDataList);
      } catch (err) {
        console.error('Failed to fetch year data:', err);
        setYearData([]);
      }
    };

    fetchYearData();
  }, [subsidiaryId, selectedYear, viewMode]);

  if (!subsidiaryId) return null;

  return (
    <div className="w-full h-full flex flex-col">
      <Card className="border-0 rounded-lg h-full flex flex-col overflow-hidden">
        {/* 헤더 */}
        <CardHeader className="flex-shrink-0 bg-white border-b z-10 pb-3 px-6 pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {loading ? (
                <>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-3 w-28" />
                </>
              ) : data ? (
                <>
                  <CardTitle className="text-lg">{data.subsidiaries.name}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {data.subsidiaries.city}, {data.subsidiaries.country}
                  </p>
                  <Badge variant="outline" className="mt-1.5 text-xs">
                    {data.subsidiaries.region}
                  </Badge>
                </>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        {/* 컨텐츠 */}
        <CardContent className="flex-1 pt-4 px-6 pb-6 overflow-y-auto min-h-0">
          {/* 로딩 상태 */}
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* 에러 상태 */}
          {error && (
            <div className="text-center py-6 text-red-600 text-sm">
              <p>{error}</p>
            </div>
          )}

          {/* 데이터 표시 */}
          {!loading && !error && data && (
            <div className="space-y-4">
              {/* 뷰 모드 선택 및 연도 선택 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={viewMode}
                  onValueChange={(value) => {
                    setViewMode(value as ViewMode);
                    if (value === 'year' && availableYears.length > 0 && !selectedYear) {
                      setSelectedYear(availableYears[0]);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>

                {viewMode === 'year' && (
                  <Select
                    value={selectedYear?.toString() || ''}
                    onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
                  >
                    <SelectTrigger className="h-8 text-xs w-28">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* 통화 선택 토글 */}
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant={currencyMode === 'KRW' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={() => setCurrencyMode('KRW')}
                  >
                    KRW
                  </Button>
                  <Button
                    variant={currencyMode === 'FCY' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={() => setCurrencyMode('FCY')}
                    disabled={
                      !(
                        viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.currency &&
                            (aggregatedYearData.revenue_fcy ||
                              aggregatedYearData.operating_profit_fcy ||
                              aggregatedYearData.sga_fcy)
                          : data?.currency &&
                            (data?.revenue_fcy || data?.operating_profit_fcy || data?.sga_fcy)
                      )
                    }
                  >
                    FCY
                  </Button>
                </div>
              </div>

              {/* 분기/연도 정보 */}
              <Badge variant="secondary" className="text-xs">
                {viewMode === 'quarter'
                  ? `${formatPeriod(data.fiscal_year, data.quarter)} Performance`
                  : selectedYear
                    ? `${selectedYear} Annual Performance`
                    : 'Performance'}
              </Badge>

              {/* 재무 지표 */}
              <div className="space-y-3">
                {/* 매출액 */}
                {currencyMode === 'KRW' ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Revenue</p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatKRW(
                        viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.revenue_krw
                          : data.revenue_krw
                      )}
                    </p>
                  </div>
                ) : (
                  (viewMode === 'year' && aggregatedYearData
                    ? aggregatedYearData.revenue_fcy
                    : data.revenue_fcy) && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Revenue (FCY)</p>
                      <p className="text-xl font-bold text-gray-900">
                        {(
                          viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.revenue_fcy || 0
                            : data.revenue_fcy || 0
                        ).toLocaleString('ko-KR')}{' '}
                        {viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.currency || ''
                          : data.currency || ''}
                      </p>
                    </div>
                  )
                )}

                {/* 영업이익 */}
                {currencyMode === 'KRW' ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Operating Profit</p>
                    <p
                      className={`text-lg font-semibold ${
                        ((viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.operating_profit_krw
                          : data.operating_profit_krw) || 0) < 0
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {formatKRW(
                        viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.operating_profit_krw || 0
                          : data.operating_profit_krw || 0
                      )}
                    </p>
                  </div>
                ) : (
                  (viewMode === 'year' && aggregatedYearData
                    ? aggregatedYearData.operating_profit_fcy !== null &&
                      aggregatedYearData.operating_profit_fcy !== undefined
                    : data.operating_profit_fcy !== null &&
                      data.operating_profit_fcy !== undefined) && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Operating Profit (FCY)</p>
                      <p
                        className={`text-lg font-semibold ${
                          (viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.operating_profit_fcy || 0
                            : data.operating_profit_fcy || 0) < 0
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {(
                          viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.operating_profit_fcy || 0
                            : data.operating_profit_fcy || 0
                        ).toLocaleString('ko-KR')}{' '}
                        {viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.currency || ''
                          : data.currency || ''}
                      </p>
                    </div>
                  )
                )}

                {/* 영업이익률 */}
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Operating Margin</p>
                  <p
                    className={`text-lg font-semibold ${
                      calculateMargin(
                        currencyMode === 'KRW'
                          ? viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.operating_profit_krw || 0
                            : data.operating_profit_krw || 0
                          : viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.operating_profit_fcy || 0
                            : data.operating_profit_fcy || 0,
                        currencyMode === 'KRW'
                          ? viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.revenue_krw
                            : data.revenue_krw
                          : viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.revenue_fcy || 0
                            : data.revenue_fcy || 0
                      ) < 0
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}
                  >
                    {formatMargin(
                      calculateMargin(
                        currencyMode === 'KRW'
                          ? viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.operating_profit_krw || 0
                            : data.operating_profit_krw || 0
                          : viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.operating_profit_fcy || 0
                            : data.operating_profit_fcy || 0,
                        currencyMode === 'KRW'
                          ? viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.revenue_krw
                            : data.revenue_krw
                          : viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.revenue_fcy || 0
                            : data.revenue_fcy || 0
                      )
                    )}
                  </p>
                </div>

                {/* 통화 정보 (FCY 모드일 때만 표시) */}
                {currencyMode === 'FCY' &&
                  (viewMode === 'year' && aggregatedYearData
                    ? aggregatedYearData.currency
                    : data.currency) && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Currency</p>
                      <p className="text-base text-gray-700 font-medium">
                        {viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.currency
                          : data.currency}
                      </p>
                    </div>
                  )}

                {/* SG&A 비용 */}
                {currencyMode === 'KRW' ? (
                  (viewMode === 'year' && aggregatedYearData
                    ? aggregatedYearData.sga_krw !== null &&
                      aggregatedYearData.sga_krw !== undefined
                    : data.sga_krw !== null && data.sga_krw !== undefined) && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">SG&A (KRW)</p>
                      <p className="text-base text-gray-700">
                        {formatKRW(
                          viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.sga_krw || 0
                            : data.sga_krw || 0
                        )}
                      </p>
                    </div>
                  )
                ) : (
                  (viewMode === 'year' && aggregatedYearData
                    ? aggregatedYearData.sga_fcy !== null &&
                      aggregatedYearData.sga_fcy !== undefined
                    : data.sga_fcy !== null && data.sga_fcy !== undefined) && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">SG&A (FCY)</p>
                      <p className="text-base text-gray-700">
                        {(
                          viewMode === 'year' && aggregatedYearData
                            ? aggregatedYearData.sga_fcy || 0
                            : data.sga_fcy || 0
                        ).toLocaleString('ko-KR')}{' '}
                        {viewMode === 'year' && aggregatedYearData
                          ? aggregatedYearData.currency || ''
                          : data.currency || ''}
                      </p>
                    </div>
                  )
                )}
              </div>

              <Separator className="my-3" />

              {/* 차트 영역 */}
              <div>
                <h3 className="text-xs font-medium text-gray-700 mb-2">
                  {viewMode === 'year'
                    ? `${selectedYear} Quarterly Trend`
                    : 'Recent Quarterly Trend'}
                </h3>
                {viewMode === 'year' ? (
                  yearData.length > 0 ? (
                    <FinancialChart data={yearData} />
                  ) : (
                    <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      No data available for selected year.
                    </div>
                  )
                ) : trendData.length > 0 ? (
                  <FinancialChart data={trendData} />
                ) : (
                  <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                    No trend data available.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

