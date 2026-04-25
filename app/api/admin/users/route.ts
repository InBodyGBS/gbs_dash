/**
 * GBS 관리자 전용 — 사용자 + 역할 통합 조회
 * GET /api/admin/users
 *
 * 응답: user_profiles 와 user_roles 를 합쳐 사용자별 역할/법인 목록을 반환.
 * - "pending" 상태: user_roles 행이 0건인 사용자 (회원가입 후 미승인)
 * - "active":      user_roles 행이 1건 이상
 *
 * 권한: 호출자가 user_roles 에서 'gbs_admin' 이어야 함.
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

async function requireGbsAdmin(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
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
  const { data: roleRows, error: roleErr } = await svc
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  if (roleErr) {
    return { ok: false, res: NextResponse.json({ error: `권한 조회 실패: ${roleErr.message}` }, { status: 500 }) };
  }
  const isAdmin = (roleRows || []).some((r) => (r as { role?: string }).role === 'gbs_admin');
  if (!isAdmin) {
    return { ok: false, res: NextResponse.json({ error: '권한이 부족합니다.' }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  team: string | null;
  created_at: string;
  /** user_roles 행이 0건이면 빈 배열 (= pending) */
  roles: Array<{ role: string; entity_code: string | null }>;
  status: 'pending' | 'active';
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireGbsAdmin(req);
    if (!auth.ok) return auth.res;

    const svc = getServiceClient();

    // 1) auth.users (admin API) — 가입은 했으나 user_profiles 가 없는 케이스도 노출
    const { data: authList, error: authErr } = await svc.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) {
      return NextResponse.json({ error: `사용자 목록 조회 실패: ${authErr.message}` }, { status: 500 });
    }

    // 2) user_profiles
    const { data: profiles } = await svc
      .from('user_profiles')
      .select('id, email, name, team');
    const profileMap = new Map<string, { email?: string | null; name?: string | null; team?: string | null }>();
    for (const p of (profiles || []) as Array<{ id: string; email?: string | null; name?: string | null; team?: string | null }>) {
      profileMap.set(p.id, { email: p.email, name: p.name, team: p.team });
    }

    // 3) user_roles (전체)
    const { data: roleRows, error: roleErr } = await svc
      .from('user_roles')
      .select('user_id, role, entity_code');
    if (roleErr) {
      return NextResponse.json({ error: `역할 조회 실패: ${roleErr.message}` }, { status: 500 });
    }
    const rolesByUser = new Map<string, Array<{ role: string; entity_code: string | null }>>();
    for (const r of (roleRows || []) as Array<{ user_id: string; role: string; entity_code: string | null }>) {
      const arr = rolesByUser.get(r.user_id) || [];
      arr.push({ role: r.role, entity_code: r.entity_code });
      rolesByUser.set(r.user_id, arr);
    }

    const users: AdminUserRow[] = (authList?.users || []).map((u) => {
      const prof = profileMap.get(u.id) || {};
      const roles = rolesByUser.get(u.id) || [];
      const email = prof.email || u.email || '';
      return {
        id: u.id,
        email,
        name: prof.name ?? null,
        team: prof.team ?? null,
        created_at: u.created_at,
        roles,
        status: roles.length === 0 ? 'pending' : 'active',
      };
    });

    return NextResponse.json({ users });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
