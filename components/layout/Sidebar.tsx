'use client';

/**
 * 대시보드 좌측 사이드바 컴포넌트
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { CATEGORIES, getDeepestMatchingChild, pathMatchesChild, type Category } from '@/lib/constants/categories';
import { cn } from '@/lib/utils';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';
import { getAllowedPageIds, canAccessPage } from '@/lib/services/rolePagePermissionService';
import { getPendingUserCount } from '@/lib/services/userManagementService';
import { getUnreadVoeCount } from '@/lib/services/voeService';
import { findPageByPath } from '@/lib/constants/pages';
import { useT } from '@/lib/contexts/LanguageContext';

interface SidebarProps {
  currentPath?: string;
}

export const Sidebar = ({ currentPath }: SidebarProps) => {
  const pathname = usePathname();
  const activePath = currentPath || pathname;
  const t = useT();

  /* ── 현재 사용자 role 의 허용 페이지 집합 (사이드바 필터링용) ── */
  const [allowedPageIds, setAllowedPageIds] = useState<Set<string>>(new Set(['*']));
  /** gbs_admin 일 때만 채워짐 — 미승인 사용자 수 (배지용) */
  const [pendingCount, setPendingCount] = useState<number>(0);
  /** VOE 미확인 답변/문의 수 — 사이드바 VOE 메뉴 옆 배지용 */
  const [voeUnreadCount, setVoeUnreadCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await getCurrentUserRoleInfo();
      // 미로그인 / 미부여 / gbs_admin → 전체 허용
      if (!info.role || info.role === 'gbs_admin') {
        if (!cancelled) setAllowedPageIds(new Set(['*']));
      } else {
        // entity_user → role_page_permissions 조회
        const ids = await getAllowedPageIds(info.role);
        if (!cancelled) setAllowedPageIds(ids);
      }

      // gbs_admin 인 경우만 pending 카운트 fetch
      if (info.role === 'gbs_admin') {
        const cnt = await getPendingUserCount();
        if (!cancelled) setPendingCount(cnt);
      }

      // VOE 미확인 카운트 — 모든 로그인 사용자 대상
      const voeCnt = await getUnreadVoeCount();
      if (!cancelled) setVoeUnreadCount(voeCnt);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // 페이지 이동 시마다 카운트 재계산 (VOE 방문 후 0으로 떨어지도록)

  /** path 기반으로 접근 가능 여부 판정 (PAGE_REGISTRY 에 없는 라우트는 기본 허용) */
  const isPathAllowed = (path: string): boolean => {
    if (allowedPageIds.has('*')) return true;
    if (!path) return true;
    const def = findPageByPath(path);
    if (!def) return true; // 레지스트리에 없으면 통과 (기본 허용 정책)
    return canAccessPage(allowedPageIds, def.id);
  };

  /** 카테고리/하위 메뉴를 권한에 따라 필터링 */
  const visibleCategories = useMemo<Category[]>(() => {
    return CATEGORIES.filter((cat) => !cat.hidden)
      .map((cat) => {
        // children 이 있으면 children 을 필터
        if (cat.children?.length) {
          const visibleChildren = cat.children.filter((c) => isPathAllowed(c.path));
          if (visibleChildren.length === 0) return null;
          return { ...cat, children: visibleChildren };
        }
        // 일반 항목은 path 직접 검사
        if (cat.path && !isPathAllowed(cat.path)) return null;
        return cat;
      })
      .filter((c): c is Category => c !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedPageIds]);

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
          <Building2 className="h-8 w-8 flex-shrink-0" style={{ color: '#971B2F' }} />
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-bold tracking-tight truncate">{t('brand.name')}</span>
            <span className="text-[10px] text-slate-400 truncate">{t('brand.tagline_short')}</span>
          </div>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleCategories.map((category) => {
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
                            <span className="flex-1">{child.label}</span>
                            {/* User Management 옆 미승인 배지 (gbs_admin 만) */}
                            {child.id === 'gbs-users' && pendingCount > 0 && (
                              <span
                                className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold"
                                title={`승인 대기 ${pendingCount}건`}
                              >
                                {pendingCount > 99 ? '99+' : pendingCount}
                              </span>
                            )}
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
                <span className="flex-1">{category.label}</span>
                {/* VOE 미확인 배지 */}
                {category.id === 'voe' && voeUnreadCount > 0 && (
                  <span
                    className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold"
                    title={`새 답변/문의 ${voeUnreadCount}건`}
                  >
                    {voeUnreadCount > 99 ? '99+' : voeUnreadCount}
                  </span>
                )}
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
