/**
 * 사용자 관리 서비스 (gbs_admin 전용)
 * - /api/admin/* 라우트의 클라이언트 래퍼
 * - 모든 호출은 현재 세션의 access_token 을 Authorization 헤더로 전달
 */

import { supabase } from '@/lib/supabase/client';

export interface AdminUserRole {
  role: 'entity_user' | 'gbs_user' | 'gbs_admin' | 'executive';
  entity_code: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  team: string | null;
  created_at: string;
  roles: AdminUserRole[];
  status: 'pending' | 'active';
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  target_user_id: string;
  target_email: string | null;
  target_name: string | null;
  action: 'approve' | 'update' | 'remove';
  before_state: Array<{ role: string; entity_codes: Array<string | null> }> | null;
  after_state: Array<{ role: string; entity_codes: Array<string | null> }> | null;
  reason: string | null;
  created_at: string;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `요청 실패 (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const headers = await authHeaders();
  const res = await fetch('/api/admin/users', { headers });
  const json = await unwrap<{ users: AdminUserRow[] }>(res);
  return json.users;
}

export async function upsertUserRole(params: {
  userId: string;
  role: AdminUserRole['role'];
  entityCodes: string[];
  reason?: string;
}): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch('/api/admin/user-roles', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: params.userId,
      role: params.role,
      entity_codes: params.entityCodes,
      reason: params.reason ?? null,
    }),
  });
  await unwrap<{ ok: true }>(res);
}

export async function removeUserRoles(params: {
  userId: string;
  reason?: string;
}): Promise<void> {
  const headers = await authHeaders();
  const search = new URLSearchParams({ user_id: params.userId });
  if (params.reason) search.set('reason', params.reason);
  const res = await fetch(`/api/admin/user-roles?${search.toString()}`, {
    method: 'DELETE',
    headers,
  });
  await unwrap<{ ok: true }>(res);
}

export async function listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/audit-log?limit=${limit}`, { headers });
  const json = await unwrap<{ entries: AuditLogEntry[] }>(res);
  return json.entries;
}
