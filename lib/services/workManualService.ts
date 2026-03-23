/**
 * Work Manual 서비스
 * Supabase Storage 및 DB 작업
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import type { WorkManual } from '@/lib/types/work-manual';

const BUCKET_NAME = 'work-manuals';

/**
 * 파일 업로드
 */
export async function uploadWorkManual(
  file: File,
  fileType: '업무기술서' | '업무분장표'
): Promise<WorkManual> {
  try {
    // 사용자 정보 가져오기 (선택적 - 로그인하지 않아도 업로드 가능)
    const { data: { user } } = await supabase.auth.getUser();

    const fileExt = file.name.split('.').pop();
    const filePath = `${uuidv4()}.${fileExt}`;
    
    // Storage 업로드
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload Error Details:', uploadError);
      throw uploadError;
    }

    // DB에 메타데이터 저장 (file_type 포함)
    const { data, error: dbError } = await supabase
      .from('work_manuals')
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: fileType, // 선택한 유형 저장
        uploaded_by: user?.id || null, // 로그인하지 않은 경우 null
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('DB Error Details:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
        fullError: dbError,
      });
      
      // 업로드 실패 시 Storage에서 파일 삭제
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      
      // file_type 컬럼이 없는 경우 안내
      if (
        dbError.code === 'PGRST204' ||
        dbError.message?.includes('file_type') ||
        dbError.message?.includes("Could not find the 'file_type' column")
      ) {
        throw new Error(
          `file_type 컬럼이 데이터베이스에 없습니다. docs/work-manual-schema-update.sql 파일의 SQL을 실행하여 스키마를 업데이트해주세요.`
        );
      }
      
      // 더 자세한 에러 메시지 제공
      throw new Error(
        `데이터베이스 저장 실패: ${dbError.message || '알 수 없는 오류'}${dbError.hint ? ` (${dbError.hint})` : ''}`
      );
    }

    return data as unknown as WorkManual;
  } catch (error) {
    console.error('Error uploading work manual:', error);
    throw error;
  }
}

/**
 * 모든 업무기술서 조회
 */
export async function getWorkManuals(fileType?: '업무기술서' | '업무분장표'): Promise<WorkManual[]> {
  let query = supabase
    .from('work_manuals')
    .select('*');

  // file_type 필터링 (컬럼이 있는 경우에만)
  if (fileType) {
    query = query.eq('file_type', fileType);
  }

  const { data, error } = await query.order('uploaded_at', { ascending: false });

  if (error) {
    // 테이블이 없을 경우 빈 배열 반환
    if (error.code === '42P01') {
      console.warn('work_manuals 테이블이 존재하지 않습니다.');
      return [];
    }
    // file_type 컬럼이 없을 경우 (필터 없이 재시도)
    const isFileTypeError = 
      error.code === 'PGRST204' ||
      error.message?.includes('file_type') ||
      error.message?.includes("Could not find the 'file_type' column");
    
    if (isFileTypeError && fileType) {
      console.warn('file_type 컬럼이 없습니다. 모든 파일을 반환합니다.');
      const { data: allData, error: allError } = await supabase
        .from('work_manuals')
        .select('*')
        .order('uploaded_at', { ascending: false });
      
      if (allError && allError.code !== '42P01') {
        throw new Error(`조회 실패: ${allError.message}`);
      }
      
      // file_type 컬럼이 없으면 모든 파일을 반환 (클라이언트에서 필터링)
      const allFiles = allData || [];
      return allFiles as unknown as WorkManual[];
    }
    throw new Error(`조회 실패: ${error.message}`);
  }

  return (data || []) as unknown as WorkManual[];
}

/**
 * 파일 다운로드 URL 가져오기
 */
export async function getWorkManualUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600); // 1시간 유효

  if (error) {
    console.error('Signed URL 생성 오류:', error);
    throw new Error(`파일 URL 생성 실패: ${error.message}`);
  }

  if (!data || !data.signedUrl) {
    throw new Error('파일 URL 생성 실패: 데이터가 없습니다.');
  }

  return data.signedUrl;
}

/**
 * 파일 삭제
 */
export async function deleteWorkManual(id: string, filePath: string): Promise<void> {
  // 1. Storage에서 파일 삭제
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (storageError) {
    console.warn('Storage 파일 삭제 실패:', storageError);
  }

  // 2. DB에서 레코드 삭제
  const { error: dbError } = await supabase
    .from('work_manuals')
    .delete()
    .eq('id', id);

  if (dbError) {
    throw new Error(`삭제 실패: ${dbError.message}`);
  }
}
