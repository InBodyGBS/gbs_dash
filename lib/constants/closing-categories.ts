/**
 * Quarterly Closing 카테고리 상수
 * 3·6·9·12월(분기말)과 그 외 월에 따라 다른 카테고리 세트를 사용합니다.
 */

export type ClosingCategory = {
  readonly id: string;
  readonly label: string;
  readonly color: string;
};

/** 분기말(3·6·9·12월) 카테고리 */
export const CLOSING_CATEGORIES_QUARTER_END: readonly ClosingCategory[] = [
  { id: 'employee-jd', label: 'Employee JD', color: '#3B82F6' },
  { id: 'preliminary-sales', label: 'Preliminary Sales/SG&A', color: '#10B981' },
  { id: 'sales-sbp', label: 'Sales (SBP)', color: '#F59E0B' },
  { id: 'lease-detail', label: 'Lease detail', color: '#8B5CF6' },
  { id: 'ar-detail', label: 'AR detail', color: '#EC4899' },
  { id: 'inventory-detail', label: 'Inventory detail', color: '#14B8A6' },
  { id: 'demo-detail', label: 'Demo detail', color: '#6366F1' },
  { id: 'general-ledger', label: 'General Ledger', color: '#64748B' },
  { id: 'interco-transaction', label: 'Interco transaction', color: '#06B6D4' },
  { id: 'pkg-fs', label: 'PKG / FS', color: '#EF4444' },
] as const;

/** 그 외 월 카테고리 */
export const CLOSING_CATEGORIES_REGULAR: readonly ClosingCategory[] = [
  { id: 'trial-balance', label: 'Trial Balance', color: '#0EA5E9' },
  { id: 'sales-detail', label: 'Sales detail', color: '#F59E0B' },
  { id: 'inventory-detail', label: 'Inventory detail', color: '#14B8A6' },
  { id: 'ar-detail', label: 'AR detail', color: '#EC4899' },
  { id: 'general-ledger', label: 'General Ledger', color: '#64748B' },
] as const;

/** 기존 DB/제출에 남아 있을 수 있는 레거시 ID (표시·조회용) */
export const LEGACY_CLOSING_CATEGORIES: readonly ClosingCategory[] = [
  { id: 'sga-detail', label: 'SG&A detail', color: '#F97316' },
  { id: 'pkg', label: 'PKG', color: '#EF4444' },
] as const;

export const QUARTER_END_MONTHS = [3, 6, 9, 12] as const;

export function isQuarterEndMonth(month: number): boolean {
  const m = ((Math.floor(month) - 1 + 12) % 12) + 1;
  return (QUARTER_END_MONTHS as readonly number[]).includes(m);
}

/** 귀속 월(1–12)에 따른 활성 카테고리 목록 */
export function getClosingCategoriesForMonth(month: number): ClosingCategory[] {
  const m = ((Math.floor(month) - 1 + 12) % 12) + 1;
  if (isQuarterEndMonth(m)) {
    return [...CLOSING_CATEGORIES_QUARTER_END];
  }
  return [...CLOSING_CATEGORIES_REGULAR];
}

function uniqCategoriesById(categories: readonly ClosingCategory[]): ClosingCategory[] {
  const seen = new Set<string>();
  const out: ClosingCategory[] = [];
  for (const c of categories) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

/** 전역 룩업·레이블용 (활성 세트 + 레거시) */
export const CLOSING_CATEGORIES: ClosingCategory[] = uniqCategoriesById([
  ...CLOSING_CATEGORIES_QUARTER_END,
  ...CLOSING_CATEGORIES_REGULAR,
  ...LEGACY_CLOSING_CATEGORIES,
]);

export type ClosingCategoryId = string;

export const getCategoryById = (id: string): ClosingCategory | undefined => {
  return CLOSING_CATEGORIES.find((cat) => cat.id === id);
};

export const CATEGORY_IDS = CLOSING_CATEGORIES.map((cat) => cat.id);
