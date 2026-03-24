/**
 * 관리자 페이지 - Entity View
 * Entity 간 매칭 상태 매트릭스
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getArapEntities, getEntityMatchMatrix, getSubmittedEntityIds } from '@/lib/services/arapService';
import { supabase } from '@/lib/supabase/client';
import type { ArapEntity, EntityMatchMatrix, MatchStatus } from '@/lib/types/arap';
import { cn } from '@/lib/utils';
import { SummaryStats } from './SummaryStats';
import { FilterOptions, type FilterState } from './FilterOptions';
import { TransactionDetailPopup } from './TransactionDetailPopup';

interface AdminEntityViewProps {
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

export function AdminEntityView({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}: AdminEntityViewProps) {
  const [entities, setEntities] = useState<ArapEntity[]>([]);
  const [matrix, setMatrix] = useState<EntityMatchMatrix[]>([]);
  const [submittedEntityIds, setSubmittedEntityIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    showOnlyWithData: true, // 기본값: 데이터 있는 항목만
    hideNoData: false,
    showLowerTriangle: false,
    showOnlySubmitted: false,
    searchQuery: '',
  });
  const [showFullMatrix, setShowFullMatrix] = useState(false);
  const [selectedPair, setSelectedPair] = useState<{
    entity1: ArapEntity;
    entity2: ArapEntity;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [entitiesData, matrixData, submittedIds] = await Promise.all([
        getArapEntities(),
        getEntityMatchMatrix(selectedYear, selectedMonth),
        getSubmittedEntityIds(selectedYear, selectedMonth),
      ]);
      setEntities(entitiesData);
      setMatrix(matrixData);
      setSubmittedEntityIds(new Set(submittedIds));
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
        setMatrix([]);
        setSubmittedEntityIds(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getStatusColor = (status: MatchStatus) => {
    switch (status) {
      case 'matched':
        return 'bg-green-500';
      case 'pending':
        return 'bg-blue-500';
      case 'no_data':
        return 'bg-gray-400';
      case 'mismatched':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusForPair = (entityAId: string, entityBId: string): MatchStatus => {
    const match = matrix.find(
      (m) =>
        (m.entity_a_id === entityAId && m.entity_b_id === entityBId) ||
        (m.entity_a_id === entityBId && m.entity_b_id === entityAId)
    );
    return match?.status || 'no_data';
  };

  // 필터링된 엔티티 계산
  const filteredEntities = useMemo(() => {
    let filtered = [...entities];
    
    // 1. 검색어 필터링
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.entity_name.toLowerCase().includes(query) ||
          e.entity_name.replace('InBody ', '').toLowerCase().includes(query)
      );
    }
    
    // 2. 제출한 법인만 표시 (실제로 제출한 법인만)
    if (filters.showOnlySubmitted) {
      filtered = filtered.filter((e) => submittedEntityIds.has(e.id));
    }
    
    // 3. 데이터가 있는 항목만
    if (filters.showOnlyWithData) {
      const entityIdsWithData = new Set<string>();
      matrix.forEach((m) => {
        if (m.status !== 'no_data') {
          entityIdsWithData.add(m.entity_a_id);
          entityIdsWithData.add(m.entity_b_id);
        }
      });
      filtered = filtered.filter((e) => entityIdsWithData.has(e.id));
    }
    
    return filtered;
  }, [entities, matrix, filters, submittedEntityIds]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // 매트릭스 테이블 렌더링용 엔티티 목록 (필터링된 것 또는 전체)
  const displayEntities = showFullMatrix ? entities : filteredEntities;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Building2 className="h-5 w-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Entity View</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
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
          <Button
            variant={adminEditMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAdminEditMode(!adminEditMode)}
          >
            Admin Edit Mode
          </Button>
        </div>
      </div>

      {/* 요약 통계 */}
      <SummaryStats
        entities={entities}
        matrix={matrix}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* 필터 옵션 */}
      <FilterOptions filters={filters} onFilterChange={setFilters} />

      {/* 매트릭스 테이블 - 필터 적용된 매트릭스 또는 전체 매트릭스 */}
      {!showFullMatrix ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Entity
                  </th>
                  {displayEntities.map((entity) => (
                    <th
                      key={entity.id}
                      className={cn(
                        'px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase min-w-[80px]',
                        filters.searchQuery &&
                          (entity.entity_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                            entity.entity_name
                              .replace('InBody ', '')
                              .toLowerCase()
                              .includes(filters.searchQuery.toLowerCase())) &&
                          'bg-yellow-100'
                      )}
                    >
                      {entity.entity_name.replace('InBody ', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayEntities.map((entityA, rowIndex) => (
                  <tr
                    key={entityA.id}
                    className={cn(
                      'border-b border-gray-100 hover:bg-gray-50',
                      filters.searchQuery &&
                        (entityA.entity_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                          entityA.entity_name
                            .replace('InBody ', '')
                            .toLowerCase()
                            .includes(filters.searchQuery.toLowerCase())) &&
                        'bg-yellow-50'
                    )}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entityA.entity_name.replace('InBody ', '')}
                    </td>
                    {displayEntities.map((entityB, colIndex) => {
                      if (entityA.id === entityB.id) {
                        return (
                          <td key={entityB.id} className="px-3 py-3 text-center">
                            <span className="text-gray-400">-</span>
                          </td>
                        );
                      }
                      
                      // 대각선 아래만 표시 옵션
                      if (filters.showLowerTriangle && rowIndex <= colIndex) {
                        return (
                          <td key={entityB.id} className="px-3 py-3 text-center">
                            <span className="text-gray-300">-</span>
                          </td>
                        );
                      }
                      
                      const status = getStatusForPair(entityA.id, entityB.id);
                      
                      // 미제출 항목 숨기기
                      if (filters.hideNoData && status === 'no_data') {
                        return (
                          <td key={entityB.id} className="px-3 py-3 text-center">
                            <span className="text-gray-300">-</span>
                          </td>
                        );
                      }
                      
                      return (
                        <td key={entityB.id} className="px-3 py-3 text-center">
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full mx-auto cursor-pointer transition-all hover:scale-110',
                              getStatusColor(status),
                              adminEditMode && status === 'no_data' && 'hover:ring-2 hover:ring-blue-400'
                            )}
                            title={`${entityA.entity_name} ↔ ${entityB.entity_name}: ${status}`}
                            onClick={async () => {
                              if (adminEditMode && status === 'no_data') {
                                // 관리자 수동 상태 변경: no_data -> pending
                                try {
                                  const { error } = await supabase
                                    .from('arap_submissions')
                                    .update({ match_status: 'pending' })
                                    .eq('entity_id', entityA.id)
                                    .eq('fiscal_year', selectedYear)
                                    .eq('fiscal_month', selectedMonth);
                                  if (!error) {
                                    await loadData();
                                  }
                                } catch {
                                  // silently fail - status remains unchanged
                                }
                              } else {
                                // 상세 팝업 열기
                                setSelectedPair({ entity1: entityA, entity2: entityB });
                              }
                            }}
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
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold">전체 매트릭스 (필터 미적용)</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullMatrix(false)}
            >
              ✕ 닫기
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Entity
                  </th>
                  {entities.map((entity) => (
                    <th
                      key={entity.id}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase min-w-[80px]"
                    >
                      {entity.entity_name.replace('InBody ', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entities.map((entityA) => (
                  <tr key={entityA.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entityA.entity_name.replace('InBody ', '')}
                    </td>
                    {entities.map((entityB) => {
                      if (entityA.id === entityB.id) {
                        return (
                          <td key={entityB.id} className="px-3 py-3 text-center">
                            <span className="text-gray-400">-</span>
                          </td>
                        );
                      }
                      const status = getStatusForPair(entityA.id, entityB.id);
                      return (
                        <td key={entityB.id} className="px-3 py-3 text-center">
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full mx-auto cursor-pointer transition-all hover:scale-110',
                              getStatusColor(status)
                            )}
                            title={`${entityA.entity_name} ↔ ${entityB.entity_name}: ${status}`}
                            onClick={() => {
                              setSelectedPair({ entity1: entityA, entity2: entityB });
                            }}
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
      )}

      {/* 전체 매트릭스 보기 버튼 */}
      {!showFullMatrix && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullMatrix(true)}
          >
            📋 전체 매트릭스 보기 ({entities.length}×{entities.length})
          </Button>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-400" />
          <span>양쪽 모두 미제출</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span>확인중 (한쪽만 제출)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span>불일치 (금액 불일치)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500" />
          <span>양쪽 제출 + 금액 매칭 완료</span>
        </div>
      </div>

      {/* 상세 팝업 */}
      {selectedPair && (
        <TransactionDetailPopup
          entity1={selectedPair.entity1}
          entity2={selectedPair.entity2}
          year={selectedYear}
          month={selectedMonth}
          open={!!selectedPair}
          onClose={() => setSelectedPair(null)}
        />
      )}
    </div>
  );
}
