'use client';

/**
 * 재무 데이터 차트 컴포넌트
 * Recharts를 사용하여 최근 4분기 매출 추이를 시각화
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { FinancialData } from '@/lib/supabase/types';
import { formatKRW, formatPeriod } from '@/lib/utils/format';

interface FinancialChartProps {
  data: FinancialData[];
}

interface ChartDataPoint {
  period: string;
  revenue: number; // 억원 단위
  revenueRaw: number; // 원 단위 (tooltip용)
}

/**
 * 법인별 재무 데이터 차트
 * 최근 N분기 매출 추이를 막대그래프로 표시
 */
export const FinancialChart = ({ data }: FinancialChartProps) => {
  // 차트 데이터 가공
  const chartData = useMemo<ChartDataPoint[]>(() => {
    // 시간 순서대로 정렬 (오래된 것부터)
    const sorted = [...data].sort((a, b) => {
      if (a.fiscal_year !== b.fiscal_year) {
        return a.fiscal_year - b.fiscal_year;
      }
      return a.quarter - b.quarter;
    });

    return sorted.map((d) => ({
      period: formatPeriod(d.fiscal_year, d.quarter),
      revenue: d.revenue_krw / 100000000, // 억원 단위
      revenueRaw: d.revenue_krw,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        No data available to display.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          tickFormatter={(value) => `${value}억`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="revenue"
          fill="#3B82F6"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * 커스텀 툴팁 컴포넌트
 * 차트 바 hover 시 상세 정보 표시
 */
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload as ChartDataPoint;

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-1">{data.period}</p>
      <p className="text-lg font-bold text-blue-600">
        {formatKRW(data.revenueRaw)}
      </p>
    </div>
  );
};

