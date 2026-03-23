/**
 * 서버사이드 파일 제출 API
 * 파일 업로드 + submissions DB 저장 + schedule_items 자동 확정
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'submission';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  let filePath: string | null = null;
  const supabase = getSupabaseClient();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as string | null;
    const quarterId = formData.get('quarter_id') as string | null;
    const subsidiaryId = formData.get('subsidiary_id') as string | null;
    const fiscalYear = formData.get('fiscal_year') as string | null;
    const entityName = formData.get('entity_name') as string | null;

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
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
      userId = user?.id ?? null;
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
      versionQuery = (versionQuery as any).eq('quarter_id', finalQuarterId);
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

    // 4. schedule_items 자동 확정
    //    submissions는 fiscal quarter_id, schedule_items는 work period quarter_id (fiscal + 1분기)
    if (subsidiaryId && finalQuarterId) {
      try {
        const { data: fiscalQData } = await supabase
          .from('quarters')
          .select('year, quarter')
          .eq('id', finalQuarterId)
          .single();

        const fiscalQ = fiscalQData as { year: number; quarter: number } | null;

        if (fiscalQ) {
          const workYear = fiscalQ.quarter === 4 ? fiscalQ.year + 1 : fiscalQ.year;
          const workQuarter = fiscalQ.quarter === 4 ? 1 : fiscalQ.quarter + 1;

          const { data: workQData } = await supabase
            .from('quarters')
            .select('id')
            .eq('year', workYear)
            .eq('quarter', workQuarter)
            .maybeSingle();

          const workQ = workQData as { id: string } | null;

          if (workQ) {
            await supabase
              .from('schedule_items')
              .update({ status: 'confirmed', confirmed_date: submittedAt.split('T')[0] })
              .eq('quarter_id', workQ.id)
              .eq('subsidiary_id', subsidiaryId)
              .eq('category', category)
              .eq('status', 'planned');
          }
        }
      } catch {
        // 비치명적 오류: 제출은 성공으로 처리
      }
    }

    return NextResponse.json({ submission: submissionData }, { status: 201 });

  } catch (error: unknown) {
    if (filePath) {
      const supabase = getSupabaseClient();
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    }
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
