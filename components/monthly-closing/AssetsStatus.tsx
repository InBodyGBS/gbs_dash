'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { BSPeriodMetrics } from '@/lib/types/monthly-closing';
import { ZoomableChartCard } from './ZoomableChartCard';

interface Props {
  trendData: BSPeriodMetrics[];
  currentData: BSPeriodMetrics | null;
  compareData: BSPeriodMetrics | null;
  compareLabel: string;
}

function formatCompact(amount: number): string {
  if (amount === 0) return '$0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

interface MetricCardProps {
  title: string;
  value: string;
  change: number | null;
  compareLabel: string;
  colorClass: string;
  bgClass: string;
}

function MetricCard({ title, value, change, compareLabel, colorClass, bgClass }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change !== null ? (
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
                  {change > 0 ? '+' : ''}
                  {change.toFixed(1)}% {compareLabel}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-1">비교 데이터 없음</p>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', bgClass)}>
            <div className={cn('w-6 h-6 rounded-full', colorClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssetsStatus({ trendData, currentData, compareData, compareLabel }: Props) {
  const totalAssetsChange =
    currentData && compareData
      ? calcChange(currentData.totalAssets, compareData.totalAssets)
      : null;
  const cashChange =
    currentData && compareData ? calcChange(currentData.cash, compareData.cash) : null;
  const wcChange =
    currentData && compareData
      ? calcChange(currentData.workingCapital, compareData.workingCapital)
      : null;

  // Cash 추이 차트 데이터
  const chartData = trendData.map((d) => ({
    period: d.period,
    Cash: Math.round(d.cash / 1_000),
  }));

  const isEmpty = trendData.length === 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Assets"
          value={currentData ? formatCompact(currentData.totalAssets) : '—'}
          change={totalAssetsChange}
          compareLabel={compareLabel}
          colorClass="bg-blue-600"
          bgClass="bg-blue-50"
        />
        <MetricCard
          title="Cash"
          value={currentData ? formatCompact(currentData.cash) : '—'}
          change={cashChange}
          compareLabel={compareLabel}
          colorClass="bg-emerald-500"
          bgClass="bg-emerald-50"
        />
        <MetricCard
          title="Working Capital (W/C)"
          value={currentData ? formatCompact(currentData.workingCapital) : '—'}
          change={wcChange}
          compareLabel={compareLabel}
          colorClass={
            currentData && currentData.workingCapital < 0 ? 'bg-red-500' : 'bg-purple-500'
          }
          bgClass={
            currentData && currentData.workingCapital < 0 ? 'bg-red-50' : 'bg-purple-50'
          }
        />
      </div>

      {/* Cash Status Line Chart — 확대 가능 */}
      <ZoomableChartCard
        title="Cash Status — Monthly Trend"
        isEmpty={isEmpty}
        emptyMessage="표시할 데이터가 없습니다."
      >
        {(mode) => (
          <ResponsiveContainer
            width="100%"
            height={mode === 'zoomed' ? '100%' : 240}
          >
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: mode === 'zoomed' ? 13 : 11 }} />
              <YAxis
                tick={{ fontSize: mode === 'zoomed' ? 13 : 11 }}
                tickFormatter={(v: number) => `$${v}K`}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toLocaleString()}K`, 'Cash']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Cash"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ZoomableChartCard>
    </div>
  );
}
