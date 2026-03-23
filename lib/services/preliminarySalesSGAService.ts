/**
 * Preliminary Sales/SG&A 서비스
 * Supabase DB 작업
 */

import { supabase } from '@/lib/supabase/client';
import type { PreliminarySalesSGA, PreliminarySalesSGAFormData } from '@/lib/types/preliminary-sales-sga';

/**
 * Preliminary Sales/SG&A 데이터 조회
 */
export async function getPreliminarySalesSGA(
  quarterId?: string | null,
  subsidiaryId?: string | null
): Promise<PreliminarySalesSGA[]> {
  try {
    let query = supabase
      .from('preliminary_sales_sga')
      .select('*')
      .order('period', { ascending: true });

    // quarterId가 있고 임시 ID가 아닌 경우에만 필터링
    if (quarterId && !quarterId.startsWith('temp-') && !quarterId.startsWith('custom-')) {
      query = query.eq('quarter_id', quarterId);
    }
    if (subsidiaryId) {
      query = query.eq('subsidiary_id', subsidiaryId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('preliminary_sales_sga 테이블이 존재하지 않습니다.');
        return [];
      }
      throw new Error(`데이터 조회 실패: ${error.message}`);
    }

    return (data || []).map((item) => ({
      id: item.id,
      quarter_id: item.quarter_id,
      subsidiary_id: item.subsidiary_id,
      period: item.period,
      sales: item.sales ? parseFloat(item.sales) : null,
      sga: item.sga ? parseFloat(item.sga) : null,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  } catch (error) {
    console.error('Error getting preliminary sales sga:', error);
    throw error;
  }
}

/**
 * Preliminary Sales/SG&A 데이터 저장 (전체 교체)
 */
export async function savePreliminarySalesSGA(
  formData: PreliminarySalesSGAFormData
): Promise<PreliminarySalesSGA[]> {
  try {
    const { quarter_id, subsidiary_id, data } = formData;

    // quarter_id가 임시 ID인 경우 NULL로 변환
    const finalQuarterId = quarter_id && !quarter_id.startsWith('temp-') && !quarter_id.startsWith('custom-')
      ? quarter_id
      : null;

    // 기존 데이터 삭제 (해당 quarter_id와 subsidiary_id의 모든 period)
    if (finalQuarterId && subsidiary_id) {
      const { error: deleteError } = await supabase
        .from('preliminary_sales_sga')
        .delete()
        .eq('quarter_id', finalQuarterId)
        .eq('subsidiary_id', subsidiary_id);

      if (deleteError && deleteError.code !== '42P01') {
        console.warn('기존 데이터 삭제 중 오류 (무시):', deleteError);
      }
    }

    // 새 데이터 삽입
    const insertData = data.map((item) => {
      // 숫자 형식 검증 및 변환
      const sales = item.sales !== null && item.sales !== undefined 
        ? (typeof item.sales === 'number' ? item.sales : parseFloat(String(item.sales)))
        : null;
      const sga = item.sga !== null && item.sga !== undefined
        ? (typeof item.sga === 'number' ? item.sga : parseFloat(String(item.sga)))
        : null;

      return {
        quarter_id: finalQuarterId,
        subsidiary_id: subsidiary_id || null,
        period: item.period,
        sales: sales !== null && !isNaN(sales) ? sales : null,
        sga: sga !== null && !isNaN(sga) ? sga : null,
      };
    });

    const { data: insertedData, error: insertError } = await supabase
      .from('preliminary_sales_sga')
      .insert(insertData)
      .select();

    if (insertError) {
      // 모든 에러 속성 출력
      console.error('Insert Error Details:', JSON.stringify(insertError, null, 2));
      console.error('Insert Error Object:', insertError);
      console.error('Insert Error Keys:', Object.keys(insertError));
      console.error('Insert Error Message:', insertError.message);
      console.error('Insert Error Code:', insertError.code);
      console.error('Insert Error Details:', insertError.details);
      console.error('Insert Error Hint:', insertError.hint);
      console.error('Insert Data:', insertData);

      // 테이블이 없는 경우
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist') || insertError.message?.includes('relation')) {
        throw new Error(
          `'preliminary_sales_sga' 테이블이 존재하지 않습니다. Supabase SQL Editor에서 docs/preliminary-sales-sga-schema.sql을 실행하여 테이블을 생성하세요.`
        );
      }

      // RLS 정책 위반
      if (insertError.code === '42501' || insertError.message?.includes('permission denied') || insertError.message?.includes('policy')) {
        throw new Error(
          `데이터베이스 권한이 없습니다. 'preliminary_sales_sga' 테이블의 RLS 정책을 확인하세요. docs/preliminary-sales-sga-schema.sql의 RLS 정책 부분을 실행했는지 확인하세요.`
        );
      }

      // 더 자세한 에러 메시지 제공
      const errorMessage = insertError.message || '알 수 없는 오류';
      const errorCode = insertError.code ? ` (코드: ${insertError.code})` : '';
      const errorHint = insertError.hint ? `\n힌트: ${insertError.hint}` : '';
      const errorDetails = insertError.details ? `\n상세: ${insertError.details}` : '';

      throw new Error(`데이터 저장 실패: ${errorMessage}${errorCode}${errorHint}${errorDetails}`);
    }

    return (insertedData || []).map((item) => ({
      id: item.id,
      quarter_id: item.quarter_id,
      subsidiary_id: item.subsidiary_id,
      period: item.period,
      sales: item.sales ? parseFloat(item.sales) : null,
      sga: item.sga ? parseFloat(item.sga) : null,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  } catch (error) {
    console.error('Error saving preliminary sales sga:', error);
    throw error;
  }
}

/**
 * Preliminary Sales/SG&A 데이터 삭제
 */
export async function deletePreliminarySalesSGA(
  quarterId: string,
  subsidiaryId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('preliminary_sales_sga')
      .delete()
      .eq('quarter_id', quarterId)
      .eq('subsidiary_id', subsidiaryId);

    if (error) {
      throw new Error(`데이터 삭제 실패: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting preliminary sales sga:', error);
    throw error;
  }
}
