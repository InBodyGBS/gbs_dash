'use client';

/**
 * Quarterly Closing 레이아웃
 * 5개 탭 네비게이션: Calendar, Calendar(T), Overview, Submission, Reference
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutGrid, Upload, BookOpen, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuarterlyClosingLayoutProps {
  children: React.ReactNode;
}

const TABS = [
  { value: 'calendar', label: 'Calendar', icon: CalendarDays, href: '/quarterly-closing/calendar' },
  { value: 'calendar-t', label: 'Calendar (T)', icon: FlaskConical, href: '/quarterly-closing/calendar-t' },
  { value: 'overview', label: 'Overview', icon: LayoutGrid, href: '/quarterly-closing/overview' },
  { value: 'submission', label: 'Submission', icon: Upload, href: '/quarterly-closing/submission' },
  { value: 'reference', label: 'Reference', icon: BookOpen, href: '/quarterly-closing/reference' },
] as const;

export default function QuarterlyClosingLayout({ children }: QuarterlyClosingLayoutProps) {
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname.includes('/calendar-t')) return 'calendar-t';
    if (pathname.includes('/calendar')) return 'calendar';
    if (pathname.includes('/overview')) return 'overview';
    if (pathname.includes('/submission')) return 'submission';
    if (pathname.includes('/reference')) return 'reference';
    return 'calendar';
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
