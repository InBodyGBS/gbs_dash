'use client';

import { useState, useEffect } from 'react';
import { Save, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { savePreliminarySalesSGA, getPreliminarySalesSGA } from '@/lib/services/preliminarySalesSGAService';
import type { PreliminarySalesSGA } from '@/lib/types/preliminary-sales-sga';

interface PreliminarySalesSGAFormProps {
  quarterId?: string | null;
  subsidiaryId?: string | null;
  onSaveSuccess: () => void;
}

type Period = '1Q' | '2Q' | '3Q' | '4Q';

interface FormData {
  period: Period;
  sales: number | null;
  sga: number | null;
}

export function PreliminarySalesSGAForm({
  quarterId,
  subsidiaryId,
  onSaveSuccess,
}: PreliminarySalesSGAFormProps) {
  const [formData, setFormData] = useState<FormData[]>([
    { period: '1Q', sales: null, sga: null },
    { period: '2Q', sales: null, sga: null },
    { period: '3Q', sales: null, sga: null },
    { period: '4Q', sales: null, sga: null },
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 기존 데이터 로드
  useEffect(() => {
    if (quarterId && subsidiaryId && !quarterId.startsWith('temp-') && !quarterId.startsWith('custom-')) {
      loadExistingData();
    }
  }, [quarterId, subsidiaryId]);

  const loadExistingData = async () => {
    try {
      setLoading(true);
      const data = await getPreliminarySalesSGA(quarterId, subsidiaryId);
      
      // 기존 데이터로 폼 업데이트
      const updatedFormData = formData.map((item) => {
        const existing = data.find((d) => d.period === item.period);
        return existing
          ? { period: item.period, sales: existing.sales, sga: existing.sga }
          : item;
      });
      setFormData(updatedFormData);
    } catch (error: any) {
      console.error('Failed to load existing data:', error);
      // 에러가 있어도 계속 진행 (데이터가 없을 수 있음)
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (period: Period, field: 'sales' | 'sga', value: string) => {
    setFormData((prev) =>
      prev.map((item) =>
        item.period === period
          ? { ...item, [field]: value === '' ? null : parseFloat(value) || null }
          : item
      )
    );
  };

  const calculateTotal = (field: 'sales' | 'sga'): number => {
    return formData.reduce((sum, item) => {
      const value = item[field];
      return sum + (value !== null && value !== undefined ? value : 0);
    }, 0);
  };

  const handleSave = async () => {
    if (!subsidiaryId || subsidiaryId === 'all') {
      toast.error('Entity를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      await savePreliminarySalesSGA({
        quarter_id: quarterId || null,
        subsidiary_id: subsidiaryId,
        data: formData,
      });
      toast.success('데이터 저장 완료', {
        description: 'Preliminary Sales/SG&A 데이터가 성공적으로 저장되었습니다.',
      });
      onSaveSuccess();
    } catch (error: any) {
      toast.error('저장 실패', {
        description: error.message || '데이터 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
          style={{ borderColor: '#971B2F' }}
        ></div>
        <p className="text-gray-600 mt-4">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Preliminary Sales/SG&A 입력</h3>
          <p className="text-sm text-gray-600 mt-1">분기별 Sales 및 SG&A 금액을 입력하세요</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !subsidiaryId || subsidiaryId === 'all'}
          style={{ backgroundColor: '#971B2F' }}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <div
                className="animate-spin rounded-full h-4 w-4 border-b-2"
                style={{ borderColor: 'white' }}
              ></div>
              저장 중...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              저장
            </>
          )}
        </Button>
      </div>

      {(!subsidiaryId || subsidiaryId === 'all') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            데이터를 저장하려면 상단에서 Entity를 선택해주세요.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Period</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>SG&A</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formData.map((item) => (
              <TableRow key={item.period}>
                <TableCell className="font-medium">{item.period}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.sales !== null && item.sales !== undefined ? item.sales : ''}
                    onChange={(e) => handleInputChange(item.period, 'sales', e.target.value)}
                    placeholder="0.00"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.sga !== null && item.sga !== undefined ? item.sga : ''}
                    onChange={(e) => handleInputChange(item.period, 'sga', e.target.value)}
                    placeholder="0.00"
                    className="w-full"
                  />
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-gray-50 font-semibold">
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Total
                </div>
              </TableCell>
              <TableCell>
                <div className="font-semibold text-gray-900">
                  {calculateTotal('sales').toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-semibold text-gray-900">
                  {calculateTotal('sga').toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
