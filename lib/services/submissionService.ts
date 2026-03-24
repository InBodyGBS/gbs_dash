/**
 * Submission 서비스
 * Supabase Storage 및 DB 작업
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import type { Submission, SubmissionComment, SubmissionFormData } from '@/lib/types/submission';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';

type SubmissionVersionRow = { version?: number };
type SubmissionCommentRow = {
  id: string;
  submission_id: string;
  message: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  edited?: boolean | null;
};
type UserProfileLite = { id: string; name?: string | null; email?: string | null };

/**
 * 서버사이드 API를 통한 파일 제출
 * schedule_items 자동 확정 포함
 */
export async function createSubmissionViaApi(
  formData: SubmissionFormData
): Promise<Submission> {
  const body = new FormData();
  body.append('file', formData.file);
  body.append('category', formData.category);
  if (formData.quarter_id) body.append('quarter_id', formData.quarter_id);
  if (formData.subsidiary_id) body.append('subsidiary_id', formData.subsidiary_id);
  if (formData.fiscal_year) body.append('fiscal_year', formData.fiscal_year);
  if (formData.entity_name) body.append('entity_name', formData.entity_name);

  // 인증 토큰 전달
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const err = await response.json() as { error?: string };
    throw new Error(err.error ?? '제출 실패');
  }

  const { submission } = await response.json() as { submission: Submission };
  return submission;
}

const BUCKET_NAME = 'submission';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 파일 업로드 및 제출 생성
 */
export async function createSubmission(
  formData: SubmissionFormData
): Promise<Submission> {
  try {
    const { file, category, quarter_id, subsidiary_id, fiscal_year, entity_name } = formData;

    // 파일 형식 검증
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'xls' && fileExt !== 'xlsx') {
      throw new Error('Excel 파일만 업로드 가능합니다 (.xls, .xlsx)');
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.`);
    }

    // 사용자 정보 가져오기
    const { data: { user } } = await supabase.auth.getUser();

    // 같은 카테고리의 최신 버전 조회
    const { data: existingSubmissions } = await supabase
      .from('submissions')
      .select('version')
      .eq('category', category)
      .order('version', { ascending: false })
      .limit(1);

    const latestSubmission = existingSubmissions?.[0] as unknown as SubmissionVersionRow | undefined;
    const nextVersion = typeof latestSubmission?.version === 'number' ? latestSubmission.version + 1 : 1;

    // 파일 경로 생성
    const filePath = `${category}/${uuidv4()}.${fileExt}`;

    // Storage 업로드
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload Error Details:', uploadError);
      // 버킷이 없는 경우
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error(
          `Storage 버킷 '${BUCKET_NAME}'이 존재하지 않습니다. Supabase Storage에서 '${BUCKET_NAME}' 버킷을 생성해주세요.`
        );
      }
      // RLS 정책 위반
      if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy')) {
        throw new Error(
          `Storage 업로드 권한이 없습니다. Supabase Storage의 '${BUCKET_NAME}' 버킷에 업로드 정책을 설정해주세요. ` +
          `Storage > ${BUCKET_NAME} > Policies에서 'Allow public uploads' 또는 적절한 RLS 정책을 추가해주세요.`
        );
      }
      throw new Error(`파일 업로드 실패: ${uploadError.message || '알 수 없는 오류'}`);
    }

    // quarter_id가 임시 ID인 경우 NULL로 변환 (UUID 형식이 아니므로)
    const finalQuarterId = quarter_id && !quarter_id.startsWith('temp-') && !quarter_id.startsWith('custom-')
      ? quarter_id
      : null;

    // DB에 메타데이터 저장
    const { data, error: dbError } = await supabase
      .from('submissions')
      .insert({
        quarter_id: finalQuarterId,
        subsidiary_id: subsidiary_id || null,
        fiscal_year: fiscal_year || null,
        entity_name: entity_name || null,
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
      // 모든 에러 속성 출력
      console.error('DB Error Details:', JSON.stringify(dbError, null, 2));
      console.error('DB Error Object:', dbError);
      console.error('DB Error Keys:', Object.keys(dbError));
      console.error('DB Error Message:', dbError.message);
      console.error('DB Error Code:', dbError.code);
      console.error('DB Error Details:', dbError.details);
      console.error('DB Error Hint:', dbError.hint);
      
      // 업로드 실패 시 Storage에서 파일 삭제
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      
      // 테이블이 없는 경우
      if (dbError.code === '42P01' || dbError.message?.includes('does not exist') || dbError.message?.includes('relation') || dbError.message?.includes('table')) {
        throw new Error(
          `'submissions' 테이블이 존재하지 않습니다. Supabase SQL Editor에서 docs/submission-schema.sql을 실행하여 테이블을 생성하세요.`
        );
      }
      
      // RLS 정책 위반
      if (dbError.code === '42501' || dbError.message?.includes('permission denied') || dbError.message?.includes('policy')) {
        throw new Error(
          `데이터베이스 권한이 없습니다. 'submissions' 테이블의 RLS 정책을 확인하세요. docs/submission-schema.sql의 RLS 정책 부분을 실행했는지 확인하세요.`
        );
      }
      
      // 더 자세한 에러 메시지 제공
      const errorMessage = dbError.message || '알 수 없는 오류';
      const errorCode = dbError.code ? ` (코드: ${dbError.code})` : '';
      const errorHint = dbError.hint ? `\n힌트: ${dbError.hint}` : '';
      const errorDetails = dbError.details ? `\n상세: ${dbError.details}` : '';
      
      throw new Error(`데이터베이스 저장 실패: ${errorMessage}${errorCode}${errorHint}${errorDetails}`);
    }

    return data as unknown as Submission;
  } catch (error) {
    console.error('Error creating submission:', error);
    throw error;
  }
}

/**
 * 모든 제출 조회
 */
export async function getSubmissions(
  category?: ClosingCategoryId,
  quarterId?: string | null,
  subsidiaryId?: string | null
): Promise<Submission[]> {
  try {
    let query = supabase
      .from('submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }
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
        console.warn('submissions 테이블이 존재하지 않습니다.');
        return [];
      }
      throw new Error(`제출 목록 조회 실패: ${error.message}`);
    }

    return (data || []).map((item) => ({
      id: item.id,
      quarter_id: item.quarter_id,
      subsidiary_id: item.subsidiary_id,
      category: item.category,
      file_name: item.file_name,
      file_path: item.file_path,
      file_size: item.file_size,
      version: item.version,
      submitted_by: item.submitted_by,
      submitted_at: item.submitted_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })) as unknown as Submission[];
  } catch (error) {
    console.error('Error getting submissions:', error);
    throw error;
  }
}

/**
 * 제출 파일 다운로드 URL 가져오기
 */
export async function getSubmissionUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600); // 1시간 유효

  if (error) {
    console.error('Signed URL 생성 오류:', error);
    if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
      throw new Error(
        `Storage 버킷 '${BUCKET_NAME}'이 존재하지 않습니다. Supabase Storage에서 '${BUCKET_NAME}' 버킷을 생성해주세요.`
      );
    }
    throw new Error(`파일 URL 생성 실패: ${error.message || '알 수 없는 오류'}`);
  }

  if (!data || !data.signedUrl) {
    throw new Error('파일 URL 생성 실패: 데이터가 없습니다.');
  }

  return data.signedUrl;
}

/**
 * 제출 삭제
 */
export async function deleteSubmission(id: string, filePath: string): Promise<void> {
  try {
    // Storage에서 파일 삭제
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (storageError) {
      console.error('Storage 삭제 오류:', storageError);
      // 버킷이 없는 경우는 무시 (이미 삭제되었거나 존재하지 않음)
      if (!storageError.message?.includes('Bucket not found') && !storageError.message?.includes('not found')) {
        console.warn('Storage 파일 삭제 실패:', storageError);
      }
      // Storage 삭제 실패해도 DB 삭제는 진행
    }

    // DB에서 레코드 삭제
    const { error: dbError } = await supabase
      .from('submissions')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw new Error(`제출 삭제 실패: ${dbError.message}`);
    }
  } catch (error) {
    console.error('Error deleting submission:', error);
    throw error;
  }
}

/**
 * 제출에 댓글 추가
 */
export async function createSubmissionComment(
  submissionId: string,
  message: string
): Promise<SubmissionComment> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('submission_comments')
      .insert({
        submission_id: submissionId,
        message: message.trim(),
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        throw new Error('submission_comments 테이블이 존재하지 않습니다. docs/submission-schema.sql을 실행하여 테이블을 생성하세요.');
      }
      throw new Error(`댓글 작성 실패: ${error.message}`);
    }

    const created = data as unknown as SubmissionCommentRow;
    return {
      id: created.id,
      submission_id: created.submission_id,
      message: created.message,
      created_by: created.created_by,
      created_at: created.created_at,
      updated_at: created.updated_at,
      edited: created.edited || false,
    };
  } catch (error) {
    console.error('Error creating submission comment:', error);
    throw error;
  }
}

/**
 * 제출의 댓글 목록 조회 (사용자 정보 포함)
 */
export async function getSubmissionComments(
  submissionId: string
): Promise<SubmissionComment[]> {
  try {
    const { data, error } = await supabase
      .from('submission_comments')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('submission_comments 테이블이 존재하지 않습니다.');
        return [];
      }
      throw new Error(`댓글 조회 실패: ${error.message}`);
    }

    // 사용자 정보 가져오기
    const userIds = (data || [])
      .map((item) => item.created_by)
      .filter((id): id is string => id !== null && id !== undefined);

    const userMap = new Map<string, { name: string | null; email: string | null }>();

    if (userIds.length > 0) {
      try {
        // user_profiles 테이블에서 사용자 정보 가져오기
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, name, email')
          .in('id', userIds);

        if (!profileError && profiles) {
          (profiles as unknown as UserProfileLite[]).forEach((profile) => {
            userMap.set(profile.id, {
              name: profile.name || null,
              email: profile.email || null,
            });
          });
        } else if (profileError) {
          // 테이블이 없거나 RLS 정책 문제인 경우 무시 (ID만 표시)
          console.warn('사용자 프로필 조회 실패 (무시):', profileError.message);
        }
      } catch (error) {
        // user_profiles 테이블이 없는 경우 무시
        console.warn('사용자 프로필 조회 중 오류 (무시):', error);
      }
    }

    return ((data || []) as unknown as SubmissionCommentRow[]).map((item) => {
      const userInfo = item.created_by ? userMap.get(item.created_by) : null;
      
      return {
        id: item.id,
        submission_id: item.submission_id,
        message: item.message,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
        edited: Boolean(item.edited),
        user_name: userInfo?.name || null,
        user_email: userInfo?.email || null,
      };
    });
  } catch (error) {
    console.error('Error getting submission comments:', error);
    throw error;
  }
}

/**
 * 댓글 수정
 */
export async function updateSubmissionComment(
  commentId: string,
  message: string
): Promise<SubmissionComment> {
  try {
    const { data, error } = await supabase
      .from('submission_comments')
      .update({
        message: message.trim(),
        edited: true,
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      throw new Error(`댓글 수정 실패: ${error.message}`);
    }

    const updated = data as unknown as SubmissionCommentRow;
    return {
      id: updated.id,
      submission_id: updated.submission_id,
      message: updated.message,
      created_by: updated.created_by,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      edited: updated.edited || false,
    };
  } catch (error) {
    console.error('Error updating submission comment:', error);
    throw error;
  }
}

/**
 * 댓글 삭제
 */
export async function deleteSubmissionComment(commentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('submission_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      throw new Error(`댓글 삭제 실패: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting submission comment:', error);
    throw error;
  }
}
