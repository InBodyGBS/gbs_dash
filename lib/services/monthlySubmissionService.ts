/**
 * Monthly Closing - 제출(Submission) 서비스
 * - 파일은 Storage('submission' bucket) 경로로 업로드
 * - 메타데이터는 monthly_submissions 테이블에 저장
 * - Overview에서 사용하는 Reviewing/Confirm 플래그는 monthly_review_statuses 테이블에 저장
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import type { MonthlyClosingCategoryId } from '@/lib/constants/monthly-closing-categories';
import type {
  MonthlyReviewStatus,
  MonthlySubmission,
  MonthlySubmissionFormData,
} from '@/lib/types/monthly-closing-submissions';

const BUCKET_NAME = 'monthly-submission';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function createMonthlySubmission(formData: MonthlySubmissionFormData) {
  try {
    const { file, category, periodYear, periodMonth, subsidiaryId } = formData;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !['xls', 'xlsx'].includes(fileExt)) {
      throw new Error('Excel 파일만 업로드 가능합니다 (.xls, .xlsx)');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 같은 기간/법인/카테고리 내 최신 버전 조회
    const { data: existingSubmissions } = await supabase
      .from('monthly_submissions')
      .select('version')
      .eq('category', category)
      .eq('subsidiary_id', subsidiaryId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion =
      existingSubmissions && existingSubmissions.length > 0 ? existingSubmissions[0].version + 1 : 1;

    // Storage 파일 경로
    const filePath = `monthly-closing/${periodYear}/${periodMonth}/${subsidiaryId}/${category}/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
    if (uploadError) {
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

    const { data, error: dbError } = await supabase
      .from('monthly_submissions')
      .insert({
        period_year: periodYear,
        period_month: periodMonth,
        subsidiary_id: subsidiaryId,
        category,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        version: nextVersion,
        submitted_by: user?.id || null,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      // 업로드 실패 롤백 시도
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);

      if (
        dbError.code === '42P01' ||
        dbError.message?.includes('does not exist') ||
        dbError.message?.includes('relation') ||
        dbError.message?.includes('table')
      ) {
        throw new Error(
          `'monthly_submissions' 테이블이 존재하지 않습니다. docs/monthly-closing-submission-schema.sql 를 실행하여 테이블을 생성하세요.`
        );
      }

      throw new Error(`데이터베이스 저장 실패: ${dbError.message}`);
    }

    return data as MonthlySubmission;
  } catch (error) {
    console.error('Error creating monthly submission:', error);
    throw error;
  }
}

export async function getMonthlySubmissions(
  periodYear: number,
  periodMonth: number,
  category?: MonthlyClosingCategoryId | null,
  subsidiaryId?: string | null
): Promise<MonthlySubmission[]> {
  try {
    let query = supabase
      .from('monthly_submissions')
      .select('*')
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .order('submitted_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (subsidiaryId) query = query.eq('subsidiary_id', subsidiaryId);

    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return [];
      }
      throw new Error(`제출 목록 조회 실패: ${error.message}`);
    }

    return (data || []) as MonthlySubmission[];
  } catch (error) {
    console.error('Error getting monthly submissions:', error);
    throw error;
  }
}

export async function getMonthlySubmissionUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(filePath, 3600);
  if (error) {
    throw new Error(`파일 URL 생성 실패: ${error.message || '알 수 없는 오류'}`);
  }
  if (!data?.signedUrl) throw new Error('파일 URL 생성 실패: signedUrl이 없습니다.');
  return data.signedUrl;
}

export async function deleteMonthlySubmission(id: string, filePath: string): Promise<void> {
  try {
    const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    if (storageError) {
      // 이미 삭제됐을 수 있으니 무시
      console.warn('Storage delete failed (ignored):', storageError.message);
    }

    const { error: dbError } = await supabase.from('monthly_submissions').delete().eq('id', id);
    if (dbError) throw new Error(`제출 삭제 실패: ${dbError.message}`);
  } catch (error) {
    console.error('Error deleting monthly submission:', error);
    throw error;
  }
}

export async function getMonthlyReviewStatuses(
  periodYear: number,
  periodMonth: number
): Promise<MonthlyReviewStatus[]> {
  try {
    const { data, error } = await supabase
      .from('monthly_review_statuses')
      .select('*')
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth);

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return [];
      }
      throw new Error(`Review 상태 조회 실패: ${error.message}`);
    }

    return (data || []) as MonthlyReviewStatus[];
  } catch (error) {
    console.error('Error getting monthly review statuses:', error);
    throw error;
  }
}

export async function upsertMonthlyReviewStatus(
  subsidiaryId: string,
  periodYear: number,
  periodMonth: number,
  patch: { reviewing: boolean; confirm: boolean }
): Promise<MonthlyReviewStatus> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const upsertPayload: Omit<MonthlyReviewStatus, 'id' | 'created_at' | 'updated_at'> & { updated_by: string | null } = {
    period_year: periodYear,
    period_month: periodMonth,
    subsidiary_id: subsidiaryId,
    reviewing: patch.reviewing,
    confirm: patch.confirm,
    // DB에 트리거/컬럼이 있다면 감사/정합성에 사용
    updated_by: user?.id || null,
  };

  const { data, error } = await supabase.from('monthly_review_statuses').upsert(
    upsertPayload,
    { onConflict: 'subsidiary_id,period_year,period_month' }
  ).select().single();

  if (error) {
    throw new Error(`Review 상태 저장 실패: ${error.message}`);
  }

  return data as MonthlyReviewStatus;
}

