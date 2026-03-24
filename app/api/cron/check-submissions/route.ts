/**
 * Cron Job: 기한 초과 schedule_items 확인 후 독촉 이메일 발송
 * Vercel Cron: 매일 01:00 UTC 실행 (vercel.json 참고)
 * 수동 테스트: GET /api/cron/check-submissions
 *   Header: Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendReminderEmail } from '@/lib/services/emailService';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  return createClient(url, key);
}

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

type OverdueItem = {
  id: string;
  quarter_id: string;
  subsidiary_id: string;
  category: string;
  planned_date: string;
  subsidiaries: { id: string; name: string; contact_email: string | null } | null;
  quarters: { id: string; year: number; quarter: number } | null;
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0]; // yyyy-MM-dd

  // 1. 기한 초과된 미제출 항목 조회
  const { data: rawItems, error: fetchError } = await supabase
    .from('schedule_items')
    .select(`
      id,
      quarter_id,
      subsidiary_id,
      category,
      planned_date,
      subsidiaries ( id, name, contact_email ),
      quarters ( id, year, quarter )
    `)
    .lt('planned_date', today)
    .eq('status', 'planned');

  if (fetchError) {
    console.error('기한 초과 항목 조회 실패:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const overdueItems = (rawItems ?? []) as unknown as OverdueItem[];

  if (overdueItems.length === 0) {
    return NextResponse.json({ message: '기한 초과 항목 없음', sent: 0 });
  }

  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const item of overdueItems) {
    const subsidiary = item.subsidiaries;
    const quarter = item.quarters;

    if (!subsidiary?.contact_email) {
      results.skipped++;
      continue;
    }

    // 오늘 이미 발송 여부 확인 (중복 발송 방지)
    const todayStart = `${today}T00:00:00Z`;
    const { data: existingLog } = await supabase
      .from('reminder_logs')
      .select('id')
      .eq('schedule_item_id', item.id)
      .gte('sent_at', todayStart)
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      results.skipped++;
      continue;
    }

    const daysOverdue = Math.floor(
      (new Date(today).getTime() - new Date(item.planned_date).getTime()) / 86400000
    );

    const categoryLabel =
      CLOSING_CATEGORIES.find((c) => c.id === item.category)?.label ?? item.category;

    // 2. 이메일 발송
    const emailResult = await sendReminderEmail({
      to: subsidiary.contact_email,
      subsidiaryName: subsidiary.name,
      category: categoryLabel,
      plannedDate: item.planned_date,
      fiscalYear: quarter?.year ?? 0,
      fiscalQuarter: quarter?.quarter ?? 0,
      daysOverdue,
    });

    const isError = 'error' in emailResult;

    // 3. 발송 이력 저장
    await supabase.from('reminder_logs').insert({
      schedule_item_id: item.id,
      subsidiary_id: item.subsidiary_id,
      quarter_id: item.quarter_id,
      category: item.category,
      recipient_email: subsidiary.contact_email,
      email_id: isError ? null : emailResult.id,
      status: isError ? 'failed' : 'sent',
      error_message: isError ? emailResult.error : null,
    });

    if (isError) {
      results.failed++;
    } else {
      results.sent++;
    }
  }

  return NextResponse.json({
    message: '크론 완료',
    total: overdueItems.length,
    ...results,
  });
}
