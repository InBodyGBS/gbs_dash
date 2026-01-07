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
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';

export interface Category {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  featured?: boolean;
  description?: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'quarterly-closing',
    label: 'Quarterly Closing',
    path: '/quarterly-closing',
    icon: Calendar,
    featured: true,
    description: '분기별 마감 일정 관리',
  },
  {
    id: 'financial-result',
    label: 'Financial Result',
    path: '/financial-result',
    icon: TrendingUp,
    description: '법인별 재무 실적',
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
    id: 'p-file',
    label: 'P-File',
    path: '/p-file',
    icon: FolderOpen,
    description: '문서 보관함',
  },
] as const;

