/**
 * Quarter 조회/생성 API (service_role key 사용)
 * 모든 인증 사용자가 quarter를 생성할 수 있도록 RLS 우회
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  return createClient(url, key);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const quarter = searchParams.get('quarter');

  if (!year || !quarter) {
    return NextResponse.json({ error: 'year와 quarter는 필수입니다.' }, { status: 400 });
  }

  const fy = parseInt(year, 10);
  const q = parseInt(quarter, 10);

  if (isNaN(fy) || isNaN(q) || q < 1 || q > 4) {
    return NextResponse.json({ error: '유효하지 않은 year 또는 quarter 값입니다.' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 기존 quarter 조회
  const { data: existing, error: selectError } = await supabase
    .from('quarters')
    .select('*')
    .eq('year', fy)
    .eq('quarter', q)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: `Quarter 조회 실패: ${selectError.message}` }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ quarter: existing });
  }

  // 없으면 생성
  const startMonth = (q - 1) * 3; // 0-indexed month
  const quarterStartDate = new Date(fy, startMonth, 1);
  const quarterEndDate = new Date(fy, startMonth + 3, 0); // 해당 분기 마지막 날

  const { data: newQuarter, error: insertError } = await supabase
    .from('quarters')
    .insert({
      year: fy,
      quarter: q,
      start_date: formatDate(quarterStartDate),
      end_date: formatDate(quarterEndDate),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Quarter 생성 실패: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ quarter: newQuarter }, { status: 201 });
}
