/**
 * 재무 데이터 서비스
 * Supabase에서 재무 데이터를 조회하는 함수들
 */

import { supabase } from '@/lib/supabase/client';
import type { FinancialData, FinancialDataWithSubsidiary } from '@/lib/supabase/types';

/**
 * 특정 법인의 최신 재무 데이터 조회
 * @param subsidiaryId - 법인 ID
 * @returns 최신 재무 데이터 (법인 정보 포함)
 */
export const getLatestFinancialData = async (
  subsidiaryId: string
): Promise<FinancialDataWithSubsidiary | null> => {
  try {
    const { data, error } = await supabase
      .from('financial_data')
      .select(`
        *,
        subsidiaries (*)
      `)
      .eq('subsidiary_id', subsidiaryId)
      .order('fiscal_year', { ascending: false })
      .order('quarter', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data as FinancialDataWithSubsidiary;
  } catch (error) {
    console.error('Failed to fetch latest financial data:', error);
    return null;
  }
};

/**
 * 특정 법인의 최근 N분기 재무 데이터 조회 (차트용)
 * @param subsidiaryId - 법인 ID
 * @param quarters - 조회할 분기 수 (기본값: 4)
 * @returns 재무 데이터 배열 (최신순)
 */
export const getFinancialTrend = async (
  subsidiaryId: string,
  quarters: number = 4
): Promise<FinancialData[]> => {
  try {
    const { data, error } = await supabase
      .from('financial_data')
      .select('*')
      .eq('subsidiary_id', subsidiaryId)
      .order('fiscal_year', { ascending: false })
      .order('quarter', { ascending: false })
      .limit(quarters);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch financial trend:', error);
    return [];
  }
};

/**
 * 모든 법인의 최신 재무 데이터 조회
 * @returns 법인별 최신 재무 데이터 배열
 */
export const getAllLatestFinancialData = async (): Promise<FinancialDataWithSubsidiary[]> => {
  try {
    // 최신 분기 정보 조회
    const { data: latestPeriod } = await supabase
      .from('financial_data')
      .select('fiscal_year, quarter')
      .order('fiscal_year', { ascending: false })
      .order('quarter', { ascending: false })
      .limit(1)
      .single();

    if (!latestPeriod) return [];

    // 해당 분기의 모든 법인 데이터 조회
    const { data, error } = await supabase
      .from('financial_data')
      .select(`
        *,
        subsidiaries (*)
      `)
      .eq('fiscal_year', (latestPeriod as any).fiscal_year)
      .eq('quarter', (latestPeriod as any).quarter);

    if (error) throw error;
    return (data as FinancialDataWithSubsidiary[]) || [];
  } catch (error) {
    console.error('Failed to fetch all latest financial data:', error);
    return [];
  }
};

