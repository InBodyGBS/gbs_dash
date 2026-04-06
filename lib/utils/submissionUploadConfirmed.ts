import type { ScheduleItem } from '@/lib/types/quarterly-closing';
import type { CategoryReviewStatus, ReviewStatus } from '@/lib/types/category-review';

/** OverviewGrid와 동일: `${subsidiaryId}__${categoryId}` */
export const overviewReviewKey = (subsidiaryId: string, categoryId: string) =>
  `${subsidiaryId}__${categoryId}`;

export function buildReviewStatusMap(
  list: CategoryReviewStatus[],
): Map<string, ReviewStatus> {
  const m = new Map<string, ReviewStatus>();
  for (const r of list) {
    m.set(overviewReviewKey(r.subsidiary_id, r.category), r.status);
  }
  return m;
}

/**
 * useScheduleData의 scheduleItemsScopedToMonth와 동일하게 필터
 */
export function scopeScheduleItemsToClosingMonth(
  items: ScheduleItem[],
  selectedYear: string,
  selectedMonth: string,
  activeCategoryIds: Set<string>,
): ScheduleItem[] {
  const fy = parseInt(selectedYear, 10);
  const monthNum = parseInt(selectedMonth, 10) || 1;
  const ymPrefix = `${fy}-${String(monthNum).padStart(2, '0')}`;
  return items.filter(
    (item) => activeCategoryIds.has(item.category) && item.planned_date.startsWith(ymPrefix),
  );
}

/**
 * Overview 셀이 확정(confirmed)이면 추가 제출 불가.
 * Entity 미선택(전체) 시에는 셀 단위 판단이 불가하므로 false.
 */
export function isSubmissionBlockedByOverviewConfirm(params: {
  subsidiaryId: string | null | undefined;
  categoryId: string;
  reviewMap: Map<string, ReviewStatus>;
  scheduleItemsScopedToMonth: ScheduleItem[];
}): boolean {
  const { subsidiaryId, categoryId, reviewMap, scheduleItemsScopedToMonth } = params;
  if (!subsidiaryId) return false;

  if (reviewMap.get(overviewReviewKey(subsidiaryId, categoryId)) === 'confirmed') {
    return true;
  }

  const items = scheduleItemsScopedToMonth.filter(
    (i) => i.subsidiary_id === subsidiaryId && i.category === categoryId,
  );
  return items.some((i) => i.status === 'confirmed');
}
