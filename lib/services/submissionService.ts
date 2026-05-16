/**
 * Submission 서비스
 * Supabase Storage 및 DB 작업
 */

import { v4 as uuidv4 } from 'uuid';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { getCategoryById } from '@/lib/constants/closing-categories';
import { displayNameFromAuthUser } from '@/lib/utils/authDisplayName';
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
  /** 작성 시 스냅샷 표시명 (마이그레이션 docs/submission-comments-author-name.sql) */
  author_name?: string | null;
};
type UserProfileLite = { id: string; name?: string | null; email?: string | null };

function resolveSubmissionCommentUserFields(
  item: SubmissionCommentRow,
  userMap: Map<string, { name: string | null; email: string | null }>,
  sessionUserId: string | null,
  sessionUser: User | null,
): { user_name: string | null; user_email: string | null } {
  const uid = item.created_by;
  const prof = uid ? userMap.get(uid) : null;
  const snapshot = item.author_name?.trim() || null;
  const isSelf = Boolean(uid && sessionUserId && uid === sessionUserId);

  const user_name =
    snapshot ||
    (prof?.name && String(prof.name).trim()) ||
    (isSelf ? displayNameFromAuthUser(sessionUser) : null) ||
    null;

  const user_email = prof?.email || (isSelf ? sessionUser?.email ?? null : null) || null;

  return { user_name, user_email };
}

/**
 * 서버사이드 API를 통한 파일 제출
 * 1) /api/submission-upload-url 에서 서명된 업로드 URL 발급 (service_role로 RLS 우회)
 * 2) 서명된 URL로 Supabase Storage에 직접 업로드 (Vercel 413 방지)
 * 3) /api/submissions 에는 JSON 메타데이터만 전송
 */
export async function createSubmissionViaApi(
  formData: SubmissionFormData
): Promise<Submission> {
  const { file, category } = formData;

  // 파일 확장자 검증
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  if (fileExt !== 'xls' && fileExt !== 'xlsx') {
    throw new Error('Excel 파일만 업로드 가능합니다 (.xls, .xlsx)');
  }

  // 인증 토큰
  const { data: { session } } = await supabase.auth.getSession();
  const authHeaders: HeadersInit = {};
  if (session?.access_token) {
    authHeaders['Authorization'] = `Bearer ${session.access_token}`;
  }

  // 1) 서명된 업로드 URL 발급
  const urlRes = await fetch('/api/submission-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ category, file_ext: fileExt }),
  });

  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? '업로드 URL 발급 실패');
  }

  const { file_path: filePath, token: uploadToken } = await urlRes.json() as {
    file_path: string;
    signed_url: string;
    token: string;
  };

  // 2) 서명된 URL로 Supabase Storage에 직접 업로드
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .uploadToSignedUrl(filePath, uploadToken, file, {
      contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

  if (uploadError) {
    throw new Error(`파일 업로드 실패: ${uploadError.message || '알 수 없는 오류'}`);
  }

  // 3) /api/submissions 에 JSON 메타데이터만 전송
  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      category,
      quarter_id: formData.quarter_id || null,
      subsidiary_id: formData.subsidiary_id || null,
      fiscal_year: formData.fiscal_year || null,
      entity_name: formData.entity_name || null,
      closing_month: formData.closing_month ?? null,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  });

  if (!response.ok) {
    // API 실패 시 이미 업로드된 파일 정리
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    const err = await response.json().catch(() => ({})) as { error?: string };
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
  subsidiaryId?: string | null,
  fiscalYear?: string | null,
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
    } else if (fiscalYear) {
      // quarter_id가 없을 수 있는 레거시 데이터는 fiscal_year로 보조 필터링
      query = query.eq('fiscal_year', fiscalYear);
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

    const rows = (data || []) as Array<Record<string, unknown>>;

    // 레거시(quarter_id NULL) 데이터가 있는 경우를 위해 보조 조회:
    // 1차 결과가 0이고 quarterId가 존재하며 fiscalYear가 있으면, 동일 조건에서 quarter_id IS NULL + fiscal_year로 재조회
    if (
      rows.length === 0 &&
      quarterId &&
      !quarterId.startsWith('temp-') &&
      !quarterId.startsWith('custom-') &&
      fiscalYear
    ) {
      let legacyQuery = supabase
        .from('submissions')
        .select('*')
        .order('submitted_at', { ascending: false })
        .eq('fiscal_year', fiscalYear)
        .is('quarter_id', null);

      if (category) legacyQuery = legacyQuery.eq('category', category);
      if (subsidiaryId) legacyQuery = legacyQuery.eq('subsidiary_id', subsidiaryId);

      const { data: legacyData, error: legacyErr } = await legacyQuery;
      if (!legacyErr && legacyData) {
        return (legacyData as any[]).map((item) => ({
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
      }
    }

    return rows.map((item) => ({
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
    // service-role API로 삭제 (RLS/권한 문제로 UI에 남는 현상 방지)
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {};
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const res = await fetch(`/api/submissions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? `제출 삭제 실패 (${res.status})`);
    }
  } catch (error) {
    console.error('Error deleting submission:', error);
    throw error;
  }
}

/**
 * 제출에 메모 추가
 */
export async function createSubmissionComment(
  submissionId: string,
  message: string
): Promise<SubmissionComment> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? (await supabase.auth.getUser()).data.user ?? null;
    const authorSnapshot = displayNameFromAuthUser(user);

    const baseInsert = {
      submission_id: submissionId,
      message: message.trim(),
      created_by: user?.id || null,
    };

    let data: unknown;
    let error: { message?: string; code?: string } | null = null;

    if (authorSnapshot) {
      const attempt = await supabase
        .from('submission_comments')
        .insert({ ...baseInsert, author_name: authorSnapshot })
        .select()
        .single();
      const msg = attempt.error?.message ?? '';
      const missingAuthorColumn =
        attempt.error &&
        (msg.includes('author_name') || msg.includes('schema cache') || attempt.error.code === '42703');
      if (missingAuthorColumn) {
        const retry = await supabase.from('submission_comments').insert(baseInsert).select().single();
        data = retry.data;
        error = retry.error;
      } else {
        data = attempt.data;
        error = attempt.error;
      }
    } else {
      const attempt = await supabase.from('submission_comments').insert(baseInsert).select().single();
      data = attempt.data;
      error = attempt.error;
    }

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        throw new Error('submission_comments 테이블이 존재하지 않습니다. docs/submission-schema.sql을 실행하여 테이블을 생성하세요.');
      }
      throw new Error(`메모 작성 실패: ${error.message}`);
    }

    const created = data as unknown as SubmissionCommentRow;

    const userMap = new Map<string, { name: string | null; email: string | null }>();
    if (user?.id) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .eq('id', user.id)
        .maybeSingle();
      const p = prof as UserProfileLite | null;
      if (p) {
        userMap.set(p.id, { name: p.name ?? null, email: p.email ?? null });
      }
    }

    const { user_name, user_email } = resolveSubmissionCommentUserFields(
      created,
      userMap,
      user?.id ?? null,
      user,
    );

    return {
      id: created.id,
      submission_id: created.submission_id,
      message: created.message,
      created_by: created.created_by,
      created_at: created.created_at,
      updated_at: created.updated_at,
      edited: created.edited || false,
      user_name,
      user_email,
    };
  } catch (error) {
    console.error('Error creating submission comment:', error);
    throw error;
  }
}

/**
 * 제출의 메모 목록 조회 (사용자 정보 포함)
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
      throw new Error(`메모 조회 실패: ${error.message}`);
    }

    const { data: { session } } = await supabase.auth.getSession();
    const sessionUser = session?.user ?? null;
    const sessionUserId = sessionUser?.id ?? null;

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
      } catch (err) {
        // user_profiles 테이블이 없는 경우 무시
        console.warn('사용자 프로필 조회 중 오류 (무시):', err);
      }
    }

    return ((data || []) as unknown as SubmissionCommentRow[]).map((item) => {
      const { user_name, user_email } = resolveSubmissionCommentUserFields(
        item,
        userMap,
        sessionUserId,
        sessionUser,
      );

      return {
        id: item.id,
        submission_id: item.submission_id,
        message: item.message,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
        edited: Boolean(item.edited),
        user_name,
        user_email,
      };
    });
  } catch (error) {
    console.error('Error getting submission comments:', error);
    throw error;
  }
}

/**
 * 메모 수정
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
      throw new Error(`메모 수정 실패: ${error.message}`);
    }

    const updated = data as unknown as SubmissionCommentRow;

    const { data: { session } } = await supabase.auth.getSession();
    const sessionUser = session?.user ?? null;
    const sessionUserId = sessionUser?.id ?? null;

    const userMap = new Map<string, { name: string | null; email: string | null }>();
    if (updated.created_by) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .eq('id', updated.created_by)
        .maybeSingle();
      const p = prof as UserProfileLite | null;
      if (p) {
        userMap.set(p.id, { name: p.name ?? null, email: p.email ?? null });
      }
    }

    const { user_name, user_email } = resolveSubmissionCommentUserFields(
      updated,
      userMap,
      sessionUserId,
      sessionUser,
    );

    return {
      id: updated.id,
      submission_id: updated.submission_id,
      message: updated.message,
      created_by: updated.created_by,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      edited: updated.edited || false,
      user_name,
      user_email,
    };
  } catch (error) {
    console.error('Error updating submission comment:', error);
    throw error;
  }
}

/**
 * 메모 삭제
 */
export async function deleteSubmissionComment(commentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('submission_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      throw new Error(`메모 삭제 실패: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting submission comment:', error);
    throw error;
  }
}

/** 엑셀 내보내기용 행 (상단 필터: 귀속연도·캘린더 월·분기·법인 범위 내 모든 카테고리 메모) */
export interface SubmissionCommentExportRow {
  entity: string;
  year: string;
  month: number;
  category_id: string;
  category_label: string;
  comment: string;
  created_at: string;
  author: string;
  file_name: string;
}

const COMMENT_IN_CHUNK = 120;

/**
 * 화면 상단 Year/Month/Entity/Quarter 필터와 동일한 범위의 제출에 달린 메모를 모읍니다.
 * `month` 열에는 선택한 캘린더 월(1–12)을 넣습니다.
 */
export async function fetchSubmissionCommentsForExcelExport(params: {
  fiscalYear: string;
  calendarMonth: number;
  quarterId: string | null;
  subsidiaryId: string | null;
  entityNameBySubsidiaryId: Map<string, string>;
}): Promise<SubmissionCommentExportRow[]> {
  let query = supabase
    .from('submissions')
    .select('id, fiscal_year, quarter_id, subsidiary_id, entity_name, category, file_name')
    .eq('fiscal_year', params.fiscalYear);

  const qid = params.quarterId;
  if (qid && !qid.startsWith('temp-') && !qid.startsWith('custom-')) {
    query = query.eq('quarter_id', qid);
  }
  if (params.subsidiaryId) {
    query = query.eq('subsidiary_id', params.subsidiaryId);
  }

  const { data: subs, error: subErr } = await query;
  if (subErr) {
    throw new Error(`제출 조회 실패: ${subErr.message}`);
  }
  const subRows = subs || [];
  if (subRows.length === 0) return [];

  type SubRow = {
    id: string;
    fiscal_year: string | null;
    quarter_id: string | null;
    subsidiary_id: string | null;
    entity_name: string | null;
    category: string;
    file_name: string;
  };

  const submissionIds = subRows.map((r) => String((r as SubRow).id));
  const subById = new Map(subRows.map((r) => [String((r as SubRow).id), r as SubRow]));

  const commentRows: SubmissionCommentRow[] = [];
  for (let i = 0; i < submissionIds.length; i += COMMENT_IN_CHUNK) {
    const chunk = submissionIds.slice(i, i + COMMENT_IN_CHUNK);
    const { data: comments, error: cErr } = await supabase
      .from('submission_comments')
      .select('*')
      .in('submission_id', chunk)
      .order('created_at', { ascending: true });
    if (cErr) {
      throw new Error(`메모 조회 실패: ${cErr.message}`);
    }
    commentRows.push(...((comments || []) as unknown as SubmissionCommentRow[]));
  }

  commentRows.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (commentRows.length === 0) return [];

  const userIds = [...new Set(commentRows.map((c) => c.created_by).filter(Boolean))] as string[];
  const userMap = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', userIds);
    (profiles as UserProfileLite[] | null | undefined)?.forEach((p) => {
      userMap.set(p.id, { name: p.name ?? null, email: p.email ?? null });
    });
  }

  const out: SubmissionCommentExportRow[] = [];
  for (const c of commentRows) {
    const sub = subById.get(c.submission_id);
    if (!sub) continue;
    const cat = String(sub.category);
    const label = getCategoryById(cat)?.label ?? cat;
    const sid = sub.subsidiary_id;
    const entity =
      (sub.entity_name && String(sub.entity_name).trim()) ||
      (sid ? params.entityNameBySubsidiaryId.get(String(sid)) : undefined) ||
      '—';
    const uid = c.created_by;
    const prof = uid ? userMap.get(uid) : null;
    const snapshot = (c as SubmissionCommentRow).author_name?.trim();
    const author =
      snapshot ||
      prof?.name ||
      prof?.email ||
      (uid ? uid.slice(0, 8) : '—');

    out.push({
      entity,
      year: params.fiscalYear,
      month: params.calendarMonth,
      category_id: cat,
      category_label: label,
      comment: c.message,
      created_at: c.created_at,
      author,
      file_name: sub.file_name,
    });
  }

  return out;
}

// ============================================
// 법인 통합 "내 제출 현황"
// ============================================

export type MySubmissionStatus = 'submitted' | 'upcoming' | 'overdue' | 'pending' | 'none';

export interface MySubmissionCell {
  /** 귀속 월 (1–12) */
  month: number;
  category: ClosingCategoryId;
  /** 마감일 (confirmed_date 우선, 없으면 planned_date). YYYY-MM-DD. */
  dueDate: string | null;
  /** 마감 확정 여부 (schedule_items.status === 'confirmed') */
  dueConfirmed: boolean;
  status: MySubmissionStatus;
  /** D-day 기준 남은 일수. 음수면 지연 일수. dueDate 없으면 null. */
  daysToDue: number | null;
  /** 가장 최신 제출(있으면) */
  latestSubmission: {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    version: number;
    submitted_at: string;
  } | null;
  /** 같은 카테고리·월 내 누적 제출 횟수 */
  submissionCount: number;
}

export interface MySubmissionsOverview {
  subsidiaryId: string;
  fiscalYear: string;
  cells: MySubmissionCell[];
  /** 카테고리별 빠른 합계 (요약 카드용) */
  totals: {
    submitted: number;
    upcoming: number;
    overdue: number;
    pending: number;
  };
}

const UPCOMING_THRESHOLD_DAYS = 7;

/** 'YYYY-MM-DD' → Date(00:00 local). 시각 부분이 있으면 무시한다. */
function parseDateOnly(d: string): Date {
  const ymd = d.length >= 10 ? d.slice(0, 10) : d;
  const [y, m, day] = ymd.split('-').map((v) => parseInt(v, 10));
  return new Date(y, (m || 1) - 1, day || 1);
}

function diffDays(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aa - bb) / MS);
}

/**
 * 법인 단위 통합 제출 현황 조회.
 * - submissions: 해당 법인+회계연도 전체
 * - schedule_items: 같은 회계연도 quarters에 걸린 모든 항목
 * 카테고리×귀속월 매트릭스로 셀을 만들어 반환한다.
 *
 * 귀속월 매핑 규칙:
 * - submissions: closing_month/entity_name이 없는 레거시 데이터까지 커버하기 위해
 *   submitted_at 의 캘린더 월에서 1을 빼서 귀속월로 본다 (FC 캘린더 규칙과 동일).
 * - schedule_items: planned_date(또는 confirmed_date)의 캘린더 월에서 1을 빼서 귀속월로.
 */
export async function getMySubmissionsOverview(
  subsidiaryId: string,
  fiscalYear: string,
): Promise<MySubmissionsOverview> {
  if (!subsidiaryId || !fiscalYear) {
    return {
      subsidiaryId,
      fiscalYear,
      cells: [],
      totals: { submitted: 0, upcoming: 0, overdue: 0, pending: 0 },
    };
  }

  // 1) 해당 회계연도의 quarters 조회 (schedule_items 필터에 사용)
  const fyNum = parseInt(fiscalYear, 10);
  const { data: quartersData, error: qErr } = await supabase
    .from('quarters')
    .select('id, year, quarter')
    .eq('year', fyNum);
  if (qErr) {
    throw new Error(`분기 조회 실패: ${qErr.message}`);
  }
  const quarterIds = (quartersData || [])
    .map((q) => (q as { id?: string }).id)
    .filter((v): v is string => Boolean(v));

  // 2) submissions
  // 주의: submissions 테이블에는 closing_month 컬럼이 없다. (API 요청 시 quarter_id 도출용으로만 사용)
  // 따라서 귀속월은 항상 submitted_at 기반으로 추정한다.
  const { data: subs, error: sErr } = await supabase
    .from('submissions')
    .select('id, category, file_name, file_path, file_size, version, submitted_at, fiscal_year, subsidiary_id')
    .eq('subsidiary_id', subsidiaryId)
    .eq('fiscal_year', fiscalYear)
    .order('submitted_at', { ascending: false });
  if (sErr) {
    if (sErr.code !== '42P01') {
      throw new Error(`제출 조회 실패: ${sErr.message}`);
    }
  }

  type SubRow = {
    id: string;
    category: string;
    file_name: string;
    file_path: string;
    file_size: number;
    version: number | null;
    submitted_at: string;
  };
  const subsRows = ((subs || []) as unknown as SubRow[]).filter(Boolean);

  // 3) schedule_items
  type SchedRow = {
    id: string;
    subsidiary_id: string;
    category: string;
    planned_date: string;
    confirmed_date: string | null;
    status: 'planned' | 'confirmed';
  };
  let schedRows: SchedRow[] = [];
  if (quarterIds.length > 0) {
    const { data: sched, error: schedErr } = await supabase
      .from('schedule_items')
      .select('id, subsidiary_id, category, planned_date, confirmed_date, status')
      .eq('subsidiary_id', subsidiaryId)
      .in('quarter_id', quarterIds);
    if (schedErr && schedErr.code !== '42P01') {
      throw new Error(`일정 조회 실패: ${schedErr.message}`);
    }
    schedRows = (sched || []) as unknown as SchedRow[];
  }

  // ---- 셀 집계
  // 캘린더월(submitted_at, planned_date) → 귀속월: 캘린더월 - 1 (1월이면 전년 12월; 전년이면 본 회계연도 매트릭스 밖이므로 제외)
  const toAttributionMonth = (calendarYmd: string): number | null => {
    const d = parseDateOnly(calendarYmd);
    const cy = d.getFullYear();
    const cm = d.getMonth() + 1;
    let am = cm - 1;
    let ay = cy;
    if (am === 0) {
      am = 12;
      ay = cy - 1;
    }
    return ay === fyNum ? am : null;
  };

  type CellKey = string; // `${month}|${category}`
  const keyOf = (month: number, category: string): CellKey => `${month}|${category}`;

  const cellMap = new Map<CellKey, MySubmissionCell>();
  const ensureCell = (month: number, category: string): MySubmissionCell => {
    const k = keyOf(month, category);
    let c = cellMap.get(k);
    if (!c) {
      c = {
        month,
        category,
        dueDate: null,
        dueConfirmed: false,
        status: 'none',
        daysToDue: null,
        latestSubmission: null,
        submissionCount: 0,
      };
      cellMap.set(k, c);
    }
    return c;
  };

  // 3-1) schedule_items → 마감일 채우기
  for (const s of schedRows) {
    const baseDate = s.confirmed_date || s.planned_date;
    if (!baseDate) continue;
    const month = toAttributionMonth(baseDate);
    if (!month) continue;
    const cell = ensureCell(month, s.category);
    // 더 늦은(또는 confirmed 우선) 날짜로 갱신
    const isConfirmed = s.status === 'confirmed';
    const candidateDate = baseDate.slice(0, 10);
    const shouldReplace =
      cell.dueDate == null ||
      (isConfirmed && !cell.dueConfirmed) ||
      (isConfirmed === cell.dueConfirmed && candidateDate > (cell.dueDate ?? ''));
    if (shouldReplace) {
      cell.dueDate = candidateDate;
      cell.dueConfirmed = isConfirmed;
    }
  }

  // 3-2) submissions → 최신 파일/카운트 반영
  for (const r of subsRows) {
    if (!r.submitted_at) continue;
    const month = toAttributionMonth(r.submitted_at);
    if (month == null) continue;
    const cell = ensureCell(month, r.category);
    cell.submissionCount += 1;
    const candidate = {
      id: r.id,
      file_name: r.file_name,
      file_path: r.file_path,
      file_size: r.file_size,
      version: r.version ?? 1,
      submitted_at: r.submitted_at,
    };
    if (!cell.latestSubmission) {
      cell.latestSubmission = candidate;
    } else {
      // 최신 판정: submitted_at 우선, 같으면 version 큰 쪽이 최신
      const candTs = new Date(candidate.submitted_at).getTime();
      const currTs = new Date(cell.latestSubmission.submitted_at).getTime();
      const candVer = candidate.version ?? 1;
      const currVer = cell.latestSubmission.version ?? 1;
      const shouldReplace =
        candTs > currTs || (candTs === currTs && candVer > currVer);
      if (shouldReplace) {
        cell.latestSubmission = candidate;
      }
    }
  }

  // 3-3) status / D-day 계산
  const today = new Date();
  for (const cell of cellMap.values()) {
    if (cell.dueDate) {
      cell.daysToDue = diffDays(parseDateOnly(cell.dueDate), today);
    }
    if (cell.latestSubmission) {
      cell.status = 'submitted';
    } else if (cell.dueDate == null) {
      cell.status = 'none';
    } else if (cell.daysToDue != null && cell.daysToDue < 0) {
      cell.status = 'overdue';
    } else if (cell.daysToDue != null && cell.daysToDue <= UPCOMING_THRESHOLD_DAYS) {
      cell.status = 'upcoming';
    } else {
      cell.status = 'pending';
    }
  }

  const cells = [...cellMap.values()].sort((a, b) =>
    a.month !== b.month ? a.month - b.month : a.category.localeCompare(b.category),
  );

  const totals = cells.reduce(
    (acc, c) => {
      if (c.status === 'submitted') acc.submitted += 1;
      else if (c.status === 'upcoming') acc.upcoming += 1;
      else if (c.status === 'overdue') acc.overdue += 1;
      else if (c.status === 'pending') acc.pending += 1;
      return acc;
    },
    { submitted: 0, upcoming: 0, overdue: 0, pending: 0 },
  );

  return { subsidiaryId, fiscalYear, cells, totals };
}
