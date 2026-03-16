/**
 * File Upload API Route
 * PRD Section 4.6.4 기반
 * 
 * Monthly Closing 파일 업로드 처리
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 허용되는 MIME 타입
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
];

// 최대 파일 크기 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const entityCode = formData.get('entity_code') as string;
    const periodYear = formData.get('period_year') as string;
    const periodMonth = formData.get('period_month') as string;

    // 필수 필드 검증
    if (!file || !entityCode || !periodYear || !periodMonth) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: file, entity_code, period_year, period_month' },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // MIME 타입 검증
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type. Allowed types: xlsx, xls, csv` },
        { status: 406 }
      );
    }

    // 파일 경로 생성 (버킷 구조에 따름)
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `uploads/${entityCode}/${periodYear}/${periodMonth}/${timestamp}_${sanitizedFileName}`;

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('monthly-closing')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 400 }
      );
    }

    // 데이터베이스에 업로드 기록 저장
    const { data: uploadRecord, error: dbError } = await supabase
      .from('tb_uploads')
      .insert({
        entity_code: entityCode,
        period_year: parseInt(periodYear),
        period_month: parseInt(periodMonth),
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded',
      })
      .select()
      .single();

    if (dbError) {
      // 롤백: 업로드된 파일 삭제
      console.error('Database insert error:', dbError);
      await supabase.storage
        .from('monthly-closing')
        .remove([filePath]);

      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      upload_id: uploadRecord.upload_id,
      file_path: uploadData.path,
      message: 'File uploaded successfully',
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * 업로드된 파일 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityCode = searchParams.get('entity_code');
    const periodYear = searchParams.get('period_year');
    const periodMonth = searchParams.get('period_month');

    let query = supabase
      .from('tb_uploads')
      .select('*')
      .order('created_at', { ascending: false });

    if (entityCode) {
      query = query.eq('entity_code', entityCode);
    }
    if (periodYear) {
      query = query.eq('period_year', parseInt(periodYear));
    }
    if (periodMonth) {
      query = query.eq('period_month', parseInt(periodMonth));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      uploads: data,
    });

  } catch (error) {
    console.error('Get uploads error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * 업로드된 파일 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('upload_id');

    if (!uploadId) {
      return NextResponse.json(
        { success: false, error: 'Missing upload_id parameter' },
        { status: 400 }
      );
    }

    // 업로드 기록 조회
    const { data: uploadRecord, error: fetchError } = await supabase
      .from('tb_uploads')
      .select('file_path')
      .eq('upload_id', uploadId)
      .single();

    if (fetchError || !uploadRecord) {
      return NextResponse.json(
        { success: false, error: 'Upload record not found' },
        { status: 404 }
      );
    }

    // Storage에서 파일 삭제
    const { error: storageError } = await supabase.storage
      .from('monthly-closing')
      .remove([uploadRecord.file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // 파일 삭제 실패해도 DB 기록은 삭제 진행
    }

    // 데이터베이스에서 기록 삭제
    const { error: dbError } = await supabase
      .from('tb_uploads')
      .delete()
      .eq('upload_id', uploadId);

    if (dbError) {
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
