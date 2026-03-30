'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Props {
  trendData: BSPeriodMetrics[];
}

export function InventoriesPanel({ trendData }: Props) {
  const invTrendData = trendData.map((d) => ({
    period: d.period,
    'Inventories ($K)': Math.round(d.inventories / 1_000),
  }));

  const invTurnoverData = trendData.map((d) => ({
    period: d.period,
    'Inv Turnover (×)': d.invTurnover !== null ? Number(d.invTurnover.toFixed(1)) : null,
    'DIO (days)': d.dio !== null ? Number(d.dio.toFixed(0)) : null,
  }));

  const isEmpty = trendData.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 재고 월별 추이 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">
            Inventories — Monthly Trend
            <span className="ml-2 text-xs font-normal text-gray-400">순액 (valuation allowance 차감)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <p className="text-center text-gray-400 py-12 text-sm">데이터 없음</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={invTrendData}
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}K`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}K`, 'Inventories']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Inventories ($K)"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Inventory Turnover */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">
            Inventory Turnover (DIO)
            <span className="ml-2 text-xs font-normal text-gray-400">
              회전율 높을수록 / DIO 낮을수록 양호
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <p className="text-center text-gray-400 py-12 text-sm">데이터 없음</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={invTurnoverData}
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit="×" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="d" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Inv Turnover (×)"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="DIO (days)"
                  stroke="#6EE7B7"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={{ r: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
