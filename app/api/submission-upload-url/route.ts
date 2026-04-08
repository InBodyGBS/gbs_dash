/**
 * 서명된 업로드 URL 발급 API
 * service_role 키로 Storage RLS를 우회하여 1회용 업로드 URL을 생성합니다.
 * 클라이언트는 이 URL로 Supabase Storage에 직접 파일을 업로드합니다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'submission';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  return createClient(url, serviceKey || anonKey!);
}

export async function POST(request: NextRequest) {
  // 인증 확인
  const authHeader = request.headers.get('authorization');
  const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!userToken) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
    }

    const category = (body['category'] as string | undefined) ?? null;
    const fileExt = (body['file_ext'] as string | undefined) ?? null;

    if (!category || !fileExt) {
      return NextResponse.json({ error: 'category와 file_ext는 필수입니다.' }, { status: 400 });
    }

    const ext = fileExt.toLowerCase();
    if (ext !== 'xls' && ext !== 'xlsx') {
      return NextResponse.json({ error: 'Excel 파일만 업로드 가능합니다 (.xls, .xlsx)' }, { status: 400 });
    }

    // 사용자 인증 검증
    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
    if (authError || !user) {
      return NextResponse.json({ error: '유효하지 않은 인증 토큰입니다.' }, { status: 401 });
    }

    // 서명된 업로드 URL 생성 (service_role로 RLS 우회)
    const filePath = `${category}/${uuidv4()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Signed upload URL 생성 실패:', error);
      return NextResponse.json({ error: `업로드 URL 생성 실패: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      file_path: filePath,
      signed_url: data.signedUrl,
      token: data.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
