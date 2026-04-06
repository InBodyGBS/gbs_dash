/**
 * 서버사이드 파일 제출 API
 * 파일 업로드 + submissions DB 저장 + schedule_items 자동 확정
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import {
  assertSubmissionUploadAllowedByOverview,
  SubmissionBlockedByOverviewError,
} from '@/lib/server/submissionUploadGuard';

const BUCKET_NAME = 'submission';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getSupabaseClient(userToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');

  // service_role 키가 있으면 RLS 완전 우회
  if (serviceKey) return createClient(url, serviceKey);

  // 없으면 사용자 토큰으로 authenticated 클라이언트 생성 (Storage RLS 통과)
  if (userToken && anonKey) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
  }

  return createClient(url, anonKey!);
}

export async function POST(request: NextRequest) {
  let filePath: string | null = null;

  // 사용자 토큰 추출 (service_role 없을 때 authenticated 클라이언트용)
  const authHeader = request.headers.get('authorization');
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = getSupabaseClient(userToken);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as string | null;
    const quarterId = formData.get('quarter_id') as string | null;
    const subsidiaryId = formData.get('subsidiary_id') as string | null;
    const fiscalYear = formData.get('fiscal_year') as string | null;
    const entityName = formData.get('entity_name') as string | null;
    const closingMonth = formData.get('closing_month') as string | null;

    if (!file || !category) {
      return NextResponse.json({ error: '파일과 카테고리는 필수입니다.' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'xls' && fileExt !== 'xlsx') {
      return NextResponse.json({ error: 'Excel 파일만 업로드 가능합니다 (.xls, .xlsx)' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.` },
        { status: 400 }
      );
    }

    // 인증 사용자 확인
    let userId: string | null = null;
    if (userToken) {
      const { data: { user } } = await supabase.auth.getUser(userToken);
      userId = user?.id ?? null;
    }

    const finalQuarterIdForGuard =
      quarterId && !quarterId.startsWith('temp-') && !quarterId.startsWith('custom-')
        ? quarterId
        : null;

    try {
      await assertSubmissionUploadAllowedByOverview(supabase, {
        quarterId: finalQuarterIdForGuard,
        subsidiaryId: subsidiaryId || null,
        category,
        fiscalYear,
        closingMonth,
      });
    } catch (e) {
      if (e instanceof SubmissionBlockedByOverviewError) {
        return NextResponse.json(
          {
            error:
              'Overview에서 확정된 자료는 추가 업로드할 수 없습니다. 확정을 해제한 뒤 다시 시도해 주세요.',
          },
          { status: 403 },
        );
      }
      throw e;
    }

    // 1. Storage 업로드
    filePath = `${category}/${uuidv4()}.${fileExt}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, { contentType: file.type });

    if (uploadError) {
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json({ error: `Storage 버킷 '${BUCKET_NAME}'이 존재하지 않습니다.` }, { status: 500 });
      }
      if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy')) {
        return NextResponse.json({ error: 'Storage 업로드 권한이 없습니다.' }, { status: 403 });
      }
      return NextResponse.json({ error: `파일 업로드 실패: ${uploadError.message}` }, { status: 500 });
    }

    // 3. submissions DB 저장
    const submittedAt = new Date().toISOString();
    const finalQuarterId =
      quarterId && !quarterId.startsWith('temp-') && !quarterId.startsWith('custom-')
        ? quarterId
        : null;

    // 2. 버전 번호 계산 (같은 분기 내에서만 누적)
    let versionQuery = supabase
      .from('submissions')
      .select('version')
      .eq('category', category)
      .eq('subsidiary_id', subsidiaryId ?? '')
      .order('version', { ascending: false })
      .limit(1);

    if (finalQuarterId) {
      versionQuery = versionQuery.eq('quarter_id', finalQuarterId);
    }

    const { data: existingRows } = await versionQuery;

    const existing = existingRows as Array<{ version: number }> | null;
    const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

    const { data: submissionData, error: dbError } = await supabase
      .from('submissions')
      .insert({
        quarter_id: finalQuarterId,
        subsidiary_id: subsidiaryId || null,
        fiscal_year: fiscalYear || null,
        entity_name: entityName || null,
        category,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        version: nextVersion,
        submitted_by: userId,
        submitted_at: submittedAt,
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      filePath = null;
      if (dbError.code === '42P01' || dbError.message?.includes('does not exist')) {
        return NextResponse.json({ error: `'submissions' 테이블이 존재하지 않습니다.` }, { status: 500 });
      }
      return NextResponse.json({ error: `데이터베이스 저장 실패: ${dbError.message}` }, { status: 500 });
    }

    // schedule_items 상태는 관리자의 "이번 달 확정" 액션으로만 변경됨 (파일 제출과 무관)

    return NextResponse.json({ submission: submissionData }, { status: 201 });

  } catch (error: unknown) {
    if (filePath) {
      const cleanupClient = getSupabaseClient(userToken);
      await cleanupClient.storage.from(BUCKET_NAME).remove([filePath]);
    }
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
