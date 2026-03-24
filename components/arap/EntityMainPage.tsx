/**
 * 해외법인 페이지 - Main Page
 * 상대방 Entity와의 AR/AP 매칭 상태
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getArapEntities, getMatchStatusSummary } from '@/lib/services/arapService';
import type { ArapEntity, MatchStatusSummary, MatchStatus } from '@/lib/types/arap';
import { cn } from '@/lib/utils';

interface EntityMainPageProps {
  entityId: string;
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

type ErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const toErrorLike = (error: unknown): ErrorLike => (error ?? {}) as ErrorLike;

export function EntityMainPage({
  entityId,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}: EntityMainPageProps) {
  const [entities, setEntities] = useState<ArapEntity[]>([]);
  const [summaries, setSummaries] = useState<MatchStatusSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [entitiesData, summariesData] = await Promise.all([
        getArapEntities(),
        getMatchStatusSummary(selectedYear, selectedMonth),
      ]);
      setEntities(entitiesData);
      // 현재 Entity와 관련된 매칭 상태만 필터링
      const filteredSummaries = summariesData.filter(
        (s) => s.entity_a_id === entityId || s.entity_b_id === entityId
      );
      setSummaries(filteredSummaries);
    } catch (error: unknown) {
      const err = toErrorLike(error);
      console.error('Failed to load data:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
      });
      // 테이블이 없을 경우 빈 배열로 설정
      if (err.code === 'PGRST116' || err.message?.includes('does not exist')) {
        console.warn('ARAP tables not found. Please run the schema migration first.');
        setEntities([]);
        setSummaries([]);
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, selectedYear, selectedMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getStatusColor = (status: MatchStatus) => {
    switch (status) {
      case 'matched':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-blue-600 bg-blue-50';
      case 'no_data':
        return 'text-gray-600 bg-gray-50';
      case 'mismatched':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getCounterpartyName = (summary: MatchStatusSummary): string => {
    return summary.entity_a_id === entityId
      ? summary.entity_b_name
      : summary.entity_a_name;
  };

  const getARAmount = (summary: MatchStatusSummary): number => {
    // 현재 Entity가 상대방에 대한 AR
    if (summary.entity_a_id === entityId) {
      return summary.entity_a_ar;
    }
    return summary.entity_b_ar;
  };

  const getAPAmount = (summary: MatchStatusSummary): number => {
    // 현재 Entity가 상대방에 대한 AP
    if (summary.entity_a_id === entityId) {
      return summary.entity_a_ap;
    }
    return summary.entity_b_ap;
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const currentEntity = entities.find((e) => e.id === entityId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Building2 className="h-5 w-5 text-gray-600" />
          <h2 className="text-xl font-semibold">
            {currentEntity?.entity_name || 'Entity'} - Intercompany Balance
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedYear.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i + 5).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth.toString()} onValueChange={(v) => onMonthChange(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index + 1} value={(index + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Counterparty
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Currency
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  AR
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  AP
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Match
                </th>
              </tr>
            </thead>
            <tbody>
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                summaries.flatMap((summary) => {
                  const counterpartyName = getCounterpartyName(summary);
                  const currencyBreakdown = summary.currency_breakdown || [];
                  
                  // 통화별 상세 정보가 없으면 전체 합계만 표시
                  if (currencyBreakdown.length === 0) {
                    const arAmount = getARAmount(summary);
                    const apAmount = getAPAmount(summary);
                    
                    return (
                      <tr key={`${summary.entity_a_id}-${summary.entity_b_id}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {counterpartyName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">-</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {arAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {apAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5',
                              getStatusColor(summary.status)
                            )}
                          >
                            <span className={cn(
                              'w-2 h-2 rounded-full',
                              summary.status === 'matched' && 'bg-green-600',
                              summary.status === 'pending' && 'bg-blue-600',
                              summary.status === 'no_data' && 'bg-gray-600',
                              summary.status === 'mismatched' && 'bg-red-600'
                            )} />
                            {summary.status === 'matched' && 'Matched'}
                            {summary.status === 'pending' && 'Pending'}
                            {summary.status === 'no_data' && 'No Data'}
                            {summary.status === 'mismatched' && 'Mismatched'}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  
                  // 통화별로 행 생성
                  return currencyBreakdown.map((currency, index) => {
                    const isFirstCurrency = index === 0;
                    const arAmount = summary.entity_a_id === entityId 
                      ? currency.entity_a_ar 
                      : currency.entity_b_ar;
                    const apAmount = summary.entity_a_id === entityId 
                      ? currency.entity_a_ap 
                      : currency.entity_b_ap;
                    
                    return (
                      <tr 
                        key={`${summary.entity_a_id}-${summary.entity_b_id}-${currency.currency}`} 
                        className={cn(
                          "border-b border-gray-100 hover:bg-gray-50",
                          !isFirstCurrency && "bg-gray-25"
                        )}
                      >
                        <td className={cn(
                          "px-4 py-3 text-sm",
                          isFirstCurrency ? "font-medium text-gray-900" : "text-gray-500 pl-8"
                        )}>
                          {isFirstCurrency ? counterpartyName : ''}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                          {currency.currency}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {arAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {apAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5',
                              getStatusColor(currency.status)
                            )}
                          >
                            <span className={cn(
                              'w-2 h-2 rounded-full',
                              currency.status === 'matched' && 'bg-green-600',
                              currency.status === 'pending' && 'bg-blue-600',
                              currency.status === 'no_data' && 'bg-gray-600',
                              currency.status === 'mismatched' && 'bg-red-600'
                            )} />
                            {currency.status === 'matched' && 'Matched'}
                            {currency.status === 'pending' && 'Pending'}
                            {currency.status === 'no_data' && 'No Data'}
                            {currency.status === 'mismatched' && 'Mismatched'}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                  {summaries.reduce((sum, s) => {
                    const breakdown = s.currency_breakdown || [];
                    if (breakdown.length === 0) {
                      return sum + getARAmount(s);
                    }
                    return sum + breakdown.reduce((subSum, c) => {
                      return subSum + (s.entity_a_id === entityId ? c.entity_a_ar : c.entity_b_ar);
                    }, 0);
                  }, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                  {summaries.reduce((sum, s) => {
                    const breakdown = s.currency_breakdown || [];
                    if (breakdown.length === 0) {
                      return sum + getAPAmount(s);
                    }
                    return sum + breakdown.reduce((subSum, c) => {
                      return subSum + (s.entity_a_id === entityId ? c.entity_a_ap : c.entity_b_ap);
                    }, 0);
                  }, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
