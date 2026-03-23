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
    return data as unknown as FinancialDataWithSubsidiary;
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
      .eq('fiscal_year', latestPeriod.fiscal_year)
      .eq('quarter', latestPeriod.quarter);

    if (error) throw error;
    return (data as unknown as FinancialDataWithSubsidiary[]) || [];
  } catch (error) {
    console.error('Failed to fetch all latest financial data:', error);
    return [];
  }
};

/**
 * 특정 법인의 특정 연도 재무 데이터 조회 (연도별 집계용)
 * @param subsidiaryId - 법인 ID
 * @param fiscalYear - 회계 연도
 * @returns 해당 연도의 모든 분기 재무 데이터 배열
 */
export const getFinancialDataByYear = async (
  subsidiaryId: string,
  fiscalYear: number
): Promise<FinancialData[]> => {
  try {
    const { data, error } = await supabase
      .from('financial_data')
      .select('*')
      .eq('subsidiary_id', subsidiaryId)
      .eq('fiscal_year', fiscalYear)
      .order('quarter', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch financial data by year:', error);
    return [];
  }
};

/**
 * 특정 법인의 사용 가능한 연도 목록 조회
 * @param subsidiaryId - 법인 ID
 * @returns 연도 배열 (내림차순)
 */
export const getAvailableYears = async (subsidiaryId: string): Promise<number[]> => {
  try {
    const { data, error } = await supabase
      .from('financial_data')
      .select('fiscal_year')
      .eq('subsidiary_id', subsidiaryId)
      .order('fiscal_year', { ascending: false });

    if (error) throw error;

    // 중복 제거 및 정렬
    const uniqueYears = Array.from(new Set((data || []).map((d) => d.fiscal_year)));
    return uniqueYears.sort((a, b) => b - a);
  } catch (error) {
    console.error('Failed to fetch available years:', error);
    return [];
  }
};
