/**
 * Submission Template 서비스 — Admin이 업로드한 카테고리별 양식 관리
 *
 * 저장 위치:
 *   - DB: submission_templates 테이블 (category 당 1행)
 *   - Storage: submission 버킷의 `templates/<categoryId>/<uuid>-<filename>` 경로
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';

const BUCKET_NAME = 'submission';
const TEMPLATES_FOLDER = 'templates';

export interface SubmissionTemplate {
  id: string;
  category: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

/** 특정 카테고리의 등록된 템플릿 조회 (없으면 null) */
export async function getSubmissionTemplate(
  categoryId: ClosingCategoryId,
): Promise<SubmissionTemplate | null> {
  const { data, error } = await supabase
    .from('submission_templates' as never)
    .select('*')
    .eq('category', categoryId)
    .maybeSingle();

  if (error) {
    // 테이블이 없으면 null 폴백
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('submission_templates 테이블이 없습니다. SQL 마이그레이션 실행 필요.');
      return null;
    }
    throw new Error(`템플릿 조회 실패: ${error.message}`);
  }
  return (data as SubmissionTemplate | null) ?? null;
}

/** Storage 에서 파일 다운로드 → Blob 반환 */
export async function downloadTemplateFile(
  filePath: string,
): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);
  if (error) throw new Error(`템플릿 파일 다운로드 실패: ${error.message}`);
  if (!data) throw new Error('템플릿 파일이 비어 있습니다.');
  return data;
}

/**
 * Admin 업로드 — 기존 템플릿이 있으면 교체 (Storage 파일 삭제 + DB upsert).
 * 호출자가 gbs_admin 인지 사전 확인할 것 (UI 레벨 가드).
 */
export async function uploadSubmissionTemplate(params: {
  categoryId: ClosingCategoryId;
  file: File;
  uploaderName?: string | null;
}): Promise<SubmissionTemplate> {
  const { categoryId, file, uploaderName } = params;

  // 확장자 검증
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') {
    throw new Error('Excel 파일(.xls / .xlsx)만 업로드 가능합니다.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('파일 크기는 10MB를 초과할 수 없습니다.');
  }

  // 새 Storage 경로
  const uid = uuidv4();
  const safeName = file.name.replace(/[^\w.\-가-힣 ]+/g, '_');
  const filePath = `${TEMPLATES_FOLDER}/${categoryId}/${uid}-${safeName}`;

  // 1) 기존 템플릿 조회 (교체 시 이전 파일 삭제)
  const existing = await getSubmissionTemplate(categoryId);

  // 2) 새 파일 업로드
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType:
        file.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  if (uploadError) {
    if (uploadError.message?.includes('not found')) {
      throw new Error(
        `Storage 버킷 '${BUCKET_NAME}'이 없거나 'templates/' 폴더 접근 권한이 없습니다. Supabase Storage 에서 정책을 확인해 주세요.`,
      );
    }
    throw new Error(`템플릿 파일 업로드 실패: ${uploadError.message}`);
  }

  // 3) DB upsert
  const { data, error: dbError } = await supabase
    .from('submission_templates' as never)
    .upsert(
      {
        category: categoryId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        uploaded_by: uploaderName ?? null,
        uploaded_at: new Date().toISOString(),
      } as never,
      { onConflict: 'category' },
    )
    .select()
    .single();

  if (dbError) {
    // DB 실패 시 업로드한 파일 정리
    await supabase.storage.from(BUCKET_NAME).remove([filePath]).catch(() => undefined);
    throw new Error(`템플릿 DB 저장 실패: ${dbError.message}`);
  }

  // 4) 이전 Storage 파일 삭제 (best-effort)
  if (existing && existing.file_path && existing.file_path !== filePath) {
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([existing.file_path])
      .catch((e) => console.warn('이전 템플릿 파일 삭제 실패 (무시):', e));
  }

  return data as SubmissionTemplate;
}

/** Admin 삭제 — DB row 삭제 + Storage 파일 삭제 */
export async function deleteSubmissionTemplate(
  categoryId: ClosingCategoryId,
): Promise<void> {
  const existing = await getSubmissionTemplate(categoryId);
  if (!existing) return;

  await supabase
    .from('submission_templates' as never)
    .delete()
    .eq('category', categoryId);

  if (existing.file_path) {
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([existing.file_path])
      .catch((e) => console.warn('템플릿 파일 삭제 실패:', e));
  }
}
