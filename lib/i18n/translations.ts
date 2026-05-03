/**
 * 번역 사전 — KR/EN 다국어 지원
 *
 * 새 문자열 추가 시:
 *   1) 아래 dictionary 에 한 줄 추가: `key: { ko: '한국어', en: 'English' }`
 *   2) 컴포넌트에서 `const t = useT(); ... t('your.key')` 로 사용
 *
 * 키 컨벤션: `<영역>.<요소>` (예: 'dashboard.title', 'sidebar.user_management')
 * 점진적으로 채워나가도 되며, 사전에 없는 키는 fallback 으로 키 자체를 그대로 표시한다.
 */

export type Lang = 'ko' | 'en';

export const dictionary = {
  // ── Brand ──
  /** 제품명 (헤더/로고 등) — 변경 시 한 곳만 수정하면 됨 */
  'brand.name': { ko: 'InBody Accounting Portal', en: 'InBody Accounting Portal' },
  /** 부제 — 로고 아래에 작게 표시 */
  'brand.tagline': {
    ko: '본사 · 해외법인 회계 통합 포털',
    en: 'Headquarters & Overseas Subsidiaries',
  },
  /** 짧은 부제 (사이드바 등 좁은 영역용) */
  'brand.tagline_short': {
    ko: '회계 통합 포털',
    en: 'Accounting Hub',
  },

  // ── Common ──
  'common.loading': { ko: '로딩 중...', en: 'Loading...' },
  'common.refresh': { ko: '새로고침', en: 'Refresh' },
  'common.save': { ko: '저장', en: 'Save' },
  'common.cancel': { ko: '취소', en: 'Cancel' },
  'common.view_all': { ko: 'View All', en: 'View All' },
  'common.no_data': { ko: '데이터가 없습니다.', en: 'No data.' },
  'common.login': { ko: '로그인', en: 'Login' },
  'common.logout': { ko: '로그아웃', en: 'Logout' },

  // ── Dashboard ──
  'dashboard.title': { ko: 'GBS Dashboard', en: 'GBS Dashboard' },
  'dashboard.last_updated': { ko: '마지막 업데이트', en: 'Last updated' },
  'dashboard.stats.announcements': { ko: 'Announcements', en: 'Announcements' },
  'dashboard.stats.announcements_hint': { ko: '최근 7일 이내', en: 'Last 7 days' },
  'dashboard.stats.upcoming_deadlines': { ko: 'Upcoming Deadlines', en: 'Upcoming Deadlines' },
  'dashboard.stats.upcoming_hint': { ko: '15일 이내', en: 'Within 15 days' },
  'dashboard.stats.pending_voe': { ko: 'Pending VOE', en: 'Pending VOE' },
  'dashboard.stats.pending_voe_hint': { ko: '미완료 문의', en: 'Open inquiries' },

  'dashboard.closing_schedule': { ko: 'Closing Schedule', en: 'Closing Schedule' },
  'dashboard.my_deadlines': { ko: 'My Deadlines', en: 'My Deadlines' },
  'dashboard.all_deadlines': { ko: 'All Deadlines', en: 'All Deadlines' },
  'dashboard.entity_progress': { ko: 'Entity Progress', en: 'Entity Progress' },
  'dashboard.tasks': { ko: 'Tasks', en: 'Tasks' },

  'dashboard.empty.my_deadlines': { ko: '15일 이내 본인 마감이 없습니다.', en: 'No deadlines for you in the next 15 days.' },
  'dashboard.empty.all_deadlines': { ko: '15일 이내 예정된 마감이 없습니다.', en: 'No deadlines scheduled in the next 15 days.' },
  'dashboard.empty.entity_progress': { ko: '15일 이내 추적 가능한 법인 마감이 없습니다.', en: 'No entity deadlines to track in the next 15 days.' },
  'dashboard.empty.tasks': { ko: '미완료 작업이 없습니다.', en: 'No open tasks.' },

  'dashboard.status.submitted': { ko: '제출완료', en: 'Submitted' },
  'dashboard.status.overdue': { ko: '지연', en: 'Overdue' },
  'dashboard.status.pending': { ko: '미제출', en: 'Pending' },

  'dashboard.pending_users.title': { ko: '승인 대기 {count}건', en: '{count} pending approval(s)' },
  'dashboard.pending_users.desc': { ko: '신규 가입한 사용자가 권한 부여를 기다리고 있습니다.', en: 'New users are waiting for role assignment.' },
  'dashboard.pending_users.cta': { ko: '사용자 관리로 이동', en: 'Go to User Management' },

  // ── Sidebar ──
  'sidebar.announcements': { ko: 'Announcements', en: 'Announcements' },
  'sidebar.closing': { ko: 'Closing', en: 'Closing' },
  'sidebar.financial_result': { ko: 'Financial Result', en: 'Financial Result' },
  'sidebar.issue': { ko: 'Issue', en: 'Issue' },
  'sidebar.system': { ko: 'System', en: 'System' },
  'sidebar.audit_and_tax': { ko: 'Audit and Tax', en: 'Audit and Tax' },
  'sidebar.voe': { ko: 'VOE', en: 'VOE' },
  'sidebar.admin': { ko: 'Admin', en: 'Admin' },

  // ── Header ──
  'header.profile': { ko: '내 계정 설정', en: 'My Profile' },
  'header.logout': { ko: '로그아웃', en: 'Logout' },

  // ── Login ──
  'login.title': { ko: '계정으로 계속하기', en: 'Continue with your account' },
  'login.email': { ko: '이메일', en: 'Email' },
  'login.password': { ko: '비밀번호', en: 'Password' },
  'login.signin': { ko: '로그인', en: 'Sign in' },
  'login.signup': { ko: '회원가입', en: 'Sign up' },
  'login.forgot': { ko: '비밀번호를 잊으셨나요?', en: 'Forgot your password?' },
  'login.remember': { ko: '로그인 정보 저장 (30일간 유지)', en: 'Remember me (30 days)' },

  // ── About this Dashboard (login page) ──
  'about.title': { ko: '이 대시보드란?', en: 'About this Dashboard' },
  'about.summary': {
    ko: 'InBody 본사 GBS 팀과 해외 법인 담당자가 회계 마감, 제출, 감사, 문의를 한곳에서 함께 관리하는 통합 대시보드입니다.',
    en: 'A unified dashboard where InBody headquarters\' GBS team and overseas entity staff jointly manage closing, submissions, audits, and inquiries.',
  },

  // 법인 담당자 (Entity Users) 관점
  'about.user.heading': { ko: '법인 담당자에게는', en: 'For Entity Staff' },
  'about.user.1.title': { ko: '내 마감, 한눈에', en: 'My deadlines at a glance' },
  'about.user.1.desc': {
    ko: '본인 법인의 마감 일정을 D-day와 함께 정렬해서 표시',
    en: 'See your entity\'s deadlines sorted by D-day',
  },
  'about.user.2.title': { ko: '쉬운 제출', en: 'Easy submission' },
  'about.user.2.desc': {
    ko: '카테고리별 표준 양식으로 업로드와 이력 관리',
    en: 'Upload via standard templates and review submission history',
  },
  'about.user.3.title': { ko: '회계 가이드 & FAQ', en: 'Accounting guides & FAQ' },
  'about.user.3.desc': {
    ko: 'Accounting Treatment 가이드를 셀프 서비스로 참고',
    en: 'Self-service access to Accounting Treatment guides',
  },
  'about.user.4.title': { ko: '본사 GBS 팀에 직접 문의', en: 'Direct line to HQ GBS' },
  'about.user.4.desc': {
    ko: 'VOE 채널로 본사 GBS 팀에 회계 질문 바로 전달',
    en: 'Send accounting inquiries straight to the HQ GBS team via VOE',
  },

  // GBS 팀 (Admins) 관점
  'about.admin.heading': { ko: 'GBS 팀에게는', en: 'For GBS Team' },
  'about.admin.1.title': { ko: '전체 법인 모니터링', en: 'Full entity overview' },
  'about.admin.1.desc': {
    ko: '모든 법인의 마감 진척률을 한 화면에서 추적',
    en: 'Track closing progress across all entities in one view',
  },
  'about.admin.2.title': { ko: '지연 사전 감지', en: 'Early lag detection' },
  'about.admin.2.desc': {
    ko: 'D-day 기반으로 늦어지는 법인을 미리 발견',
    en: 'Spot lagging entities early via D-day tracking',
  },
  'about.admin.3.title': { ko: '문의 단일 채널', en: 'Single inquiry channel' },
  'about.admin.3.desc': {
    ko: '이메일·메신저로 흩어진 문의를 VOE에 집중 응대',
    en: 'Consolidate scattered emails and chats into VOE',
  },
  'about.admin.4.title': { ko: '권한 & 가입 워크플로', en: 'Roles & approval workflow' },
  'about.admin.4.desc': {
    ko: '법인별 접근 분리, 신규 가입 승인, 페이지별 권한 관리',
    en: 'Per-entity access, signup approvals, page-level permissions',
  },

  'about.show': { ko: '자세히 보기', en: 'Learn more' },
  'about.hide': { ko: '간단히 보기', en: 'Show less' },
} as const satisfies Record<string, { ko: string; en: string }>;

export type TranslationKey = keyof typeof dictionary;

/**
 * 키 → 현재 언어 문자열 변환.
 * 사전에 없으면 키 자체를 반환 (개발 중 빠진 번역 식별 용이).
 * `params` 가 있으면 `{name}` 같은 placeholder 를 치환한다.
 */
export function translate(
  key: string,
  lang: Lang,
  params?: Record<string, string | number>,
): string {
  const entry = (dictionary as Record<string, { ko: string; en: string }>)[key];
  let text = entry ? entry[lang] : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
