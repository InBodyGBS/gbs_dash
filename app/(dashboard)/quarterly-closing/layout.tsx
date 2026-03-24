'use client';

/**
 * Financial Closing 레이아웃
 * 탭: Calendar, Overview, Submission — Finance guide는 Closing → Finance guide(사이드바)에서 진입
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Upload, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuarterlyClosingLayoutProps {
  children: React.ReactNode;
}

const TABS = [
  { value: 'calendar-t', label: 'Calendar', icon: CalendarDays, href: '/quarterly-closing/calendar-t' },
  { value: 'overview', label: 'Overview', icon: LayoutGrid, href: '/quarterly-closing/overview' },
  { value: 'submission', label: 'Submission', icon: Upload, href: '/quarterly-closing/submission' },
] as const;

export default function QuarterlyClosingLayout({ children }: QuarterlyClosingLayoutProps) {
  const pathname = usePathname();
  const isFinanceGuide = pathname.includes('/quarterly-closing/reference');

  if (isFinanceGuide) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto px-6 py-2">{children}</div>
      </div>
    );
  }

  const getActiveTab = () => {
    if (pathname.includes('/calendar-t')) return 'calendar-t';
    if (pathname.includes('/overview')) return 'overview';
    if (pathname.includes('/submission')) return 'submission';
    return 'calendar-t';
  };

  const activeTab = getActiveTab();

  return (
    <div className="h-full flex flex-col">
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

      <div className="flex-1 overflow-hidden px-6">
        {children}
      </div>
    </div>
  );
}
