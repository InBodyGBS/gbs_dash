'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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
import type { BSPeriodMetrics } from '@/lib/types/monthly-closing';

interface Props {
  trendData: BSPeriodMetrics[];
  currentData: BSPeriodMetrics | null;
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

export function WorkingCapital({ trendData, currentData }: Props) {
  const wcBarData = trendData.map((d) => ({
    period: d.period,
    'W/C': Math.round(d.workingCapital / 1_000),
  }));

  const arTurnoverData = trendData.map((d) => ({
    period: d.period,
    'AR Turnover (×)': d.arTurnover !== null ? Number(d.arTurnover.toFixed(1)) : null,
    'DSO (days)': d.dso !== null ? Number(d.dso.toFixed(0)) : null,
  }));

  const apTurnoverData = trendData.map((d) => ({
    period: d.period,
    'AP Turnover (×)': d.apTurnover !== null ? Number(d.apTurnover.toFixed(1)) : null,
    'DPO (days)': d.dpo !== null ? Number(d.dpo.toFixed(0)) : null,
  }));

  const isEmpty = trendData.length === 0;

  return (
    <div className="space-y-6">
      {/* 설명 배너 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-4">
          <p className="text-sm font-medium text-blue-800">
            Working Capital = 매출채권 + 재고자산 − 매입채무
          </p>
          <p className="text-xs text-blue-600 mt-1">
            영업활동에 묶인 자금 규모를 나타내는 지표입니다. 값이 크면 운전자본 부담이 높고, 낮으면
            현금 회수 효율이 좋은 상태를 의미합니다.
          </p>
        </CardContent>
      </Card>

      {/* 상단 2분할: WC 막대그래프 + AR/Inv/AP 표 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 월별 Working Capital 막대그래프 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              Monthly Working Capital
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEmpty ? (
              <p className="text-center text-gray-400 py-10 text-sm">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={wcBarData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}K`} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}K`, 'W/C']} />
                  <Bar
                    dataKey="W/C"
                    fill="#6366F1"
                    radius={[4, 4, 0, 0]}
                    label={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* AR / Inventories / AP 현재값 표 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              Current Components
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!currentData ? (
              <p className="text-center text-gray-400 py-10 text-sm">데이터 없음</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 font-semibold text-gray-600">항목</th>
                    <th className="text-right py-2 font-semibold text-gray-600">금액</th>
                    <th className="text-left py-2 pl-4 font-semibold text-gray-600">역할</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2.5 font-medium text-blue-700">AR (매출채권)</td>
                    <td className="py-2.5 text-right font-mono">
                      {formatCompact(currentData.accountsReceivable)}
                    </td>
                    <td className="py-2.5 pl-4 text-gray-500 text-xs">+</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 font-medium text-amber-700">Inventories (재고)</td>
                    <td className="py-2.5 text-right font-mono">
                      {formatCompact(currentData.inventories)}
                    </td>
                    <td className="py-2.5 pl-4 text-gray-500 text-xs">+</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 font-medium text-red-700">AP (매입채무)</td>
                    <td className="py-2.5 text-right font-mono">
                      {formatCompact(currentData.accountsPayable)}
                    </td>
                    <td className="py-2.5 pl-4 text-gray-500 text-xs">−</td>
                  </tr>
                  <tr className="border-t-2 border-gray-400 bg-gray-50 font-semibold">
                    <td className="py-2.5">Working Capital</td>
                    <td
                      className={cn(
                        'py-2.5 text-right font-mono',
                        currentData.workingCapital < 0 ? 'text-red-600' : 'text-gray-900'
                      )}
                    >
                      {formatCompact(currentData.workingCapital)}
                    </td>
                    <td className="py-2.5 pl-4 text-gray-500 text-xs">=</td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 하단 2분할: DSO 라인차트 + AP Turnover 라인차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AR Turnover (DSO) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              AR Turnover (DSO)
              <span className="ml-2 text-xs font-normal text-gray-400">
                회전율 높을수록 / DSO 낮을수록 양호
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEmpty ? (
              <p className="text-center text-gray-400 py-10 text-sm">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={arTurnoverData}
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
                    dataKey="AR Turnover (×)"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="DSO (days)"
                    stroke="#93C5FD"
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

        {/* AP Turnover (DPO) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              AP Turnover (DPO)
              <span className="ml-2 text-xs font-normal text-gray-400">
                DPO 높을수록 지급 여유 양호
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEmpty ? (
              <p className="text-center text-gray-400 py-10 text-sm">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={apTurnoverData}
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
                    dataKey="AP Turnover (×)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="DPO (days)"
                    stroke="#FCD34D"
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
    </div>
  );
}
