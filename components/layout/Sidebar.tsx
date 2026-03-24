'use client';

/**
 * 대시보드 좌측 사이드바 컴포넌트
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { CATEGORIES, getDeepestMatchingChild, pathMatchesChild } from '@/lib/constants/categories';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPath?: string;
}

export const Sidebar = ({ currentPath }: SidebarProps) => {
  const pathname = usePathname();
  const activePath = currentPath || pathname;

  const matchesFinancialResultBranch = (path: string) =>
    path.startsWith('/financial-result') || path.startsWith('/monthly-closing');

  // 현재 경로가 하위 항목에 해당하면 해당 부모를 기본으로 열어둠
  const getInitialOpen = () => {
    const set = new Set<string>();
    CATEGORIES.forEach((cat) => {
      if (
        cat.children?.some((child) => activePath.startsWith(child.path)) ||
        (cat.id === 'financial-result' && matchesFinancialResultBranch(activePath))
      ) {
        set.add(cat.id);
      }
    });
    return set;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(getInitialOpen);

  // 경로 변경 시 해당 부모 자동 열기
  useEffect(() => {
    CATEGORIES.forEach((cat) => {
      if (
        cat.children?.some((child) => pathMatchesChild(child.path, activePath)) ||
        (cat.id === 'financial-result' && matchesFinancialResultBranch(activePath))
      ) {
        setOpenGroups((prev) => new Set(prev).add(cat.id));
      }
    });
  }, [activePath]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col">
      {/* 로고 */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Building2 className="h-8 w-8" style={{ color: '#971B2F' }} />
          <span className="text-xl font-bold">InBody</span>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const hasChildren = !!category.children?.length;
          const isOpen = openGroups.has(category.id);
          const isActive = !!category.path && activePath === category.path;
          const activeChildInCategory =
            category.children && category.children.length > 0
              ? getDeepestMatchingChild([...category.children], activePath)
              : null;
          const isChildActive =
            activeChildInCategory !== null ||
            (category.id === 'financial-result' && matchesFinancialResultBranch(activePath));

          if (hasChildren) {
            return (
              <div key={category.id}>
                {/* 부모 항목 */}
                <button
                  onClick={() => toggleGroup(category.id)}
                  className={cn(
                    'w-full h-12 flex items-center px-6 text-sm transition-colors',
                    isChildActive
                      ? 'text-white font-medium bg-slate-800'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="flex-1 text-left">{category.label}</span>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                  }
                </button>

                {/* 하위 항목 */}
                {isOpen && (
                  <div className="bg-slate-950/40">
                    {category.children!.map((child) => {
                      const isChildItemActive = activeChildInCategory?.id === child.id;
                      return (
                        <div
                          key={child.id}
                          className={cn('relative', isChildItemActive && 'border-l-4')}
                          style={isChildItemActive ? { borderLeftColor: '#971B2F' } : undefined}
                        >
                          <Link
                            href={child.path}
                            className={cn(
                              'flex items-center h-10 pl-14 pr-6 text-sm transition-colors',
                              isChildItemActive
                                ? 'text-white font-medium bg-slate-800'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            )}
                          >
                            {child.label}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // 일반 항목
          return (
            <div
              key={category.id}
              className={cn('relative', isActive && 'border-l-4')}
              style={isActive ? { borderLeftColor: '#971B2F' } : undefined}
            >
              <Link
                href={category.path}
                className={cn(
                  'flex items-center h-12 px-6 text-sm transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                <span>{category.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <p>© 2026 InBody Co., Ltd.</p>
        <p className="mt-1">Global Business Support</p>
      </div>
    </aside>
  );
};
