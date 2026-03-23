/**
 * Entity View - 요약 통계 컴포넌트
 */

'use client';

import type { ArapEntity, EntityMatchMatrix } from '@/lib/types/arap';
import { getSubmittedEntityIds } from '@/lib/services/arapService';
import { useEffect, useState } from 'react';

interface SummaryStatsProps {
  entities: ArapEntity[];
  matrix: EntityMatchMatrix[];
  selectedYear: number;
  selectedMonth: number;
}

export function SummaryStats({ entities, matrix, selectedYear, selectedMonth }: SummaryStatsProps) {
  const [submittedEntityIds, setSubmittedEntityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getSubmittedEntityIds(selectedYear, selectedMonth)
      .then((ids) => {
        setSubmittedEntityIds(new Set(ids));
      })
      .catch((error) => {
        console.error('Failed to load submitted entities:', error);
        setSubmittedEntityIds(new Set());
      });
  }, [selectedYear, selectedMonth]);

  // 전체 거래쌍 수 계산 (n*(n-1)/2)
  const totalPairs = (entities.length * (entities.length - 1)) / 2;
  
  // 상태별 카운트
  const matchedCount = matrix.filter((m) => m.status === 'matched').length;
  const pendingCount = matrix.filter((m) => m.status === 'pending').length;
  const noDataCount = matrix.filter((m) => m.status === 'no_data').length;
  const mismatchedCount = matrix.filter((m) => m.status === 'mismatched').length;
  
  // 실제로 제출한 법인만 필터링
  const submittedEntities = entities.filter((e) => submittedEntityIds.has(e.id));
  const notSubmittedCount = entities.length - submittedEntities.length;
  
  const matchedPercent = totalPairs > 0 ? ((matchedCount / totalPairs) * 100).toFixed(1) : '0.0';
  const pendingPercent = totalPairs > 0 ? ((pendingCount / totalPairs) * 100).toFixed(1) : '0.0';
  const noDataPercent = totalPairs > 0 ? ((noDataCount / totalPairs) * 100).toFixed(1) : '0.0';
  const mismatchedPercent = totalPairs > 0 ? ((mismatchedCount / totalPairs) * 100).toFixed(1) : '0.0';
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">📈</span>
        제출 현황 요약
      </h3>
      
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{totalPairs}</div>
          <div className="text-sm text-gray-600">전체 거래쌍</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">{matchedCount}</div>
          <div className="text-sm text-gray-600">
            🟢 매칭완료 ({matchedPercent}%)
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">{pendingCount}</div>
          <div className="text-sm text-gray-600">
            🔵 확인중 ({pendingPercent}%)
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-600">{mismatchedCount}</div>
          <div className="text-sm text-gray-600">
            🔴 불일치 ({mismatchedPercent}%)
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-400">{noDataCount}</div>
          <div className="text-sm text-gray-600">
            ⚪ 미제출 ({noDataPercent}%)
          </div>
        </div>
      </div>
      
      <div className="border-t pt-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">제출한 법인:</span>
          <span className="font-semibold">
            {submittedEntities.length}개
            {submittedEntities.length > 0 && (
              <span className="text-gray-500 ml-2">
                ({submittedEntities.map((e) => e.entity_name.replace('InBody ', '')).join(', ')})
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">미제출 법인:</span>
          <span className="font-semibold text-red-600">
            {notSubmittedCount}개
          </span>
        </div>
      </div>
    </div>
  );
}
