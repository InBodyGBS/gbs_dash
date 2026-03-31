'use client';

/**
 * Monthly Closing - Result 페이지
 * P&L 손익계산서 조회 (PRD v1.1 기반 - P&L Code 구조)
 * Single Entity View + Drill-Down
 */

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
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
import { getPLResults, getStdPLMaster } from '@/lib/services/monthlyClosingService';
import type { PLResult, StdPLMaster } from '@/lib/types/monthly-closing';
import type { Subsidiary } from '@/lib/supabase/types';

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

// P&L 표시 라인 (단일 월 데이터)
interface PLDisplayLineSingle {
  key: string;
  plCode?: string;
  label: string;
  amount: number;
  indent: number;
  isSubtotal: boolean;
  isMargin: boolean;
  marginValue?: number;
  children?: PLDisplayLineSingle[];
  canDrillDown?: boolean;
}

// P&L 표시 라인 (12개월 월별 데이터)
interface PLDisplayLineYearly {
  key: string;
  plCode?: string;
  label: string;
  monthlyAmounts: number[]; // 12개월 월별값 데이터 [1월, 2월, ..., 12월]
  ytdAmount: number; // 전체 YTD (12월 누적값)
  qtdAmounts: number[]; // 분기별 QTD [1Q, 2Q, 3Q, 4Q]
  indent: number;
  isSubtotal: boolean;
  isMargin: boolean;
  marginValues?: number[]; // 12개월 마진 데이터
  children?: PLDisplayLineYearly[];
  canDrillDown?: boolean;
}

type ErrorWithMessage = {
  message?: string;
};

type DrillDownAccount = {
  id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
};

type CoaMappingRow = {
  local_account_code: string;
};

type TBUploadIdRow = {
  id: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  const maybeError = error as ErrorWithMessage;
  if (typeof maybeError?.message === 'string' && maybeError.message.length > 0) {
    return maybeError.message;
  }
  return '알 수 없는 오류';
};

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
  const [selectedMonth, setSelectedMonth] = useState<string>(savedState?.month || String(new Date().getMonth() + 1));
  const [activeTab, setActiveTab] = useState<'cumulative' | 'monthly' | 'yearly'>(savedState?.tab || 'cumulative');

  // 데이터 상태
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [plMaster, setPLMaster] = useState<StdPLMaster[]>([]);
  const [cumulativeResults, setCumulativeResults] = useState<PLResult[]>([]); // 누적값 데이터
  const [monthlyResults, setMonthlyResults] = useState<PLResult[]>([]); // 월별값 데이터 (누적 - 직전월 누적)
  const [yearlyMonthlyData, setYearlyMonthlyData] = useState<Map<number, PLResult[]>>(new Map()); // 12개월 월별 데이터
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [drillDownData, setDrillDownData] = useState<{ plCode: string; accounts: DrillDownAccount[]; month: number } | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  // 상태 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        entityCode: selectedEntityCode,
        year: selectedYear,
        month: selectedMonth,
        tab: activeTab,
      }));
    } catch {}
  }, [selectedEntityCode, selectedYear, selectedMonth, activeTab]);

  const loadSubsidiaries = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('subsidiaries').select('*').order('name');
      setSubsidiaries(data || []);
    } catch {
      toast.error('법인 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPLMaster = useCallback(async () => {
    try {
      const data = await getStdPLMaster();
      setPLMaster(data);
    } catch (error: unknown) {
      console.error('Failed to load PL Master:', getErrorMessage(error));
    }
  }, []);

  // 탭 1, 2: 단일 월 데이터 로드 (누적값 및 월별값)
  const loadSingleMonthPL = useCallback(async () => {
    if (!selectedEntityCode || !selectedYear || !selectedMonth) return;
    
    setDataLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      
      // 누적값 로드
      const cumulative = await getPLResults(selectedEntityCode, year, month);
      setCumulativeResults(cumulative);
      
      // 월별값 계산 (현재 누적 - 직전월 누적)
      if (month === 1) {
        // 1월은 누적값 = 월별값
        setMonthlyResults(cumulative);
      } else {
        const prevMonth = month - 1;
        const prevResults = await getPLResults(selectedEntityCode, year, prevMonth);
        
        // 현재 월 누적값 Map
        const currMap = new Map<string, number>();
        cumulative.forEach((r) => {
          currMap.set(r.std_pl_code, (currMap.get(r.std_pl_code) || 0) + r.amount);
        });
        
        // 직전월 누적값 Map
        const prevMap = new Map<string, number>();
        prevResults.forEach((r) => {
          prevMap.set(r.std_pl_code, (prevMap.get(r.std_pl_code) || 0) + r.amount);
        });
        
        // 차이 계산
        const allCodes = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
        const monthly: PLResult[] = Array.from(allCodes).map((code) => ({
          id: `${code}-${month}`,
          upload_id: '',
          entity_code: selectedEntityCode,
          subsidiary_id: null,
          period_year: year,
          period_month: month,
          std_pl_code: code,
          amount: (currMap.get(code) || 0) - (prevMap.get(code) || 0),
          currency: cumulative[0]?.currency || 'KRW',
          created_at: new Date().toISOString(),
          std_pl_master: undefined,
        }));
        
        setMonthlyResults(monthly);
      }
    } catch (error: unknown) {
      console.error('Failed to load single month P&L:', getErrorMessage(error));
      toast.error('P&L 데이터 로드 실패');
    } finally {
      setDataLoading(false);
    }
  }, [selectedEntityCode, selectedYear, selectedMonth]);

  // 탭 3: 12개월 월별 데이터 로드 (각 월 = 해당 월 누적 - 직전월 누적)
  const loadYearlyMonthlyPL = useCallback(async () => {
    if (!selectedEntityCode || !selectedYear) return;
    
    setDataLoading(true);
    try {
      const year = parseInt(selectedYear);
      const newMonthlyData = new Map<number, PLResult[]>();

      // 12개월 데이터를 병렬로 로드
      const loadPromises = Array.from({ length: 12 }, async (_, i) => {
        const month = i + 1;
        const currentResults = await getPLResults(selectedEntityCode, year, month);
        
        // 3월 데이터가 없으면 빈 배열 반환
        if (month === 3 && (!currentResults || currentResults.length === 0)) {
          return { month, results: [] };
        }
        
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
          
          // 3월인 경우, 모든 값이 0이면 빈 배열 반환
          if (month === 3) {
            const hasNonZeroValue = monthlyResults.some((r) => r.amount !== 0);
            if (!hasNonZeroValue) {
              return { month, results: [] };
            }
          }
          
          return { month, results: monthlyResults };
        }
      });

      const results = await Promise.all(loadPromises);
      results.forEach(({ month, results }) => {
        newMonthlyData.set(month, results);
      });

      setYearlyMonthlyData(newMonthlyData);
    } catch (error: unknown) {
      console.error('Failed to load yearly monthly P&L:', getErrorMessage(error));
      toast.error('월별 P&L 데이터 로드 실패');
    } finally {
      setDataLoading(false);
    }
  }, [selectedEntityCode, selectedYear]);

  useEffect(() => {
    void loadSubsidiaries();
    void loadPLMaster();
  }, [loadSubsidiaries, loadPLMaster]);

  useEffect(() => {
    if ((activeTab === 'cumulative' || activeTab === 'monthly') && selectedEntityCode && selectedYear && selectedMonth) {
      void loadSingleMonthPL();
    }
  }, [activeTab, selectedEntityCode, selectedYear, selectedMonth, loadSingleMonthPL]);

  useEffect(() => {
    if (activeTab === 'yearly' && selectedEntityCode && selectedYear) {
      void loadYearlyMonthlyPL();
    }
  }, [activeTab, selectedEntityCode, selectedYear, loadYearlyMonthlyPL]);

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

      if (!upload || !('id' in upload)) return;

      // 매핑 조회
      const { data: mappings } = await supabase
        .from('coa_mapping')
        .select('local_account_code')
        .eq('entity_code', selectedEntityCode)
        .eq('std_code', plCode)
        .eq('is_active', true);

      if (!mappings || mappings.length === 0) return;

      const accountCodes = (mappings as CoaMappingRow[]).map((m) => m.local_account_code);

      // 원장 데이터 조회
      const uploadId = (upload as TBUploadIdRow).id;
      if (!uploadId) return;
      
      const { data: rawData } = await supabase
        .from('tb_raw_data')
        .select('*')
        .eq('upload_id', uploadId)
        .in('account_code', accountCodes);

      setDrillDownData({
        plCode,
        accounts: ((rawData || []) as DrillDownAccount[]),
        month,
      });
      setDrillDownOpen(true);
    } catch (error: unknown) {
      console.error('Failed to load drill-down:', getErrorMessage(error));
      toast.error('Drill-down 데이터 로드 실패');
    }
  };

  // P&L 표시 라인 생성 (단일 월 - 누적값 또는 월별값)
  const createSingleMonthDisplayLines = useCallback((results: PLResult[]): PLDisplayLineSingle[] => {
    if (results.length === 0 || !plMaster.length) return [];

    // P&L Code별 금액 Map
    const amountByCode = new Map<string, number>();
    results.forEach((r) => {
      amountByCode.set(r.std_pl_code, (amountByCode.get(r.std_pl_code) || 0) + r.amount);
    });

    // Summary 계산
    const salesCodes = ['41000', '42000', '43000', '44000', '45000', '46000'];
    const sales = salesCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);
    
    const cogsCodes = ['51000', '52000', '53000', '54000'];
    const cogs = cogsCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);
    
    const grossProfit = sales - cogs;
    const gpMargin = sales !== 0 ? (grossProfit / sales) * 100 : 0;

    const sgaCodes = plMaster.filter((m) => m.pl_code.startsWith('600')).map((m) => m.pl_code);
    const sga = sgaCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);
    
    const operatingIncome = grossProfit - sga;
    const operatingMargin = sales !== 0 ? (operatingIncome / sales) * 100 : 0;

    const otherRevenueCodes = plMaster.filter((m) => m.pl_code.startsWith('710')).map((m) => m.pl_code);
    const otherRevenue = otherRevenueCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);
    
    const otherExpenseCodes = plMaster.filter((m) => m.pl_code.startsWith('720')).map((m) => m.pl_code);
    const otherExpense = otherExpenseCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);
    
    const financialRevenueCodes = plMaster.filter((m) => m.pl_code.startsWith('730')).map((m) => m.pl_code);
    const financialRevenue = financialRevenueCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);
    
    const financialExpenseCodes = plMaster.filter((m) => m.pl_code.startsWith('740')).map((m) => m.pl_code);
    const financialExpense = financialExpenseCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);
    
    const incomeBeforeTax = operatingIncome + otherRevenue - otherExpense + financialRevenue - financialExpense;
    
    const corporateTax = amountByCode.get('80001') || 0;
    
    const netIncome = incomeBeforeTax - corporateTax;
    const netMargin = sales !== 0 ? (netIncome / sales) * 100 : 0;

    return [
      {
        key: 'sales',
        label: 'Sales',
        amount: sales,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: salesCodes.map((code) => ({
          key: code,
          plCode: code,
          label: plMaster.find((m) => m.pl_code === code)?.pl_line || code,
          amount: amountByCode.get(code) || 0,
          indent: 1,
          isSubtotal: false,
          isMargin: false,
          canDrillDown: true,
        })),
      },
      {
        key: 'cogs',
        label: 'Cost of Goods Sold',
        amount: cogs,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: cogsCodes.map((code) => ({
          key: code,
          plCode: code,
          label: plMaster.find((m) => m.pl_code === code)?.pl_line || code,
          amount: amountByCode.get(code) || 0,
          indent: 1,
          isSubtotal: false,
          isMargin: false,
          canDrillDown: true,
        })),
      },
      {
        key: 'gross_profit',
        label: 'Gross Profit',
        amount: grossProfit,
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
        marginValue: gpMargin,
      },
      {
        key: 'sga',
        label: 'Selling and Administration Expense',
        amount: sga,
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
      {
        key: 'operating_income',
        label: 'Operating Income',
        amount: operatingIncome,
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
        marginValue: operatingMargin,
      },
      {
        key: 'other_revenue',
        label: 'Other Revenue',
        amount: otherRevenue,
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
      {
        key: 'other_expense',
        label: 'Other Expense',
        amount: otherExpense,
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
      {
        key: 'financial_revenue',
        label: 'Financial Revenue',
        amount: financialRevenue,
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
      {
        key: 'financial_expense',
        label: 'Financial Expense',
        amount: financialExpense,
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
      {
        key: 'income_before_tax',
        label: 'Income before Tax',
        amount: incomeBeforeTax,
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'corporate_tax',
        plCode: '80001',
        label: 'Corporate Income Tax',
        amount: corporateTax,
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
      },
      {
        key: 'net_income',
        label: 'Net Income',
        amount: netIncome,
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
        marginValue: netMargin,
      },
    ];
  }, [plMaster]);

  // 탭 1: 누적값 표시 라인
  const cumulativeDisplayLines = useMemo(() => {
    return createSingleMonthDisplayLines(cumulativeResults);
  }, [cumulativeResults, createSingleMonthDisplayLines]);

  // 탭 2: 월별값 표시 라인
  const monthlyDisplayLines = useMemo(() => {
    return createSingleMonthDisplayLines(monthlyResults);
  }, [monthlyResults, createSingleMonthDisplayLines]);

  // 탭 3: 12개월 월별 데이터 표시 라인
  const yearlyDisplayLines: PLDisplayLineYearly[] = useMemo(() => {
    if (yearlyMonthlyData.size === 0 || !plMaster.length) return [];

    // 각 월별로 P&L Code별 금액 Map 생성
    const amountByCodeByMonth = new Map<number, Map<string, number>>();
    for (let month = 1; month <= 12; month++) {
      const monthData = yearlyMonthlyData.get(month) || [];
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

    // YTD 누적값 계산 헬퍼 (12월 누적값 하나만 반환)
    // 값이 없는 월은 0으로 처리
    const calculateYTD = (monthlyAmounts: number[]): number => {
      return monthlyAmounts.reduce((sum, amount) => sum + (amount ?? 0), 0);
    };

    // QTD 분기별 누적값 계산 헬퍼 (1Q, 2Q, 3Q, 4Q)
    // 값이 없는 월은 0으로 처리
    const calculateQTD = (monthlyAmounts: number[]): number[] => {
      const safeAmount = (val: number | undefined) => (val ?? 0);
      return [
        // 1Q: 1월+2월+3월 (3월 값이 없어도 정상)
        safeAmount(monthlyAmounts[0]) + safeAmount(monthlyAmounts[1]) + safeAmount(monthlyAmounts[2]),
        // 2Q: 4월+5월+6월
        safeAmount(monthlyAmounts[3]) + safeAmount(monthlyAmounts[4]) + safeAmount(monthlyAmounts[5]),
        // 3Q: 7월+8월+9월
        safeAmount(monthlyAmounts[6]) + safeAmount(monthlyAmounts[7]) + safeAmount(monthlyAmounts[8]),
        // 4Q: 10월+11월+12월
        safeAmount(monthlyAmounts[9]) + safeAmount(monthlyAmounts[10]) + safeAmount(monthlyAmounts[11]),
      ];
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
        ytdAmount: calculateYTD(salesAmounts),
        qtdAmounts: calculateQTD(salesAmounts),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('41000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('41000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('42000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('42000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('43000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('43000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('44000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('44000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('45000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('45000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('46000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('46000')),
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
        ytdAmount: calculateYTD(cogsAmounts),
        qtdAmounts: calculateQTD(cogsAmounts),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('51000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('51000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('52000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('52000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('53000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('53000')),
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
            ytdAmount: calculateYTD(getMonthlyAmounts('54000')),
            qtdAmounts: calculateQTD(getMonthlyAmounts('54000')),
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
        ytdAmount: calculateYTD(grossProfitAmounts),
        qtdAmounts: calculateQTD(grossProfitAmounts),
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'gp_margin',
        label: 'GP Margin',
        monthlyAmounts: Array(12).fill(0),
        ytdAmount: 0,
        qtdAmounts: [0, 0, 0, 0],
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
        ytdAmount: calculateYTD(sgaAmounts),
        qtdAmounts: calculateQTD(sgaAmounts),
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('600'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => {
            const amounts = getMonthlyAmounts(m.pl_code);
            return {
            key: m.pl_code,
            plCode: m.pl_code,
            label: m.pl_line,
              monthlyAmounts: amounts,
              ytdAmount: calculateYTD(amounts),
              qtdAmounts: calculateQTD(amounts),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
            };
          }),
      },
      // Operating Income (계산값)
      {
        key: 'operating_income',
        label: 'Operating Income',
        monthlyAmounts: operatingIncomeAmounts,
        ytdAmount: calculateYTD(operatingIncomeAmounts),
        qtdAmounts: calculateQTD(operatingIncomeAmounts),
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'operating_margin',
        label: 'Operating Margin',
        monthlyAmounts: Array(12).fill(0),
        ytdAmount: 0,
        qtdAmounts: [0, 0, 0, 0],
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
        ytdAmount: calculateYTD(otherRevenueAmounts),
        qtdAmounts: calculateQTD(otherRevenueAmounts),
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('710'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => {
            const amounts = getMonthlyAmounts(m.pl_code);
            return {
              key: m.pl_code,
              plCode: m.pl_code,
              label: m.pl_line,
              monthlyAmounts: amounts,
              ytdAmount: calculateYTD(amounts),
              qtdAmounts: calculateQTD(amounts),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
            };
          }),
      },
      // Other Expense
      {
        key: 'other_expense',
        label: 'Other Expense',
        monthlyAmounts: otherExpenseAmounts,
        ytdAmount: calculateYTD(otherExpenseAmounts),
        qtdAmounts: calculateQTD(otherExpenseAmounts),
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('720'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => {
            const amounts = getMonthlyAmounts(m.pl_code);
            return {
              key: m.pl_code,
              plCode: m.pl_code,
              label: m.pl_line,
              monthlyAmounts: amounts,
              ytdAmount: calculateYTD(amounts),
              qtdAmounts: calculateQTD(amounts),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
            };
          }),
      },
      // Financial Revenue
      {
        key: 'financial_revenue',
        label: 'Financial Revenue',
        monthlyAmounts: financialRevenueAmounts,
        ytdAmount: calculateYTD(financialRevenueAmounts),
        qtdAmounts: calculateQTD(financialRevenueAmounts),
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('730'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => {
            const amounts = getMonthlyAmounts(m.pl_code);
            return {
              key: m.pl_code,
              plCode: m.pl_code,
              label: m.pl_line,
              monthlyAmounts: amounts,
              ytdAmount: calculateYTD(amounts),
              qtdAmounts: calculateQTD(amounts),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
            };
          }),
      },
      // Financial Expense
      {
        key: 'financial_expense',
        label: 'Financial Expense',
        monthlyAmounts: financialExpenseAmounts,
        ytdAmount: calculateYTD(financialExpenseAmounts),
        qtdAmounts: calculateQTD(financialExpenseAmounts),
        indent: 0,
        isSubtotal: false,
        isMargin: false,
        canDrillDown: true,
        children: plMaster
          .filter((m) => m.pl_code.startsWith('740'))
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => {
            const amounts = getMonthlyAmounts(m.pl_code);
            return {
              key: m.pl_code,
              plCode: m.pl_code,
              label: m.pl_line,
              monthlyAmounts: amounts,
              ytdAmount: calculateYTD(amounts),
              qtdAmounts: calculateQTD(amounts),
            indent: 1,
            isSubtotal: false,
            isMargin: false,
            canDrillDown: true,
            };
          }),
      },
      // Income before Tax (계산값)
      {
        key: 'income_before_tax',
        label: 'Income before Tax',
        monthlyAmounts: incomeBeforeTaxAmounts,
        ytdAmount: calculateYTD(incomeBeforeTaxAmounts),
        qtdAmounts: calculateQTD(incomeBeforeTaxAmounts),
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
        ytdAmount: calculateYTD(corporateTaxAmounts),
        qtdAmounts: calculateQTD(corporateTaxAmounts),
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
        ytdAmount: calculateYTD(netIncomeAmounts),
        qtdAmounts: calculateQTD(netIncomeAmounts),
        indent: 0,
        isSubtotal: true,
        isMargin: false,
      },
      {
        key: 'net_margin',
        label: 'Net Margin',
        monthlyAmounts: Array(12).fill(0),
        ytdAmount: 0,
        qtdAmounts: [0, 0, 0, 0],
        indent: 1,
        isSubtotal: false,
        isMargin: true,
        marginValues: netMarginValues,
      },
    ];
  }, [yearlyMonthlyData, plMaster]);

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
  const handleExport = async () => {
    if (!selectedEntityCode || !selectedYear) return;

    const XLSX = await import('xlsx');
    
    if (activeTab === 'yearly') {
      if (yearlyDisplayLines.length === 0) return;
      const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      const headers = ['P&L Code', 'P&L Line', ...monthNames];
      
      const wsData = yearlyDisplayLines
        .filter((l) => !l.isMargin)
        .map((line) => {
          const row: Record<string, string | number> = {
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
      XLSX.utils.book_append_sheet(wb, ws, 'P&L Yearly');
      XLSX.writeFile(wb, `PL_${selectedEntityCode}_${selectedYear}_Yearly.xlsx`);
    } else {
      const displayLines = activeTab === 'cumulative' ? cumulativeDisplayLines : monthlyDisplayLines;
      if (displayLines.length === 0) return;
      
      const headers = ['P&L Code', 'P&L Line', 'Amount'];
      const wsData = displayLines
        .filter((l) => !l.isMargin)
        .map((line) => ({
          'P&L Code': line.plCode || '',
          'P&L Line': line.label,
          'Amount': (line as PLDisplayLineSingle).amount,
        }));
      
      const ws = XLSX.utils.json_to_sheet(wsData, { header: headers });
      const wb = XLSX.utils.book_new();
      const tabName = activeTab === 'cumulative' ? 'Cumulative' : 'Monthly';
      XLSX.utils.book_append_sheet(wb, ws, `P&L ${tabName}`);
      XLSX.writeFile(wb, `PL_${selectedEntityCode}_${selectedYear}_${selectedMonth}_${tabName}.xlsx`);
    }
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

      {/* Tabs */}
      <div className="flex-shrink-0 mb-4 border-b border-gray-200">
        <nav className="flex gap-2">
          {[
            { value: 'cumulative', label: '일반 월별 손익계산서 (누적값)' },
            { value: 'monthly', label: '일반 월별 손익계산서 (월별값)' },
            { value: 'yearly', label: '월별 손익계산서 (1월~12월)' },
          ].map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value as 'cumulative' | 'monthly' | 'yearly')}
                className={cn(
                  'px-4 py-2 border-b-2 transition-colors text-sm font-medium',
                  isActive
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
          </div>

      {/* Filters */}
      <div className="flex-shrink-0 mb-6 bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* 월 선택 (탭 1, 2만 표시) */}
          {(activeTab === 'cumulative' || activeTab === 'monthly') && (
          <div>
            <Label>월</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
        </div>
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
        ) : (activeTab === 'cumulative' && cumulativeDisplayLines.length === 0) ||
            (activeTab === 'monthly' && monthlyDisplayLines.length === 0) ||
            (activeTab === 'yearly' && yearlyDisplayLines.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p className="mb-2">해당 기간의 P&L 데이터가 없습니다.</p>
                <p className="text-sm">Upload 탭에서 TB 파일을 먼저 업로드해주세요.</p>
              </CardContent>
            </Card>
        ) : activeTab === 'yearly' ? (
          /* 탭 3: 12개월 전체 */
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      {subsidiaries.find((s) => s.code === selectedEntityCode)?.name || selectedEntityCode}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: '2000px' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[300px]">
                        P&L Line
                      </th>
                      {activeTab === 'yearly' ? (
                        <>
                          {Array.from({ length: 12 }, (_, i) => {
                            const month = i + 1;
                            const isQuarterEnd = month === 3 || month === 6 || month === 9 || month === 12;
                            const quarterLabel = month === 3 ? '1Q' : month === 6 ? '2Q' : month === 9 ? '3Q' : month === 12 ? '4Q' : null;
                            return (
                              <Fragment key={month}>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                                  {month}월
                                </th>
                                {isQuarterEnd && quarterLabel && (
                                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px] bg-gray-50/50 border-l border-gray-300">
                                    {quarterLabel}
                                  </th>
                                )}
                              </Fragment>
                            );
                          })}
                          <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px] bg-gray-100 border-l-2 border-gray-300">
                            YTD
                          </th>
                        </>
                      ) : (
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]">
                          Amount
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearlyDisplayLines.map((line) => {
                    const hasChildren = line.children && line.children.length > 0;
                    const isExpanded = expandedLines.has(line.key);

                    return (
                        <Fragment key={line.key}>
                          <tr className={cn(
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
                            {/* 12개월 컬럼 + QTD (각 분기 말 옆에 배치) */}
                            {line.monthlyAmounts.map((amount, monthIdx) => {
                              const month = monthIdx + 1;
                              const isNegative = amount < 0;
                              const isQuarterEnd = month === 3 || month === 6 || month === 9 || month === 12;
                              const qtdIndex = month === 3 ? 0 : month === 6 ? 1 : month === 9 ? 2 : month === 12 ? 3 : -1;
                              const qtdAmount = qtdIndex >= 0 ? (line.qtdAmounts || [0, 0, 0, 0])[qtdIndex] : 0;
                              const isQtdNegative = qtdAmount < 0;
                              
                              return (
                                <Fragment key={month}>
                                  {/* 월별 컬럼 */}
                                  <td
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
                                  {/* QTD 컬럼 (3월, 6월, 9월, 12월 옆에만 표시) */}
                                  {isQuarterEnd && (
                                    <td
                                      className={cn(
                                        'py-3 px-4 text-right font-mono text-sm bg-gray-50/50 border-l border-gray-300',
                                        line.isMargin && 'text-gray-500',
                                        !line.isMargin && isQtdNegative && 'text-red-600 font-medium',
                                        !line.isMargin && !isQtdNegative && line.isSubtotal && 'text-gray-900 font-semibold',
                                        !line.isMargin && !isQtdNegative && !line.isSubtotal && 'text-gray-700'
                                      )}
                                    >
                                      {line.isMargin
                                        ? '-'
                                        : qtdAmount !== 0
                                          ? formatCurrency(qtdAmount)
                                          : <span className="text-gray-400">-</span>}
                                    </td>
                                  )}
                                </Fragment>
                              );
                            })}
                            {/* YTD 컬럼 */}
                            <td
                              className={cn(
                                'py-3 px-4 text-right font-mono text-sm bg-gray-100',
                                line.isMargin && 'text-gray-500',
                                !line.isMargin && (line.ytdAmount || 0) < 0 && 'text-red-600 font-medium',
                                !line.isMargin && (line.ytdAmount || 0) >= 0 && line.isSubtotal && 'text-gray-900 font-semibold',
                                !line.isMargin && (line.ytdAmount || 0) >= 0 && !line.isSubtotal && 'text-gray-700'
                              )}
                            >
                              {line.isMargin
                                ? '-'
                                : (line.ytdAmount || 0) !== 0
                                  ? formatCurrency(line.ytdAmount || 0)
                                  : <span className="text-gray-400">-</span>}
                            </td>
                          </tr>
                        {/* Drill-Down Children */}
                        {hasChildren && isExpanded && line.children?.map((child) => (
                            <tr
                            key={child.key}
                              className="text-sm text-gray-600 hover:bg-gray-50/50 transition-colors"
                            >
                              <td
                                className="py-2 px-6 sticky left-0 bg-white z-10 cursor-pointer"
                                onClick={() => {
                                  if (child.canDrillDown && child.plCode) {
                                    handleDrillDown(child.plCode, 1);
                                  }
                                }}
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
                                const isQuarterEnd = month === 3 || month === 6 || month === 9 || month === 12;
                                const qtdIndex = month === 3 ? 0 : month === 6 ? 1 : month === 9 ? 2 : month === 12 ? 3 : -1;
                                const qtdAmount = qtdIndex >= 0 ? (child.qtdAmounts || [0, 0, 0, 0])[qtdIndex] : 0;
                                const isQtdNegative = qtdAmount < 0;
                                
                                return (
                                  <Fragment key={month}>
                                    {/* 월별 컬럼 */}
                                    <td
                                      className={cn(
                                        'py-2 px-4 text-right font-mono text-sm cursor-pointer hover:bg-gray-50',
                                        isNegative && 'text-red-600',
                                        !isNegative && 'text-gray-700'
                                      )}
                                      onClick={() => child.canDrillDown && child.plCode && handleDrillDown(child.plCode, month)}
                                    >
                                      {amount !== 0 ? formatCurrency(amount) : <span className="text-gray-400">-</span>}
                                    </td>
                                    {/* QTD 컬럼 (3월, 6월, 9월, 12월 옆에만 표시) */}
                                    {isQuarterEnd && (
                                      <td
                                        className={cn(
                                          'py-2 px-4 text-right font-mono text-sm bg-gray-50/50 border-l border-gray-300',
                                          isQtdNegative && 'text-red-600',
                                          !isQtdNegative && 'text-gray-700'
                                        )}
                                      >
                                        {qtdAmount !== 0 ? formatCurrency(qtdAmount) : <span className="text-gray-400">-</span>}
                                      </td>
                                    )}
                                  </Fragment>
                                );
                              })}
                              {/* YTD 컬럼 */}
                              <td
                                className={cn(
                                  'py-2 px-4 text-right font-mono text-sm bg-gray-100',
                                  (child.ytdAmount || 0) < 0 && 'text-red-600',
                                  (child.ytdAmount || 0) >= 0 && 'text-gray-700'
                                )}
                              >
                                {(child.ytdAmount || 0) !== 0 ? formatCurrency(child.ytdAmount || 0) : <span className="text-gray-400">-</span>}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                    );
                  })}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>
        ) : (
          /* 탭 1, 2: 단일 월 표시 */
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {subsidiaries.find((s) => s.code === selectedEntityCode)?.name || selectedEntityCode}
                  </CardTitle>
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
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]">
                        Amount
                      </th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(activeTab === 'cumulative' ? cumulativeDisplayLines : monthlyDisplayLines).map((line) => {
                      const hasChildren = line.children && line.children.length > 0;
                      const isExpanded = expandedLines.has(line.key);

                        return (
                        <Fragment key={line.key}>
                          <tr className={cn(
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
                            {(() => {
                              const singleLine = line as PLDisplayLineSingle;
                              const amount = singleLine.amount;
                              const isNegative = amount < 0;
                              const month = parseInt(selectedMonth);
                              return (
                                <td
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
                                    ? singleLine.marginValue !== undefined
                                      ? formatPercent(singleLine.marginValue)
                                      : '-'
                                    : amount !== 0
                                      ? formatCurrency(amount)
                                      : <span className="text-gray-400">-</span>}
                            </td>
                              );
                            })()}
                          </tr>
                          {/* Drill-Down Children */}
                          {hasChildren && isExpanded && line.children?.map((child) => (
                            <tr
                              key={child.key}
                              className="text-sm text-gray-600 hover:bg-gray-50/50 transition-colors"
                            >
                              <td
                                className="py-2 px-6 sticky left-0 bg-white z-10 cursor-pointer"
                                onClick={() => {
                                  const month = parseInt(selectedMonth);
                                  if (child.canDrillDown && child.plCode) {
                                    handleDrillDown(child.plCode, month);
                                  }
                                }}
                                style={{ paddingLeft: `${24 + child.indent * 20 + 24}px` }}
                              >
                                <div className="flex items-center gap-2.5">
                                  {child.plCode && (
                                    <span className="font-mono text-xs text-gray-400 mr-2">{child.plCode}</span>
                                  )}
                                  <span className="text-gray-600">{child.label}</span>
                                </div>
                              </td>
                              {(() => {
                                const singleChild = child as PLDisplayLineSingle;
                                const amount = singleChild.amount;
                                const isNegative = amount < 0;
                                const month = parseInt(selectedMonth);
                                return (
                                  <td
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
                              })()}
                            </tr>
                          ))}
                        </Fragment>
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
                  {drillDownData.accounts.map((acc) => (
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
