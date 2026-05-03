/**
 * GBS 관리자 전용 — user_roles 변경 + 감사 로그 자동 기록
 *
 * POST   /api/admin/user-roles  : 사용자 역할 일괄 설정 (replace)
 *   body: { user_id, role, entity_codes: string[], reason }
 *   - role 이 'entity_user' 면 entity_codes 의 각 코드마다 1행씩 INSERT (기존 행 모두 삭제 후 교체)
 *   - 그 외 역할은 entity_code = NULL 로 1행 INSERT
 *
 * DELETE /api/admin/user-roles?user_id=...&reason=...
 *   - 해당 사용자의 모든 역할 삭제 (= 권한 회수, pending 상태로 되돌림)
 *
 * 안전장치:
 *   - 본인의 gbs_admin 권한 박탈 차단
 *   - 마지막 gbs_admin 제거 차단
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 2-tier 권한: 신규 부여는 entity_user / gbs_admin 만 허용
// (과거 gbs_user / executive 는 폐기 — DB 잔존 데이터는 읽기만 가능)
const VALID_ROLES = ['entity_user', 'gbs_admin'] as const;
type ValidRole = typeof VALID_ROLES[number];

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service-role 환경변수가 설정되지 않았습니다.');
  }
  return createClient(url, serviceKey);
}

interface ActorContext {
  userId: string;
  email: string | null;
  name: string | null;
}

async function requireGbsAdmin(
  req: NextRequest,
): Promise<{ ok: true; svc: SupabaseClient; actor: ActorContext } | { ok: false; res: NextResponse }> {
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

  const { data: profile } = await svc
    .from('user_profiles')
    .select('email, name')
    .eq('id', user.id)
    .maybeSingle();
  const p = profile as { email?: string | null; name?: string | null } | null;

  return {
    ok: true,
    svc,
    actor: {
      userId: user.id,
      email: p?.email ?? user.email ?? null,
      name: p?.name ?? null,
    },
  };
}

async function fetchTargetSnapshot(
  svc: SupabaseClient,
  userId: string,
): Promise<{ email: string | null; name: string | null; roles: Array<{ role: string; entity_code: string | null }> }> {
  const [{ data: prof }, { data: roles }] = await Promise.all([
    svc.from('user_profiles').select('email, name').eq('id', userId).maybeSingle(),
    svc.from('user_roles').select('role, entity_code').eq('user_id', userId),
  ]);
  const p = prof as { email?: string | null; name?: string | null } | null;
  const r = (roles || []) as Array<{ role: string; entity_code: string | null }>;
  return {
    email: p?.email ?? null,
    name: p?.name ?? null,
    roles: r.map((x) => ({ role: x.role, entity_code: x.entity_code })),
  };
}

function snapshotToState(roles: Array<{ role: string; entity_code: string | null }>) {
  if (roles.length === 0) return null;
  // 동일 role 의 entity_code 들을 묶어서 표현
  const grouped = new Map<string, Array<string | null>>();
  for (const r of roles) {
    const arr = grouped.get(r.role) || [];
    arr.push(r.entity_code);
    grouped.set(r.role, arr);
  }
  const out: Array<{ role: string; entity_codes: Array<string | null> }> = [];
  for (const [role, codes] of grouped.entries()) {
    out.push({ role, entity_codes: codes });
  }
  return out;
}

async function writeAuditLog(
  svc: SupabaseClient,
  params: {
    actor: ActorContext;
    target: { userId: string; email: string | null; name: string | null };
    action: 'approve' | 'update' | 'remove';
    before: ReturnType<typeof snapshotToState>;
    after: ReturnType<typeof snapshotToState>;
    reason: string | null;
  },
) {
  const { actor, target, action, before, after, reason } = params;
  const { error } = await svc.from('user_role_changes').insert({
    actor_id: actor.userId,
    actor_email: actor.email,
    actor_name: actor.name,
    target_user_id: target.userId,
    target_email: target.email,
    target_name: target.name,
    action,
    before_state: before,
    after_state: after,
    reason: reason ?? null,
  });
  if (error) {
    // 감사 실패는 로그만 남기고 본 작업은 성공 처리 (운영 안정성)
    console.error('user_role_changes 기록 실패:', error.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireGbsAdmin(req);
    if (!auth.ok) return auth.res;
    const { svc, actor } = auth;

    const body = (await req.json().catch(() => null)) as {
      user_id?: string;
      role?: string;
      entity_codes?: string[];
      reason?: string;
    } | null;
    if (!body || !body.user_id || !body.role) {
      return NextResponse.json({ error: 'user_id, role 은 필수입니다.' }, { status: 400 });
    }
    const role = body.role as ValidRole;
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `지원하지 않는 role: ${role}` }, { status: 400 });
    }
    const entityCodes = Array.isArray(body.entity_codes)
      ? body.entity_codes.map((c) => String(c).trim()).filter(Boolean)
      : [];
    if (role === 'entity_user' && entityCodes.length === 0) {
      return NextResponse.json({ error: 'entity_user 는 최소 1개 entity_code 가 필요합니다.' }, { status: 400 });
    }

    // 변경 전 스냅샷
    const before = await fetchTargetSnapshot(svc, body.user_id);

    // 안전장치 1: 본인의 admin 권한 자가 박탈 차단
    if (body.user_id === actor.userId) {
      const wasAdmin = before.roles.some((r) => r.role === 'gbs_admin');
      const willBeAdmin = role === 'gbs_admin';
      if (wasAdmin && !willBeAdmin) {
        return NextResponse.json(
          { error: '본인의 gbs_admin 권한은 스스로 변경할 수 없습니다. 다른 관리자에게 요청하세요.' },
          { status: 400 },
        );
      }
    }

    // 안전장치 2: 마지막 gbs_admin 제거 차단
    const wasAdmin = before.roles.some((r) => r.role === 'gbs_admin');
    const willBeAdmin = role === 'gbs_admin';
    if (wasAdmin && !willBeAdmin) {
      const { count } = await svc
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'gbs_admin');
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: '마지막 gbs_admin 권한은 제거할 수 없습니다. 다른 사용자에게 admin 을 부여한 뒤 다시 시도하세요.' },
          { status: 400 },
        );
      }
    }

    // 기존 역할 모두 삭제 후 교체
    const { error: delErr } = await svc.from('user_roles').delete().eq('user_id', body.user_id);
    if (delErr) {
      return NextResponse.json({ error: `기존 역할 삭제 실패: ${delErr.message}` }, { status: 500 });
    }

    const insertRows =
      role === 'entity_user'
        ? entityCodes.map((code) => ({ user_id: body.user_id!, role, entity_code: code }))
        : [{ user_id: body.user_id, role, entity_code: null }];

    const { error: insErr } = await svc.from('user_roles').insert(insertRows);
    if (insErr) {
      return NextResponse.json({ error: `역할 적용 실패: ${insErr.message}` }, { status: 500 });
    }

    const after = await fetchTargetSnapshot(svc, body.user_id);

    await writeAuditLog(svc, {
      actor,
      target: { userId: body.user_id, email: after.email, name: after.name },
      action: before.roles.length === 0 ? 'approve' : 'update',
      before: snapshotToState(before.roles),
      after: snapshotToState(after.roles),
      reason: body.reason ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireGbsAdmin(req);
    if (!auth.ok) return auth.res;
    const { svc, actor } = auth;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const reason = searchParams.get('reason');
    if (!userId) {
      return NextResponse.json({ error: 'user_id 가 필요합니다.' }, { status: 400 });
    }

    if (userId === actor.userId) {
      return NextResponse.json(
        { error: '본인 권한은 스스로 회수할 수 없습니다.' },
        { status: 400 },
      );
    }

    const before = await fetchTargetSnapshot(svc, userId);
    const wasAdmin = before.roles.some((r) => r.role === 'gbs_admin');
    if (wasAdmin) {
      const { count } = await svc
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'gbs_admin');
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: '마지막 gbs_admin 권한은 제거할 수 없습니다.' },
          { status: 400 },
        );
      }
    }

    const { error: delErr } = await svc.from('user_roles').delete().eq('user_id', userId);
    if (delErr) {
      return NextResponse.json({ error: `삭제 실패: ${delErr.message}` }, { status: 500 });
    }

    await writeAuditLog(svc, {
      actor,
      target: { userId, email: before.email, name: before.name },
      action: 'remove',
      before: snapshotToState(before.roles),
      after: null,
      reason,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
