/**
 * 권한 관리 대상 페이지 레지스트리.
 *
 * `role_page_permissions.page_id` 와 1:1 매칭되며,
 * /gbs/users 페이지의 권한 매트릭스 UI 와 사이드바 필터링이 이 목록을 사용한다.
 *
 * 카테고리(group)는 화면상 그룹핑용이며, role_page_permissions 에는 page.id 만 저장한다.
 */

export interface PageDef {
  id: string;          // = role_page_permissions.page_id
  label: string;       // 표시 이름
  path: string;        // 라우트 경로 (matching 용)
  group: string;       // 그룹핑용 (Common / Closing / ...)
}

/**
 * 모든 라우트가 다 들어 있을 필요는 없고, 권한 분리가 의미 있는 페이지만 등록한다.
 * Profile/Dashboard 처럼 "누구나 접근" 기본 페이지도 매트릭스에 포함시켜
 * 운영자가 명시적으로 허용/차단할 수 있게 한다.
 */
export const PAGE_REGISTRY: PageDef[] = [
  // Common
  { id: 'dashboard',           label: 'Main Dashboard',     path: '/',                          group: 'Common' },
  { id: 'profile',             label: '내 계정 설정',         path: '/profile',                   group: 'Common' },

  // Announcements
  { id: 'announcements',       label: 'Announcements',      path: '/announcements',             group: 'Announcements' },

  // Closing
  { id: 'finance-guide',       label: 'Accounting treatment', path: '/quarterly-closing/reference', group: 'Closing' },
  { id: 'quarterly-closing',   label: 'Financial Closing',  path: '/quarterly-closing',         group: 'Closing' },
  { id: 'my-submissions',      label: 'My Submissions',     path: '/my-submissions',            group: 'Closing' },

  // Financial Result
  { id: 'financial-result',    label: 'Entity map',         path: '/financial-result',          group: 'Financial Result' },
  { id: 'monthly-financial-dash', label: 'Financial dash',  path: '/monthly-closing/dashboard', group: 'Financial Result' },

  // Issue / VOE / etc
  { id: 'issue',               label: 'Issue',              path: '/issue',                     group: 'Operations' },
  { id: 'voe',                 label: 'VOE',                path: '/voe',                       group: 'Operations' },
  { id: 'system',              label: 'System',             path: '/system',                    group: 'Operations' },
  { id: 'audit-and-tax',       label: 'Audit and Tax',      path: '/audit-and-tax',             group: 'Operations' },

  // Admin
  { id: 'p-file',              label: 'P-File',             path: '/p-file',                    group: 'Admin' },
  { id: 'gbs',                 label: 'GBS',                path: '/gbs',                       group: 'Admin' },
  { id: 'gbs-calendar',        label: 'GBS Calendar',       path: '/gbs/calendar',              group: 'Admin' },
  { id: 'gbs-users',           label: 'User Management',    path: '/gbs/users',                 group: 'Admin' },
];

/** 그룹별로 페이지를 묶어 반환 (UI 매트릭스 표시용) */
export function getPagesByGroup(): Array<{ group: string; pages: PageDef[] }> {
  const map = new Map<string, PageDef[]>();
  for (const p of PAGE_REGISTRY) {
    const list = map.get(p.group) ?? [];
    list.push(p);
    map.set(p.group, list);
  }
  return Array.from(map.entries()).map(([group, pages]) => ({ group, pages }));
}

/** path 로 PageDef 찾기 (가장 긴 match 우선) */
export function findPageByPath(pathname: string): PageDef | null {
  const matches = PAGE_REGISTRY.filter(
    (p) => pathname === p.path || pathname.startsWith(`${p.path}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.path.length >= b.path.length ? a : b));
}
