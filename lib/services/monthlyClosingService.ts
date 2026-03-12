/**
 * Monthly Closing 서비스
 * TB 업로드, COA 매핑, P&L/BS 생성 관련 Supabase 작업
 * PRD v1.1 기반 (P&L Code + BS Code 구조)
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import type {
  TBUpload,
  TBRawData,
  COAMapping,
  COAMappingInput,
  PLResult,
  BSResult,
  PLSummary,
  BSSummary,
  UnmappedAccount,
  TBParsedRow,
  StdPLMaster,
  StdBSMaster,
  StatementType,
} from '@/lib/types/monthly-closing';

const BUCKET_NAME = 'monthly-closing';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================
// TB Upload
// ============================================

/**
 * TB 파일 업로드 및 기록 저장
 */
export async function uploadTBFile(
  file: File,
  entityCode: string,
  subsidiaryId: string | null,
  periodYear: number,
  periodMonth: number
): Promise<TBUpload> {
  // 파일 검증
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  if (!['xls', 'xlsx', 'csv'].includes(fileExt || '')) {
    throw new Error('Excel 또는 CSV 파일만 업로드 가능합니다 (.xls, .xlsx, .csv)');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('파일 크기는 10MB를 초과할 수 없습니다.');
  }

  // 기존 업로드 확인
  const { data: existing } = await supabase
    .from('tb_uploads')
    .select('id')
    .eq('entity_code', entityCode)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .single();

  if (existing) {
    // 기존 데이터 삭제 (cascade로 tb_raw_data, pl_results도 삭제)
    await supabase.from('tb_uploads').delete().eq('id', existing.id);
  }

  // Storage 업로드
  const filePath = `${entityCode}/${periodYear}/${periodMonth}/${uuidv4()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (uploadError) {
    if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
      throw new Error(
        `Storage 버킷 '${BUCKET_NAME}'이 존재하지 않습니다. Supabase Storage에서 '${BUCKET_NAME}' 버킷을 생성해주세요.\n` +
        `설정 가이드: docs/monthly-closing-storage-setup.md`
      );
    }
    if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy')) {
      throw new Error(
        `Storage 업로드 권한이 없습니다. Supabase Storage의 '${BUCKET_NAME}' 버킷에 업로드 정책을 설정해주세요.\n` +
        `SQL 파일 실행: docs/monthly-closing-storage-policies.sql`
      );
    }
    throw new Error(`파일 업로드 실패: ${uploadError.message || '알 수 없는 오류'}`);
  }

  // DB에 업로드 기록 저장
  const { data, error } = await supabase
    .from('tb_uploads')
    .insert({
      entity_code: entityCode,
      subsidiary_id: subsidiaryId,
      period_year: periodYear,
      period_month: periodMonth,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      status: 'uploaded',
    })
    .select()
    .single();

  if (error) throw new Error(`업로드 기록 저장 실패: ${error.message}`);
  return data as TBUpload;
}

/**
 * TB 원장 데이터 저장
 */
export async function saveTBRawData(
  uploadId: string,
  rows: TBParsedRow[]
): Promise<void> {
  const insertData = rows.map((row) => ({
    upload_id: uploadId,
    account_code: row.accountCode,
    account_name: row.accountName,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    description: row.description || null,
  }));

  // 배치 삽입 (500개씩)
  const batchSize = 500;
  for (let i = 0; i < insertData.length; i += batchSize) {
    const batch = insertData.slice(i, i + batchSize);
    const { error } = await supabase.from('tb_raw_data').insert(batch);
    if (error) throw new Error(`데이터 저장 실패 (batch ${i}): ${error.message}`);
  }
}

/**
 * TB 업로드 목록 조회
 */
export async function getTBUploads(
  entityCode?: string,
  periodYear?: number,
  periodMonth?: number
): Promise<TBUpload[]> {
  let query = supabase
    .from('tb_uploads')
    .select('*')
    .order('created_at', { ascending: false });

  if (entityCode) query = query.eq('entity_code', entityCode);
  if (periodYear) query = query.eq('period_year', periodYear);
  if (periodMonth) query = query.eq('period_month', periodMonth);

  const { data, error } = await query;
  if (error) throw new Error(`업로드 목록 조회 실패: ${error.message}`);
  return (data || []) as TBUpload[];
}

/**
 * 업로드 상태 업데이트
 */
export async function updateUploadStatus(
  uploadId: string,
  status: string,
  unmappedCount?: number
): Promise<void> {
  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (unmappedCount !== undefined) updateData.unmapped_count = unmappedCount;

  const { error } = await supabase
    .from('tb_uploads')
    .update(updateData)
    .eq('id', uploadId);

  if (error) throw new Error(`상태 업데이트 실패: ${error.message}`);
}

/**
 * TB 업로드 삭제 (관련 데이터 및 Storage 파일 포함)
 */
export async function deleteTBUpload(uploadId: string): Promise<void> {
  // 먼저 업로드 정보 조회 (Storage 파일 경로 확인)
  const { data: upload, error: fetchError } = await supabase
    .from('tb_uploads')
    .select('file_path')
    .eq('id', uploadId)
    .single();

  if (fetchError) {
    throw new Error(`업로드 정보 조회 실패: ${fetchError.message}`);
  }

  // Storage 파일 삭제 (있는 경우)
  if (upload?.file_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([upload.file_path]);
    
    if (storageError) {
      console.warn(`Storage 파일 삭제 실패 (무시됨): ${storageError.message}`);
    }
  }

  // DB 레코드 삭제 (CASCADE로 tb_raw_data, pl_results, bs_results도 삭제됨)
  const { error: deleteError } = await supabase
    .from('tb_uploads')
    .delete()
    .eq('id', uploadId);

  if (deleteError) {
    throw new Error(`업로드 삭제 실패: ${deleteError.message}`);
  }
}

// ============================================
// Standard P&L Master
// ============================================

/**
 * 표준 P&L 마스터 조회
 */
export async function getStdPLMaster(): Promise<StdPLMaster[]> {
  const { data, error } = await supabase
    .from('std_pl_master')
    .select('*')
    .order('display_order');

  if (error) throw new Error(`P&L 마스터 조회 실패: ${error.message}`);
  return (data || []) as StdPLMaster[];
}

/**
 * P&L Code로 마스터 조회
 */
export async function getStdPLMasterByCode(plCode: string): Promise<StdPLMaster | null> {
  const { data, error } = await supabase
    .from('std_pl_master')
    .select('*')
    .eq('pl_code', plCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`P&L 마스터 조회 실패: ${error.message}`);
  }
  return data as StdPLMaster;
}

// ============================================
// Standard BS Master
// ============================================

/**
 * 표준 BS 마스터 조회
 */
export async function getStdBSMaster(): Promise<StdBSMaster[]> {
  const { data, error } = await supabase
    .from('std_bs_master')
    .select('*')
    .order('display_order');

  if (error) throw new Error(`BS 마스터 조회 실패: ${error.message}`);
  return (data || []) as StdBSMaster[];
}

/**
 * BS Code로 마스터 조회
 */
export async function getStdBSMasterByCode(bsCode: string): Promise<StdBSMaster | null> {
  const { data, error } = await supabase
    .from('std_bs_master')
    .select('*')
    .eq('bs_code', bsCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`BS 마스터 조회 실패: ${error.message}`);
  }
  return data as StdBSMaster;
}

// ============================================
// COA Mapping
// ============================================

/**
 * COA 매핑 목록 조회 (P&L/BS Master 정보 포함)
 */
export async function getCOAMappings(
  entityCode?: string,
  statementType?: StatementType
): Promise<COAMapping[]> {
  // statement_type에 따라 적절한 마스터 테이블 조인
  let query = supabase
    .from('coa_mapping')
    .select('*')
    .eq('is_active', true)
    .order('entity_code')
    .order('local_account_code');

  if (entityCode) query = query.eq('entity_code', entityCode);
  if (statementType) query = query.eq('statement_type', statementType);

  const { data, error } = await query;
  if (error) throw new Error(`매핑 목록 조회 실패: ${error.message}`);

  // 마스터 정보 조인
  const mappings = (data || []) as COAMapping[];
  
  // P&L 마스터 조회
  const plCodes = mappings.filter(m => m.statement_type === 'PL').map(m => m.std_code);
  const bsCodes = mappings.filter(m => m.statement_type === 'BS').map(m => m.std_code);

  let plMasterMap = new Map<string, StdPLMaster>();
  let bsMasterMap = new Map<string, StdBSMaster>();

  if (plCodes.length > 0) {
    const { data: plData } = await supabase
      .from('std_pl_master')
      .select('*')
      .in('pl_code', plCodes);
    (plData || []).forEach((pl: StdPLMaster) => plMasterMap.set(pl.pl_code, pl));
  }

  if (bsCodes.length > 0) {
    const { data: bsData } = await supabase
      .from('std_bs_master')
      .select('*')
      .in('bs_code', bsCodes);
    (bsData || []).forEach((bs: StdBSMaster) => bsMasterMap.set(bs.bs_code, bs));
  }

  // 매핑에 마스터 정보 추가
  return mappings.map(m => ({
    ...m,
    std_pl_master: m.statement_type === 'PL' ? plMasterMap.get(m.std_code) : undefined,
    std_bs_master: m.statement_type === 'BS' ? bsMasterMap.get(m.std_code) : undefined,
  }));
}

/**
 * COA 매핑 추가/업데이트
 */
export async function upsertCOAMapping(mapping: COAMappingInput): Promise<COAMapping> {
  const { data, error } = await supabase
    .from('coa_mapping')
    .upsert(
      {
        entity_code: mapping.entity_code,
        local_account_code: mapping.local_account_code,
        local_account_name: mapping.local_account_name || null,
        statement_type: mapping.statement_type,
        std_code: mapping.std_code,
        is_active: true,
        updated_by: 'system',
      },
      { onConflict: 'entity_code,local_account_code' }
    )
    .select()
    .single();

  if (error) throw new Error(`매핑 저장 실패: ${error.message}`);
  return data as COAMapping;
}

/**
 * COA 매핑 삭제 (비활성화)
 */
export async function deleteCOAMapping(id: string): Promise<void> {
  const { error } = await supabase
    .from('coa_mapping')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(`매핑 삭제 실패: ${error.message}`);
}

/**
 * COA 매핑 엑셀 파일 파싱
 */
export async function parseCOAMappingExcel(file: File): Promise<COAMappingInput[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          reject(new Error('Excel 파일이 비어있습니다.'));
          return;
        }

        // 필수 컬럼 확인 (유연한 매칭)
        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);

        const findCol = (names: string[]) =>
          keys.find((k) => names.some((n) => k.toLowerCase().includes(n.toLowerCase())));

        const accountCodeCol = findCol(['Account Code', 'account_code', '계정코드', 'AccountCode', 'Local Account Code']);
        const accountNameCol = findCol(['Account Name', 'account_name', '계정명', 'AccountName', 'Local Account Name']);
        const statementTypeCol = findCol(['Statement Type', 'statement_type', '재무제표', 'Type', 'StatementType']);
        const stdCodeCol = findCol(['Std Code', 'std_code', 'P&L Code', 'BS Code', 'Standard Code', 'PLCode', 'BSCode']);

        if (!accountCodeCol || !stdCodeCol) {
          reject(
            new Error(
              `필수 컬럼이 누락되었습니다.\n필요: Account Code, Std Code (또는 P&L Code, BS Code)\n발견: ${keys.join(', ')}`
            )
          );
          return;
        }

        const parsedMappings: COAMappingInput[] = jsonData
          .filter((row) => row[accountCodeCol!] && row[stdCodeCol!])
          .map((row) => {
            // Statement Type 추론 (명시적으로 지정되지 않은 경우 코드 범위로 판단)
            let statementType: StatementType = 'PL';
            if (statementTypeCol && row[statementTypeCol]) {
              const type = String(row[statementTypeCol]).toUpperCase().trim();
              statementType = type === 'BS' ? 'BS' : 'PL';
            } else {
              // 코드 범위로 추론 (1xxxx = BS, 나머지 = PL)
              const code = String(row[stdCodeCol!]).trim();
              if (code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) {
                statementType = 'BS';
              }
            }

            return {
              local_account_code: String(row[accountCodeCol!]).trim(),
              local_account_name: accountNameCol ? String(row[accountNameCol] || '').trim() : undefined,
              statement_type: statementType,
              std_code: String(row[stdCodeCol!]).trim(),
              entity_code: '', // 임시값, 실제 업로드 시 설정
            };
          });

        if (parsedMappings.length === 0) {
          reject(new Error('유효한 매핑 데이터가 없습니다.'));
          return;
        }

        resolve(parsedMappings);
      } catch (err: any) {
        reject(new Error(`파일 파싱 실패: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsBinaryString(file);
  });
}

/**
 * COA 매핑 일괄 업로드
 */
export async function bulkUpsertCOAMappings(
  entityCode: string,
  mappings: COAMappingInput[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  // P&L Code와 BS Code 유효성 검사
  const plMappings = mappings.filter(m => m.statement_type === 'PL');
  const bsMappings = mappings.filter(m => m.statement_type === 'BS');

  // P&L Code 유효성 검사
  let validPLCodeSet = new Set<string>();
  if (plMappings.length > 0) {
    const { data: validPLCodes, error: plCodeError } = await supabase
      .from('std_pl_master')
      .select('pl_code');
    if (plCodeError) {
      throw new Error(`P&L 마스터 조회 실패: ${plCodeError.message}`);
    }
    validPLCodeSet = new Set((validPLCodes || []).map((p: any) => p.pl_code));
  }

  // BS Code 유효성 검사
  let validBSCodeSet = new Set<string>();
  if (bsMappings.length > 0) {
    const { data: validBSCodes, error: bsCodeError } = await supabase
      .from('std_bs_master')
      .select('bs_code');
    if (bsCodeError) {
      throw new Error(`BS 마스터 조회 실패: ${bsCodeError.message}`);
    }
    validBSCodeSet = new Set((validBSCodes || []).map((b: any) => b.bs_code));
  }

  // 유효하지 않은 Code 필터링
  const invalidMappings: string[] = [];
  const validMappings = mappings.filter((m) => {
    if (m.statement_type === 'PL') {
      if (!validPLCodeSet.has(m.std_code)) {
        invalidMappings.push(`계정코드 ${m.local_account_code}: P&L Code '${m.std_code}'가 존재하지 않습니다.`);
        return false;
      }
    } else if (m.statement_type === 'BS') {
      if (!validBSCodeSet.has(m.std_code)) {
        invalidMappings.push(`계정코드 ${m.local_account_code}: BS Code '${m.std_code}'가 존재하지 않습니다.`);
        return false;
      }
    }
    return true;
  });

  if (invalidMappings.length > 0) {
    console.warn('유효하지 않은 Code:', invalidMappings);
  }

  if (validMappings.length === 0) {
    throw new Error('유효한 매핑 데이터가 없습니다. 모든 Code가 유효하지 않습니다.');
  }

  // ★ 중복 계정코드 제거 (마지막 것 유지)
  const uniqueMappings = Array.from(
    validMappings.reduce((map, m) => {
      map.set(m.local_account_code, m);
      return map;
    }, new Map<string, COAMappingInput>()).values()
  );

  if (validMappings.length !== uniqueMappings.length) {
    const duplicateCount = validMappings.length - uniqueMappings.length;
    console.warn(`중복 계정코드 ${duplicateCount}건이 제거되었습니다.`);
  }

  const mappingsToInsert = uniqueMappings.map((m) => ({
    entity_code: entityCode,
    local_account_code: m.local_account_code,
    local_account_name: m.local_account_name || null,
    statement_type: m.statement_type,
    std_code: m.std_code,
    is_active: true,
    updated_by: 'system',
  }));

  // 배치로 업로드 (Supabase는 한번에 최대 1000개까지)
  const batchSize = 1000;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  // 유효하지 않은 매핑 에러 추가
  if (invalidMappings.length > 0) {
    errors.push(...invalidMappings);
    failed += invalidMappings.length;
  }

  for (let i = 0; i < mappingsToInsert.length; i += batchSize) {
    const batch = mappingsToInsert.slice(i, i + batchSize);
    const { error } = await supabase
      .from('coa_mapping')
      .upsert(batch, { onConflict: 'entity_code,local_account_code' });

    if (error) {
      failed += batch.length;
      const errorDetails = error.details || error.message || '알 수 없는 오류';
      const errorHint = error.hint || '';
      errors.push(
        `배치 ${Math.floor(i / batchSize) + 1} 실패: ${errorDetails}${errorHint ? ` (${errorHint})` : ''}`
      );
      console.error('Batch upsert error:', error);
    } else {
      success += batch.length;
    }
  }

  return { success, failed, errors };
}

/**
 * Unmapped 계정 조회 (매핑되지 않은 TB 계정)
 */
export async function getUnmappedAccounts(uploadId: string): Promise<UnmappedAccount[]> {
  // upload 정보 조회
  const { data: upload, error: uploadError } = await supabase
    .from('tb_uploads')
    .select('entity_code')
    .eq('id', uploadId)
    .single();

  if (uploadError) throw new Error(`업로드 조회 실패: ${uploadError.message}`);

  const entityCode = upload.entity_code;

  // TB 원장 조회
  const { data: rawData, error: rawError } = await supabase
    .from('tb_raw_data')
    .select('*')
    .eq('upload_id', uploadId);

  if (rawError) throw new Error(`원장 데이터 조회 실패: ${rawError.message}`);

  // 매핑 조회
  const { data: mappings, error: mapError } = await supabase
    .from('coa_mapping')
    .select('local_account_code')
    .eq('entity_code', entityCode)
    .eq('is_active', true);

  if (mapError) throw new Error(`매핑 조회 실패: ${mapError.message}`);

  const mappedCodes = new Set(mappings?.map((m: any) => m.local_account_code) || []);

  // 매핑되지 않은 계정 필터링 + statement_type 추천
  return (rawData || [])
    .filter((row: any) => !mappedCodes.has(row.account_code))
    .map((row: any) => {
      // Balance 부호로 statement_type 추천
      // 일반적으로: 자산/비용 = 차변(+), 부채/자본/수익 = 대변(-)
      // P&L 계정은 당기 발생액, BS 계정은 누적 잔액
      // 계정코드 첫자리로 추론 시도
      const code = row.account_code;
      let suggested: StatementType = 'PL';
      if (code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) {
        suggested = 'BS';
      } else if (code.startsWith('4') || code.startsWith('5') || code.startsWith('6') || code.startsWith('7') || code.startsWith('8')) {
        suggested = 'PL';
      }

      return {
        account_code: row.account_code,
        account_name: row.account_name,
        debit: row.debit,
        credit: row.credit,
        balance: row.balance,
        entity_code: entityCode,
        upload_id: uploadId,
        suggested_statement_type: suggested,
      };
    });
}

// ============================================
// P&L / BS Generation
// ============================================

/**
 * P&L 및 BS 생성 (TB → 매핑 → P&L/BS Code 기반 집계)
 */
export async function generateStatements(uploadId: string): Promise<{ plResults: PLResult[]; bsResults: BSResult[] }> {
  // upload 정보 조회
  const { data: upload, error: uploadError } = await supabase
    .from('tb_uploads')
    .select('*')
    .eq('id', uploadId)
    .single();

  if (uploadError) throw new Error(`업로드 조회 실패: ${uploadError.message}`);

  // TB 원장 조회
  const { data: rawData, error: rawError } = await supabase
    .from('tb_raw_data')
    .select('*')
    .eq('upload_id', uploadId);

  if (rawError) throw new Error(`원장 데이터 조회 실패: ${rawError.message}`);

  // 매핑 조회
  const { data: mappings, error: mapError } = await supabase
    .from('coa_mapping')
    .select('*')
    .eq('entity_code', upload.entity_code)
    .eq('is_active', true);

  if (mapError) throw new Error(`매핑 조회 실패: ${mapError.message}`);

  // 매핑 Map 생성 (local_account_code → { statement_type, std_code })
  const mappingMap = new Map<string, { statement_type: StatementType; std_code: string }>();
  (mappings || []).forEach((m: any) => {
    mappingMap.set(m.local_account_code, {
      statement_type: m.statement_type,
      std_code: m.std_code,
    });
  });

  // P&L Code별, BS Code별 금액 집계
  const plCodeAmounts = new Map<string, number>();
  const bsCodeAmounts = new Map<string, number>();
  let unmappedCount = 0;

  // 디버그: 각 std_code별 상세 내역
  const debugDetails = new Map<string, { accounts: string[]; rawBalances: number[]; amounts: number[] }>();

  // 부호 결정 함수: std_code가 1, 5, 6, 72, 74, 80으로 시작하면 +balance, 그 외는 -balance
  const getSignedAmount = (stdCode: string, balance: number): number => {
    const prefix1 = stdCode.charAt(0);
    const prefix2 = stdCode.substring(0, 2);
    
    // 1, 5, 6으로 시작하거나 72, 74, 80으로 시작하면 양수
    if (prefix1 === '1' || prefix1 === '5' || prefix1 === '6' ||
        prefix2 === '72' || prefix2 === '74' || prefix2 === '80') {
      return balance;
    }
    // 그 외 (4xxxx Sales, 71xxx Other Revenue, 73xxx Financial Revenue 등)는 부호 반전
    return -balance;
  };

  (rawData || []).forEach((row: any) => {
    const mapping = mappingMap.get(row.account_code);
    if (!mapping) {
      unmappedCount++;
      return;
    }

    // balance가 0이면 credit - debit 사용
    const debit = Number(row.debit) || 0;
    const credit = Number(row.credit) || 0;
    const balance = Number(row.balance) || 0;
    const effectiveBalance = balance !== 0 ? balance : (credit - debit);

    // 부호 적용
    const amount = getSignedAmount(mapping.std_code, effectiveBalance);

    // 디버그 정보 수집
    if (!debugDetails.has(mapping.std_code)) {
      debugDetails.set(mapping.std_code, { accounts: [], rawBalances: [], amounts: [] });
    }
    const detail = debugDetails.get(mapping.std_code)!;
    detail.accounts.push(row.account_code);
    detail.rawBalances.push(effectiveBalance);
    detail.amounts.push(amount);

    if (mapping.statement_type === 'PL') {
      const existing = plCodeAmounts.get(mapping.std_code) || 0;
      plCodeAmounts.set(mapping.std_code, existing + amount);
    } else if (mapping.statement_type === 'BS') {
      const existing = bsCodeAmounts.get(mapping.std_code) || 0;
      bsCodeAmounts.set(mapping.std_code, existing + amount);
    }
  });

  // 디버그 로그: Sales(4xxxx)와 COGS(5xxxx) 상세 출력
  console.log('=== P&L 생성 디버그 ===');
  debugDetails.forEach((detail, stdCode) => {
    if (stdCode.startsWith('4') || stdCode.startsWith('5')) {
      const total = detail.amounts.reduce((a, b) => a + b, 0);
      console.log(`[${stdCode}] 계정수: ${detail.accounts.length}, 합계: ${total.toLocaleString()}`);
      detail.accounts.forEach((acc, i) => {
        console.log(`  - ${acc}: rawBalance=${detail.rawBalances[i].toLocaleString()} → amount=${detail.amounts[i].toLocaleString()}`);
      });
    }
  });
  console.log(`Unmapped 계정 수: ${unmappedCount}`);

  // 기존 결과 삭제
  await supabase.from('pl_results').delete().eq('upload_id', uploadId);
  await supabase.from('bs_results').delete().eq('upload_id', uploadId);

  // P&L 결과 저장
  const plResults: any[] = [];
  plCodeAmounts.forEach((amount, plCode) => {
    plResults.push({
      upload_id: uploadId,
      entity_code: upload.entity_code,
      subsidiary_id: upload.subsidiary_id,
      period_year: upload.period_year,
      period_month: upload.period_month,
      std_pl_code: plCode,
      amount: amount,
      currency: 'KRW',
    });
  });

  if (plResults.length > 0) {
    const { error } = await supabase.from('pl_results').insert(plResults);
    if (error) throw new Error(`P&L 저장 실패: ${error.message}`);
  }

  // BS 결과 저장
  const bsResults: any[] = [];
  bsCodeAmounts.forEach((amount, bsCode) => {
    bsResults.push({
      upload_id: uploadId,
      entity_code: upload.entity_code,
      subsidiary_id: upload.subsidiary_id,
      period_year: upload.period_year,
      period_month: upload.period_month,
      std_bs_code: bsCode,
      amount: amount,
      currency: 'KRW',
    });
  });

  if (bsResults.length > 0) {
    const { error } = await supabase.from('bs_results').insert(bsResults);
    if (error) throw new Error(`BS 저장 실패: ${error.message}`);
  }

  // 업로드 상태 업데이트
  const status = unmappedCount === 0 ? 'mapped' : 'partial';
  await updateUploadStatus(uploadId, status, unmappedCount);

  return { plResults: plResults as PLResult[], bsResults: bsResults as BSResult[] };
}

/**
 * P&L만 생성 (기존 호환성 유지)
 */
export async function generatePL(uploadId: string): Promise<PLResult[]> {
  const { plResults } = await generateStatements(uploadId);
  return plResults;
}

// ============================================
// P&L 조회
// ============================================

/**
 * P&L 결과 조회 (P&L Master 정보 포함)
 */
export async function getPLResults(
  entityCode: string,
  periodYear: number,
  periodMonth: number
): Promise<PLResult[]> {
  const { data, error } = await supabase
    .from('pl_results')
    .select('*, std_pl_master(*)')
    .eq('entity_code', entityCode)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth);

  if (error) throw new Error(`P&L 조회 실패: ${error.message}`);
  return (data || []) as PLResult[];
}

/**
 * P&L Summary 계산 (PRD 기반)
 */
export function calculatePLSummary(
  results: PLResult[],
  entityCode: string,
  entityName: string,
  periodYear: number,
  periodMonth: number
): PLSummary {
  // P&L Code별 금액 Map 생성
  const amountByCode = new Map<string, number>();
  results.forEach((r) => {
    amountByCode.set(r.std_pl_code, r.amount);
  });

  // Sales (41000~46000: 모든 Sales 코드)
  const salesCodes = ['41000', '42000', '43000', '44000', '45000', '46000'];
  const sales = salesCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);

  // Cost of Sales (51000~54000: 모든 COGS 코드)
  const cogsCodes = ['51000', '52000', '53000', '54000'];
  const costOfSales = cogsCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);

  // Gross Profit (계산값)
  const grossProfit = sales - costOfSales;
  const gpMargin = sales !== 0 ? (grossProfit / sales) * 100 : 0;

  // Selling and Administration Expense (60001~60034)
  const sgACodes = Array.from({ length: 34 }, (_, i) => `600${String(i + 1).padStart(2, '0')}`);
  const sellingAndAdminExpense = sgACodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);

  // Operating Income (계산값)
  const operatingIncome = grossProfit - sellingAndAdminExpense;
  const operatingMargin = sales !== 0 ? (operatingIncome / sales) * 100 : 0;

  // Other Revenue (71001~71009)
  const otherRevCodes = Array.from({ length: 9 }, (_, i) => `710${String(i + 1).padStart(2, '0')}`);
  const otherRevenue = otherRevCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);

  // Other Expense (72001~72013)
  const otherExpCodes = Array.from({ length: 13 }, (_, i) => `720${String(i + 1).padStart(2, '0')}`);
  const otherExpense = otherExpCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);

  // Financial Revenue (73001~73005)
  const finRevCodes = Array.from({ length: 5 }, (_, i) => `730${String(i + 1).padStart(2, '0')}`);
  const financialRevenue = finRevCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);

  // Financial Expense (74001~74004)
  const finExpCodes = Array.from({ length: 4 }, (_, i) => `740${String(i + 1).padStart(2, '0')}`);
  const financialExpense = finExpCodes.reduce((sum, code) => sum + (amountByCode.get(code) || 0), 0);

  // Income before Tax (계산값)
  const incomeBeforeTax = operatingIncome + otherRevenue - otherExpense + financialRevenue - financialExpense;

  // Corporate Income Tax (80001)
  const corporateIncomeTax = amountByCode.get('80001') || 0;

  // Net Income (계산값)
  const netIncome = incomeBeforeTax - corporateIncomeTax;
  const netMargin = sales !== 0 ? (netIncome / sales) * 100 : 0;

  return {
    entityCode,
    entityName,
    periodYear,
    periodMonth,
    sales,
    costOfSales,
    grossProfit,
    gpMargin,
    sellingAndAdminExpense,
    operatingIncome,
    operatingMargin,
    otherRevenue,
    otherExpense,
    financialRevenue,
    financialExpense,
    incomeBeforeTax,
    corporateIncomeTax,
    netIncome,
    netMargin,
    currency: results[0]?.currency || 'KRW',
  };
}

/**
 * 모든 Entity의 P&L Summary 조회 (특정 기간)
 */
export async function getAllEntityPLSummaries(
  periodYear: number,
  periodMonth: number
): Promise<PLSummary[]> {
  const { data, error } = await supabase
    .from('pl_results')
    .select('*, subsidiaries(name)')
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth);

  if (error) throw new Error(`전체 P&L 조회 실패: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Entity별 그룹화
  const entityMap = new Map<string, { results: PLResult[]; entityName: string }>();
  data.forEach((row: any) => {
    const key = row.entity_code;
    if (!entityMap.has(key)) {
      entityMap.set(key, {
        results: [],
        entityName: row.subsidiaries?.name || row.entity_code,
      });
    }
    entityMap.get(key)!.results.push(row);
  });

  // Summary 계산
  const summaries: PLSummary[] = [];
  entityMap.forEach(({ results, entityName }, entityCode) => {
    summaries.push(
      calculatePLSummary(results, entityCode, entityName, periodYear, periodMonth)
    );
  });

  return summaries;
}

// ============================================
// BS 조회
// ============================================

/**
 * BS 결과 조회 (BS Master 정보 포함)
 */
export async function getBSResults(
  entityCode: string,
  periodYear: number,
  periodMonth: number
): Promise<BSResult[]> {
  const { data, error } = await supabase
    .from('bs_results')
    .select('*, std_bs_master(*)')
    .eq('entity_code', entityCode)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth);

  if (error) throw new Error(`BS 조회 실패: ${error.message}`);
  return (data || []) as BSResult[];
}

/**
 * BS Summary 계산 (PRD 기반)
 */
export function calculateBSSummary(
  results: BSResult[],
  entityCode: string,
  entityName: string,
  periodYear: number,
  periodMonth: number
): BSSummary {
  // BS Code별 금액 Map 생성
  const amountByCode = new Map<string, number>();
  results.forEach((r) => {
    amountByCode.set(r.std_bs_code, r.amount);
  });

  // Current Assets (11xxx)
  let currentAssets = 0;
  // Non-Current Assets (12xxx)
  let nonCurrentAssets = 0;
  // Current Liabilities (21xxx)
  let currentLiabilities = 0;
  // Non-Current Liabilities (22xxx)
  let nonCurrentLiabilities = 0;
  // Equity (31xxx)
  let totalEquity = 0;

  amountByCode.forEach((amount, code) => {
    if (code.startsWith('11')) {
      currentAssets += amount;
    } else if (code.startsWith('12')) {
      nonCurrentAssets += amount;
    } else if (code.startsWith('21')) {
      currentLiabilities += amount;
    } else if (code.startsWith('22')) {
      nonCurrentLiabilities += amount;
    } else if (code.startsWith('31')) {
      totalEquity += amount;
    }
  });

  const totalAssets = currentAssets + nonCurrentAssets;
  const totalLiabilities = currentLiabilities + nonCurrentLiabilities;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01; // 반올림 오차 허용

  return {
    entityCode,
    entityName,
    periodYear,
    periodMonth,
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced,
    currency: results[0]?.currency || 'KRW',
  };
}
