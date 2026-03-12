'use client';

/**
 * Monthly Closing 레이아웃
 * 4개 탭 네비게이션: Upload, Mapping, Result, Dashboard
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, GitBranch, BarChart3, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlyClosingLayoutProps {
  children: React.ReactNode;
}

const TABS = [
  { value: 'upload', label: 'Upload', icon: Upload, href: '/monthly-closing/upload' },
  { value: 'mapping', label: 'Mapping', icon: GitBranch, href: '/monthly-closing/mapping' },
  { value: 'result', label: 'Result', icon: BarChart3, href: '/monthly-closing/result' },
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/monthly-closing/dashboard' },
] as const;

export default function MonthlyClosingLayout({ children }: MonthlyClosingLayoutProps) {
  const pathname = usePathname();

  // 현재 활성 탭 결정
  const getActiveTab = () => {
    if (pathname.includes('/upload')) return 'upload';
    if (pathname.includes('/mapping')) return 'mapping';
    if (pathname.includes('/result')) return 'result';
    if (pathname.includes('/dashboard')) return 'dashboard';
    return 'upload';
  };

  const activeTab = getActiveTab();

  return (
    <div className="h-full flex flex-col">
      {/* 탭 네비게이션 - Fixed */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <nav className="flex gap-2 px-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;

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

      {/* 페이지 컨텐츠 - Scrollable */}
      <div className="flex-1 overflow-hidden px-6">
        {children}
      </div>
    </div>
  );
}
