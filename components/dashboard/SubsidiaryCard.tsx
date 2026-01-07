'use client';

/**
 * 법인 정보 카드 컴포넌트
 * 선택된 법인의 기본 정보와 최근 재무 데이터를 표시
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';
import { getLatestFinancialData, getFinancialTrend } from '@/lib/services/financialService';
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
export const SubsidiaryCard = ({ subsidiaryId, onClose }: SubsidiaryCardProps) => {
  const [data, setData] = useState<FinancialDataWithSubsidiary | null>(null);
  const [trendData, setTrendData] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subsidiaryId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [latest, trend] = await Promise.all([
          getLatestFinancialData(subsidiaryId),
          getFinancialTrend(subsidiaryId, 4),
        ]);

        if (!latest) {
          setError('No financial data available for this subsidiary.');
          return;
        }

        setData(latest);
        setTrendData(trend);
      } catch (err) {
        setError('Failed to load financial data. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [subsidiaryId]);

  if (!subsidiaryId) return null;

  return (
    <div className="h-full w-full bg-white rounded-lg shadow-lg border border-gray-200 animate-in slide-in-from-right duration-300">
      <Card className="h-full border-0 rounded-lg overflow-y-auto">
        {/* 헤더 */}
        <CardHeader className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {loading ? (
                <>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : data ? (
                <>
                  <CardTitle className="text-2xl">{data.subsidiaries.name}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {data.subsidiaries.city}, {data.subsidiaries.country}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {data.subsidiaries.region}
                  </Badge>
                </>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* 컨텐츠 */}
        <CardContent className="pt-6">
          {/* 로딩 상태 */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {/* 에러 상태 */}
          {error && (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
            </div>
          )}

          {/* 데이터 표시 */}
          {!loading && !error && data && (
            <div className="space-y-6">
              {/* 분기 정보 */}
              <Badge variant="secondary" className="text-sm">
                {formatPeriod(data.fiscal_year, data.quarter)} Performance
              </Badge>

              {/* 재무 지표 */}
              <div className="space-y-4">
                {/* 매출액 */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatKRW(data.revenue_krw)}
                  </p>
                </div>

                {/* 영업이익 */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Operating Profit</p>
                  <p
                    className={`text-xl font-semibold ${
                      (data.operating_profit_krw || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {formatKRW(data.operating_profit_krw || 0)}
                  </p>
                </div>

                {/* 영업이익률 */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Operating Margin</p>
                  <p
                    className={`text-xl font-semibold ${
                      calculateMargin(data.operating_profit_krw || 0, data.revenue_krw) < 0
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}
                  >
                    {formatMargin(
                      calculateMargin(data.operating_profit_krw || 0, data.revenue_krw)
                    )}
                  </p>
                </div>

                {/* 목표 매출액 (있는 경우) */}
                {data.target_revenue_krw && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Target Revenue</p>
                    <p className="text-lg text-gray-700">
                      {formatKRW(data.target_revenue_krw)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Achievement:{' '}
                      {((data.revenue_krw / data.target_revenue_krw) * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* 차트 영역 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                  Recent Quarterly Trend
                </h3>
                {trendData.length > 0 ? (
                  <FinancialChart data={trendData} />
                ) : (
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
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

