/**
 * Issue 카테고리 및 상태 상수
 */

import type { IssueCategory, IssueStatus } from '@/lib/types/issue';

export const ISSUE_CATEGORIES: readonly IssueCategory[] = [
  'Tax',              // 세무
  'Lease',            // 리스
  'Closing',          // 결산
  'System',           // 시스템
  'Audit',            // 감사
  'Depreciation',     // 감가상각
  'Labor SG&A',       // 인건비/판관비
  'Accrual',          // 미지급/선급
  'PKG',              // 포장비
  'Inventory',        // 재고
  'Bad debt',         // 대손
  'Allowance',        // 충당금
  'FS',               // 재무제표
  'Others',           // 기타
] as const;

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
  'Depreciation': '#EC4899',     // pink-500
  'Labor SG&A': '#14B8A6',       // teal-500
  'Accrual': '#F97316',          // orange-500
  'PKG': '#84CC16',              // lime-500
  'Inventory': '#06B6D4',        // cyan-500
  'Bad debt': '#DC2626',         // red-600
  'Allowance': '#7C3AED',        // violet-600
  'FS': '#2563EB',               // blue-600
  'Others': '#6B7280',           // gray-500
};

// 카테고리 한글 이름
export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  'Tax': '세무',
  'Lease': '리스',
  'Closing': '결산',
  'System': '시스템',
  'Audit': '감사',
  'Depreciation': '감가상각',
  'Labor SG&A': '인건비/판관비',
  'Accrual': '미지급/선급',
  'PKG': '포장비',
  'Inventory': '재고',
  'Bad debt': '대손',
  'Allowance': '충당금',
  'FS': '재무제표',
  'Others': '기타',
};

