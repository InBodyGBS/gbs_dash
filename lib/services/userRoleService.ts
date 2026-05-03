/**
 * 사용자 역할 조회 서비스
 * docs/user-roles-schema.sql 의 user_roles 테이블을 사용한다.
 *
 * 역할 종류 (2-tier):
 * - 'entity_user'  법인 사용자 (entity_code 로 자기 법인만 접근)
 * - 'gbs_admin'    본사 GBS 관리자 (전체 법인 조회 + 권한 관리)
 *
 * 과거에 있던 'gbs_user' / 'executive' 는 더 이상 사용하지 않는다.
 * DB에 잔존 데이터가 있을 경우 안전하게 처리하기 위해 본 코드에서는
 * 'gbs_user' / 'executive' 도 "전체 조회 가능(=gbs_admin 동급)"으로 폴백한다.
 */

import { supabase } from '@/lib/supabase/client';

/** 정식 역할 (앞으로 신규 부여 가능한 값) */
export type UserRole = 'entity_user' | 'gbs_admin';

/** DB 에서 읽힐 수 있는 모든 역할 — 레거시 값 포함 (런타임 폴백용) */
type StoredRole = UserRole | 'gbs_user' | 'executive';

export interface CurrentUserRoleInfo {
  userId: string | null;
  /** 가장 권한 높은 역할 (없으면 null) */
  role: UserRole | null;
  /** entity_user 인 경우 접근 가능한 entity_code 목록 */
  entityCodes: string[];
  /** 전체 법인을 볼 수 있는지 여부 (entity_user 가 아닌 경우 true) */
  canSeeAll: boolean;
}

/** 레거시 역할은 gbs_admin 으로 정규화 (전체 조회 가능 권한) */
function normalizeRole(role: StoredRole): UserRole {
  return role === 'entity_user' ? 'entity_user' : 'gbs_admin';
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  gbs_admin: 2,
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
  role: StoredRole;
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

  // 레거시 값(gbs_user/executive)은 gbs_admin 동급으로 정규화
  const normalizedRoles = rows.map((r) => normalizeRole(r.role));
  const highest = normalizedRoles.reduce<UserRole>((acc, role) => {
    return (ROLE_PRIORITY[role] ?? 0) > (ROLE_PRIORITY[acc] ?? 0) ? role : acc;
  }, normalizedRoles[0]);

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
