/**
 * Entity View - 거래 상세 팝업 컴포넌트
 */

'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getMatchStatusSummary } from '@/lib/services/arapService';
import type { ArapEntity, MatchStatusSummary } from '@/lib/types/arap';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface TransactionDetailPopupProps {
  entity1: ArapEntity;
  entity2: ArapEntity;
  year: number;
  month: number;
  open: boolean;
  onClose: () => void;
}

export function TransactionDetailPopup({
  entity1,
  entity2,
  year,
  month,
  open,
  onClose,
}: TransactionDetailPopupProps) {
  const [summary, setSummary] = useState<MatchStatusSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadDetails();
    }
  }, [open, entity1.id, entity2.id, year, month]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const summaries = await getMatchStatusSummary(year, month);
      const found = summaries.find(
        (s) =>
          (s.entity_a_id === entity1.id && s.entity_b_id === entity2.id) ||
          (s.entity_a_id === entity2.id && s.entity_b_id === entity1.id)
      );
      setSummary(found || null);
    } catch (error) {
      console.error('Failed to load details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownload = async () => {
    if (!summary) return;

    try {
      // 통화별 상세 정보를 Excel로 내보내기
      const currencyBreakdown = summary.currency_breakdown || [];
      
      if (currencyBreakdown.length === 0) {
        // 통화별 정보가 없으면 기본 정보만
        const exportData = [
          {
            'Entity A': entity1.entity_name,
            'Entity B': entity2.entity_name,
            'Year': year,
            'Month': month,
            'Status': summary.status,
            'Entity A AR': summary.entity_a_ar,
            'Entity A AP': summary.entity_a_ap,
            'Entity B AR': summary.entity_b_ar,
            'Entity B AP': summary.entity_b_ap,
            'Difference': summary.difference,
          },
        ];
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Summary');
        XLSX.writeFile(wb, `ARAP_${entity1.entity_name}_${entity2.entity_name}_${year}_${month}.xlsx`);
      } else {
        // 통화별 상세 정보
        const exportData = currencyBreakdown.map((cb) => ({
          'Currency': cb.currency,
          'Entity A AR': cb.entity_a_ar,
          'Entity A AP': cb.entity_a_ap,
          'Entity B AR': cb.entity_b_ar,
          'Entity B AP': cb.entity_b_ap,
          'Status': cb.status,
          'Difference': cb.difference,
        }));
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Currency Breakdown');
        XLSX.writeFile(wb, `ARAP_${entity1.entity_name}_${entity2.entity_name}_${year}_${month}.xlsx`);
      }
    } catch (error) {
      console.error('Failed to export:', error);
      alert('Export failed');
    }
  };

  if (!summary) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {entity1.entity_name} ↔ {entity2.entity_name}
            </DialogTitle>
            <DialogDescription>
              {year}년 {month}월 거래 내역
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 text-center text-gray-500">
            {loading ? 'Loading...' : 'No data available'}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const entity1ToEntity2 = {
    ar: summary.entity_a_id === entity1.id ? summary.entity_a_ar : summary.entity_b_ar,
    ap: summary.entity_a_id === entity1.id ? summary.entity_a_ap : summary.entity_b_ap,
  };

  const entity2ToEntity1 = {
    ar: summary.entity_a_id === entity2.id ? summary.entity_a_ar : summary.entity_b_ar,
    ap: summary.entity_a_id === entity2.id ? summary.entity_a_ap : summary.entity_b_ap,
  };

  const entity1Submitted = entity1ToEntity2.ar > 0 || entity1ToEntity2.ap > 0;
  const entity2Submitted = entity2ToEntity1.ar > 0 || entity2ToEntity1.ap > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entity1.entity_name} ↔ {entity2.entity_name}
          </DialogTitle>
          <DialogDescription>
            {year}년 {month}월 거래 내역
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* 왼쪽: Entity1 → Entity2 */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {entity1.entity_name} → {entity2.entity_name}
              {entity1Submitted ? (
                <Badge className="bg-green-100 text-green-800">제출완료</Badge>
              ) : (
                <Badge variant="secondary">미제출</Badge>
              )}
            </h3>
            
            {entity1Submitted ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AR:</span>
                  <span className="font-mono font-semibold">
                    {entity1ToEntity2.ar.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AP:</span>
                  <span className="font-mono font-semibold">
                    {entity1ToEntity2.ap.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">아직 제출하지 않았습니다</div>
            )}
          </div>
          
          {/* 오른쪽: Entity2 → Entity1 */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {entity2.entity_name} → {entity1.entity_name}
              {entity2Submitted ? (
                <Badge className="bg-green-100 text-green-800">제출완료</Badge>
              ) : (
                <Badge variant="secondary">미제출</Badge>
              )}
            </h3>
            
            {entity2Submitted ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AR:</span>
                  <span className="font-mono font-semibold">
                    {entity2ToEntity1.ar.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AP:</span>
                  <span className="font-mono font-semibold">
                    {entity2ToEntity1.ap.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">아직 제출하지 않았습니다</div>
            )}
          </div>
        </div>
        
        {/* 통화별 상세 정보 */}
        {summary.currency_breakdown && summary.currency_breakdown.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-3">통화별 상세</h3>
            <div className="space-y-3">
              {summary.currency_breakdown.map((cb, index) => (
                <div key={index} className="bg-gray-50 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{cb.currency}</span>
                    <Badge
                      className={
                        cb.status === 'matched'
                          ? 'bg-green-100 text-green-800'
                          : cb.status === 'mismatched'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {cb.status === 'matched' && 'Matched'}
                      {cb.status === 'mismatched' && 'Mismatched'}
                      {cb.status === 'no_data' && 'No Data'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">AR:</span>{' '}
                      <span className="font-mono">{cb.entity_a_ar.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">AP:</span>{' '}
                      <span className="font-mono">{cb.entity_a_ap.toLocaleString()}</span>
                    </div>
                  </div>
                  {cb.difference > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      차액: {cb.difference.toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 매칭 상태 */}
        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">매칭 상태</h3>
          
          {summary.status === 'matched' ? (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <div className="flex items-center gap-2 text-green-700">
                <span className="text-2xl">🟢</span>
                <span className="font-semibold">매칭 완료</span>
              </div>
              <div className="text-sm text-green-600 mt-2">
                AR/AP 금액이 정확히 일치합니다
              </div>
            </div>
          ) : summary.status === 'pending' ? (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex items-center gap-2 text-blue-700">
                <span className="text-2xl">🔵</span>
                <span className="font-semibold">확인 중</span>
              </div>
              <div className="text-sm text-blue-600 mt-2">
                {!entity1Submitted && !entity2Submitted
                  ? '양쪽 모두 미제출'
                  : !entity1Submitted
                  ? `${entity1.entity_name} 미제출`
                  : !entity2Submitted
                  ? `${entity2.entity_name} 미제출`
                  : '금액 불일치'}
              </div>
              {entity1Submitted && entity2Submitted && summary.difference > 0 && (
                <div className="mt-2 text-sm text-red-600">
                  차액: {summary.difference.toLocaleString()}
                </div>
              )}
            </div>
          ) : summary.status === 'mismatched' ? (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-center gap-2 text-red-700">
                <span className="text-2xl">🔴</span>
                <span className="font-semibold">불일치</span>
              </div>
              <div className="text-sm text-red-600 mt-2">
                금액이 일치하지 않습니다
              </div>
              {summary.difference > 0 && (
                <div className="mt-2 text-sm font-semibold text-red-700">
                  차액: {summary.difference.toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-2xl">⚪</span>
                <span className="font-semibold">미제출</span>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                양쪽 모두 데이터를 제출하지 않았습니다
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            상세 내역 다운로드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
