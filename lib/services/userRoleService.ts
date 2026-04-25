/**
 * 사용자 역할 조회 서비스
 * docs/user-roles-schema.sql 의 user_roles 테이블을 사용한다.
 *
 * 역할 종류:
 * - 'entity_user'  법인 사용자 (entity_code 로 자기 법인만 접근)
 * - 'gbs_user'     본사 GBS 사용자 (전체 법인 조회 가능)
 * - 'gbs_admin'    본사 GBS 관리자
 * - 'executive'    경영진
 */

import { supabase } from '@/lib/supabase/client';

export type UserRole = 'entity_user' | 'gbs_user' | 'gbs_admin' | 'executive';

export interface CurrentUserRoleInfo {
  userId: string | null;
  /** 가장 권한 높은 역할 (없으면 null) */
  role: UserRole | null;
  /** entity_user 인 경우 접근 가능한 entity_code 목록 */
  entityCodes: string[];
  /** 전체 법인을 볼 수 있는지 여부 (entity_user 가 아닌 경우 true) */
  canSeeAll: boolean;
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  gbs_admin: 4,
  gbs_user: 3,
  executive: 2,
  entity_user: 1,
};

const DEFAULT_INFO: CurrentUserRoleInfo = {
  userId: null,
  role: null,
  entityCodes: [],
  canSeeAll: true,
};

type UserRoleRow = {
  user_id: string;
  role: UserRole;
  entity_code: string | null;
};

/**
 * 현재 로그인한 사용자의 역할 정보를 조회한다.
 * - 미로그인이거나 user_roles 테이블이 없으면 "전체 조회 가능" 으로 반환 (기존 동작 유지)
 * - 한 사용자가 여러 행을 가질 수 있어 (UNIQUE(user_id, entity_code)),
 *   가장 높은 권한 1개를 대표 role 로 사용한다.
 */
export async function getCurrentUserRoleInfo(): Promise<CurrentUserRoleInfo> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_INFO;

  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role, entity_code')
    .eq('user_id', user.id);

  if (error) {
    if (error.code === '42P01') {
      // 테이블 없음 → 전체 조회 가능 (개발 환경/마이그레이션 전)
      return { ...DEFAULT_INFO, userId: user.id };
    }
    console.warn('user_roles 조회 실패 (전체 조회로 폴백):', error.message);
    return { ...DEFAULT_INFO, userId: user.id };
  }

  const rows = (data || []) as UserRoleRow[];
  if (rows.length === 0) {
    // 역할이 없으면 일단 전체 조회 가능으로 (운영 정책에 따라 추후 deny 로 바꿀 수 있음)
    return { ...DEFAULT_INFO, userId: user.id };
  }

  const highest = rows.reduce<UserRole>((acc, r) => {
    const cur = (ROLE_PRIORITY[r.role] ?? 0) > (ROLE_PRIORITY[acc] ?? 0) ? r.role : acc;
    return cur;
  }, rows[0].role);

  const entityCodes = [
    ...new Set(
      rows
        .map((r) => r.entity_code)
        .filter((v): v is string => Boolean(v && v.trim())),
    ),
  ];

  const canSeeAll = highest !== 'entity_user';

  return {
    userId: user.id,
    role: highest,
    entityCodes,
    canSeeAll,
  };
}
