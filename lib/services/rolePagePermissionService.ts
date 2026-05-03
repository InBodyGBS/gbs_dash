/**
 * 역할별 페이지 접근 권한 서비스.
 *
 * 정책:
 *   - gbs_admin  → 항상 모든 페이지 접근 (테이블 조회 생략)
 *   - entity_user → role_page_permissions 테이블에 행이 있는 page_id 만 접근 허용
 *   - 미로그인 / role 없음 → 기본 허용 (현 단계 정책 — 운영 시 deny 로 강화 가능)
 */

import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/services/userRoleService';

export type ManagedRole = Extract<UserRole, 'entity_user' | 'gbs_admin'>;

interface RolePagePermissionRow {
  role: ManagedRole;
  page_id: string;
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('does not exist')) ||
    Boolean(error.message?.includes('Could not find the table'))
  );
}

/**
 * 특정 role 의 허용 page_id 목록을 가져온다.
 * gbs_admin 은 무조건 전체 허용이므로 PAGE_REGISTRY 의 모든 id 가 반환되는 것과 같다.
 * (UI/사이드바는 role 별로 호출)
 */
export async function getAllowedPageIds(role: ManagedRole): Promise<Set<string>> {
  if (role === 'gbs_admin') {
    // 코드 레벨에서 항상 허용 — 호출자는 PAGE_REGISTRY 와 비교해 사용
    return new Set<string>(['*']);
  }

  const { data, error } = await supabase
    .from('role_page_permissions' as never)
    .select('page_id')
    .eq('role', role);

  if (error) {
    if (isMissingTableError(error)) {
      console.warn(
        'role_page_permissions 테이블이 없습니다. docs/role-page-permissions-schema.sql 을 실행하세요.',
      );
      return new Set<string>(['*']); // 폴백: 전체 허용
    }
    console.error('role_page_permissions 조회 실패:', error.message);
    return new Set<string>();
  }

  return new Set<string>((data ?? []).map((r) => (r as { page_id: string }).page_id));
}

/**
 * UI 매트릭스용 — 모든 관리 대상 role 의 page_id 매핑을 한 번에 조회.
 */
export async function getAllRolePagePermissions(): Promise<Record<ManagedRole, Set<string>>> {
  const empty: Record<ManagedRole, Set<string>> = {
    entity_user: new Set<string>(),
    gbs_admin: new Set<string>(['*']),
  };

  const { data, error } = await supabase
    .from('role_page_permissions' as never)
    .select('role, page_id');

  if (error) {
    if (isMissingTableError(error)) {
      console.warn(
        'role_page_permissions 테이블이 없습니다. docs/role-page-permissions-schema.sql 을 실행하세요.',
      );
      return empty;
    }
    console.error(error.message);
    return empty;
  }

  const result: Record<ManagedRole, Set<string>> = {
    entity_user: new Set<string>(),
    gbs_admin: new Set<string>(['*']),
  };
  for (const row of (data ?? []) as RolePagePermissionRow[]) {
    if (row.role === 'entity_user' || row.role === 'gbs_admin') {
      result[row.role].add(row.page_id);
    }
  }
  return result;
}

/**
 * 특정 role 의 허용 페이지 목록을 통째로 교체한다.
 * gbs_admin 은 잠금 — 호출 시도 시 빠르게 무시.
 */
export async function setRolePagePermissions(
  role: ManagedRole,
  pageIds: string[],
): Promise<void> {
  if (role === 'gbs_admin') {
    // 정책 상 편집 불가 — 호출자가 잘못 호출했을 때 안전하게 무시
    return;
  }

  // 1) 기존 행 모두 삭제
  const { error: delErr } = await supabase
    .from('role_page_permissions' as never)
    .delete()
    .eq('role', role);
  if (delErr) {
    if (isMissingTableError(delErr)) {
      throw new Error(
        'role_page_permissions 테이블이 없습니다. docs/role-page-permissions-schema.sql 을 실행한 뒤 다시 시도하세요.',
      );
    }
    throw new Error(`기존 권한 삭제 실패: ${delErr.message}`);
  }

  if (pageIds.length === 0) return;

  // 2) 새 권한 INSERT (중복 방어 — UNIQUE(role, page_id))
  const rows = [...new Set(pageIds)].map((page_id) => ({ role, page_id }));
  const { error: insErr } = await supabase
    .from('role_page_permissions' as never)
    .insert(rows as never);
  if (insErr) {
    throw new Error(`권한 저장 실패: ${insErr.message}`);
  }
}

/**
 * 사용자의 현재 role 기준으로 특정 page_id 접근 가능한지 판정.
 * - allowedSet 에 '*' 가 있으면 무조건 허용 (gbs_admin / 폴백)
 */
export function canAccessPage(allowedSet: Set<string>, pageId: string): boolean {
  if (allowedSet.has('*')) return true;
  return allowedSet.has(pageId);
}
