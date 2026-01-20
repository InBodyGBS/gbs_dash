/**
 * 관리자 페이지 - Monthly View
 * 연도별 월별 제출 현황 그리드
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getArapEntities, getMonthlyStatus } from '@/lib/services/arapService';
import type { ArapEntity, MonthlyStatus, MatchStatus } from '@/lib/types/arap';
import { cn } from '@/lib/utils';

interface AdminMonthlyViewProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export function AdminMonthlyView({ selectedYear, onYearChange }: AdminMonthlyViewProps) {
  const [entities, setEntities] = useState<ArapEntity[]>([]);
  const [monthlyStatuses, setMonthlyStatuses] = useState<MonthlyStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [entitiesData, statusesData] = await Promise.all([
        getArapEntities(),
        getMonthlyStatus(selectedYear),
      ]);
      setEntities(entitiesData);
      setMonthlyStatuses(statusesData);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      // 테이블이 없을 경우 빈 배열로 설정
      if (error?.code === 'PGRST116' || error?.message?.includes('does not exist')) {
        console.warn('ARAP tables not found. Please run the schema migration first.');
        setEntities([]);
        setMonthlyStatuses([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: MatchStatus) => {
    switch (status) {
      case 'matched':
        return 'bg-green-500'; // 🟢 초록색
      case 'pending':
        return 'bg-blue-500'; // 🔵 파란색
      case 'no_data':
        return 'bg-gray-400'; // 회색
      case 'mismatched':
        return 'bg-red-500'; // 빨간색
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusForEntityMonth = (entityId: string, month: number): MatchStatus => {
    const status = monthlyStatuses.find(
      (s) => s.entity_id === entityId && s.fiscal_month === month
    );
    return status?.status || 'no_data';
  };

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

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
          <Calendar className="h-5 w-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Monthly View</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onYearChange(selectedYear - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => onYearChange(selectedYear + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Entity
                </th>
                {months.map((month) => (
                  <th
                    key={month}
                    className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase min-w-[60px]"
                  >
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => (
                <tr key={entity.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {entity.entity_name}
                  </td>
                  {months.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const status = getStatusForEntityMonth(entity.id, month);
                    return (
                      <td key={month} className="px-3 py-3 text-center">
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full mx-auto cursor-pointer transition-all hover:scale-110',
                            getStatusColor(status)
                          )}
                          title={`${entity.entity_name} - ${month}월: ${status}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-400" />
          <span>미제출 (No submission)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span>제출완료 (Submitted)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span>불일치 (Mismatched)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500" />
          <span>매칭완료 (Matched)</span>
        </div>
      </div>
    </div>
  );
}
