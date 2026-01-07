/**
 * Quarterly Closing 카테고리 상수
 * 9개 결산 서류 카테고리 정의
 */

export const CLOSING_CATEGORIES = [
  { id: 'employee-jd', label: 'Employee JD', color: '#3B82F6' },
  { id: 'preliminary-sales', label: 'Preliminary Sales/SG&A', color: '#10B981' },
  { id: 'sales-detail', label: 'Sales detail', color: '#F59E0B' },
  { id: 'lease-detail', label: 'Lease detail', color: '#8B5CF6' },
  { id: 'ar-detail', label: 'AR detail', color: '#EC4899' },
  { id: 'inventory-detail', label: 'Inventory detail', color: '#14B8A6' },
  { id: 'sga-detail', label: 'SG&A detail', color: '#F97316' },
  { id: 'demo-detail', label: 'Demo detail', color: '#6366F1' },
  { id: 'pkg', label: 'PKG', color: '#EF4444' },
] as const;

/**
 * 카테고리 ID 타입
 */
export type ClosingCategoryId = typeof CLOSING_CATEGORIES[number]['id'];

/**
 * 카테고리 객체 타입
 */
export type ClosingCategory = typeof CLOSING_CATEGORIES[number];

/**
 * ID로 카테고리 찾기
 */
export const getCategoryById = (id: ClosingCategoryId): ClosingCategory | undefined => {
  return CLOSING_CATEGORIES.find((cat) => cat.id === id);
};

/**
 * 카테고리 ID 목록
 */
export const CATEGORY_IDS = CLOSING_CATEGORIES.map((cat) => cat.id);

