'use client';

/**
 * Quarterly Closing 레이아웃
 * 3개 탭 네비게이션: Schedule, Submission, Reference
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Upload, BookOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface QuarterlyClosingLayoutProps {
  children: React.ReactNode;
}

const TABS = [
  { value: 'schedule', label: 'Schedule', icon: Calendar, href: '/quarterly-closing/schedule' },
  { value: 'submission', label: 'Submission', icon: Upload, href: '/quarterly-closing/submission' },
  { value: 'reference', label: 'Reference', icon: BookOpen, href: '/quarterly-closing/reference' },
] as const;

export default function QuarterlyClosingLayout({ children }: QuarterlyClosingLayoutProps) {
  const pathname = usePathname();

  // 현재 활성 탭 결정
  const getActiveTab = () => {
    if (pathname.includes('/schedule')) return 'schedule';
    if (pathname.includes('/submission')) return 'submission';
    if (pathname.includes('/reference')) return 'reference';
    return 'schedule';
  };

  const activeTab = getActiveTab();

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
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
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 페이지 컨텐츠 */}
      <div className="px-6">
        {children}
      </div>
    </div>
  );
}

