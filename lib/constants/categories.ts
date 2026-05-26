/**
 * 대시보드 카테고리 상수 정의
 * 좌측 사이드바 네비게이션 메뉴 구성
 */

import {
  Calendar,
  TrendingUp,
  AlertCircle,
  ArrowLeftRight,
  Settings,
  FileCheck,
  Megaphone,
  ShieldCheck,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export interface SubCategory {
  id: string;
  label: string;
  path: string;
}

export interface Category {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  description?: string;
  children?: SubCategory[];
  hidden?: boolean;
}

/** 경로가 정확히 일치하거나 하위 경로일 때만 매칭 (부모 path가 조기 매칭되지 않도록) */
export function pathMatchesChild(childPath: string, pathname: string): boolean {
  return pathname === childPath || pathname.startsWith(`${childPath}/`);
}

/** 같은 그룹에서 가장 구체적으로 일치하는 하위 메뉴 (긴 path 우선) */
export function getDeepestMatchingChild(
  children: SubCategory[],
  pathname: string
): SubCategory | null {
  const matches = children.filter((ch) => pathMatchesChild(ch.path, pathname));
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.path.length >= b.path.length ? a : b));
}

export const CATEGORIES: Category[] = [
  {
    id: 'announcements',
    label: 'Announcements',
    path: '/announcements',
    icon: Megaphone,
    description: '공지사항 관리',
  },
  {
    id: 'closing',
    label: 'Closing',
    path: '',
    icon: Calendar,
    description: '마감 일정 관리',
    children: [
      { id: 'finance-guide', label: 'Accounting treatment', path: '/quarterly-closing/reference' },
      { id: 'quarterly-closing', label: 'Financial Closing', path: '/quarterly-closing' },
      { id: 'my-submissions', label: 'My Submissions', path: '/my-submissions' },
    ],
  },
  {
    id: 'financial-result',
    label: 'Financial Result',
    path: '',
    icon: TrendingUp,
    description: '법인별 재무 실적 및 월마감',
    children: [
      { id: 'financial-result-main', label: 'Entity map', path: '/financial-result' },
      {
        id: 'monthly-financial-dash',
        label: 'Financial dash',
        path: '/monthly-closing/dashboard',
      },
    ],
  },
  {
    id: 'issue',
    label: 'Issue',
    path: '/issue',
    icon: AlertCircle,
    description: '현안 사항 관리',
  },
  {
    id: 'inter-co-transaction',
    label: 'Inter-co Transaction',
    path: '/inter-co-transaction',
    icon: ArrowLeftRight,
    description: '법인 간 거래 내역',
    hidden: true,
  },
  {
    id: 'system',
    label: 'System',
    path: '/system',
    icon: Settings,
    description: 'ERP 시스템 사용 현황',
  },
  {
    id: 'audit-and-tax',
    label: 'Audit and Tax',
    path: '/audit-and-tax',
    icon: FileCheck,
    description: '감사 및 세무',
  },
  {
    id: 'voe',
    label: 'VOE',
    path: '/voe',
    icon: MessageSquare,
    description: 'Voice of Entity — 법인 문의',
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '',
    icon: ShieldCheck,
    description: '관리자 메뉴',
    children: [
      { id: 'p-file', label: 'P-File', path: '/p-file' },
      { id: 'gbs', label: 'GBS', path: '/gbs' },
      { id: 'gbs-calendar', label: 'Calendar', path: '/gbs/calendar' },
      { id: 'gbs-users', label: 'User Management', path: '/gbs/users' },
      { id: 'gbs-closing-tasks', label: '결산 일정표', path: '/gbs/closing-tasks' },
    ],
  },
] as const;
