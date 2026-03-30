/**
 * Issue 카테고리 및 상태 상수
 */

import type { IssueCategory, IssueStatus } from '@/lib/types/issue';

const uniqSorted = (categories: readonly IssueCategory[]): readonly IssueCategory[] => {
  return [...new Set(categories)].sort((a, b) => a.localeCompare(b, 'en'));
};

/**
 * "현재 사용" 카테고리 (UI 선택지/필터/AI 분류용)
 * - 과거 카테고리는 데이터 호환을 위해 타입/라벨/색상은 남기되, 선택지에서는 숨깁니다.
 * - 정렬은 알파벳순.
 */
export const ISSUE_CATEGORIES_ACTIVE: readonly IssueCategory[] = uniqSorted([
  'Accrual',
  'Allowance',
  'Audit/Tax',
  'Fixed Asset /Lease',
  'Inventory/Demo',
  'Others',
  'PKG/FS',
  'Sales',
  'System',
]);

/** 과거(레거시) 카테고리 — 기존 데이터 표시/조회 호환용 */
export const ISSUE_CATEGORIES_LEGACY: readonly IssueCategory[] = uniqSorted([
  'Tax',
  'Lease',
  'Closing',
  'Audit',
  'Depreciation',
  'Labor SG&A',
  'PKG',
  'Inventory',
  'Bad debt',
  'FS',
  'Demo',
]);

/**
 * 기본 export는 "활성" 목록으로 둡니다.
 * 기존 컴포넌트들이 `ISSUE_CATEGORIES`를 사용 중이라, 의도적으로 레거시가 안 보이게 하기 위함입니다.
 */
export const ISSUE_CATEGORIES: readonly IssueCategory[] = ISSUE_CATEGORIES_ACTIVE;

export const ISSUE_STATUS: Record<string, IssueStatus> = {
  IN_PROGRESS: '확인 중',
  COMPLETED: '완료',
} as const;

export const ISSUE_STATUS_LIST: readonly IssueStatus[] = ['확인 중', '완료'] as const;

// 카테고리 색상 매핑
export const CATEGORY_COLORS: Record<IssueCategory, string> = {
  'Tax': '#EF4444',              // red-500
  'Lease': '#F59E0B',            // amber-500
  'Closing': '#10B981',          // emerald-500
  'System': '#3B82F6',           // blue-500
  'Audit': '#8B5CF6',            // violet-500
  'Audit/Tax': '#8B5CF6',        // violet-500 (Audit 계열)
  'Depreciation': '#EC4899',     // pink-500
  'Fixed Asset /Lease': '#F59E0B', // amber-500 (Lease 계열)
  'Labor SG&A': '#14B8A6',       // teal-500
  'Accrual': '#F97316',          // orange-500
  'PKG': '#84CC16',              // lime-500
  'PKG/FS': '#2563EB',           // blue-600 (FS 계열)
  'Inventory': '#06B6D4',        // cyan-500
  'Inventory/Demo': '#06B6D4',   // cyan-500 (Inventory 계열)
  'Bad debt': '#DC2626',         // red-600
  'Allowance': '#7C3AED',        // violet-600
  'FS': '#2563EB',               // blue-600
  'Sales': '#22C55E',            // green-500
  'Demo': '#A855F7',             // purple-500
  'Others': '#6B7280',           // gray-500
};

// 카테고리 한글 이름
export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  'Tax': '세무',
  'Lease': '리스',
  'Closing': '결산',
  'System': '시스템',
  'Audit': '감사',
  'Audit/Tax': '감사/세무',
  'Depreciation': '감가상각',
  'Fixed Asset /Lease': '고정자산/리스',
  'Labor SG&A': '인건비/판관비',
  'Accrual': '미지급/선급',
  'PKG': '포장비',
  'PKG/FS': 'PKG/FS',
  'Inventory': '재고',
  'Inventory/Demo': '재고/데모',
  'Bad debt': '대손',
  'Allowance': '충당금',
  'FS': '재무제표',
  'Sales': '영업',
  'Demo': '데모',
  'Others': '기타',
};

