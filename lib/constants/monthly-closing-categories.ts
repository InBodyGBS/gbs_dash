/**
 * Monthly Closing 카테고리 상수
 * Trial balance / Sales / Inventory / AR / General ledger
 */

export const MONTHLY_CLOSING_CATEGORIES = [
  { id: 'trial-balance', label: 'Trial balance', color: '#3B82F6' },
  { id: 'sales', label: 'Sales', color: '#10B981' },
  { id: 'inventory', label: 'Inventory', color: '#14B8A6' },
  { id: 'ar', label: 'AR', color: '#EC4899' },
  { id: 'general-ledger', label: 'General ledger', color: '#F59E0B' },
] as const;

export type MonthlyClosingCategoryId = (typeof MONTHLY_CLOSING_CATEGORIES)[number]['id'];

export const getMonthlyClosingCategoryById = (
  id: MonthlyClosingCategoryId
): (typeof MONTHLY_CLOSING_CATEGORIES)[number] | undefined => {
  return MONTHLY_CLOSING_CATEGORIES.find((c) => c.id === id);
};

