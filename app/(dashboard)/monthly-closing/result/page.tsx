'use client';

/**
 * Monthly Closing - Result 페이지
 * P&L 손익계산서 조회 (PRD v1.1 기반 - P&L Code 구조)
 * Single Entity View + Drill-Down
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  getPLResults,
  calculatePLSummary,
  getAllEntityPLSummaries,
  getStdPLMaster,
} from '@/lib/services/monthlyClosingService';
import type { PLResult, PLSummary, StdPLMaster } from '@/lib/types/monthly-closing';
import type { Subsidiary } from '@/lib/supabase/types';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'monthly-closing-result-state';

// 금액 포맷팅 (실제 음수만 음수로 표시, 나머지는 양수로 표시)
function formatCurrency(amount: number, compact = false): string {
  if (amount === 0) return '0';
  const abs = Math.abs(amount);
  // 실제 음수인 경우만 음수 표시
  const sign = amount < 0 ? '-' : '';

  if (compact) {
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// P&L 표시 라인 (PRD 기반)
interface PLDisplayLine {
  key: string;
  plCode?: string;
  label: string;
  amount: number;
  indent: number;
  isSubtotal: boolean;
  isMargin: boolean;
  marginValue?: number;
  children?: PLDisplayLine[];
  canDrillDown?: boolean;
}

export default function ResultPage() {
  // localStorage 복원
  const loadSavedState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };

  const savedState = loadSavedState();

  // 필터 상태
  const [selectedEntityCode, setSelectedEntityCode] = useState<string>(savedState?.entityCode || '');
  const [selectedYear, setSelectedYear] = useState<string>(savedState?.year || String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(savedState?.month || String(new Date().getMonth() || 12));
  const [viewMode, setViewMode] = useState<'single' | 'multi'>(savedState?.viewMode || 'single');

  // 데이터 상태
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [plResults, setPLResults] = useState<PLResult[]>([]);
  const [plMaster, setPLMaster] = useState<StdPLMaster[]>([]);
  const [plSummary, setPLSummary] = useState<PLSummary | null>(null);
  const [allSummaries, setAllSummaries] = useState<PLSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [drillDownData, setDrillDownData] = useState<{ plCode: string; accounts: any[] } | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  // 상태 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        entityCode: selectedEntityCode,
        year: selectedYear,
        month: selectedMonth,
        viewMode,
      }));
    } catch {}
  }, [selectedEntityCode, selectedYear, selectedMonth, viewMode]);

  // 초기 로드
  useEffect(() => {
    loadSubsidiaries();
    loadPLMaster();
  }, []);

  // Entity/Period 변경 시 데이터 로드
  useEffect(() => {
    if (viewMode === 'single' && selectedEntityCode && selectedYear && selectedMonth) {
      loadSingleEntityPL();
    } else if (viewMode === 'multi' && selectedYear && selectedMonth) {
      loadMultiEntityPL();
    }
  }, [selectedEntityCode, selectedYear, selectedMonth, viewMode]);

  const loadSubsidiaries = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('subsidiaries').select('*').order('name');
      setSubsidiaries(data || []);
    } catch {
      toast.error('법인 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadPLMaster = async () => {
    try {
      const data = await getStdPLMaster();
      setPLMaster(data);
    } catch (error: any) {
      console.error('Failed to load PL Master:', error);
    }
  };

  const loadSingleEntityPL = async () => {
    setDataLoading(true);
    try {
      const results = await getPLResults(
        selectedEntityCode,
        parseInt(selectedYear),
        parseInt(selectedMonth)
      );
      setPLResults(results);

      const entityName =
        subsidiaries.find((s) => s.code === selectedEntityCode)?.name || selectedEntityCode;
      if (results.length > 0) {
        const summary = calculatePLSummary(
          results,
          selectedEntityCode,
          entityName,
          parseInt(selectedYear),
          parseInt(selectedMonth)
        );
        setPLSummary(summary);
      } else {
        setPLSummary(null);
      }
    } catch (error: any) {
      console.error('Failed to load P&L:', error);
      toast.error('P&L 데이터 로드 실패');
    } finally {
      setDataLoading(false);
    }
  };

  const loadMultiEntityPL = async () => {
    setDataLoading(true);
    try {
      const summaries = await getAllEntityPLSummaries(
        parseInt(selectedYear),
        parseInt(selectedMonth)
      );
      setAllSummaries(summaries);
    } catch (error: any) {
      console.error('Failed to load all PL:', error);
      toast.error('전체 P&L 로드 실패');
    } finally {
      setDataLoading(false);
    }
  };

  // Drill-down 데이터 로드
  const loadDrillDown = async (plCode: string) => {
    if (!selectedEntityCode || !selectedYear || !selectedMonth) return;

    try {
      // 해당 P&L Code에 매핑된 원장 계정 조회
      const { data: upload } = await supabase
        .from('tb_uploads')
        .select('id')
        .eq('entity_code', selectedEntityCode)
        .eq('period_year', parseInt(selectedYear))
        .eq('period_month', parseInt(selectedMonth))
        .single();

      if (!upload) return;

      // 매핑 조회
      const { data: mappings } = await supabase
        .from('coa_mapping')
        .select('local_account_code')
        .eq('entity_code', selectedEntityCode)
        .eq('std_code', plCode)
        .eq('is_active', true);

      if (!mappings || mappings.length === 0) return;

      const accountCodes = mappings.map((m: any) => m.local_account_code);

      // 원장 데이터 조회
      const { data: rawData } = await supabase
        .from('tb_raw_data')
        .select('*')
        .eq('upload_id', upload.id)
        .in('account_code', accountCodes);

      setDrillDownData({
        plCode,
        accounts: rawData || [],
      });
      setDrillDownOpen(true);
    } catch (error: any) {
      console.error('Failed to load drill-down:', error);
      toast.error('Drill-down 데이터 로드 실패');
    }
  };

  // P&L 표시 라인 생성 (PRD 기반)
  const plDisplayLines: PLDisplayLine[] = useMemo(() => {
    if (!plSummary || !plResults.length) return [];

    // P&L Code별 금액 Map
    const amountByCode = new Map<string, number>();
    plResults.forEach((r) => {
      amountByCode.set(r.std_pl_code, r.amount);
    });

    // P&L Master Map
    const masterByCode = new Map<string, StdPLMaster>();
    plMaster.forEach((m) => {
      masterByCode.set(m.pl_code, m);
    });

    return [
      // Sales
      {
        key: 'sales',
        label: 'Sales',
        amount: plSummary.sales,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: [
          {
            key: '41000',
            plCode: '41000',
            label: 'Sales - Finished Goods',
            amount: amountByCode.get('41000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '42000',
            plCode: '42000',
            label: 'Sales - Finished Goods (Related)',
            amount: amountByCode.get('42000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '43000',
            plCode: '43000',
            label: 'Sales - Merchandise',
            amount: amountByCode.get('43000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '44000',
            plCode: '44000',
            label: 'Sales - Merchandise (Related)',
            amount: amountByCode.get('44000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '45000',
            plCode: '45000',
            label: 'Sales - Services',
            amount: amountByCode.get('45000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '46000',
            plCode: '46000',
            label: 'Sales - Others',
            amount: amountByCode.get('46000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
        ],
      },
      // Cost of Goods Sold
      {
        key: 'cogs',
        label: 'Cost of Goods Sold',
        amount: plSummary.costOfSales,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: [
          {
            key: '51000',
            plCode: '51000',
            label: 'COGS - Finished Goods',
            amount: amountByCode.get('51000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '52000',
            plCode: '52000',
            label: 'COGS - Merchandise',
            amount: amountByCode.get('52000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '53000',
            plCode: '53000',
            label: 'COGS - Services',
            amount: amountByCode.get('53000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '54000',
            plCode: '54000',
            label: 'COGS - Others',
            amount: amountByCode.get('54000') || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
        ],
      },
      // Gross Profit (계산값)
      {
        key: 'gross_profit',
        label: 'Gross Profit',
        amount: plSummary.grossProfit,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'gp_margin',
        label: 'GP Margin',
        amount: 0,
        indent: 1,
        isSubtotal: false,
        isMargin: true,
        marginValue: plSummary.gpMargin,
      },
      // Selling and Administration Expense
      {
        key: 'sga',
        label: 'Selling and Administration Expense',
        amount: plSummary.sellingAndAdminExpense,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('600'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => ({
            key: m.pl_code,
            plCode: m.pl_code,
            label: m.pl_line,
            amount: amountByCode.get(m.pl_code) || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          })),
      },
      // Operating Income (계산값)
      {
        key: 'operating_income',
        label: 'Operating Income',
        amount: plSummary.operatingIncome,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'operating_margin',
        label: 'Operating Margin',
        amount: 0,
        indent: 1,
        isSubtotal: false,
        isMargin: true,
        marginValue: plSummary.operatingMargin,
      },
      // Other Revenue
      {
        key: 'other_revenue',
        label: 'Other Revenue',
        amount: plSummary.otherRevenue,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('710'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => ({
            key: m.pl_code,
            plCode: m.pl_code,
            label: m.pl_line,
            amount: amountByCode.get(m.pl_code) || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          })),
      },
      // Other Expense
      {
        key: 'other_expense',
        label: 'Other Expense',
        amount: plSummary.otherExpense,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('720'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => ({
            key: m.pl_code,
            plCode: m.pl_code,
            label: m.pl_line,
            amount: amountByCode.get(m.pl_code) || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          })),
      },
      // Financial Revenue
      {
        key: 'financial_revenue',
        label: 'Financial Revenue',
        amount: plSummary.financialRevenue,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('730'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => ({
            key: m.pl_code,
            plCode: m.pl_code,
            label: m.pl_line,
            amount: amountByCode.get(m.pl_code) || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          })),
      },
      // Financial Expense
      {
        key: 'financial_expense',
        label: 'Financial Expense',
        amount: plSummary.financialExpense,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('740'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => ({
            key: m.pl_code,
            plCode: m.pl_code,
            label: m.pl_line,
            amount: amountByCode.get(m.pl_code) || 0,
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          })),
      },
      // Income before Tax (계산값)
      {
        key: 'income_before_tax',
        label: 'Income before Tax',
        amount: plSummary.incomeBeforeTax,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      // Corporate Income Tax
      {
        key: 'corporate_tax',
        plCode: '80001',
        label: 'Corporate Income Tax',
        amount: plSummary.corporateIncomeTax,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
      },
      // Net Income (계산값)
      {
        key: 'net_income',
        label: 'Net Income',
        amount: plSummary.netIncome,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'net_margin',
        label: 'Net Margin',
        amount: 0,
        indent: 1,
        isSubtotal: false,
        isMargin: true,
        marginValue: plSummary.netMargin,
      },
    ];
  }, [plSummary, plResults, plMaster]);

  const toggleExpand = (key: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDrillDown = (plCode: string) => {
    loadDrillDown(plCode);
  };

  // Excel 내보내기
  const handleExport = () => {
    if (viewMode === 'single' && plSummary) {
      const wsData = plDisplayLines
        .filter((l) => !l.isMargin)
        .map((line) => ({
          'P&L Code': line.plCode || '',
          'P&L Line': line.label,
          Amount: line.amount,
        }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'P&L');
      XLSX.writeFile(wb, `PL_${selectedEntityCode}_${selectedYear}_${selectedMonth}.xlsx`);
    } else if (viewMode === 'multi' && allSummaries.length > 0) {
      const wsData = allSummaries.map((s) => ({
        Entity: s.entityName,
        Sales: s.sales,
        'Cost of Sales': s.costOfSales,
        'Gross Profit': s.grossProfit,
        'GP%': s.gpMargin,
        'Operating Income': s.operatingIncome,
        'Op. Margin%': s.operatingMargin,
        'Net Income': s.netIncome,
        'Net%': s.netMargin,
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Entity Comparison');
      XLSX.writeFile(wb, `PL_All_${selectedYear}_${selectedMonth}.xlsx`);
    }
  };

  // 옵션 데이터
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => String(2020 + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto py-6 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">P&L Statement</h1>
          <p className="text-gray-600">월별 손익계산서 조회 및 분석</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 mb-6 bg-white rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* View Mode */}
          <div>
            <Label>View Mode</Label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'single' | 'multi')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="single">Single Entity</SelectItem>
                <SelectItem value="multi">Multi-Entity Comparison</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity (Single mode only) */}
          {viewMode === 'single' && (
            <div>
              <Label>Entity</Label>
              <Select value={selectedEntityCode} onValueChange={setSelectedEntityCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity 선택" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {subsidiaries.map((sub) => (
                    <SelectItem key={sub.id} value={sub.code}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>연도</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>월</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : viewMode === 'single' ? (
          /* Single Entity P&L View */
          !selectedEntityCode ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                Entity를 선택하면 P&L 손익계산서가 표시됩니다.
              </CardContent>
            </Card>
          ) : !plSummary ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p className="mb-2">해당 기간의 P&L 데이터가 없습니다.</p>
                <p className="text-sm">Upload 탭에서 TB 파일을 먼저 업로드해주세요.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {subsidiaries.find((s) => s.code === selectedEntityCode)?.name || selectedEntityCode}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedYear}년 {selectedMonth}월 P&L
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-0.5">
                  {/* 헤더 */}
                  <div className="grid grid-cols-12 py-2 px-4 border-b-2 border-gray-300 text-xs font-semibold text-gray-500 uppercase">
                    <div className="col-span-7">P&L Line</div>
                    <div className="col-span-5 text-right">Amount</div>
                  </div>

                  {/* P&L 라인 */}
                  {plDisplayLines.map((line) => {
                    const hasChildren = line.children && line.children.length > 0;
                    const isExpanded = expandedLines.has(line.key);

                    return (
                      <div key={line.key}>
                        <div
                          className={cn(
                            'grid grid-cols-12 py-2.5 px-4 rounded-md transition-colors',
                            line.isSubtotal && 'bg-gray-100 font-semibold border-t border-b border-gray-200',
                            line.isMargin && 'text-gray-500 italic text-sm',
                            !line.isSubtotal && !line.isMargin && 'hover:bg-gray-50',
                            (hasChildren || line.canDrillDown) && 'cursor-pointer'
                          )}
                          onClick={() => {
                            if (hasChildren) {
                              toggleExpand(line.key);
                            } else if (line.canDrillDown && line.plCode) {
                              handleDrillDown(line.plCode);
                            }
                          }}
                          style={{ paddingLeft: `${16 + line.indent * 24}px` }}
                        >
                          <div className="col-span-7 flex items-center gap-2">
                            {hasChildren && (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )
                            )}
                            {line.plCode && (
                              <span className="font-mono text-xs text-gray-400 mr-2">{line.plCode}</span>
                            )}
                            <span>{line.label}</span>
                          </div>
                          <div className={cn(
                            'col-span-5 text-right font-mono',
                            line.isMargin && 'text-gray-500',
                            !line.isMargin && line.amount < 0 && 'text-red-600'
                          )}>
                            {line.isMargin
                              ? formatPercent(line.marginValue || 0)
                              : line.amount !== 0
                                ? formatCurrency(line.amount)
                                : '-'}
                          </div>
                        </div>

                        {/* Drill-Down Children */}
                        {hasChildren && isExpanded && line.children?.map((child) => (
                          <div
                            key={child.key}
                            className="grid grid-cols-12 py-2 px-4 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                            style={{ paddingLeft: `${16 + child.indent * 24 + 20}px` }}
                            onClick={() => child.canDrillDown && child.plCode && handleDrillDown(child.plCode)}
                          >
                            <div className="col-span-7 flex items-center gap-2">
                              {child.plCode && (
                                <span className="font-mono text-xs text-gray-400 mr-2">{child.plCode}</span>
                              )}
                              <span>{child.label}</span>
                            </div>
                            <div className="col-span-5 text-right font-mono">
                              {child.amount !== 0 ? formatCurrency(child.amount) : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          /* Multi-Entity Comparison View */
          allSummaries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p className="mb-2">해당 기간의 P&L 데이터가 없습니다.</p>
                <p className="text-sm">Upload 탭에서 각 Entity의 TB 파일을 업로드해주세요.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Multi-Entity P&L Comparison</CardTitle>
                <p className="text-sm text-gray-500">
                  {selectedYear}년 {selectedMonth}월
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">P&L Line</th>
                        {allSummaries.map((s) => (
                          <th key={s.entityCode} className="text-right py-2 px-3 font-semibold text-gray-600">
                            {s.entityName}
                          </th>
                        ))}
                        <th className="text-right py-2 px-3 font-semibold text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Sales', key: 'sales' },
                        { label: 'COGS', key: 'costOfSales' },
                        { label: 'Gross Profit', key: 'grossProfit', bold: true },
                        { label: 'GP%', key: 'gpMargin', isPercent: true },
                        { label: 'SG&A', key: 'sellingAndAdminExpense' },
                        { label: 'Operating Income', key: 'operatingIncome', bold: true },
                        { label: 'Op. Margin%', key: 'operatingMargin', isPercent: true },
                        { label: 'Net Income', key: 'netIncome', bold: true },
                        { label: 'Net%', key: 'netMargin', isPercent: true },
                      ].map((row) => {
                        const total = row.isPercent
                          ? 0
                          : allSummaries.reduce((sum, s) => sum + (s as any)[row.key], 0);
                        const totalPercent = row.key === 'gpMargin'
                          ? (allSummaries.reduce((s, e) => s + e.grossProfit, 0) / Math.max(allSummaries.reduce((s, e) => s + e.sales, 0), 1)) * 100
                          : row.key === 'operatingMargin'
                            ? (allSummaries.reduce((s, e) => s + e.operatingIncome, 0) / Math.max(allSummaries.reduce((s, e) => s + e.sales, 0), 1)) * 100
                            : row.key === 'netMargin'
                              ? (allSummaries.reduce((s, e) => s + e.netIncome, 0) / Math.max(allSummaries.reduce((s, e) => s + e.sales, 0), 1)) * 100
                              : 0;

                        return (
                          <tr
                            key={row.key}
                            className={cn(
                              'border-b',
                              row.bold && 'bg-gray-50 font-semibold',
                              row.isPercent && 'text-gray-500 text-xs italic'
                            )}
                          >
                            <td className="py-2 px-3">{row.label}</td>
                            {allSummaries.map((s) => (
                              <td key={s.entityCode} className="py-2 px-3 text-right font-mono">
                                {row.isPercent
                                  ? formatPercent((s as any)[row.key])
                                  : formatCurrency((s as any)[row.key], true)}
                              </td>
                            ))}
                            <td className="py-2 px-3 text-right font-mono font-semibold">
                              {row.isPercent
                                ? formatPercent(totalPercent)
                                : formatCurrency(total, true)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Drill-Down Dialog */}
      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {drillDownData && plMaster.find((m) => m.pl_code === drillDownData.plCode)?.pl_line}
            </DialogTitle>
            <p className="text-sm text-gray-500">
              P&L Code: {drillDownData?.plCode}
            </p>
          </DialogHeader>
          {drillDownData && drillDownData.accounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Account Code</th>
                    <th className="text-left py-2 px-3 font-medium">Account Name</th>
                    <th className="text-right py-2 px-3 font-medium">Debit</th>
                    <th className="text-right py-2 px-3 font-medium">Credit</th>
                    <th className="text-right py-2 px-3 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDownData.accounts.map((acc: any) => (
                    <tr key={acc.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono text-xs">{acc.account_code}</td>
                      <td className="py-2 px-3">{acc.account_name}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {acc.debit.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {acc.credit.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {acc.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">매핑된 계정이 없습니다.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
