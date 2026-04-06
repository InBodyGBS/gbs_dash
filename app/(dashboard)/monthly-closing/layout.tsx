'use client';

/**
 * Monthly Closing 레이아웃
 * 상단: Financial dash
 * 하위 탭: Upload, Mapping, Result, Financial dash (Financial dash 경로에서만 표시)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, GitBranch, BarChart3, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlyClosingLayoutProps {
  children: React.ReactNode;
}

// Financial dash 하위 탭 (Overview / Submission 상단 탭 없음)
const DASHBOARD_SUBTABS = [
  { value: 'upload', label: 'Upload', icon: Upload, href: '/monthly-closing/upload' },
  { value: 'mapping', label: 'Mapping', icon: GitBranch, href: '/monthly-closing/mapping' },
  { value: 'result', label: 'Result', icon: BarChart3, href: '/monthly-closing/result' },
  { value: 'dashboard', label: 'Financial dash', icon: LayoutDashboard, href: '/monthly-closing/dashboard' },
] as const;

export default function MonthlyClosingLayout({ children }: MonthlyClosingLayoutProps) {
  const pathname = usePathname();

  // 1차 탭 활성 상태 (Overview/Submission 페이지는 사이드 탭에 없음 → 미선택)
  const getActivePrimary = (): 'dashboard' | null => {
    if (
      pathname.includes('/upload') ||
      pathname.includes('/mapping') ||
      pathname.includes('/result') ||
      pathname.includes('/dashboard')
    ) {
      return 'dashboard';
    }
    return null;
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
      {/* Upload / Mapping / Result / Financial dash — Overview·Submission 제거 */}
      {activePrimary === 'dashboard' && (
        <div className="flex-shrink-0 border-b border-gray-200">
          <nav className="flex gap-2 px-6 py-2">
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
