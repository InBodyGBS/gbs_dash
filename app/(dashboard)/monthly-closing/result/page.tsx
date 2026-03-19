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

// P&L 표시 라인 (12개월 월별 데이터)
interface PLDisplayLine {
  key: string;
  plCode?: string;
  label: string;
  monthlyAmounts: number[]; // 12개월 데이터 [1월, 2월, ..., 12월]
  indent: number;
  isSubtotal: boolean;
  isMargin: boolean;
  marginValues?: number[]; // 12개월 마진 데이터
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

  // 데이터 상태
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [plMaster, setPLMaster] = useState<StdPLMaster[]>([]);
  const [monthlyData, setMonthlyData] = useState<Map<number, PLResult[]>>(new Map()); // 월별 P&L 데이터 (1~12월)
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [drillDownData, setDrillDownData] = useState<{ plCode: string; accounts: any[]; month: number } | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  // 상태 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        entityCode: selectedEntityCode,
        year: selectedYear,
      }));
    } catch {}
  }, [selectedEntityCode, selectedYear]);

  // 초기 로드
  useEffect(() => {
    loadSubsidiaries();
    loadPLMaster();
  }, []);

  // Entity/Year 변경 시 12개월 데이터 로드
  useEffect(() => {
    if (selectedEntityCode && selectedYear) {
      loadYearlyMonthlyPL();
    }
  }, [selectedEntityCode, selectedYear]);

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

  // 12개월 월별 데이터 로드 (각 월 = 해당 월 누적 - 직전월 누적)
  const loadYearlyMonthlyPL = async () => {
    if (!selectedEntityCode || !selectedYear) return;
    
    setDataLoading(true);
    try {
      const year = parseInt(selectedYear);
      const newMonthlyData = new Map<number, PLResult[]>();

      // 12개월 데이터를 병렬로 로드
      const loadPromises = Array.from({ length: 12 }, async (_, i) => {
        const month = i + 1;
        const currentResults = await getPLResults(selectedEntityCode, year, month);
        
        if (month === 1) {
          // 1월은 그냥 누적값 사용
          return { month, results: currentResults };
        } else {
          // 2월~12월: 현재 누적 - 직전월 누적
          const prevMonth = month - 1;
          const prevResults = await getPLResults(selectedEntityCode, year, prevMonth);
          
          // 현재 월 누적값 Map
          const currMap = new Map<string, number>();
          currentResults.forEach((r) => {
            currMap.set(r.std_pl_code, (currMap.get(r.std_pl_code) || 0) + r.amount);
          });
          
          // 직전월 누적값 Map
          const prevMap = new Map<string, number>();
          prevResults.forEach((r) => {
            prevMap.set(r.std_pl_code, (prevMap.get(r.std_pl_code) || 0) + r.amount);
          });
          
          // 차이 계산
          const allCodes = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
          const monthlyResults: PLResult[] = Array.from(allCodes).map((code) => ({
            id: `${code}-${month}`,
            upload_id: '',
            entity_code: selectedEntityCode,
            subsidiary_id: null,
            period_year: year,
            period_month: month,
            std_pl_code: code,
            amount: (currMap.get(code) || 0) - (prevMap.get(code) || 0),
            currency: currentResults[0]?.currency || 'KRW',
            created_at: new Date().toISOString(),
            std_pl_master: undefined,
          }));
          
          return { month, results: monthlyResults };
        }
      });

      const results = await Promise.all(loadPromises);
      results.forEach(({ month, results }) => {
        newMonthlyData.set(month, results);
      });

      setMonthlyData(newMonthlyData);
    } catch (error: any) {
      console.error('Failed to load yearly monthly P&L:', error);
      toast.error('월별 P&L 데이터 로드 실패');
    } finally {
      setDataLoading(false);
    }
  };

  // Drill-down 데이터 로드
  const loadDrillDown = async (plCode: string, month: number) => {
    if (!selectedEntityCode || !selectedYear) return;

    try {
      // 해당 P&L Code에 매핑된 원장 계정 조회
      const { data: upload } = await supabase
        .from('tb_uploads')
        .select('id')
        .eq('entity_code', selectedEntityCode)
        .eq('period_year', parseInt(selectedYear))
        .eq('period_month', month)
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
        .eq('upload_id', upload!.id)
        .in('account_code', accountCodes);

      setDrillDownData({
        plCode,
        accounts: rawData || [],
        month,
      });
      setDrillDownOpen(true);
    } catch (error: any) {
      console.error('Failed to load drill-down:', error);
      toast.error('Drill-down 데이터 로드 실패');
    }
  };

  // P&L 표시 라인 생성 (12개월 월별 데이터)
  const plDisplayLines: PLDisplayLine[] = useMemo(() => {
    if (monthlyData.size === 0 || !plMaster.length) return [];

    // 각 월별로 P&L Code별 금액 Map 생성
    const amountByCodeByMonth = new Map<number, Map<string, number>>();
    for (let month = 1; month <= 12; month++) {
      const monthData = monthlyData.get(month) || [];
      const codeMap = new Map<string, number>();
      monthData.forEach((r) => {
        codeMap.set(r.std_pl_code, (codeMap.get(r.std_pl_code) || 0) + r.amount);
      });
      amountByCodeByMonth.set(month, codeMap);
    }

    // 각 P&L Code에 대해 12개월 데이터 추출하는 헬퍼 함수
    const getMonthlyAmounts = (code: string): number[] => {
      return Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const codeMap = amountByCodeByMonth.get(month);
        return codeMap?.get(code) || 0;
      });
    };

    // Summary 계산 헬퍼 (12개월 합계)
    const getSummary = (codes: string[]): number[] => {
      return Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const codeMap = amountByCodeByMonth.get(month);
        return codes.reduce((sum, code) => sum + (codeMap?.get(code) || 0), 0);
      });
    };

    // P&L Master Map
    const masterByCode = new Map<string, StdPLMaster>();
    plMaster.forEach((m) => {
      masterByCode.set(m.pl_code, m);
    });

    // Sales 합계 계산
    const salesCodes = ['41000', '42000', '43000', '44000', '45000', '46000'];
    const salesAmounts = getSummary(salesCodes);
    
    // COGS 합계 계산
    const cogsCodes = ['51000', '52000', '53000', '54000'];
    const cogsAmounts = getSummary(cogsCodes);
    
    // Gross Profit 계산 (Sales - COGS)
    const grossProfitAmounts = Array.from({ length: 12 }, (_, i) => salesAmounts[i] - cogsAmounts[i]);
    
    // GP Margin 계산
    const gpMarginValues = Array.from({ length: 12 }, (_, i) => 
      salesAmounts[i] !== 0 ? (grossProfitAmounts[i] / salesAmounts[i]) * 100 : 0
    );

    // SG&A 계산 (600번대 코드들)
    const sgaCodes = plMaster.filter((m) => m.pl_code.startsWith('600')).map((m) => m.pl_code);
    const sgaAmounts = getSummary(sgaCodes);
    
    // Operating Income 계산 (Gross Profit - SG&A)
    const operatingIncomeAmounts = Array.from({ length: 12 }, (_, i) => grossProfitAmounts[i] - sgaAmounts[i]);
    
    // Operating Margin 계산
    const operatingMarginValues = Array.from({ length: 12 }, (_, i) => 
      salesAmounts[i] !== 0 ? (operatingIncomeAmounts[i] / salesAmounts[i]) * 100 : 0
    );
    
    // Other Revenue 계산 (710번대)
    const otherRevenueCodes = plMaster.filter((m) => m.pl_code.startsWith('710')).map((m) => m.pl_code);
    const otherRevenueAmounts = getSummary(otherRevenueCodes);
    
    // Other Expense 계산 (720번대)
    const otherExpenseCodes = plMaster.filter((m) => m.pl_code.startsWith('720')).map((m) => m.pl_code);
    const otherExpenseAmounts = getSummary(otherExpenseCodes);
    
    // Financial Revenue 계산 (730번대)
    const financialRevenueCodes = plMaster.filter((m) => m.pl_code.startsWith('730')).map((m) => m.pl_code);
    const financialRevenueAmounts = getSummary(financialRevenueCodes);
    
    // Financial Expense 계산 (740번대)
    const financialExpenseCodes = plMaster.filter((m) => m.pl_code.startsWith('740')).map((m) => m.pl_code);
    const financialExpenseAmounts = getSummary(financialExpenseCodes);
    
    // Income before Tax 계산
    const incomeBeforeTaxAmounts = Array.from({ length: 12 }, (_, i) => 
      operatingIncomeAmounts[i] + otherRevenueAmounts[i] - otherExpenseAmounts[i] + financialRevenueAmounts[i] - financialExpenseAmounts[i]
    );
    
    // Corporate Income Tax
    const corporateTaxAmounts = getMonthlyAmounts('80001');
    
    // Net Income 계산
    const netIncomeAmounts = Array.from({ length: 12 }, (_, i) => incomeBeforeTaxAmounts[i] - corporateTaxAmounts[i]);
    
    // Net Margin 계산
    const netMarginValues = Array.from({ length: 12 }, (_, i) => 
      salesAmounts[i] !== 0 ? (netIncomeAmounts[i] / salesAmounts[i]) * 100 : 0
    );

    return [
      // Sales
      {
        key: 'sales',
        label: 'Sales',
        monthlyAmounts: salesAmounts,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: [
          {
            key: '41000',
            plCode: '41000',
            label: 'Sales - Finished Goods',
            monthlyAmounts: getMonthlyAmounts('41000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '42000',
            plCode: '42000',
            label: 'Sales - Finished Goods (Related)',
            monthlyAmounts: getMonthlyAmounts('42000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '43000',
            plCode: '43000',
            label: 'Sales - Merchandise',
            monthlyAmounts: getMonthlyAmounts('43000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '44000',
            plCode: '44000',
            label: 'Sales - Merchandise (Related)',
            monthlyAmounts: getMonthlyAmounts('44000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '45000',
            plCode: '45000',
            label: 'Sales - Services',
            monthlyAmounts: getMonthlyAmounts('45000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '46000',
            plCode: '46000',
            label: 'Sales - Others',
            monthlyAmounts: getMonthlyAmounts('46000'),
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
        monthlyAmounts: cogsAmounts,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: [
          {
            key: '51000',
            plCode: '51000',
            label: 'COGS - Finished Goods',
            monthlyAmounts: getMonthlyAmounts('51000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '52000',
            plCode: '52000',
            label: 'COGS - Merchandise',
            monthlyAmounts: getMonthlyAmounts('52000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '53000',
            plCode: '53000',
            label: 'COGS - Services',
            monthlyAmounts: getMonthlyAmounts('53000'),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
          },
          {
            key: '54000',
            plCode: '54000',
            label: 'COGS - Others',
            monthlyAmounts: getMonthlyAmounts('54000'),
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
        monthlyAmounts: grossProfitAmounts,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'gp_margin',
        label: 'GP Margin',
        monthlyAmounts: Array(12).fill(0),
        indent: 1,
        isSubtotal: false,
        isMargin: true,
        marginValues: gpMarginValues,
      },
      // Selling and Administration Expense
      {
        key: 'sga',
        label: 'Selling and Administration Expense',
        monthlyAmounts: sgaAmounts,
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
            monthlyAmounts: getMonthlyAmounts(m.pl_code),
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
        monthlyAmounts: operatingIncomeAmounts,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'operating_margin',
        label: 'Operating Margin',
        monthlyAmounts: Array(12).fill(0),
        indent: 1,
        isSubtotal: false,
        isMargin: true,
        marginValues: operatingMarginValues,
      },
      // Other Revenue
      {
        key: 'other_revenue',
        label: 'Other Revenue',
        monthlyAmounts: otherRevenueAmounts,
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
            monthlyAmounts: getMonthlyAmounts(m.pl_code),
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
        monthlyAmounts: otherExpenseAmounts,
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
            monthlyAmounts: getMonthlyAmounts(m.pl_code),
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
        monthlyAmounts: financialRevenueAmounts,
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
            monthlyAmounts: getMonthlyAmounts(m.pl_code),
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
        monthlyAmounts: financialExpenseAmounts,
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
            monthlyAmounts: getMonthlyAmounts(m.pl_code),
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
        monthlyAmounts: incomeBeforeTaxAmounts,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      // Corporate Income Tax
      {
        key: 'corporate_tax',
        plCode: '80001',
        label: 'Corporate Income Tax',
        monthlyAmounts: corporateTaxAmounts,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
      },
      // Net Income (계산값)
      {
        key: 'net_income',
        label: 'Net Income',
        monthlyAmounts: netIncomeAmounts,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'net_margin',
        label: 'Net Margin',
        monthlyAmounts: Array(12).fill(0),
        indent: 1,
        isSubtotal: false,
        isMargin: true,
        marginValues: netMarginValues,
      },
    ];
  }, [monthlyData, plMaster]);

  const toggleExpand = (key: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDrillDown = (plCode: string, month: number) => {
    loadDrillDown(plCode, month);
  };

  // Excel 내보내기
  const handleExport = () => {
    if (!selectedEntityCode || !selectedYear || plDisplayLines.length === 0) return;
    
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const headers = ['P&L Code', 'P&L Line', ...monthNames];
    
    const wsData = plDisplayLines
      .filter((l) => !l.isMargin)
      .map((line) => {
        const row: any = {
          'P&L Code': line.plCode || '',
          'P&L Line': line.label,
        };
        line.monthlyAmounts.forEach((amount, idx) => {
          row[monthNames[idx]] = amount;
        });
        return row;
      });
    
    const ws = XLSX.utils.json_to_sheet(wsData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Monthly');
    XLSX.writeFile(wb, `PL_${selectedEntityCode}_${selectedYear}_Monthly.xlsx`);
  };

  // 옵션 데이터
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => String(2020 + i));

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
          <h1 className="text-3xl font-bold text-gray-900 mb-1.5">P&L Statement</h1>
          <p className="text-gray-500 text-sm">월별 손익계산서 조회 및 분석</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="border-gray-300 hover:bg-gray-50">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 mb-6 bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Entity */}
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
        </div>
        <p className="text-xs text-gray-500 mt-3">
          * 각 월은 해당 월 누적값에서 직전월 누적값을 뺀 월별 금액입니다. (1월은 누적값)
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !selectedEntityCode ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Entity를 선택하면 P&L 손익계산서가 표시됩니다.
            </CardContent>
          </Card>
        ) : plDisplayLines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p className="mb-2">해당 기간의 P&L 데이터가 없습니다.</p>
              <p className="text-sm">Upload 탭에서 TB 파일을 먼저 업로드해주세요.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {subsidiaries.find((s) => s.code === selectedEntityCode)?.name || selectedEntityCode}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1.5">
                    {selectedYear}년 월별 P&L (각 월 = 해당 월 누적 - 직전월 누적)
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[300px]">
                        P&L Line
                      </th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i + 1} className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                          {i + 1}월
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plDisplayLines.map((line) => {
                      const hasChildren = line.children && line.children.length > 0;
                      const isExpanded = expandedLines.has(line.key);

                      return (
                        <>
                          <tr key={line.key} className={cn(
                            'transition-colors',
                            line.isSubtotal && 'bg-gray-50/80 font-semibold',
                            !line.isSubtotal && !line.isMargin && 'hover:bg-gray-50/50'
                          )}>
                            <td
                              className={cn(
                                'py-3 px-6 sticky left-0 bg-inherit z-10',
                                line.isSubtotal && 'bg-gray-50/80',
                                !line.isSubtotal && !line.isMargin && 'bg-white',
                                (hasChildren || line.canDrillDown) && 'cursor-pointer'
                              )}
                              onClick={() => {
                                if (hasChildren) {
                                  toggleExpand(line.key);
                                }
                              }}
                              style={{ paddingLeft: `${24 + line.indent * 20}px` }}
                            >
                              <div className="flex items-center gap-2.5">
                                {hasChildren && (
                                  <div className="flex-shrink-0">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-gray-400" />
                                    )}
                                  </div>
                                )}
                                {!hasChildren && (hasChildren || line.canDrillDown) && (
                                  <div className="w-4" />
                                )}
                                {line.plCode && (
                                  <span className="font-mono text-xs text-gray-500 mr-2 font-medium">{line.plCode}</span>
                                )}
                                <span className={cn(
                                  line.isSubtotal && 'text-gray-900',
                                  line.isMargin && 'text-gray-500 italic text-sm',
                                  !line.isSubtotal && !line.isMargin && 'text-gray-700'
                                )}>{line.label}</span>
                              </div>
                            </td>
                            {line.monthlyAmounts.map((amount, monthIdx) => {
                              const month = monthIdx + 1;
                              const isNegative = amount < 0;
                              return (
                                <td
                                  key={month}
                                  className={cn(
                                    'py-3 px-4 text-right font-mono text-sm',
                                    line.isMargin && 'text-gray-500',
                                    !line.isMargin && isNegative && 'text-red-600 font-medium',
                                    !line.isMargin && !isNegative && line.isSubtotal && 'text-gray-900 font-semibold',
                                    !line.isMargin && !isNegative && !line.isSubtotal && 'text-gray-700',
                                    line.canDrillDown && !line.isMargin && 'cursor-pointer hover:bg-gray-50'
                                  )}
                                  onClick={() => {
                                    if (line.canDrillDown && line.plCode && !line.isMargin) {
                                      handleDrillDown(line.plCode, month);
                                    }
                                  }}
                                >
                                  {line.isMargin
                                    ? line.marginValues?.[monthIdx] !== undefined
                                      ? formatPercent(line.marginValues[monthIdx])
                                      : '-'
                                    : amount !== 0
                                      ? formatCurrency(amount)
                                      : <span className="text-gray-400">-</span>}
                                </td>
                              );
                            })}
                          </tr>
                          {/* Drill-Down Children */}
                          {hasChildren && isExpanded && line.children?.map((child) => (
                            <tr
                              key={child.key}
                              className="text-sm text-gray-600 hover:bg-gray-50/50 transition-colors"
                            >
                              <td
                                className="py-2 px-6 sticky left-0 bg-white z-10 cursor-pointer"
                                onClick={() => child.canDrillDown && child.plCode && handleDrillDown(child.plCode, 1)}
                                style={{ paddingLeft: `${24 + child.indent * 20 + 24}px` }}
                              >
                                <div className="flex items-center gap-2.5">
                                  {child.plCode && (
                                    <span className="font-mono text-xs text-gray-400 mr-2">{child.plCode}</span>
                                  )}
                                  <span className="text-gray-600">{child.label}</span>
                                </div>
                              </td>
                              {child.monthlyAmounts.map((amount, monthIdx) => {
                                const month = monthIdx + 1;
                                const isNegative = amount < 0;
                                return (
                                  <td
                                    key={month}
                                    className={cn(
                                      'py-2 px-4 text-right font-mono text-sm cursor-pointer hover:bg-gray-50',
                                      isNegative && 'text-red-600',
                                      !isNegative && 'text-gray-700'
                                    )}
                                    onClick={() => child.canDrillDown && child.plCode && handleDrillDown(child.plCode, month)}
                                  >
                                    {amount !== 0 ? formatCurrency(amount) : <span className="text-gray-400">-</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
              P&L Code: {drillDownData?.plCode} | {selectedYear}년 {drillDownData?.month}월
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
