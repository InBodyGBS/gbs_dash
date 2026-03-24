'use client';

/**
 * Monthly Closing 레이아웃
 * 상단 3개 탭: Overview, Submission, Financial dash
 * Financial dash 탭 활성 시 하위 4개 탭: Upload, Mapping, Result, Financial dash
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, GitBranch, BarChart3, LayoutDashboard, FileSpreadsheet, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlyClosingLayoutProps {
  children: React.ReactNode;
}

// 상단 1차 탭
const PRIMARY_TABS = [
  { value: 'overview', label: 'Overview', icon: Eye, href: '/monthly-closing/overview' },
  { value: 'submission', label: 'Submission', icon: FileSpreadsheet, href: '/monthly-closing/submission' },
  { value: 'dashboard', label: 'Financial dash', icon: LayoutDashboard, href: '/monthly-closing/dashboard' },
] as const;

// Financial dash 하위 2차 탭
const DASHBOARD_SUBTABS = [
  { value: 'upload', label: 'Upload', icon: Upload, href: '/monthly-closing/upload' },
  { value: 'mapping', label: 'Mapping', icon: GitBranch, href: '/monthly-closing/mapping' },
  { value: 'result', label: 'Result', icon: BarChart3, href: '/monthly-closing/result' },
  { value: 'dashboard', label: 'Financial dash', icon: LayoutDashboard, href: '/monthly-closing/dashboard' },
] as const;

export default function MonthlyClosingLayout({ children }: MonthlyClosingLayoutProps) {
  const pathname = usePathname();

  // 1차 탭 활성 상태
  const getActivePrimary = () => {
    if (pathname.includes('/overview')) return 'overview';
    if (pathname.includes('/submission')) return 'submission';
    // upload/mapping/result/dashboard는 모두 dashboard 그룹으로 묶음
    if (
      pathname.includes('/upload') ||
      pathname.includes('/mapping') ||
      pathname.includes('/result') ||
      pathname.includes('/dashboard')
    ) {
      return 'dashboard';
    }
    return 'overview';
  };

  const activePrimary = getActivePrimary();

  // 2차 탭 활성 상태 (Dashboard 하위)
  const getActiveSub = () => {
    if (pathname.includes('/upload')) return 'upload';
    if (pathname.includes('/mapping')) return 'mapping';
    if (pathname.includes('/result')) return 'result';
    if (pathname.includes('/dashboard')) return 'dashboard';
    return 'dashboard';
  };

  const activeSub = getActiveSub();

  return (
    <div className="h-full flex flex-col">
      {/* 탭 네비게이션 - Fixed */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <nav className="flex gap-2 px-6">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activePrimary === tab.value;

            return (
              <Link
                key={tab.value}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
                  isActive
                    ? 'font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                )}
                style={isActive ? { borderBottomColor: '#971B2F', color: '#971B2F' } : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Dashboard 하위 탭 - Dashboard 활성 시에만 표시 */}
      {activePrimary === 'dashboard' && (
        <div className="flex-shrink-0 border-b border-gray-100">
          <nav className="flex gap-2 px-6 py-1">
            {DASHBOARD_SUBTABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSub === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 border-b-2 text-sm transition-colors',
                    isActive
                      ? 'font-medium'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  )}
                  style={isActive ? { borderBottomColor: '#971B2F', color: '#971B2F' } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* 페이지 컨텐츠 - Scrollable */}
      <div className="flex-1 min-h-0 overflow-auto px-6">
        {children}
      </div>
    </div>
  );
}
