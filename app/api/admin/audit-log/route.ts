/**
 * GBS 관리자 전용 — 역할 변경 감사 로그 조회
 * GET /api/admin/audit-log?limit=100
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service-role 환경변수가 설정되지 않았습니다.');
  }
  return createClient(url, serviceKey);
}

async function requireGbsAdmin(req: NextRequest): Promise<{ ok: true; svc: SupabaseClient } | { ok: false; res: NextResponse }> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, res: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }
  const svc = getServiceClient();
  const { data: { user }, error } = await svc.auth.getUser(token);
  if (error || !user) {
    return { ok: false, res: NextResponse.json({ error: '인증 실패' }, { status: 401 }) };
  }
  const { data: roleRows } = await svc.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roleRows || []).some((r) => (r as { role?: string }).role === 'gbs_admin');
  if (!isAdmin) {
    return { ok: false, res: NextResponse.json({ error: '권한이 부족합니다.' }, { status: 403 }) };
  }
  return { ok: true, svc };
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  target_user_id: string;
  target_email: string | null;
  target_name: string | null;
  action: 'approve' | 'update' | 'remove';
  before_state: unknown;
  after_state: unknown;
  reason: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireGbsAdmin(req);
    if (!auth.ok) return auth.res;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100));

    const { data, error } = await auth.svc
      .from('user_role_changes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ entries: [], note: '감사 로그 테이블이 아직 생성되지 않았습니다. docs/user-role-changes-schema.sql 을 적용하세요.' });
      }
      return NextResponse.json({ error: `감사 로그 조회 실패: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ entries: (data || []) as AuditLogRow[] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
