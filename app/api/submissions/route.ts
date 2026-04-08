/**
 * 서버사이드 파일 제출 API
 * 파일 업로드 + submissions DB 저장 + schedule_items 자동 확정
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  assertSubmissionUploadAllowedByOverview,
  SubmissionBlockedByOverviewError,
} from '@/lib/server/submissionUploadGuard';

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

async function ensureQuarterId(params: {
  supabase: ReturnType<typeof getSupabaseClient>;
  quarterId: string | null;
  fiscalYear: string | null;
  closingMonth: string | null;
}): Promise<string | null> {
  const { supabase, quarterId, fiscalYear, closingMonth } = params;

  // already a real id
  if (quarterId && !quarterId.startsWith('temp-') && !quarterId.startsWith('custom-')) {
    return quarterId;
  }

  // derive from fiscalYear + closingMonth
  if (!fiscalYear || !closingMonth) return null;
  const fy = parseInt(fiscalYear, 10);
  const m = parseInt(closingMonth, 10);
  if (Number.isNaN(fy) || Number.isNaN(m) || m < 1 || m > 12) return null;

  const q = Math.min(4, Math.max(1, Math.ceil(m / 3)));
  const quarterStartDate = new Date(fy, (q - 1) * 3, 1);
  const quarterEndDate = new Date(fy, q * 3, 0);
  const startDate = quarterStartDate.toISOString().slice(0, 10);
  const endDate = quarterEndDate.toISOString().slice(0, 10);

  const { data: existing, error: qErr } = await supabase
    .from('quarters')
    .select('id')
    .eq('year', fy)
    .eq('quarter', q)
    .maybeSingle();

  if (qErr && qErr.code !== 'PGRST116') {
    console.warn('quarters 조회 실패:', qErr.message);
  }

  const existingId = (existing as { id?: string } | null)?.id;
  if (existingId) return existingId;

  const { data: created, error: insertErr } = await supabase
    .from('quarters')
    .insert({
      year: fy,
      quarter: q,
      start_date: startDate,
      end_date: endDate,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.warn('quarters 생성 실패:', insertErr.message);
    return null;
  }

  return (created as { id?: string } | null)?.id ?? null;
}

export async function POST(request: NextRequest) {
  // 사용자 토큰 추출 (service_role 없을 때 authenticated 클라이언트용)
  const authHeader = request.headers.get('authorization');
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const supabase = getSupabaseClient(userToken);

  try {
    // JSON 메타데이터만 수신 (바이너리 업로드 금지)
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
    }

    const category = (body['category'] as string | undefined) ?? null;
    const quarterId = (body['quarter_id'] as string | undefined) ?? null;
    const subsidiaryId = (body['subsidiary_id'] as string | undefined) ?? null;
    const fiscalYear = (body['fiscal_year'] as string | undefined) ?? null;
    const entityName = (body['entity_name'] as string | undefined) ?? null;
    const closingMonth = (body['closing_month'] as string | undefined) ?? null;

    const fileName = (body['file_name'] as string | undefined) ?? null;
    const filePath = (body['file_path'] as string | undefined) ?? null;
    const fileSize = (body['file_size'] as number | undefined) ?? null;
    const mimeType = (body['mime_type'] as string | undefined) ?? null;

    if (!category) {
      return NextResponse.json({ error: '카테고리는 필수입니다.' }, { status: 400 });
    }
    if (!fileName || !filePath || fileSize == null || !mimeType) {
      return NextResponse.json({ error: 'file_name, file_path, file_size, mime_type는 필수입니다.' }, { status: 400 });
    }

    const fileExt = fileName.split('.').pop()?.toLowerCase();
    if (fileExt !== 'xls' && fileExt !== 'xlsx') {
      return NextResponse.json({ error: 'Excel 파일만 업로드 가능합니다 (.xls, .xlsx)' }, { status: 400 });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.` },
        { status: 400 }
      );
    }

    // quarter_id 재발방지: 누락/임시값이면 fiscal_year+closing_month로 유도하여 저장
    const ensuredQuarterId = await ensureQuarterId({
      supabase,
      quarterId,
      fiscalYear,
      closingMonth,
    });

    if (!ensuredQuarterId) {
      return NextResponse.json(
        { error: 'quarter_id 또는 fiscal_year+closing_month가 필요합니다.' },
        { status: 400 },
      );
    }

    // 인증 사용자 확인
    let userId: string | null = null;
    if (userToken) {
      const { data: { user } } = await supabase.auth.getUser(userToken);
      userId = user?.id ?? null;
    }

    const finalQuarterIdForGuard = ensuredQuarterId;

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

    // submissions DB 저장
    const submittedAt = new Date().toISOString();
    const finalQuarterId = ensuredQuarterId;

    // 버전 번호 계산 (같은 분기 내에서만 누적)
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
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        version: nextVersion,
        submitted_by: userId,
        submitted_at: submittedAt,
      })
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '42P01' || dbError.message?.includes('does not exist')) {
        return NextResponse.json({ error: `'submissions' 테이블이 존재하지 않습니다.` }, { status: 500 });
      }
      return NextResponse.json({ error: `데이터베이스 저장 실패: ${dbError.message}` }, { status: 500 });
    }

    // schedule_items 상태는 관리자의 "이번 달 확정" 액션으로만 변경됨 (파일 제출과 무관)

    return NextResponse.json({ submission: submissionData }, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // 읽기(GET)는 인증 없이 허용 — service_role로 RLS 우회하여 조회
  // 쓰기(POST/DELETE)만 인증 필수
  const supabase = getSupabaseClient();

  try {
    const { searchParams } = new URL(request.url);
    const quarterId = searchParams.get('quarter_id');
    const fiscalYear = searchParams.get('fiscal_year');

    if (!quarterId && !fiscalYear) {
      return NextResponse.json(
        { error: 'quarter_id 또는 fiscal_year 쿼리 파라미터가 필요합니다.' },
        { status: 400 },
      );
    }

    let q = supabase.from('submissions').select('*').order('submitted_at', { ascending: false });

    // quarter_id OR fiscal_year 로 조회 (AND가 아님!)
    // 둘 다 있으면 OR, 하나만 있으면 해당 필드만
    if (quarterId && fiscalYear) {
      q = q.or(`quarter_id.eq.${quarterId},fiscal_year.eq.${fiscalYear}`);
    } else if (quarterId) {
      q = q.eq('quarter_id', quarterId);
    } else if (fiscalYear) {
      q = q.eq('fiscal_year', fiscalYear);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ submissions: data ?? [] }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // 인증 분리는 추후 — 현재는 누구나 삭제 가능
  const supabase = getSupabaseClient();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id 쿼리 파라미터가 필요합니다.' }, { status: 400 });
    }

    // 먼저 파일 경로 조회
    const { data: row, error: fetchErr } = await supabase
      .from('submissions')
      .select('file_path')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const filePath = (row as { file_path?: string | null } | null)?.file_path ?? null;

    // DB에서 레코드 삭제
    const { error: dbErr } = await supabase
      .from('submissions')
      .delete()
      .eq('id', id);

    if (dbErr) {
      return NextResponse.json({ error: `제출 삭제 실패: ${dbErr.message}` }, { status: 500 });
    }

    // Storage에서 파일 삭제 (있을 때만)
    if (filePath) {
      const { error: storageErr } = await supabase.storage
        .from('submission')
        .remove([filePath]);
      if (storageErr) {
        // DB 삭제는 성공했으므로 200은 유지, 경고만 로그
        console.warn('Storage 삭제 실패(무시):', storageErr.message);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
