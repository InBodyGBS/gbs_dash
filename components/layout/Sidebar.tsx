'use client';

/**
 * 대시보드 좌측 사이드바 컴포넌트
 * 카테고리 네비게이션 메뉴를 표시합니다.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPath?: string;
}

export const Sidebar = ({ currentPath }: SidebarProps) => {
  const pathname = usePathname();
  const activePath = currentPath || pathname;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col">
      {/* 로고 영역 */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <Link 
          href="/" 
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Building2 className="h-8 w-8 text-blue-500" />
          <span className="text-xl font-bold">InBody</span>
        </Link>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 overflow-y-auto">
        {CATEGORIES.map((category) => {
          const isActive = activePath === category.path;
          const Icon = category.icon;

          if (category.featured) {
            // Featured 카테고리 (Quarterly Closing) - 큰 버튼
            return (
              <div key={category.id} className="m-4 mb-6">
                <Button
                  asChild
                  className={cn(
                    'w-full h-auto flex flex-col items-center justify-center gap-3 p-4 rounded-lg transition-all',
                    isActive
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                >
                  <Link href={category.path}>
                    <Icon className="w-8 h-8" />
                    <span className="text-lg font-semibold text-center whitespace-pre-line">
                      {category.label}
                    </span>
                  </Link>
                </Button>
              </div>
            );
          }

          // 일반 메뉴 아이템
          return (
            <div
              key={category.id}
              className={cn(
                'relative',
                isActive && 'border-l-4 border-blue-500'
              )}
            >
              <Button
                asChild
                variant="ghost"
                className={cn(
                  'w-full h-12 justify-start px-6 rounded-none transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white font-medium hover:bg-slate-800'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Link href={category.path}>
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="text-sm">{category.label}</span>
                </Link>
              </Button>
            </div>
          );
        })}
      </nav>

      {/* 하단 정보 */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <p>© 2026 InBody Co., Ltd.</p>
        <p className="mt-1">Global Business Support</p>
      </div>
    </aside>
  );
};

