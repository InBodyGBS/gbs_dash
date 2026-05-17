/**
 * 사용자 권한에 따라 접근 가능한 법인 목록만 조회.
 *
 *  - gbs_admin / 미부여 / 레거시 권한 → 전체 법인
 *  - entity_user                       → 본인 entity_code 에 해당하는 법인만
 *
 * 사용 가이드:
 *  - 페이지의 Entity 드롭다운에서 `supabase.from('subsidiaries').select('*')` 를 직접
 *    호출하지 말고, 본 함수를 사용해 권한이 자동으로 적용되도록 한다.
 *  - "전체" 옵션은 `canSeeAll === true` 일 때만 노출한다.
 */

import { supabase } from '@/lib/supabase/client';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';
import type { Subsidiary } from '@/lib/supabase/types';

export interface SubsidiariesAccess {
  /** 권한에 따라 필터된 법인 목록 (name 오름차순) */
  subsidiaries: Subsidiary[];
  /** 전체 법인 조회 가능 여부 — entity_user 면 false */
  canSeeAll: boolean;
  /** entity_user 인 경우 접근 가능한 entity_code 목록 (gbs_admin 은 빈 배열) */
  entityCodes: string[];
}

/**
 * 현재 로그인 사용자가 볼 수 있는 법인 목록을 반환.
 */
export async function fetchSubsidiariesForCurrentUser(): Promise<SubsidiariesAccess> {
  const roleInfo = await getCurrentUserRoleInfo();

  let query = supabase.from('subsidiaries').select('*').order('name');

  if (!roleInfo.canSeeAll) {
    if (roleInfo.entityCodes.length === 0) {
      // 담당 법인이 없으면 강제로 빈 결과 (사고 방지)
      query = query.in('code', ['__no_entity__']);
    } else {
      query = query.in('code', roleInfo.entityCodes);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    subsidiaries: (data || []) as Subsidiary[],
    canSeeAll: roleInfo.canSeeAll,
    entityCodes: roleInfo.entityCodes,
  };
}

/**
 * 드롭다운 초기값 보정 헬퍼.
 * - entity_user 가 'all' 또는 본인 담당이 아닌 ID 를 갖고 있으면 첫 담당 법인으로 교체.
 * - 그 외 경우엔 현재 선택을 유지.
 */
export function pickInitialSubsidiaryId(
  current: string,
  access: Pick<SubsidiariesAccess, 'subsidiaries' | 'canSeeAll'>,
): string {
  if (access.canSeeAll) return current;
  const validIds = new Set(access.subsidiaries.map((s) => s.id));
  if (current === 'all' || !validIds.has(current)) {
    return access.subsidiaries[0]?.id ?? current;
  }
  return current;
}
