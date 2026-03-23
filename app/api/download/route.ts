/**
 * File Download API Route
 * PRD Section 4.6.5 기반
 * 
 * 업로드된 파일 다운로드 및 Signed URL 생성
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Validates the Supabase session from the Authorization header.
 * Returns the user if valid, or null if not authenticated.
 */
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const client = createServerClient();
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Signed URL 생성 (1시간 유효)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('upload_id');
    const filePath = searchParams.get('file_path');

    // upload_id 또는 file_path 중 하나 필요
    let targetPath = filePath;

    if (uploadId && !filePath) {
      // upload_id로 file_path 조회
      const { data: uploadRecord, error: fetchError } = await supabase
        .from('tb_uploads')
        .select('file_path, file_name')
        .eq('upload_id', uploadId)
        .single();

      if (fetchError || !uploadRecord) {
        return NextResponse.json(
          { success: false, error: 'Upload record not found' },
          { status: 404 }
        );
      }

      targetPath = uploadRecord.file_path;
    }

    if (!targetPath) {
      return NextResponse.json(
        { success: false, error: 'Missing upload_id or file_path parameter' },
        { status: 400 }
      );
    }

    // Signed URL 생성 (1시간 유효)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('monthly-closing')
      .createSignedUrl(targetPath, 3600); // 3600초 = 1시간

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      return NextResponse.json(
        { success: false, error: signedUrlError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      signed_url: signedUrlData.signedUrl,
      expires_in: 3600,
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * 파일 직접 다운로드 (Blob 반환)
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { upload_id, file_path } = body;

    let targetPath = file_path;
    let fileName = 'download';

    if (upload_id && !file_path) {
      // upload_id로 file_path 조회
      const { data: uploadRecord, error: fetchError } = await supabase
        .from('tb_uploads')
        .select('file_path, file_name')
        .eq('upload_id', upload_id)
        .single();

      if (fetchError || !uploadRecord) {
        return NextResponse.json(
          { success: false, error: 'Upload record not found' },
          { status: 404 }
        );
      }

      targetPath = uploadRecord.file_path;
      fileName = uploadRecord.file_name;
    }

    if (!targetPath) {
      return NextResponse.json(
        { success: false, error: 'Missing upload_id or file_path' },
        { status: 400 }
      );
    }

    // 파일 다운로드
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('monthly-closing')
      .download(targetPath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return NextResponse.json(
        { success: false, error: downloadError.message },
        { status: 400 }
      );
    }

    // Blob을 Response로 반환
    const arrayBuffer = await fileData.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': fileData.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
