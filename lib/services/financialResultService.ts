/**
 * Financial Result 서비스
 * Supabase Storage 및 DB 작업
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import type { FinancialResultFile, FinancialResultData, QuarterComparison } from '@/lib/types/financial-result';
import { findSubsidiaryIdByEntity, normalizeEntityName, getEntityToSubsidiaryMapping } from '@/lib/utils/entityMapping';

const BUCKET_NAME = 'financial-result';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Period 문자열 파싱 (예: "20254Q" -> { year: 2025, quarter: 4 })
 */
function parsePeriod(periodStr: string): { year: number; quarter: number } | null {
  if (!periodStr || periodStr.length < 5) return null;
  try {
    const year = parseInt(periodStr.substring(0, 4));
    const quarter = parseInt(periodStr.substring(4, 5));
    if (isNaN(year) || isNaN(quarter) || quarter < 1 || quarter > 4) return null;
    return { year, quarter };
  } catch {
    return null;
  }
}

/**
 * 이전 분기 계산 (예: "20254Q" -> "20253Q")
 */
function getPreviousQuarter(periodStr: string): string | null {
  const parsed = parsePeriod(periodStr);
  if (!parsed) return null;
  const { year, quarter } = parsed;
  if (quarter === 1) {
    return `${year - 1}4Q`;
  }
  return `${year}${quarter - 1}Q`;
}

/**
 * 전년 동분기 계산 (예: "20254Q" -> "20244Q")
 */
function getPreviousYearQuarter(periodStr: string): string | null {
  const parsed = parsePeriod(periodStr);
  if (!parsed) return null;
  const { year, quarter } = parsed;
  return `${year - 1}${quarter}Q`;
}

/**
 * 파일 업로드 및 데이터 저장
 */
export async function uploadFinancialResultFile(
  file: File,
  fiscalYear: number,
  quarter: number
): Promise<FinancialResultFile> {
  try {
    // 파일 형식 검증
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'xls' && fileExt !== 'xlsx') {
      throw new Error('Excel 파일만 업로드 가능합니다 (.xls, .xlsx)');
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.`);
    }

    // 파일 경로 생성
    const filePath = `${fiscalYear}/${quarter}/${uuidv4()}.${fileExt}`;

    // Storage 업로드
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload Error Details:', uploadError);
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error(
          `Storage 버킷 '${BUCKET_NAME}'이 존재하지 않습니다. Supabase Storage에서 '${BUCKET_NAME}' 버킷을 생성해주세요.`
        );
      }
      if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy')) {
        throw new Error(
          `Storage 업로드 권한이 없습니다. Supabase Storage의 '${BUCKET_NAME}' 버킷에 업로드 정책을 설정해주세요.`
        );
      }
      throw new Error(`파일 업로드 실패: ${uploadError.message || '알 수 없는 오류'}`);
    }

    // DB에 파일 정보 저장
    const { data, error: dbError } = await supabase
      .from('financial_result_files')
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        fiscal_year: fiscalYear,
        quarter: quarter,
        uploaded_by: null, // TODO: 사용자 정보 추가
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB Error Details:', dbError);
      throw new Error(`파일 정보 저장 실패: ${dbError.message || '알 수 없는 오류'}`);
    }

    return data;
  } catch (error: any) {
    console.error('Upload Financial Result File Error:', error);
    throw error;
  }
}

/**
 * Excel 파일에서 데이터 추출 및 저장
 * 주의: 이 함수는 클라이언트에서 실행되므로, 실제로는 서버 API를 통해 처리해야 합니다.
 * 여기서는 데이터 구조만 정의합니다.
 */
export interface ExcelRowData {
  Entity: string;
  Period: string;
  'Rev_Account': string;
  'Amount(KRW)': number;
}

/**
 * 데이터 저장
 */
export async function saveFinancialResultData(
  fileId: string,
  data: ExcelRowData[]
): Promise<void> {
  try {
    // Entity → Subsidiary ID 매핑 캐시
    const entityToSubsidiaryId = new Map<string, string | null>();
    
    // 모든 고유 Entity에 대해 Subsidiary ID 조회
    const uniqueEntities = Array.from(new Set(data.map((row) => normalizeEntityName(row.Entity))));
    
    for (const entity of uniqueEntities) {
      const subsidiaryId = await findSubsidiaryIdByEntity(entity);
      entityToSubsidiaryId.set(entity, subsidiaryId);
    }

    const rowsToInsert = await Promise.all(
      data.map(async (row) => {
        const normalizedEntity = normalizeEntityName(row.Entity);
        const subsidiaryId = entityToSubsidiaryId.get(normalizedEntity) || null;
        
        return {
          file_id: fileId,
          entity: normalizedEntity,
          subsidiary_id: subsidiaryId,
          period: row.Period,
          rev_account: row['Rev_Account'],
          amount_krw: row['Amount(KRW)'] || 0,
        };
      })
    );

    // 배치 삽입 (한 번에 최대 1000개)
    const batchSize = 1000;
    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('financial_result_data')
        .insert(batch);

      if (error) {
        console.error('Batch Insert Error:', error);
        throw new Error(`데이터 저장 실패: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('Save Financial Result Data Error:', error);
    throw error;
  }
}

/**
 * 파일 목록 조회
 */
export async function getFinancialResultFiles(
  fiscalYear?: number,
  quarter?: number
): Promise<FinancialResultFile[]> {
  try {
    let query = supabase
      .from('financial_result_files')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (fiscalYear) {
      query = query.eq('fiscal_year', fiscalYear);
    }
    if (quarter) {
      query = query.eq('quarter', quarter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get Financial Result Files Error:', error);
      throw new Error(`파일 목록 조회 실패: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Get Financial Result Files Error:', error);
    throw error;
  }
}

/**
 * 특정 파일의 데이터 조회
 */
export async function getFinancialResultDataByFile(
  fileId: string
): Promise<FinancialResultData[]> {
  try {
    const { data, error } = await supabase
      .from('financial_result_data')
      .select('*')
      .eq('file_id', fileId)
      .order('entity')
      .order('period')
      .order('rev_account');

    if (error) {
      console.error('Get Financial Result Data Error:', error);
      throw new Error(`데이터 조회 실패: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Get Financial Result Data Error:', error);
    throw error;
  }
}

/**
 * 분기별 증감 분석 데이터 생성
 */
export async function getQuarterComparison(
  targetPeriod: string,
  entity?: string,
  revAccount?: string
): Promise<QuarterComparison[]> {
  try {
    // 현재 분기 데이터 조회 (subsidiaries 조인)
    let query = supabase
      .from('financial_result_data')
      .select(`
        *,
        subsidiaries (
          id,
          name,
          code
        )
      `)
      .eq('period', targetPeriod);

    if (entity) {
      query = query.eq('entity', entity);
    }
    if (revAccount) {
      query = query.eq('rev_account', revAccount);
    }

    const { data: currentData, error: currentError } = await query;

    if (currentError) {
      throw new Error(`현재 분기 데이터 조회 실패: ${currentError.message}`);
    }

    if (!currentData || currentData.length === 0) {
      return [];
    }

    // 이전 분기 및 전년 동분기 Period 계산
    const previousQuarter = getPreviousQuarter(targetPeriod);
    const previousYearQuarter = getPreviousYearQuarter(targetPeriod);

    // 이전 분기 데이터 조회
    let previousQuery = supabase
      .from('financial_result_data')
      .select('*');

    if (previousQuarter) {
      previousQuery = previousQuery.eq('period', previousQuarter);
    } else {
      previousQuery = previousQuery.eq('period', 'none'); // 빈 결과
    }

    if (entity) {
      previousQuery = previousQuery.eq('entity', entity);
    }
    if (revAccount) {
      previousQuery = previousQuery.eq('rev_account', revAccount);
    }

    const { data: previousData } = await previousQuery;

    // 전년 동분기 데이터 조회
    let previousYearQuery = supabase
      .from('financial_result_data')
      .select('*');

    if (previousYearQuarter) {
      previousYearQuery = previousYearQuery.eq('period', previousYearQuarter);
    } else {
      previousYearQuery = previousYearQuery.eq('period', 'none'); // 빈 결과
    }

    if (entity) {
      previousYearQuery = previousYearQuery.eq('entity', entity);
    }
    if (revAccount) {
      previousYearQuery = previousYearQuery.eq('rev_account', revAccount);
    }

    const { data: previousYearData } = await previousYearQuery;

    // 데이터 매핑
    const previousMap = new Map<string, number>();
    (previousData || []).forEach((row) => {
      const key = `${row.entity}_${row.rev_account}`;
      previousMap.set(key, row.amount_krw);
    });

    const previousYearMap = new Map<string, number>();
    (previousYearData || []).forEach((row) => {
      const key = `${row.entity}_${row.rev_account}`;
      previousYearMap.set(key, row.amount_krw);
    });

    // 비교 데이터 생성
    const parsed = parsePeriod(targetPeriod);
    const comparisons: QuarterComparison[] = (currentData || []).map((row) => {
      const key = `${row.entity}_${row.rev_account}`;
      const currentAmount = row.amount_krw;
      const previousAmount = previousMap.get(key) || null;
      const previousYearAmount = previousYearMap.get(key) || null;

      const qoqChange = previousAmount !== null ? currentAmount - previousAmount : null;
      const qoqChangePercent =
        previousAmount !== null && previousAmount !== 0
          ? (qoqChange! / previousAmount) * 100
          : null;

      const yoyChange = previousYearAmount !== null ? currentAmount - previousYearAmount : null;
      const yoyChangePercent =
        previousYearAmount !== null && previousYearAmount !== 0
          ? (yoyChange! / previousYearAmount) * 100
          : null;

      // subsidiary name 가져오기
      const subsidiaryName = (row as any).subsidiaries?.name || null;

      return {
        period: targetPeriod,
        fiscalYear: parsed?.year || 0,
        quarter: parsed?.quarter || 0,
        entity: row.entity,
        subsidiaryName,
        revAccount: row.rev_account,
        currentAmount,
        previousAmount,
        previousYearAmount,
        qoqChange,
        qoqChangePercent,
        yoyChange,
        yoyChangePercent,
      };
    });

    return comparisons;
  } catch (error: any) {
    console.error('Get Quarter Comparison Error:', error);
    throw error;
  }
}

/**
 * 모든 Entity 목록 조회 (subsidiary name 포함)
 * financial_result_data에 있는 모든 entity와 entityMapping에 정의된 모든 entity를 포함
 */
export async function getAllFinancialEntities(): Promise<Array<{ entity: string; subsidiaryName: string | null }>> {
  try {
    // 1. financial_result_data에서 모든 고유 entity 조회 (subsidiaries 조인)
    const { data: financialData, error: financialError } = await supabase
      .from('financial_result_data')
      .select(`
        entity,
        subsidiary_id,
        subsidiaries (
          id,
          name,
          code
        )
      `)
      .order('entity');

    if (financialError) {
      console.error('Financial Result Data 조회 실패:', financialError);
    }

    // 2. subsidiaries 테이블에서 모든 법인 조회
    const { data: subsidiariesData, error: subsidiariesError } = await supabase
      .from('subsidiaries')
      .select('id, name, code')
      .order('name');

    if (subsidiariesError) {
      console.error('Subsidiaries 조회 실패:', subsidiariesError);
    }

    // 3. Entity 매핑 생성
    const entityMap = new Map<string, string | null>();
    
    // financial_result_data에서 entity 추출 (이미 매핑된 것)
    (financialData || []).forEach((row: any) => {
      if (!entityMap.has(row.entity)) {
        entityMap.set(row.entity, row.subsidiaries?.name || null);
      }
    });

    // 4. entityMapping의 ENTITY_TO_CODE_MAPPING에 정의된 모든 entity 포함
    const ENTITY_TO_CODE_MAPPING: Record<string, string | null> = {
      'HQ': 'HQ',
      'USA': 'USA',
      'Japan': 'JPN',
      'China': 'CHN',
      'Europe': 'EUR',
      'Asia': 'ASIA',
      'India': 'IND',
      'Mexico': 'MEX',
      'Oceania': 'OCE',
      'BWA': 'BWA',
      'Vietnam': 'VNM',
      'Turkey': 'TUR',
      'KOROT': 'KOROT',
      '헬스케어': 'HEALTHCARE',
      '삼한정공': 'SAMHAN',
      'KOCP': 'KOCP',
      '연결조정': null, // subsidiaries에 없음
      '합계': null, // 합계는 subsidiaries에 없음
    };

    // subsidiaries의 code를 사용하여 entity 매핑
    const codeToNameMap = new Map<string, string>();
    (subsidiariesData || []).forEach((sub: any) => {
      if (sub.code) {
        codeToNameMap.set(sub.code, sub.name);
      }
    });

    // ENTITY_TO_CODE_MAPPING의 모든 entity를 포함
    Object.entries(ENTITY_TO_CODE_MAPPING).forEach(([entity, code]) => {
      if (!entityMap.has(entity)) {
        if (code && codeToNameMap.has(code)) {
          entityMap.set(entity, codeToNameMap.get(code)!);
        } else {
          entityMap.set(entity, null);
        }
      }
    });

    // 5. 결과 반환 (정렬)
    const allEntities = Array.from(entityMap.entries())
      .map(([entity, subsidiaryName]) => ({
        entity,
        subsidiaryName,
      }))
      .sort((a, b) => a.entity.localeCompare(b.entity));

    return allEntities;
  } catch (error: any) {
    console.error('Get All Financial Entities Error:', error);
    throw error;
  }
}

/**
 * 파일 다운로드 URL 생성
 */
export async function getFileDownloadUrl(filePath: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600); // 1시간 유효

    if (error) {
      throw new Error(`다운로드 URL 생성 실패: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error: any) {
    console.error('Get File Download URL Error:', error);
    throw error;
  }
}
