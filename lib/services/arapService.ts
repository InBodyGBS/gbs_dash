/**
 * Intercompany AR-AP Balance Reconciliation Service
 * 데이터베이스 연동 서비스
 */

import { supabase } from '@/lib/supabase/client';
import type {
  ArapSubmission,
  ArapSubmissionDetail,
  ArapSubmissionWithDetails,
  ArapSubmissionFormData,
  MatchStatusSummary,
  MonthlyStatus,
  EntityMatchMatrix,
  MatchStatus,
  AccountType,
} from '@/lib/types/arap';

/**
 * 모든 Entity 조회 (subsidiaries 테이블 사용)
 */
export async function getArapEntities() {
  try {
    const { data, error } = await supabase
      .from('subsidiaries')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching subsidiaries:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    // subsidiaries를 arap entities 형식으로 변환
    return (data || []).map((sub) => ({
      id: sub.id,
      entity_name: sub.name,
      entity_code: sub.code,
      is_admin: sub.code === 'HQ' || sub.code === 'KOREA',
      display_order: 0,
      created_at: sub.created_at,
      updated_at: sub.created_at,
    }));
  } catch (error: any) {
    console.error('Error in getArapEntities:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    throw error;
  }
}

/**
 * Submission 생성
 */
export async function createArapSubmission(
  formData: ArapSubmissionFormData,
  entityId: string,
  submittedBy?: string
): Promise<ArapSubmissionWithDetails> {
  try {
    const { fiscal_year, fiscal_month, submission_type, items, file } = formData;

    console.log('📤 Creating ARAP submission:', {
      entityId,
      fiscal_year,
      fiscal_month,
      submission_type,
      itemsCount: items.length,
      hasFile: !!file,
    });

    // 1. 파일 업로드 (파일이 있는 경우)
    let filePath: string | null = null;
    if (file && submission_type === 'file') {
      try {
        const fileName = `${entityId}/${fiscal_year}/${fiscal_month}/${Date.now()}_${file.name}`;
        console.log('📁 Uploading file:', fileName);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('arap-submissions')
          .upload(fileName, file);

        if (uploadError) {
          // 에러 객체를 안전하게 직렬화
          const errorDetails = {
            message: uploadError.message || 'Unknown error',
            statusCode: uploadError.statusCode || 'Unknown',
            statusText: uploadError.statusText || 'Unknown',
            name: uploadError.name || 'Unknown',
            error: uploadError.error ? String(uploadError.error) : 'No error details',
            ...(uploadError as any),
          };
          
          console.error('❌ File upload error:', JSON.stringify(errorDetails, null, 2));
          
          // Storage 버킷이 없거나 RLS 정책 위반인 경우 파일 없이 진행
          const errorMessage = String(uploadError.message || '');
          const isBucketNotFound = 
            errorMessage.includes('Bucket not found') || 
            errorMessage.includes('does not exist') ||
            errorMessage.includes('not found');
          const isRLSViolation = 
            errorMessage.includes('row-level security policy') ||
            errorMessage.includes('RLS') ||
            errorMessage.includes('violates row-level security') ||
            uploadError.statusCode === 403 ||
            uploadError.statusCode === '403' ||
            (uploadError as any).status === 403 ||
            (uploadError as any).status === 400;
          
          if (isBucketNotFound || isRLSViolation) {
            console.warn('⚠️ Storage bucket not found or RLS policy violation. Proceeding without file upload.');
            console.warn('⚠️ Please ensure the "arap-submissions" bucket exists and RLS policies are set up.');
            console.warn('⚠️ Run the SQL in docs/arap-storage-policies.sql to fix this issue.');
            filePath = null;
            // RLS 위반은 에러를 throw하지 않고 경고만 출력하고 계속 진행 (파일 없이 데이터만 저장)
          } else {
            throw new Error(`File upload failed: ${errorMessage || 'Unknown error'}`);
          }
        } else {
          filePath = fileName;
          console.log('✅ File uploaded successfully:', uploadData);
        }
      } catch (fileError: any) {
        const errorMessage = fileError?.message || String(fileError) || 'Unknown error';
        const errorDetails = {
          message: errorMessage,
          name: fileError?.name || 'Unknown',
          stack: fileError?.stack || 'No stack trace',
          ...(fileError && typeof fileError === 'object' ? fileError : {}),
        };
        
        console.error('❌ File upload exception:', JSON.stringify(errorDetails, null, 2));
        
        // 파일 업로드 실패해도 계속 진행 (수동 입력 데이터는 저장)
        if (submission_type === 'file') {
          throw new Error(`File upload failed: ${errorMessage}`);
        } else {
          // 수동 입력인 경우 파일 없이 진행
          console.warn('⚠️ File upload failed but continuing without file (manual submission)');
          filePath = null;
        }
      }
    }

    // 2. 기존 제출 확인 및 삭제
    console.log('🔍 Checking for existing submission...');
    const { data: existingSubmissions } = await supabase
      .from('arap_submissions')
      .select('id')
      .eq('entity_id', entityId)
      .eq('fiscal_year', fiscal_year)
      .eq('fiscal_month', fiscal_month);

    if (existingSubmissions && existingSubmissions.length > 0) {
      console.log('🗑️ Deleting existing submission(s)...', existingSubmissions.length);
      for (const existing of existingSubmissions) {
        try {
          await deleteArapSubmission(existing.id);
        } catch (deleteError) {
          console.warn('⚠️ Failed to delete existing submission:', deleteError);
        }
      }
    }

    // 3. Submission 생성
    console.log('💾 Creating submission record...');
    const { data: submission, error: submissionError } = await supabase
      .from('arap_submissions')
      .insert({
        entity_id: entityId,
        fiscal_year,
        fiscal_month,
        submission_type,
        file_path: filePath,
        total_items: items.length,
        match_status: 'pending',
        submitted_by: submittedBy || null,
      })
      .select()
      .single();

    if (submissionError) {
      console.error('❌ Submission creation error:', {
        message: submissionError.message,
        code: submissionError.code,
        details: submissionError.details,
        hint: submissionError.hint,
      });
      
      // 테이블이 없을 경우
      if (submissionError.code === 'PGRST116' || submissionError.message?.includes('does not exist')) {
        throw new Error('ARAP tables not found. Please run the schema migration first.');
      }
      
      throw new Error(`Failed to create submission: ${submissionError.message}`);
    }

    if (!submission) {
      throw new Error('Submission was not created');
    }

    console.log('✅ Submission created:', submission.id);

    // 4. Submission Details 생성
    console.log('💾 Creating submission details...', items.length, 'items');
    const details = items.map((item) => ({
      submission_id: submission.id,
      invoice_date: item.invoice_date || null,
      counterparty_entity_id: item.counterparty_entity_id,
      account_type: item.account_type,
      invoice_no: item.invoice_no || null,
      currency: item.currency,
      amount: item.amount,
      description: item.description || null,
    }));

    const { data: detailsData, error: detailsError } = await supabase
      .from('arap_submission_details')
      .insert(details)
      .select();

    if (detailsError) {
      console.error('❌ Submission details creation error:', {
        message: detailsError.message,
        code: detailsError.code,
        details: detailsError.details,
        hint: detailsError.hint,
      });
      
      // Submission은 생성되었지만 Details 생성 실패 - Submission 삭제
      await supabase.from('arap_submissions').delete().eq('id', submission.id);
      
      throw new Error(`Failed to create submission details: ${detailsError.message}`);
    }

    console.log('✅ Submission details created:', detailsData?.length || 0, 'items');

    // 5. 매칭 상태 재계산 (에러가 나도 무시)
    try {
      console.log('🔄 Recalculating match status...', { fiscal_year, fiscal_month });
      await recalculateMatchStatus(fiscal_year, fiscal_month);
      console.log('✅ Match status recalculated successfully');
    } catch (matchError: any) {
      console.error('⚠️ Failed to recalculate match status:', {
        message: matchError?.message,
        code: matchError?.code,
        details: matchError?.details,
        stack: matchError?.stack,
      });
      // 매칭 상태 재계산 실패해도 저장은 성공으로 처리
    }

    return {
      ...submission,
      submission_details: detailsData || [],
    };
  } catch (error: any) {
    console.error('❌ Error in createArapSubmission:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
    });
    throw error;
  }
}

/**
 * Submission 조회
 */
export async function getArapSubmissions(
  entityId?: string,
  fiscalYear?: number,
  fiscalMonth?: number
): Promise<ArapSubmissionWithDetails[]> {
  try {
    let query = supabase
      .from('arap_submissions')
      .select(`
        *,
        submission_details:arap_submission_details(*)
      `)
      .order('submission_date', { ascending: false });

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    if (fiscalYear) {
      query = query.eq('fiscal_year', fiscalYear);
    }
    if (fiscalMonth) {
      query = query.eq('fiscal_month', fiscalMonth);
    }

    const { data, error } = await query;

    if (error) {
      // 테이블이 없을 경우 빈 배열 반환
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('ARAP tables not found. Please run the schema migration first.');
        return [];
      }
      throw error;
    }

    // submission_details가 배열이 아닌 경우 처리
    const submissions = (data || []).map((sub: any) => ({
      ...sub,
      submission_details: Array.isArray(sub.submission_details) 
        ? sub.submission_details 
        : [],
    }));

    return submissions as ArapSubmissionWithDetails[];
  } catch (error: any) {
    console.error('Error fetching ARAP submissions:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    
    // 테이블이 없을 경우 빈 배열 반환
    if (error?.code === 'PGRST116' || error?.message?.includes('does not exist')) {
      return [];
    }
    
    throw error;
  }
}

/**
 * 매칭 상태 요약 조회
 */
export async function getMatchStatusSummary(
  fiscalYear: number,
  fiscalMonth: number
): Promise<MatchStatusSummary[]> {
  try {
    // 모든 Entity 조회
    const entities = await getArapEntities();
    const summaries: MatchStatusSummary[] = [];

    // 각 Entity 쌍에 대해 매칭 상태 계산
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];

        const summary = await calculateMatchStatus(
          entityA.id,
          entityB.id,
          fiscalYear,
          fiscalMonth
        );

        summaries.push({
          entity_a_id: entityA.id,
          entity_b_id: entityB.id,
          entity_a_name: entityA.entity_name,
          entity_b_name: entityB.entity_name,
          fiscal_year: fiscalYear,
          fiscal_month: fiscalMonth,
          ...summary,
        });
      }
    }

    return summaries;
  } catch (error: any) {
    console.error('Error in getMatchStatusSummary:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    
    // 테이블이 없을 경우 빈 배열 반환
    if (error?.code === 'PGRST116' || error?.message?.includes('does not exist')) {
      return [];
    }
    
    throw error;
  }
}

/**
 * 월별 상태 조회
 */
export async function getMonthlyStatus(
  fiscalYear: number
): Promise<MonthlyStatus[]> {
  try {
    const entities = await getArapEntities();
    const statuses: MonthlyStatus[] = [];

    for (const entity of entities) {
      for (let month = 1; month <= 12; month++) {
        try {
          const { data: submissions, error } = await supabase
            .from('arap_submissions')
            .select('id')
            .eq('entity_id', entity.id)
            .eq('fiscal_year', fiscalYear)
            .eq('fiscal_month', month);

          // 테이블이 없을 경우 빈 상태로 처리
          if (error) {
            const errorCode = error.code || '';
            const errorMessage = error.message || String(error);
            
            if (
              errorCode === 'PGRST116' || 
              errorCode === '42P01' ||
              errorMessage.includes('does not exist') ||
              errorMessage.includes('relation')
            ) {
              // 테이블이 없으면 no_data 상태로 추가
              statuses.push({
                entity_id: entity.id,
                entity_name: entity.entity_name,
                fiscal_year: fiscalYear,
                fiscal_month: month,
                status: 'no_data',
                submission_count: 0,
              });
              continue;
            }
            
            // 다른 에러는 로깅하고 no_data로 처리
            console.warn(`Error fetching submission for ${entity.entity_name} ${fiscalYear}-${month}:`, {
              message: errorMessage,
              code: errorCode,
              details: error.details,
              hint: error.hint,
            });
            
            statuses.push({
              entity_id: entity.id,
              entity_name: entity.entity_name,
              fiscal_year: fiscalYear,
              fiscal_month: month,
              status: 'no_data',
              submission_count: 0,
            });
            continue;
          }

          const submissionCount = submissions?.length || 0;
          
          // 제출하지 않았으면 미제출
          if (submissionCount === 0) {
            statuses.push({
              entity_id: entity.id,
              entity_name: entity.entity_name,
              fiscal_year: fiscalYear,
              fiscal_month: month,
              status: 'no_data',
              submission_count: 0,
            });
            continue;
          }
          
          // 실시간으로 매칭 상태 계산 (실제로 거래가 있는 상대방만 확인)
          let status: MatchStatus = 'no_data';
          
          // 이 Entity가 제출한 데이터에서 실제 거래 상대방 목록 추출
          const { data: submissionDetails, error: detailsError } = await supabase
            .from('arap_submission_details')
            .select('counterparty_entity_id')
            .in('submission_id', (submissions || []).map((s: any) => s.id));
          
          if (detailsError) {
            console.warn(`Error fetching submission details for ${entity.entity_name}:`, detailsError);
            // 에러가 나도 pending으로 처리
            status = 'pending';
          } else {
            // 실제 거래가 있는 상대방 Entity ID 목록 (중복 제거)
            const counterpartyIds = Array.from(
              new Set((submissionDetails || []).map((d: any) => d.counterparty_entity_id))
            );
            
            if (counterpartyIds.length === 0) {
              // 거래 상대방이 없으면 pending
              status = 'pending';
            } else {
              // 실제 거래가 있는 상대방과의 매칭 상태만 확인
              const matchStatuses: MatchStatus[] = [];
              
              for (const counterpartyId of counterpartyIds) {
                try {
                  const matchSummary = await calculateMatchStatus(
                    entity.id,
                    counterpartyId,
                    fiscalYear,
                    month
                  );
                  matchStatuses.push(matchSummary.status);
                } catch (matchError) {
                  // 개별 매칭 계산 실패는 무시하고 계속 진행
                  console.warn(`Failed to calculate match status for ${entity.entity_name} vs counterparty ${counterpartyId}:`, matchError);
                }
              }
              
              // 상태 결정: 실제 거래 상대방 모두와의 매칭 상태를 종합
              // - 모든 거래 상대방과 matched면 matched
              // - 하나라도 mismatched면 mismatched
              // - 그 외는 pending
              if (matchStatuses.length === 0) {
                status = 'pending';
              } else if (matchStatuses.every(s => s === 'matched')) {
                status = 'matched';
              } else if (matchStatuses.some(s => s === 'mismatched')) {
                status = 'mismatched';
              } else {
                status = 'pending';
              }
            }
          }

          statuses.push({
            entity_id: entity.id,
            entity_name: entity.entity_name,
            fiscal_year: fiscalYear,
            fiscal_month: month,
            status,
            submission_count: submissionCount,
          });
        } catch (monthError: any) {
          // 개별 월 조회 에러는 로깅하고 계속 진행
          console.warn(`Error processing month ${month} for ${entity.entity_name}:`, {
            message: monthError?.message || String(monthError),
            code: monthError?.code,
          });
          
          statuses.push({
            entity_id: entity.id,
            entity_name: entity.entity_name,
            fiscal_year: fiscalYear,
            fiscal_month: month,
            status: 'no_data',
            submission_count: 0,
          });
        }
      }
    }

    return statuses;
  } catch (error: any) {
    // 에러 객체를 더 안전하게 직렬화
    const errorInfo = {
      message: error?.message || String(error),
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      name: error?.name,
      stack: error?.stack,
    };
    
    console.error('Error in getMonthlyStatus:', errorInfo);
    console.error('Full error object:', error);
    
    // 테이블이 없을 경우 빈 배열 반환 (에러를 throw하지 않음)
    const errorMessage = errorInfo.message || '';
    const errorCode = errorInfo.code || '';
    
    if (
      errorCode === 'PGRST116' || 
      errorCode === '42P01' ||
      errorMessage.includes('does not exist') ||
      errorMessage.includes('relation')
    ) {
      console.warn('ARAP tables not found. Returning empty array.');
      return [];
    }
    
    // 다른 에러도 빈 배열 반환 (애플리케이션이 크래시되지 않도록)
    console.warn('Error in getMonthlyStatus, returning empty array:', errorInfo);
    return [];
  }
}

/**
 * Entity 매칭 매트릭스 조회
 */
export async function getEntityMatchMatrix(
  fiscalYear: number,
  fiscalMonth: number
): Promise<EntityMatchMatrix[]> {
  try {
    const entities = await getArapEntities();
    const matrix: EntityMatchMatrix[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = 0; j < entities.length; j++) {
        if (i === j) continue;

        const entityA = entities[i];
        const entityB = entities[j];

        const summary = await calculateMatchStatus(
          entityA.id,
          entityB.id,
          fiscalYear,
          fiscalMonth
        );

        matrix.push({
          entity_a_id: entityA.id,
          entity_a_name: entityA.entity_name,
          entity_b_id: entityB.id,
          entity_b_name: entityB.entity_name,
          status: summary.status,
        });
      }
    }

    return matrix;
  } catch (error: any) {
    console.error('Error in getEntityMatchMatrix:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    
    // 테이블이 없을 경우 빈 배열 반환
    if (error?.code === 'PGRST116' || error?.message?.includes('does not exist')) {
      return [];
    }
    
    throw error;
  }
}

/**
 * 매칭 상태 계산 (두 Entity 간)
 */
async function calculateMatchStatus(
  entityAId: string,
  entityBId: string,
  fiscalYear: number,
  fiscalMonth: number
): Promise<{
  status: MatchStatus;
  entity_a_ar: number;
  entity_a_ap: number;
  entity_b_ar: number;
  entity_b_ap: number;
  difference: number;
  currency_breakdown?: Array<{
    currency: string;
    entity_a_ar: number;
    entity_a_ap: number;
    entity_b_ar: number;
    entity_b_ap: number;
    status: MatchStatus;
    difference: number;
  }>;
}> {
  try {
    // Entity A가 Entity B에 대한 AR/AP 합계
    const { data: aSubmissions, error: aError } = await supabase
      .from('arap_submissions')
      .select(`
        id,
        submission_details:arap_submission_details(
          counterparty_entity_id,
          account_type,
          currency,
          amount
        )
      `)
      .eq('entity_id', entityAId)
      .eq('fiscal_year', fiscalYear)
      .eq('fiscal_month', fiscalMonth);

    // 테이블이 없을 경우 기본값 반환
    if (aError && (aError.code === 'PGRST116' || aError.message?.includes('does not exist'))) {
      return {
        status: 'no_data',
        entity_a_ar: 0,
        entity_a_ap: 0,
        entity_b_ar: 0,
        entity_b_ap: 0,
        difference: 0,
        currency_breakdown: [],
      };
    }

    if (aError) throw aError;

    // Entity B가 Entity A에 대한 AR/AP 합계
    const { data: bSubmissions, error: bError } = await supabase
      .from('arap_submissions')
      .select(`
        id,
        submission_details:arap_submission_details(
          counterparty_entity_id,
          account_type,
          currency,
          amount
        )
      `)
      .eq('entity_id', entityBId)
      .eq('fiscal_year', fiscalYear)
      .eq('fiscal_month', fiscalMonth);

    if (bError) throw bError;

    // 통화별로 합계 계산
    const aToBAr: Record<string, number> = {};
    const aToBAp: Record<string, number> = {};
    const bToAAr: Record<string, number> = {};
    const bToAAp: Record<string, number> = {};

    // Entity A → Entity B
    aSubmissions?.forEach((sub: any) => {
      const details = Array.isArray(sub.submission_details) 
        ? sub.submission_details 
        : sub.submission_details 
        ? [sub.submission_details] 
        : [];
      
      details.forEach((detail: any) => {
        if (detail && detail.counterparty_entity_id === entityBId) {
          const currency = detail.currency;
          const amount = Number(detail.amount) || 0;
          if (detail.account_type === 'AR') {
            aToBAr[currency] = (aToBAr[currency] || 0) + amount;
          } else if (detail.account_type === 'AP') {
            aToBAp[currency] = (aToBAp[currency] || 0) + amount;
          }
        }
      });
    });

    // Entity B → Entity A
    bSubmissions?.forEach((sub: any) => {
      const details = Array.isArray(sub.submission_details) 
        ? sub.submission_details 
        : sub.submission_details 
        ? [sub.submission_details] 
        : [];
      
      details.forEach((detail: any) => {
        if (detail && detail.counterparty_entity_id === entityAId) {
          const currency = detail.currency;
          const amount = Number(detail.amount) || 0;
          if (detail.account_type === 'AR') {
            bToAAr[currency] = (bToAAr[currency] || 0) + amount;
          } else if (detail.account_type === 'AP') {
            bToAAp[currency] = (bToAAp[currency] || 0) + amount;
          }
        }
      });
    });

    // 통화별 매칭 검증 및 상세 정보 생성
    let allMatched = true;
    let totalDifference = 0;
    const currencyBreakdown: Array<{
      currency: string;
      entity_a_ar: number;
      entity_a_ap: number;
      entity_b_ar: number;
      entity_b_ap: number;
      status: MatchStatus;
      difference: number;
    }> = [];

    const currencies = new Set([
      ...Object.keys(aToBAr),
      ...Object.keys(aToBAp),
      ...Object.keys(bToAAr),
      ...Object.keys(bToAAp),
    ]);

    currencies.forEach((currency) => {
      const aAr = aToBAr[currency] || 0;
      const aAp = aToBAp[currency] || 0;
      const bAr = bToAAr[currency] || 0;
      const bAp = bToAAp[currency] || 0;

      // A의 AR = B의 AP, A의 AP = B의 AR
      const arApDiff = Math.abs(aAr - bAp);
      const apArDiff = Math.abs(aAp - bAr);
      const currencyDiff = arApDiff + apArDiff;

      // 통화별 상태 결정
      let currencyStatus: MatchStatus = 'no_data';
      if (aAr === 0 && aAp === 0 && bAr === 0 && bAp === 0) {
        currencyStatus = 'no_data';
      } else if (arApDiff <= 0.01 && apArDiff <= 0.01) {
        currencyStatus = 'matched';
      } else {
        currencyStatus = 'mismatched';
        allMatched = false;
      }

      if (currencyDiff > 0.01) {
        totalDifference += currencyDiff;
      }

      currencyBreakdown.push({
        currency,
        entity_a_ar: aAr,
        entity_a_ap: aAp,
        entity_b_ar: bAr,
        entity_b_ap: bAp,
        status: currencyStatus,
        difference: currencyDiff,
      });
    });

    // 전체 합계 계산
    const entityAAr = Object.values(aToBAr).reduce((sum, val) => sum + val, 0);
    const entityAAp = Object.values(aToBAp).reduce((sum, val) => sum + val, 0);
    const entityBAr = Object.values(bToAAr).reduce((sum, val) => sum + val, 0);
    const entityBAp = Object.values(bToAAp).reduce((sum, val) => sum + val, 0);

    // 상태 결정
    let status: MatchStatus = 'no_data';
    if (entityAAr === 0 && entityAAp === 0 && entityBAr === 0 && entityBAp === 0) {
      status = 'no_data';
    } else if (allMatched) {
      status = 'matched';
    } else if (entityAAr > 0 || entityAAp > 0 || entityBAr > 0 || entityBAp > 0) {
      status = 'pending';
    }

    return {
      status,
      entity_a_ar: entityAAr,
      entity_a_ap: entityAAp,
      entity_b_ar: entityBAr,
      entity_b_ap: entityBAp,
      difference: totalDifference,
      currency_breakdown: currencyBreakdown,
    };
  } catch (error: any) {
    // 에러 객체를 더 안전하게 직렬화
    const errorInfo = {
      message: error?.message || String(error),
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      name: error?.name,
      stack: error?.stack,
    };
    
    console.error('Error in calculateMatchStatus:', errorInfo);
    console.error('Full error object:', error);
    
    // 테이블이 없을 경우 기본값 반환
    const errorMessage = errorInfo.message || '';
    const errorCode = errorInfo.code || '';
    
    if (
      errorCode === 'PGRST116' || 
      errorMessage.includes('does not exist') ||
      errorMessage.includes('relation') ||
      errorCode === '42P01'
    ) {
      console.warn('ARAP tables not found. Returning default values.');
      return {
        status: 'no_data',
        entity_a_ar: 0,
        entity_a_ap: 0,
        entity_b_ar: 0,
        entity_b_ap: 0,
        difference: 0,
        currency_breakdown: [],
      };
    }
    
    // 다른 에러는 기본값 반환 (에러를 throw하지 않음)
    console.warn('Error in calculateMatchStatus, returning default values:', errorInfo);
    return {
      status: 'no_data',
      entity_a_ar: 0,
      entity_a_ap: 0,
      entity_b_ar: 0,
      entity_b_ap: 0,
      difference: 0,
      currency_breakdown: [],
    };
  }
}

/**
 * 매칭 상태 재계산 (특정 연도/월)
 */
export async function recalculateMatchStatus(
  fiscalYear: number,
  fiscalMonth: number
): Promise<void> {
  try {
    const entities = await getArapEntities();
    console.log(`🔄 Recalculating match status for ${fiscalYear}-${fiscalMonth} (${entities.length} entities)`);

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];
        
        const summary = await calculateMatchStatus(
          entityA.id,
          entityB.id,
          fiscalYear,
          fiscalMonth
        );

        console.log(`  ${entityA.entity_name} ↔ ${entityB.entity_name}: ${summary.status}`);

        // 관련된 모든 submissions의 match_status 업데이트
        const { data: submissionsA, error: errorA } = await supabase
          .from('arap_submissions')
          .select('id')
          .eq('entity_id', entityA.id)
          .eq('fiscal_year', fiscalYear)
          .eq('fiscal_month', fiscalMonth);

        const { data: submissionsB, error: errorB } = await supabase
          .from('arap_submissions')
          .select('id')
          .eq('entity_id', entityB.id)
          .eq('fiscal_year', fiscalYear)
          .eq('fiscal_month', fiscalMonth);

        if (errorA || errorB) {
          console.warn(`⚠️ Error fetching submissions for ${entityA.entity_name} ↔ ${entityB.entity_name}:`, {
            errorA: errorA?.message,
            errorB: errorB?.message,
          });
          continue;
        }

        const allSubmissionIds = [
          ...(submissionsA || []).map((s) => s.id),
          ...(submissionsB || []).map((s) => s.id),
        ];

        if (allSubmissionIds.length > 0) {
          const { error: updateError } = await supabase
            .from('arap_submissions')
            .update({ match_status: summary.status })
            .in('id', allSubmissionIds);
          
          if (updateError) {
            console.warn(`⚠️ Error updating match_status for ${entityA.entity_name} ↔ ${entityB.entity_name}:`, updateError);
          } else {
            console.log(`  ✅ Updated ${allSubmissionIds.length} submissions to ${summary.status}`);
          }
        }
      }
    }
    
    console.log('✅ Match status recalculation completed');
  } catch (error: any) {
    console.error('❌ Error in recalculateMatchStatus:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack,
    });
    throw error;
  }
}

/**
 * 실제로 제출한 법인 ID 목록 조회
 */
export async function getSubmittedEntityIds(
  fiscalYear: number,
  fiscalMonth: number
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('arap_submissions')
      .select('entity_id')
      .eq('fiscal_year', fiscalYear)
      .eq('fiscal_month', fiscalMonth);

    if (error) {
      // 테이블이 없을 경우 빈 배열 반환
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return [];
      }
      throw error;
    }

    // 중복 제거하여 고유한 entity_id만 반환
    const uniqueEntityIds = Array.from(new Set((data || []).map((s: any) => s.entity_id)));
    return uniqueEntityIds;
  } catch (error: any) {
    console.error('Error fetching submitted entity IDs:', {
      message: error?.message,
      code: error?.code,
    });
    
    if (error?.code === 'PGRST116' || error?.message?.includes('does not exist')) {
      return [];
    }
    
    throw error;
  }
}

/**
 * 파일 다운로드 URL 생성
 */
export async function getSubmissionFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('arap-submissions')
    .createSignedUrl(filePath, 3600); // 1시간 유효

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Submission 삭제
 */
export async function deleteArapSubmission(submissionId: string): Promise<void> {
  // 파일 삭제
  const { data: submission } = await supabase
    .from('arap_submissions')
    .select('file_path')
    .eq('id', submissionId)
    .single();

  if (submission?.file_path) {
    await supabase.storage
      .from('arap-submissions')
      .remove([submission.file_path]);
  }

  // Submission 삭제 (CASCADE로 details도 함께 삭제됨)
  const { error } = await supabase
    .from('arap_submissions')
    .delete()
    .eq('id', submissionId);

  if (error) throw error;
}
