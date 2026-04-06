'use client';

/**
 * GBS 레이아웃
 * 상단 탭: 업무기술서, 업무분장표 (Calendar는 Admin 사이드바에서 진입)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GBSLayoutProps {
  children: React.ReactNode;
}

const TABS = [
  { value: 'work-manual', label: '업무기술서', icon: FileText, href: '/gbs/work-manual' },
  { value: 'work-assignment', label: '업무분장표', icon: Users, href: '/gbs/work-assignment' },
] as const;

export default function GBSLayout({ children }: GBSLayoutProps) {
  const pathname = usePathname();

  // 현재 활성 탭 결정
  const getActiveTab = (): string | null => {
    if (pathname.includes('/work-manual')) return 'work-manual';
    if (pathname.includes('/work-assignment')) return 'work-assignment';
    return null;
  };

  const activeTab = getActiveTab();

  return (
    <div className="h-full flex flex-col">
      {/* 탭 네비게이션 - Fixed */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <nav className="flex gap-2 px-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab !== null && activeTab === tab.value;

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
